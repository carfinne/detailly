import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderTime } from '../zeiterfassung/entities/order-time.entity';
import { OrderMaterial } from '../order-material/entities/order-material.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../shop/entities/product.entity';
import {
  BerlinYMD,
  berlinMonatsGrenzen,
  berlinYMDvonInstant,
} from '../kassenbuch/kassenbuch-zeit';

export interface Wirtschaftlichkeit {
  netto: number;
  lohnkosten: number;
  materialkosten: number;
  marge: number;
  margeProzent: number | null;
  /** Auf diesen Auftrag gebuchte Arbeitszeit (Summe OrderTime.minuten). */
  gebuchteMinuten: number;
  /** Dieselbe Zeit in Stunden (Anzeige). */
  gebuchteStunden: number;
  /**
   * "Was bringt die Stunde": Deckungsbeitrag je geleisteter Arbeitsstunde
   * (marge / gebuchteStunden). null bei 0 Stunden – KEINE Division durch Null,
   * kein irrefuehrender 0- oder Unendlich-Wert.
   */
  deckungsbeitragProStunde: number | null;
  /** Brutto-Sicht daneben: Umsatz je Stunde (netto / Stunden). null bei 0 h. */
  umsatzProStunde: number | null;
}

/**
 * Betriebs-Durchschnitt eines Monats: "lohnt sich unsere Arbeit insgesamt?".
 * Aggregiert ueber alle Auftraege des Monats MIT gebuchter Zeit. Der Monat wird
 * ueber Auftrags-createdAt (Europe/Berlin) gefenstert – jeder Auftrag genau
 * einmal, jede Stunde/jedes Netto genau einmal (keine Monats-Doppelzaehlung).
 */
export interface BetriebsUebersicht {
  /** Gefensterter Monat als 'YYYY-MM'. */
  zeitraum: string;
  /** Monatsgrenzen (UTC-Instants) – Berliner Wanduhr-Monat. */
  von: string;
  bis: string;
  /** Anzahl Auftraege des Monats MIT gebuchter Zeit. */
  anzahlAuftraege: number;
  netto: number;
  lohnkosten: number;
  materialkosten: number;
  marge: number;
  gebuchteStunden: number;
  /** Durchschnittlicher Deckungsbeitrag je Stunde des Betriebs. null bei 0 h. */
  deckungsbeitragProStunde: number | null;
  /** Durchschnittlicher Umsatz je Stunde des Betriebs. null bei 0 h. */
  umsatzProStunde: number | null;
}

/**
 * Deckungsbeitrag je Auftrag: Netto-Auftragswert minus direkte Kosten
 * (Lohn = erfasste Stunden * Stundenlohn; Material = verbrauchte Menge *
 * Einkaufspreis). Sensible BWL-Zahl -> Controller ist Leitung-only.
 * Tenant-getrennt.
 */
@Injectable()
export class ProfitabilityService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderTime) private readonly timeRepo: Repository<OrderTime>,
    @InjectRepository(OrderMaterial) private readonly materialRepo: Repository<OrderMaterial>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  async forOrder(tenantId: string, orderId: string): Promise<Wirtschaftlichkeit> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, tenantId },
      select: ['id', 'nettoSumme'],
    });
    if (!order) throw new NotFoundException('Auftrag nicht gefunden');
    const netto = round2(Number(order.nettoSumme || 0));

    const [zeiten, materialien] = await Promise.all([
      this.timeRepo.find({ where: { tenantId, orderId }, select: ['userId', 'minuten'] }),
      this.materialRepo.find({ where: { tenantId, orderId }, select: ['productId', 'menge'] }),
    ]);

    // Lohnkosten = Summe(Stunden * Stundenlohn).
    const userIds = [...new Set(zeiten.map((z) => z.userId))];
    const users = userIds.length
      ? await this.userRepo.find({ where: { id: In(userIds), tenantId }, select: ['id', 'stundenlohn'] })
      : [];
    const lohnById = new Map(users.map((u) => [u.id, Number(u.stundenlohn ?? 0)]));
    const lohnkosten = round2(
      zeiten.reduce((s, z) => s + (Number(z.minuten) / 60) * (lohnById.get(z.userId) ?? 0), 0),
    );

    // Materialkosten = Summe(Menge * Einkaufspreis des aktuellen Produkts).
    const prodIds = [...new Set(materialien.map((m) => m.productId))];
    const products = prodIds.length
      ? await this.productRepo.find({ where: { id: In(prodIds), tenantId }, select: ['id', 'einkaufspreis'] })
      : [];
    const ekById = new Map(products.map((p) => [p.id, Number(p.einkaufspreis ?? 0)]));
    const materialkosten = round2(
      materialien.reduce((s, m) => s + Number(m.menge) * (ekById.get(m.productId) ?? 0), 0),
    );

    const marge = round2(netto - lohnkosten - materialkosten);
    const margeProzent = netto > 0 ? Math.round((marge / netto) * 1000) / 10 : null;

    // "Was bringt die Stunde": Deckungsbeitrag je geleisteter Arbeitsstunde. Auf
    // Minuten-Basis rechnen (kein Rundungsverlust ueber die Stundenzahl); bei 0
    // gebuchten Minuten null statt Division durch Null.
    const gebuchteMinuten = zeiten.reduce((s, z) => s + Number(z.minuten || 0), 0);
    const gebuchteStunden = round2(gebuchteMinuten / 60);
    const deckungsbeitragProStunde =
      gebuchteMinuten > 0 ? round2(marge / (gebuchteMinuten / 60)) : null;
    const umsatzProStunde = gebuchteMinuten > 0 ? round2(netto / (gebuchteMinuten / 60)) : null;

    return {
      netto,
      lohnkosten,
      materialkosten,
      marge,
      margeProzent,
      gebuchteMinuten,
      gebuchteStunden,
      deckungsbeitragProStunde,
      umsatzProStunde,
    };
  }

  /**
   * Betriebs-Durchschnitt: Deckungsbeitrag je Stunde ueber alle Auftraege eines
   * Monats MIT gebuchter Zeit. KONSTANTE Query-Anzahl (kein N+1): eine
   * Gruppen-Aggregation ueber OrderTime + zwei skalare Summen (Netto/Material)
   * fuer die qualifizierenden Auftraege – unabhaengig von der Auftrags-Anzahl.
   */
  async betriebsUebersicht(tenantId: string, zeitraum?: string): Promise<BetriebsUebersicht> {
    const ymd = parseMonat(zeitraum);
    const { von, bis } = berlinMonatsGrenzen(ymd);
    const zeitraumStr = `${ymd.y}-${String(ymd.m).padStart(2, '0')}`;

    // (1) Zeit + Lohn je Auftrag, gefenstert auf im Monat angelegte Auftraege mit
    // Zeit. INNER JOIN Order -> nur Auftraege dieses Monats; LEFT JOIN User ->
    // fehlender/geloeschter Mitarbeiter zaehlt die Minuten weiter, kostet aber 0
    // Lohn (konsistent zur Pro-Auftrag-Logik). GROUP BY orderId = ein Datensatz
    // je Auftrag, keine Schleife.
    const zeitRows = await this.timeRepo
      .createQueryBuilder('ot')
      .innerJoin(Order, 'o', 'o.id = ot.orderId AND o.tenantId = ot.tenantId')
      .leftJoin(User, 'u', 'u.id = ot.userId AND u.tenantId = ot.tenantId')
      .select('ot.orderId', 'orderId')
      .addSelect('COALESCE(SUM(ot.minuten), 0)', 'minuten')
      .addSelect('COALESCE(SUM(ot.minuten * u.stundenlohn), 0)', 'lohnGewichtet')
      .where('ot.tenantId = :tenantId AND o.createdAt BETWEEN :von AND :bis', { tenantId, von, bis })
      .groupBy('ot.orderId')
      .getRawMany<{ orderId: string; minuten: string; lohnGewichtet: string }>();

    const orderIds = zeitRows.map((r) => r.orderId);
    const gebuchteMinuten = zeitRows.reduce((s, r) => s + Number(r.minuten || 0), 0);
    const lohnkosten = round2(zeitRows.reduce((s, r) => s + Number(r.lohnGewichtet || 0), 0) / 60);

    // (2)+(3) Netto und Material NUR fuer die qualifizierenden Auftraege (parallel).
    // Ohne solche Auftraege bleibt alles 0 -> keine IN-()-Query mit leerer Liste.
    const [nettoRow, materialRow] = orderIds.length
      ? await Promise.all([
          this.orderRepo
            .createQueryBuilder('o')
            .select('COALESCE(SUM(o.nettoSumme), 0)', 'netto')
            .where('o.tenantId = :tenantId AND o.id IN (:...ids)', { tenantId, ids: orderIds })
            .getRawOne<{ netto: string }>(),
          this.materialRepo
            .createQueryBuilder('om')
            .leftJoin(Product, 'p', 'p.id = om.productId AND p.tenantId = om.tenantId')
            .select('COALESCE(SUM(om.menge * p.einkaufspreis), 0)', 'material')
            .where('om.tenantId = :tenantId AND om.orderId IN (:...ids)', { tenantId, ids: orderIds })
            .getRawOne<{ material: string }>(),
        ])
      : [null, null];

    const netto = round2(Number(nettoRow?.netto ?? 0));
    const materialkosten = round2(Number(materialRow?.material ?? 0));
    const marge = round2(netto - lohnkosten - materialkosten);
    const gebuchteStunden = round2(gebuchteMinuten / 60);
    const deckungsbeitragProStunde =
      gebuchteMinuten > 0 ? round2(marge / (gebuchteMinuten / 60)) : null;
    const umsatzProStunde = gebuchteMinuten > 0 ? round2(netto / (gebuchteMinuten / 60)) : null;

    return {
      zeitraum: zeitraumStr,
      von: von.toISOString(),
      bis: bis.toISOString(),
      anzahlAuftraege: orderIds.length,
      netto,
      lohnkosten,
      materialkosten,
      marge,
      gebuchteStunden,
      deckungsbeitragProStunde,
      umsatzProStunde,
    };
  }
}

/** 'YYYY-MM' -> Berliner Monatsanker; ungueltig/leer -> laufender Berliner Monat. */
function parseMonat(zeitraum?: string): BerlinYMD {
  const match = /^(\d{4})-(\d{2})$/.exec((zeitraum ?? '').trim());
  if (match) {
    const y = +match[1];
    const m = +match[2];
    if (m >= 1 && m <= 12) return { y, m, day: 1 };
  }
  const now = berlinYMDvonInstant(new Date());
  return { y: now.y, m: now.m, day: 1 };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
