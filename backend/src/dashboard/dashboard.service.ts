import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { AngebotStatus, Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { Product } from '../shop/entities/product.entity';
import { UserRole } from '../users/entities/user.entity';

// Offene (= aktive, nicht abgeschlossene) Auftragsstatus.
const OFFENE_STATUS = [
  OrderStatus.ANGEFRAGT,
  OrderStatus.KALKULIERT,
  OrderStatus.BESTAETIGT,
  OrderStatus.IN_ARBEIT,
  OrderStatus.QUALITAETSKONTROLLE,
];

/**
 * Rollen mit kaufmaennischer Verantwortung: duerfen die Betriebs-Geldkennzahlen
 * (Umsatz, 6-Monats-Trend, umsatzstaerkste Leistungen, offene Angebote) sehen.
 * Bewusstes Gegenstueck zu LEITUNG_ROLLEN im Frontend (lib/rollen.ts) und zur
 * bestehenden Controller-Konvention `@Roles(UserRole.MANAGER, UserRole.OWNER)`
 * (z. B. reports/profitability/appointments-umsatz). platform_admin ist ergaenzt,
 * weil er per RolesGuard ohnehin ueberall durchgelassen wird.
 */
const GELD_ROLLEN: string[] = [UserRole.OWNER, UserRole.MANAGER, UserRole.PLATFORM_ADMIN];

/**
 * Offene Forderungen (Debitoren) darf zusaetzlich die Rezeption sehen: sie stellt
 * Rechnungen und markiert sie als bezahlt — die offenen Posten sind ihre
 * Arbeitsliste. Umsatz/Trend/Top-Leistungen/Angebote bleiben ihr aber verborgen.
 */
const OFFENE_POSTEN_ROLLEN: string[] = [...GELD_ROLLEN, UserRole.RECEPTIONIST];

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Appointment) private readonly apptRepo: Repository<Appointment>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  /**
   * Produkte unter Mindestbestand (proaktiver Nachbestell-Hinweis). Nur aktive
   * Produkte MIT gesetztem Mindestbestand (>0); knappste zuerst. Liefert Anzahl
   * gesamt + die Top-Liste fuers Dashboard-Widget.
   */
  async niedrigerBestand(tenantId: string): Promise<{
    anzahl: number;
    produkte: { name: string; bestand: number; mindestbestand: number; einheit: string }[];
  }> {
    const [rows, anzahl] = await this.productRepo
      .createQueryBuilder('p')
      .where(
        'p.tenantId = :tenantId AND p.aktiv = :aktiv AND p.mindestbestand > 0 AND p.bestand <= p.mindestbestand',
        { tenantId, aktiv: true },
      )
      .orderBy('p.bestand - p.mindestbestand', 'ASC')
      .take(6)
      .getManyAndCount();
    return {
      anzahl,
      produkte: rows.map((p) => ({
        name: p.name,
        bestand: Number(p.bestand),
        mindestbestand: Number(p.mindestbestand),
        einheit: p.einheit,
      })),
    };
  }

  /**
   * Dashboard-Kennzahlen — rollenabhaengig. Die Antwortstruktur richtet sich nach
   * der `role` des Anfragenden: Geld-Kennzahlen werden fuer Rollen OHNE
   * kaufmaennische Verantwortung GAR NICHT ERST berechnet und NICHT ausgeliefert
   * (nicht nur im UI ausgeblendet — sonst waeren sie ueber die API weiter
   * abrufbar). Drei Stufen:
   *  - Technician: nur operative Basis-Kennzahlen (offene Auftraege/Termine/
   *    Bestand/Kunden), KEINE Rechnungs-/Umsatz-Query.
   *  - Receptionist: zusaetzlich die offenen Forderungen (Debitoren-Arbeitsliste),
   *    aber KEIN Umsatz/Trend/Top-Leistungen/Angebote.
   *  - Leitung (OWNER/MANAGER/platform_admin): alle Kennzahlen wie bisher.
   */
  async stats(tenantId: string, role: string) {
    const darfGeld = GELD_ROLLEN.includes(role);
    const darfOffenePosten = OFFENE_POSTEN_ROLLEN.includes(role);

    const now = new Date();
    const heuteStart = new Date(now);
    heuteStart.setHours(0, 0, 0, 0);
    const heuteEnde = new Date(now);
    heuteEnde.setHours(23, 59, 59, 999);
    const in7Tagen = new Date(now);
    in7Tagen.setDate(in7Tagen.getDate() + 7);

    // --- Operative Basis-Kennzahlen: fuer JEDE Rolle (enthalten kein Geld). ---
    // DB-Aggregate (COUNT) statt ganze Tabellen laden; nur die kleinen Widget-
    // Listen (take 6/8) laden echte Zeilen.
    const [
      offeneAuftraege,
      termineHeuteCount,
      kundenGesamt,
      offeneAuftragsListe,
      kommendeTermineRaw,
      termineHeuteRaw,
      niedrigerBestand,
    ] = await Promise.all([
      this.orderRepo.count({ where: { tenantId, status: In(OFFENE_STATUS) } }),
      this.apptRepo.count({ where: { tenantId, start: Between(heuteStart, heuteEnde) } }),
      this.customerRepo.count({ where: { tenantId, isActive: true } }),
      // Widget: offene Auftraege (klein). KEINE items-Relation (von decorateOrder
      // nicht genutzt) -> kein zusaetzlicher Join.
      this.orderRepo.find({
        where: { tenantId, status: In(OFFENE_STATUS) },
        order: { createdAt: 'DESC' },
        take: 8,
      }),
      this.apptRepo.find({
        where: { tenantId, start: Between(now, in7Tagen) },
        order: { start: 'ASC' },
        take: 6,
      }),
      this.apptRepo.find({
        where: { tenantId, start: Between(heuteStart, heuteEnde) },
        order: { start: 'ASC' },
      }),
      this.niedrigerBestand(tenantId),
    ]);

    // --- Namen fuer Widgets nachladen (keine ORM-Relationen vorhanden) ---
    const custIds = unique([
      ...offeneAuftragsListe.map((o) => o.customerId),
      ...kommendeTermineRaw.map((a) => a.customerId),
      ...termineHeuteRaw.map((a) => a.customerId),
    ]);
    const vehIds = unique([
      ...offeneAuftragsListe.map((o) => o.vehicleId),
      ...kommendeTermineRaw.map((a) => a.vehicleId),
      ...termineHeuteRaw.map((a) => a.vehicleId),
    ]);
    const custMap = await this.nameMap(this.customerRepo, custIds, tenantId, (c: Customer) =>
      [c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName || 'Kunde',
    );
    const vehMap = await this.nameMap(this.vehicleRepo, vehIds, tenantId, (v: Vehicle) =>
      [v.make, v.model].filter(Boolean).join(' ') || v.licensePlate || 'Fahrzeug',
    );

    const decorateOrder = (o: Order) => ({
      id: o.id,
      auftragsnummer: o.auftragsnummer,
      status: o.status,
      art: o.serviceType,
      // gesamtpreis = Wert DIESES Auftrags (operativ, wie in /auftraege sichtbar) —
      // bewusst KEINE Betriebs-Geschaeftszahl und daher fuer jede Rolle enthalten.
      gesamtpreis: Number(o.gesamtpreis),
      kunde: custMap.get(o.customerId) ?? '—',
      fahrzeug: o.vehicleId ? vehMap.get(o.vehicleId) ?? '—' : '—',
      geplanterStart: o.geplanterStart,
    });
    const decorateAppt = (a: Appointment) => ({
      id: a.id,
      titel: a.titel ?? 'Termin',
      start: a.start,
      kunde: a.customerId ? custMap.get(a.customerId) ?? '—' : '—',
      fahrzeug: a.vehicleId ? vehMap.get(a.vehicleId) ?? '—' : '—',
    });

    const base = {
      offeneAuftraege,
      termineHeute: termineHeuteCount,
      kundenGesamt,
      offeneAuftragsListe: offeneAuftragsListe.map(decorateOrder),
      kommendeTermine: kommendeTermineRaw.map(decorateAppt),
      termineHeuteListe: termineHeuteRaw.map(decorateAppt),
      niedrigerBestand,
    };

    // --- Rollen ohne jegliches Geld-Recht (Technician): hier ist Schluss. ---
    // Es wird KEINE Rechnungs-/Umsatz-Query abgesetzt -> die Zahlen entstehen gar
    // nicht erst und fehlen im Response-Objekt vollstaendig.
    if (!darfOffenePosten) return base;

    // --- Offene Forderungen (Leitung + Rezeption). ---
    const offeneAgg = await this.offeneRechnungenAgg(tenantId);
    const mitOffenePosten = {
      ...base,
      offeneRechnungenSumme: round2(offeneAgg.summe),
      offeneRechnungenAnzahl: offeneAgg.anzahl,
    };

    // --- Rezeption: offene Posten ja, Umsatz/Trend/Top/Angebote NEIN. ---
    if (!darfGeld) return mitOffenePosten;

    // --- Leitung: volle Geld-Kennzahlen. ---
    // 6 Monatsfenster (aelteste -> aktuell) fuer den Umsatztrend.
    const monate: { label: string; start: Date; ende: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ende = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      monate.push({ label: start.toLocaleDateString('de-DE', { month: 'short' }), start, ende });
    }
    const [umsatzBezahlt, angeboteAgg, topLeistungen, ...trendSummen] = await Promise.all([
      this.bruttoSumme(tenantId, InvoiceStatus.BEZAHLT),
      this.offeneAngeboteAgg(tenantId),
      this.topLeistungen(tenantId),
      ...monate.map((m) => this.bruttoSumme(tenantId, InvoiceStatus.BEZAHLT, m.start, m.ende)),
    ]);

    const umsatzTrend = monate.map((m, i) => ({ label: m.label, umsatz: round2(trendSummen[i]) }));
    const umsatzMonat = trendSummen[trendSummen.length - 1] ?? 0;
    const umsatzVormonat = trendSummen[trendSummen.length - 2] ?? 0;
    const umsatzDeltaProzent =
      umsatzVormonat > 0
        ? Math.round(((umsatzMonat - umsatzVormonat) / umsatzVormonat) * 1000) / 10
        : null;

    return {
      ...mitOffenePosten,
      umsatzBezahlt: round2(umsatzBezahlt),
      umsatzMonat: round2(umsatzMonat),
      umsatzVormonat: round2(umsatzVormonat),
      umsatzDeltaProzent,
      offeneAngeboteSumme: round2(angeboteAgg.summe),
      offeneAngeboteAnzahl: angeboteAgg.anzahl,
      umsatzTrend,
      topLeistungen,
    };
  }

  /** SUM(brutto) bezahlter/offener Rechnungen, optional auf ein Datumsfenster. */
  private async bruttoSumme(
    tenantId: string,
    status: InvoiceStatus,
    von?: Date,
    bis?: Date,
  ): Promise<number> {
    const qb = this.invoiceRepo
      .createQueryBuilder('i')
      .select('COALESCE(SUM(i.brutto), 0)', 'summe')
      .where('i.tenantId = :tenantId AND i.art = :art AND i.status = :status', {
        tenantId,
        art: InvoiceKind.RECHNUNG,
        status,
      });
    if (von) qb.andWhere('i.createdAt >= :von', { von });
    if (bis) qb.andWhere('i.createdAt <= :bis', { bis });
    const r = await qb.getRawOne<{ summe: string }>();
    return Number(r?.summe ?? 0);
  }

  /** Summe + Anzahl offener Rechnungen in EINER Aggregat-Abfrage. */
  private async offeneRechnungenAgg(tenantId: string): Promise<{ summe: number; anzahl: number }> {
    const r = await this.invoiceRepo
      .createQueryBuilder('i')
      .select('COALESCE(SUM(i.brutto), 0)', 'summe')
      .addSelect('COUNT(*)', 'anzahl')
      .where('i.tenantId = :tenantId AND i.art = :art AND i.status = :status', {
        tenantId,
        art: InvoiceKind.RECHNUNG,
        status: InvoiceStatus.OFFEN,
      })
      .getRawOne<{ summe: string; anzahl: string }>();
    return { summe: Number(r?.summe ?? 0), anzahl: Number(r?.anzahl ?? 0) };
  }

  /**
   * Summe + Anzahl OFFENER Angebote (motivierende Verkaufszahl fuers Dashboard) in
   * EINER Aggregat-Abfrage – analog offeneRechnungenAgg, kein N+1. "Offen" heisst:
   * noch nicht angenommen/abgelehnt/abgelaufen und nicht storniert. Konkret:
   *  - art = ANGEBOT (nur Angebote, keine Rechnungen),
   *  - status != STORNIERT (ein stornierter Beleg zaehlt nie als offen),
   *  - angebotStatus = OFFEN ODER NULL (NULL = Altbestand-Angebote vor Welle 1,
   *    laut Entity-Kommentar wie 'offen' zu behandeln — TypeORM-null-Falle: als
   *    RAW `IS NULL`, nicht `= null`),
   *  - gueltigBis in der Zukunft ODER NULL (abgelaufene Angebote sind nicht mehr
   *    offen; Datumsvergleich in der DB, gleiche Semantik wie die Belegliste).
   * Leere Menge -> COALESCE/COUNT liefern 0 statt NULL (kein Crash). Tenant-scoped.
   */
  private async offeneAngeboteAgg(tenantId: string): Promise<{ summe: number; anzahl: number }> {
    const r = await this.invoiceRepo
      .createQueryBuilder('i')
      .select('COALESCE(SUM(i.brutto), 0)', 'summe')
      .addSelect('COUNT(*)', 'anzahl')
      .where('i.tenantId = :tenantId AND i.art = :art', { tenantId, art: InvoiceKind.ANGEBOT })
      .andWhere('i.status != :storniert', { storniert: InvoiceStatus.STORNIERT })
      .andWhere('(i.angebotStatus = :offen OR i.angebotStatus IS NULL)', {
        offen: AngebotStatus.OFFEN,
      })
      .andWhere('(i.gueltigBis IS NULL OR i.gueltigBis >= :now)', { now: new Date() })
      .getRawOne<{ summe: string; anzahl: string }>();
    return { summe: Number(r?.summe ?? 0), anzahl: Number(r?.anzahl ?? 0) };
  }

  /** Top-5 Leistungen nach Umsatz – GROUP BY in der DB statt alle Auftraege laden. */
  private async topLeistungen(
    tenantId: string,
  ): Promise<{ name: string; umsatz: number; anzahl: number }[]> {
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .innerJoin('o.items', 'oi')
      .select('oi.beschreibung', 'name')
      .addSelect('COALESCE(SUM(oi.gesamtpreis), 0)', 'umsatz')
      .addSelect('COALESCE(SUM(oi.menge), 0)', 'anzahl')
      .where('o.tenantId = :tenantId', { tenantId })
      .groupBy('oi.beschreibung')
      .orderBy('umsatz', 'DESC')
      .limit(5)
      .getRawMany<{ name: string; umsatz: string; anzahl: string }>();
    return rows.map((r) => ({
      name: r.name ?? 'Sonstiges',
      umsatz: round2(Number(r.umsatz)),
      anzahl: Number(r.anzahl),
    }));
  }

  // Hilfsfunktion: ID -> Anzeigename, mandantengetrennt ueber tenantId-Filter.
  private async nameMap<T extends { id: string }>(
    repo: Repository<T>,
    ids: string[],
    tenantId: string,
    label: (e: T) => string,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.length === 0) return map;
    const rows = await repo.find({ where: { id: In(ids), tenantId } as any });
    for (const r of rows) map.set(r.id, label(r));
    return map;
  }
}

// --- reine Hilfsfunktionen ---
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function unique(arr: (string | undefined | null)[]): string[] {
  return [...new Set(arr.filter((x): x is string => !!x))];
}
