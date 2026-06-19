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

    const monatStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const vormonatStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const vormonatEnde = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const in7Tagen = new Date(now);
    in7Tagen.setDate(in7Tagen.getDate() + 7);

    const [
      offeneAuftraege,
      termineHeuteCount,
      kundenGesamt,
      offeneAuftragsListe,
      bezahlteRechnungen,
      offeneRechnungen,
      kommendeTermineRaw,
      termineHeuteRaw,
      alleOrdersFuerTop,
    ] = await Promise.all([
      this.orderRepo.count({ where: { tenantId, status: In(OFFENE_STATUS) } }),
      this.apptRepo.count({ where: { tenantId, start: Between(heuteStart, heuteEnde) } }),
      this.customerRepo.count({ where: { tenantId, isActive: true } }),
      this.orderRepo.find({
        where: { tenantId, status: In(OFFENE_STATUS) },
        relations: ['items'],
        order: { createdAt: 'DESC' },
        take: 8,
      }),
      this.invoiceRepo.find({
        where: { tenantId, art: InvoiceKind.RECHNUNG, status: InvoiceStatus.BEZAHLT },
      }),
      this.invoiceRepo.find({
        where: { tenantId, art: InvoiceKind.RECHNUNG, status: InvoiceStatus.OFFEN },
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
      this.orderRepo.find({ where: { tenantId }, relations: ['items'] }),
    ]);

    // --- Umsatzkennzahlen ---
    const umsatzBezahlt = sum(bezahlteRechnungen.map((r) => Number(r.brutto)));
    const umsatzMonat = sum(
      bezahlteRechnungen
        .filter((r) => new Date(r.createdAt) >= monatStart)
        .map((r) => Number(r.brutto)),
    );
    const umsatzVormonat = sum(
      bezahlteRechnungen
        .filter((r) => {
          const d = new Date(r.createdAt);
          return d >= vormonatStart && d <= vormonatEnde;
        })
        .map((r) => Number(r.brutto)),
    );
    const umsatzDeltaProzent =
      umsatzVormonat > 0
        ? Math.round(((umsatzMonat - umsatzVormonat) / umsatzVormonat) * 1000) / 10
        : null;

    const offeneRechnungenSumme = sum(offeneRechnungen.map((r) => Number(r.brutto)));

    // --- 6-Monats-Umsatztrend ---
    const umsatzTrend = buildMonthlyTrend(bezahlteRechnungen, now, 6);

    // --- Top-Leistungen nach Umsatz ---
    const topLeistungen = topServices(alleOrdersFuerTop);

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
    const custMap = await this.nameMap(this.customerRepo, custIds, (c: Customer) =>
      [c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName || 'Kunde',
    );
    const vehMap = await this.nameMap(this.vehicleRepo, vehIds, (v: Vehicle) =>
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
      offeneRechnungenSumme: round2(offeneRechnungenSumme),
      offeneRechnungenAnzahl: offeneRechnungen.length,
      offeneAuftragsListe: offeneAuftragsListe.map(decorateOrder),
      kommendeTermine: kommendeTermineRaw.map(decorateAppt),
      termineHeuteListe: termineHeuteRaw.map(decorateAppt),
      umsatzTrend,
      topLeistungen,
    };
  }

  // Hilfsfunktion: ID -> Anzeigename, tenant-sicher ueber die uebergebenen IDs.
  private async nameMap<T extends { id: string }>(
    repo: Repository<T>,
    ids: string[],
    label: (e: T) => string,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.length === 0) return map;
    const rows = await repo.find({ where: { id: In(ids) } as any });
    for (const r of rows) map.set(r.id, label(r));
    return map;
  }
}

// --- reine Hilfsfunktionen ---
function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function unique(arr: (string | undefined | null)[]): string[] {
  return [...new Set(arr.filter((x): x is string => !!x))];
}

function buildMonthlyTrend(rechnungen: Invoice[], now: Date, months: number) {
  const buckets: { label: string; jahr: number; monat: number; umsatz: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      label: d.toLocaleDateString('de-DE', { month: 'short' }),
      jahr: d.getFullYear(),
      monat: d.getMonth(),
      umsatz: 0,
    });
  }
  for (const r of rechnungen) {
    const d = new Date(r.createdAt);
    const b = buckets.find((x) => x.jahr === d.getFullYear() && x.monat === d.getMonth());
    if (b) b.umsatz += Number(r.brutto);
  }
  return buckets.map((b) => ({ label: b.label, umsatz: round2(b.umsatz) }));
}

function topServices(orders: Order[]) {
  const map = new Map<string, { name: string; umsatz: number; anzahl: number }>();
  for (const o of orders) {
    for (const it of o.items ?? []) {
      const key = it.beschreibung ?? 'Sonstiges';
      const cur = map.get(key) ?? { name: key, umsatz: 0, anzahl: 0 };
      cur.umsatz += Number(it.gesamtpreis ?? 0);
      cur.anzahl += Number(it.menge ?? 1);
      map.set(key, cur);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.umsatz - a.umsatz)
    .slice(0, 5)
    .map((x) => ({ name: x.name, umsatz: round2(x.umsatz), anzahl: x.anzahl }));
}
