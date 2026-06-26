import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';

// Offene (= aktive, nicht abgeschlossene) Auftragsstatus.
const OFFENE_STATUS = [
  OrderStatus.ANGEFRAGT,
  OrderStatus.KALKULIERT,
  OrderStatus.BESTAETIGT,
  OrderStatus.IN_ARBEIT,
  OrderStatus.QUALITAETSKONTROLLE,
];

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Appointment) private readonly apptRepo: Repository<Appointment>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async stats(tenantId: string) {
    const now = new Date();
    const heuteStart = new Date(now);
    heuteStart.setHours(0, 0, 0, 0);
    const heuteEnde = new Date(now);
    heuteEnde.setHours(23, 59, 59, 999);
    const in7Tagen = new Date(now);
    in7Tagen.setDate(in7Tagen.getDate() + 7);

    // 6 Monatsfenster (aelteste -> aktuell) fuer den Umsatztrend.
    const monate: { label: string; start: Date; ende: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ende = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      monate.push({ label: start.toLocaleDateString('de-DE', { month: 'short' }), start, ende });
    }

    // ALLE Kennzahlen als DB-Aggregate (SUM/COUNT/GROUP BY) statt ganze Tabellen
    // in den App-Speicher zu laden + pro Zeile zu entschluesseln. Nur die kleinen
    // Widget-Listen (take 6/8) laden echte Zeilen.
    const [
      offeneAuftraege,
      termineHeuteCount,
      kundenGesamt,
      offeneAuftragsListe,
      kommendeTermineRaw,
      termineHeuteRaw,
      umsatzBezahlt,
      offeneAgg,
      topLeistungen,
      ...trendSummen
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
      this.bruttoSumme(tenantId, InvoiceStatus.BEZAHLT),
      this.offeneRechnungenAgg(tenantId),
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

    return {
      offeneAuftraege,
      termineHeute: termineHeuteCount,
      kundenGesamt,
      umsatzBezahlt: round2(umsatzBezahlt),
      umsatzMonat: round2(umsatzMonat),
      umsatzVormonat: round2(umsatzVormonat),
      umsatzDeltaProzent,
      offeneRechnungenSumme: round2(offeneAgg.summe),
      offeneRechnungenAnzahl: offeneAgg.anzahl,
      offeneAuftragsListe: offeneAuftragsListe.map(decorateOrder),
      kommendeTermine: kommendeTermineRaw.map(decorateAppt),
      termineHeuteListe: termineHeuteRaw.map(decorateAppt),
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
