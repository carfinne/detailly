import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In, Between } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderItemType } from '../orders/entities/order-item.entity';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { Customer } from '../customers/entities/customer.entity';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

// Abgeschlossene (= erledigte) Auftraege: nur diese zaehlen fuer die Mitarbeiter-
// Bestenliste (faire Leistungsmetrik). Fuer die reinen Meilenstein-Badges zaehlen
// dagegen ALLE nicht-stornierten Auftraege, damit auch junge Betriebe Fortschritt
// sehen (Motivation ab dem ersten Auftrag).
const ABGESCHLOSSEN_STATUS = [OrderStatus.FERTIG, OrderStatus.ABGERECHNET];

// Kanonische Schwellen je Meilenstein-Track (aufsteigend = Bronze..Platin bzw.
// die 6 Auftrags-/Umsatzstufen). Rein datengetrieben, KEINE Leistung hartkodiert.
export const SCHWELLEN: Record<string, number[]> = {
  auftraege: [10, 50, 100, 250, 500, 1000],
  umsatz: [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000],
  kunden: [10, 50, 100, 250, 500],
  aufbereitung: [10, 25, 50, 100],
  folierung: [10, 25, 50, 100],
  ppf: [10, 25, 50, 100],
  jubilaeum: [1, 3, 5, 10],
};

export interface BadgeTrack {
  key: string;
  wert: number;
  /** Index der hoechsten erreichten Stufe (-1 = noch keine). */
  stufeIndex: number;
  stufenAnzahl: number;
  /** Naechste Schwelle oder null, wenn die hoechste Stufe erreicht ist. */
  naechsteSchwelle: number | null;
  /** Fortschritt 0..100 zur naechsten Stufe (100, wenn Maximum erreicht). */
  fortschrittProzent: number;
  erreicht: boolean;
}

export interface AchievementsResponse {
  tracks: BadgeTrack[];
  leistungDesMonats: { name: string; anzahl: number; umsatz: number } | null;
  topKategorieMonat: { kategorie: string; anzahl: number } | null;
  betriebsalterTage: number;
}

export type LeaderboardZeitraum = 'monat' | 'jahr' | 'all';

export interface LeaderboardEntry {
  userId: string;
  name: string;
  aktiv: boolean;
  anzahlAuftraege: number;
  umsatz: number;
  rang: number;
}

export interface LeaderboardResponse {
  zeitraum: LeaderboardZeitraum;
  von: string | null;
  bis: string | null;
  eintraege: LeaderboardEntry[];
  nichtZugeordnet: { anzahlAuftraege: number; umsatz: number };
}

export interface WrappedResponse {
  jahr: number;
  betriebsname: string;
  anzahlAuftraege: number;
  umsatz: number;
  topLeistung: { name: string; anzahl: number } | null;
  topKategorie: string | null;
  /** Monatsindex 1–12 (Anzeige-Formatierung erfolgt sprachabhaengig im Frontend). */
  staerksterMonat: { monat: number; umsatz: number } | null;
  neueKunden: number;
}

/**
 * Berechnet einen einzelnen Meilenstein-Track (erreichte Stufe + Fortschritt zur
 * naechsten). Reine Funktion -> deterministisch testbar, keine DB.
 */
export function buildTrack(key: string, wert: number, schwellen: number[]): BadgeTrack {
  let stufeIndex = -1;
  for (let i = 0; i < schwellen.length; i++) {
    if (wert >= schwellen[i]) stufeIndex = i;
  }
  const naechsteSchwelle = stufeIndex < schwellen.length - 1 ? schwellen[stufeIndex + 1] : null;
  const fortschrittProzent = naechsteSchwelle
    ? Math.min(100, Math.round((wert / naechsteSchwelle) * 100))
    : 100;
  return {
    key,
    wert,
    stufeIndex,
    stufenAnzahl: schwellen.length,
    naechsteSchwelle,
    fortschrittProzent,
    erreicht: stufeIndex >= 0,
  };
}

/**
 * Gamification / Erfolge (Welle 1, strikt BETRIEBSINTERN). Reine Aggregation
 * bestehender Daten (COUNT/SUM/GROUP BY), jede Query hart nach tenantId
 * gefiltert. Kein neues Table, kein Cross-Tenant-Vergleich.
 */
@Injectable()
export class GamificationService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
  ) {}

  /** Meilenstein-Badges + „Leistung des Monats" (KERN, alle Betriebs-Rollen). */
  async achievements(tenantId: string): Promise<AchievementsResponse> {
    const now = new Date();
    const monatStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monatEnde = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [gesamtAuftraege, kundenAktiv, umsatzRow, kategorieRows, leistungRow, topKategRow, tenant] =
      await Promise.all([
        this.orderRepo.count({ where: { tenantId, status: Not(OrderStatus.STORNIERT) } }),
        this.customerRepo.count({ where: { tenantId, isActive: true } }),
        this.invoiceRepo
          .createQueryBuilder('i')
          .select('COALESCE(SUM(i.brutto), 0)', 'summe')
          .where('i.tenantId = :tenantId AND i.art = :art AND i.status = :status', {
            tenantId,
            art: InvoiceKind.RECHNUNG,
            status: InvoiceStatus.BEZAHLT,
          })
          .getRawOne<{ summe: string }>(),
        this.orderRepo
          .createQueryBuilder('o')
          .select('o.serviceType', 'serviceType')
          .addSelect('COUNT(*)', 'anzahl')
          .where('o.tenantId = :tenantId AND o.status != :storniert', {
            tenantId,
            storniert: OrderStatus.STORNIERT,
          })
          .groupBy('o.serviceType')
          .getRawMany<{ serviceType: string; anzahl: string }>(),
        this.orderRepo
          .createQueryBuilder('o')
          .innerJoin('o.items', 'oi')
          .select('oi.beschreibung', 'name')
          .addSelect('COALESCE(SUM(oi.menge), 0)', 'anzahl')
          .addSelect('COALESCE(SUM(oi.gesamtpreis), 0)', 'umsatz')
          .where(
            'o.tenantId = :tenantId AND oi.typ = :leistung AND o.status != :storniert AND o.createdAt BETWEEN :von AND :bis',
            {
              tenantId,
              leistung: OrderItemType.LEISTUNG,
              storniert: OrderStatus.STORNIERT,
              von: monatStart,
              bis: monatEnde,
            },
          )
          .groupBy('oi.beschreibung')
          .orderBy('anzahl', 'DESC')
          .limit(1)
          .getRawOne<{ name: string; anzahl: string; umsatz: string }>(),
        this.orderRepo
          .createQueryBuilder('o')
          .select('o.serviceType', 'kategorie')
          .addSelect('COUNT(*)', 'anzahl')
          .where('o.tenantId = :tenantId AND o.status != :storniert AND o.createdAt BETWEEN :von AND :bis', {
            tenantId,
            storniert: OrderStatus.STORNIERT,
            von: monatStart,
            bis: monatEnde,
          })
          .groupBy('o.serviceType')
          .orderBy('anzahl', 'DESC')
          .limit(1)
          .getRawOne<{ kategorie: string; anzahl: string }>(),
        this.tenantRepo.findOne({ where: { id: tenantId } }),
      ]);

    const umsatz = round2(Number(umsatzRow?.summe ?? 0));
    const kategMap = new Map(kategorieRows.map((r) => [r.serviceType, Number(r.anzahl)]));
    const created = tenant?.createdAt ? new Date(tenant.createdAt) : null;
    const betriebsalterTage = created
      ? Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86_400_000))
      : 0;
    const jahre = Math.floor(betriebsalterTage / 365.25);

    const tracks: BadgeTrack[] = [
      buildTrack('auftraege', gesamtAuftraege, SCHWELLEN.auftraege),
      buildTrack('umsatz', umsatz, SCHWELLEN.umsatz),
      buildTrack('kunden', kundenAktiv, SCHWELLEN.kunden),
      buildTrack('aufbereitung', kategMap.get('aufbereitung') ?? 0, SCHWELLEN.aufbereitung),
      buildTrack('folierung', kategMap.get('folierung') ?? 0, SCHWELLEN.folierung),
      buildTrack('ppf', kategMap.get('ppf') ?? 0, SCHWELLEN.ppf),
      buildTrack('jubilaeum', jahre, SCHWELLEN.jubilaeum),
    ];

    return {
      tracks,
      leistungDesMonats:
        leistungRow && leistungRow.name
          ? {
              name: leistungRow.name,
              anzahl: Number(leistungRow.anzahl),
              umsatz: round2(Number(leistungRow.umsatz)),
            }
          : null,
      topKategorieMonat: topKategRow?.kategorie
        ? { kategorie: topKategRow.kategorie, anzahl: Number(topKategRow.anzahl) }
        : null,
      betriebsalterTage,
    };
  }

  /**
   * Mitarbeiter-Bestenliste (BETRIEBSINTERN, nur Leitung – siehe Controller-Gate).
   * Abgeschlossene Auftraege je zugeordnetem Mitarbeiter, Rang nach Auftragszahl
   * (Tie-Break Umsatz). Nicht zugeordnete Auftraege werden separat ausgewiesen.
   */
  async leaderboard(tenantId: string, zeitraumRaw?: string): Promise<LeaderboardResponse> {
    const zeitraum: LeaderboardZeitraum = ['monat', 'jahr', 'all'].includes(zeitraumRaw ?? '')
      ? (zeitraumRaw as LeaderboardZeitraum)
      : 'monat';
    const now = new Date();
    let von: Date | null = null;
    let bis: Date | null = null;
    if (zeitraum === 'monat') {
      von = new Date(now.getFullYear(), now.getMonth(), 1);
      bis = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (zeitraum === 'jahr') {
      von = new Date(now.getFullYear(), 0, 1);
      bis = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .select('o.assignedUserId', 'userId')
      .addSelect('COUNT(*)', 'anzahl')
      .addSelect('COALESCE(SUM(o.gesamtpreis), 0)', 'umsatz')
      .where('o.tenantId = :tenantId AND o.status IN (:...status)', {
        tenantId,
        status: ABGESCHLOSSEN_STATUS,
      })
      .groupBy('o.assignedUserId');
    if (von && bis) qb.andWhere('o.createdAt BETWEEN :von AND :bis', { von, bis });
    const rows = await qb.getRawMany<{ userId: string | null; anzahl: string; umsatz: string }>();

    const nichtRow = rows.find((r) => !r.userId);
    const nichtZugeordnet = {
      anzahlAuftraege: Number(nichtRow?.anzahl ?? 0),
      umsatz: round2(Number(nichtRow?.umsatz ?? 0)),
    };

    const zugeordnet = rows.filter((r): r is { userId: string; anzahl: string; umsatz: string } =>
      Boolean(r.userId),
    );
    const ids = zugeordnet.map((r) => r.userId);
    const users = ids.length
      ? await this.userRepo.find({
          where: { id: In(ids), tenantId },
          select: ['id', 'firstName', 'lastName', 'isActive'],
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const eintraege: LeaderboardEntry[] = zugeordnet
      .map((r) => {
        const u = userMap.get(r.userId);
        const name = u
          ? [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Mitarbeiter'
          : 'Ehemaliger Mitarbeiter';
        return {
          userId: r.userId,
          name,
          aktiv: u?.isActive ?? false,
          anzahlAuftraege: Number(r.anzahl),
          umsatz: round2(Number(r.umsatz)),
        };
      })
      .sort((a, b) => b.anzahlAuftraege - a.anzahlAuftraege || b.umsatz - a.umsatz)
      .map((e, i) => ({ ...e, rang: i + 1 }));

    return {
      zeitraum,
      von: von ? von.toISOString() : null,
      bis: bis ? bis.toISOString() : null,
      eintraege,
      nichtZugeordnet,
    };
  }

  /** „Detailly Wrapped" – Jahres-Zusammenfassung aus EIGENEN Daten (KERN). */
  async wrapped(tenantId: string, jahr: number): Promise<WrappedResponse> {
    const jahrStart = new Date(jahr, 0, 1);
    const jahrEnde = new Date(jahr, 11, 31, 23, 59, 59, 999);
    // Monatsfenster (nur Datumsgrenzen – KEIN Label). Ein Monatsindex reicht:
    // die Anzeige-Formatierung des staerksten Monats macht das Frontend in der
    // aktiven UI-Sprache (sonst landet ein de-DE-Kuerzel auf der teilbaren Karte).
    const monate: { start: Date; ende: Date }[] = [];
    for (let m = 0; m < 12; m++) {
      monate.push({ start: new Date(jahr, m, 1), ende: new Date(jahr, m + 1, 0, 23, 59, 59, 999) });
    }

    // Bewusst 12 Monats-SUMs + 1 Jahres-SUM als Einzel-Aggregate statt EINEM
    // GROUP-BY-Monat: portables Monats-Gruppieren braeuchte dialektspezifische
    // Datumsfunktionen (SQLite strftime vs. Postgres EXTRACT) und wuerde die
    // Portabilitaetsregel verletzen. Die Abfragen laufen parallel (Promise.all).
    const [auftragCount, umsatz, topLeistungRow, topKategRow, neueKunden, tenant, ...monatsUmsaetze] =
      await Promise.all([
        this.orderRepo.count({
          where: { tenantId, status: Not(OrderStatus.STORNIERT), createdAt: Between(jahrStart, jahrEnde) },
        }),
        this.bruttoSummeWindow(tenantId, jahrStart, jahrEnde),
        this.orderRepo
          .createQueryBuilder('o')
          .innerJoin('o.items', 'oi')
          .select('oi.beschreibung', 'name')
          .addSelect('COALESCE(SUM(oi.menge), 0)', 'anzahl')
          .where(
            'o.tenantId = :tenantId AND oi.typ = :leistung AND o.status != :storniert AND o.createdAt BETWEEN :von AND :bis',
            {
              tenantId,
              leistung: OrderItemType.LEISTUNG,
              storniert: OrderStatus.STORNIERT,
              von: jahrStart,
              bis: jahrEnde,
            },
          )
          .groupBy('oi.beschreibung')
          .orderBy('anzahl', 'DESC')
          .limit(1)
          .getRawOne<{ name: string; anzahl: string }>(),
        this.orderRepo
          .createQueryBuilder('o')
          .select('o.serviceType', 'kategorie')
          .addSelect('COUNT(*)', 'anzahl')
          .where('o.tenantId = :tenantId AND o.status != :storniert AND o.createdAt BETWEEN :von AND :bis', {
            tenantId,
            storniert: OrderStatus.STORNIERT,
            von: jahrStart,
            bis: jahrEnde,
          })
          .groupBy('o.serviceType')
          .orderBy('anzahl', 'DESC')
          .limit(1)
          .getRawOne<{ kategorie: string; anzahl: string }>(),
        this.customerRepo.count({ where: { tenantId, createdAt: Between(jahrStart, jahrEnde) } }),
        this.tenantRepo.findOne({ where: { id: tenantId } }),
        ...monate.map((mo) => this.bruttoSummeWindow(tenantId, mo.start, mo.ende)),
      ]);

    // Staerkster Monat = hoechster bezahlter Umsatz; nur wenn > 0.
    let bestIdx = 0;
    for (let i = 1; i < monatsUmsaetze.length; i++) {
      if (monatsUmsaetze[i] > monatsUmsaetze[bestIdx]) bestIdx = i;
    }
    const staerksterMonat =
      monatsUmsaetze[bestIdx] > 0
        ? { monat: bestIdx + 1, umsatz: round2(monatsUmsaetze[bestIdx]) }
        : null;

    return {
      jahr,
      betriebsname: tenant?.name ?? 'Detailly',
      anzahlAuftraege: auftragCount,
      umsatz: round2(umsatz),
      topLeistung:
        topLeistungRow && topLeistungRow.name
          ? { name: topLeistungRow.name, anzahl: Number(topLeistungRow.anzahl) }
          : null,
      topKategorie: topKategRow?.kategorie ?? null,
      staerksterMonat,
      neueKunden,
    };
  }

  /** SUM(brutto) bezahlter Rechnungen in einem createdAt-Fenster (tenant-scoped). */
  private async bruttoSummeWindow(tenantId: string, von: Date, bis: Date): Promise<number> {
    const r = await this.invoiceRepo
      .createQueryBuilder('i')
      .select('COALESCE(SUM(i.brutto), 0)', 'summe')
      .where(
        'i.tenantId = :tenantId AND i.art = :art AND i.status = :status AND i.createdAt BETWEEN :von AND :bis',
        { tenantId, art: InvoiceKind.RECHNUNG, status: InvoiceStatus.BEZAHLT, von, bis },
      )
      .getRawOne<{ summe: string }>();
    return Number(r?.summe ?? 0);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
