import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { Plan } from '../subscriptions/entities/plan.entity';
import { Order } from '../orders/entities/order.entity';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';

export interface PlatformOverview {
  abos: { aktiv: number; testphase: number; gekuendigt: number; mrr: number; tarife: { name: string; anzahl: number }[] };
  wachstum: { betriebeGesamt: number; neuDiesenMonat: number; trend: { label: string; anzahl: number }[] };
  nutzung: { auftraege: number; rechnungen: number; umsatzGesamt: number };
  aktivitaet: { topBetriebe: { name: string; auftraege: number }[]; inaktivAnzahl: number; inaktivBetriebe: { name: string }[] };
}

/**
 * BETRIEBSUEBERGREIFENDE Plattform-Auswertung fuer Detailly. BEWUSST die EINZIGE
 * Stelle ohne Mandantenfilter – der Controller ist strikt auf Plattform-Rollen
 * begrenzt. Liefert nur Aggregate/Zahlen, keine Kundeninhalte.
 */
@Injectable()
export class PlatformAnalyticsService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async overview(): Promise<PlatformOverview> {
    const [abos, wachstum, nutzung, aktivitaet] = await Promise.all([
      this.aboUebersicht(),
      this.wachstum(),
      this.nutzung(),
      this.betriebsAktivitaet(),
    ]);
    return { abos, wachstum, nutzung, aktivitaet };
  }

  /** Abos & MRR (monatlich wiederkehrender Umsatz aus aktiven Abos). */
  async aboUebersicht() {
    const [aktiv, testphase, gekuendigt, mrrRow, tarifeRows] = await Promise.all([
      this.subRepo.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      this.subRepo.count({ where: { status: SubscriptionStatus.TRIAL } }),
      this.subRepo.count({ where: { status: SubscriptionStatus.CANCELED } }),
      this.subRepo
        .createQueryBuilder('s')
        .innerJoin(Plan, 'p', 'p.id = s.planId')
        .select('COALESCE(SUM(p.preisMonatlich), 0)', 'mrr')
        .where('s.status = :st', { st: SubscriptionStatus.ACTIVE })
        .getRawOne<{ mrr: string }>(),
      this.subRepo
        .createQueryBuilder('s')
        .innerJoin(Plan, 'p', 'p.id = s.planId')
        .select('p.name', 'name')
        .addSelect('COUNT(*)', 'anzahl')
        .where('s.status = :st', { st: SubscriptionStatus.ACTIVE })
        .groupBy('p.name')
        .orderBy('anzahl', 'DESC')
        .getRawMany<{ name: string; anzahl: string }>(),
    ]);
    return {
      aktiv,
      testphase,
      gekuendigt,
      mrr: round2(Number(mrrRow?.mrr ?? 0)),
      tarife: tarifeRows.map((t) => ({ name: t.name ?? '—', anzahl: Number(t.anzahl) })),
    };
  }

  /** Wachstum: Betriebe gesamt, neu diesen Monat, 6-Monats-Trend. */
  async wachstum() {
    const now = new Date();
    const monatStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monate: { label: string; start: Date; ende: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ende = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      monate.push({ label: start.toLocaleDateString('de-DE', { month: 'short' }), start, ende });
    }
    const [betriebeGesamt, neuDiesenMonat, ...trendCounts] = await Promise.all([
      this.tenantRepo.count(),
      this.tenantRepo.count({ where: { createdAt: MoreThanOrEqual(monatStart) } }),
      ...monate.map((m) => this.tenantRepo.count({ where: { createdAt: Between(m.start, m.ende) } })),
    ]);
    return {
      betriebeGesamt,
      neuDiesenMonat,
      trend: monate.map((m, i) => ({ label: m.label, anzahl: trendCounts[i] ?? 0 })),
    };
  }

  /** Nutzung gesamt ueber alle Betriebe. */
  async nutzung() {
    const [auftraege, rechnungen, umsatzRow] = await Promise.all([
      this.orderRepo.count(),
      this.invoiceRepo.count(),
      this.invoiceRepo
        .createQueryBuilder('i')
        .select('COALESCE(SUM(i.brutto), 0)', 'summe')
        .where('i.art = :art AND i.status = :s', { art: InvoiceKind.RECHNUNG, s: InvoiceStatus.BEZAHLT })
        .getRawOne<{ summe: string }>(),
    ]);
    return { auftraege, rechnungen, umsatzGesamt: round2(Number(umsatzRow?.summe ?? 0)) };
  }

  /** Aktivste Betriebe (nach Auftragszahl) + inaktive (keine Auftraege in 30 Tagen). */
  async betriebsAktivitaet() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const topRows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.tenantId', 'tenantId')
      .addSelect('COUNT(*)', 'anzahl')
      .groupBy('o.tenantId')
      .orderBy('anzahl', 'DESC')
      .limit(5)
      .getRawMany<{ tenantId: string; anzahl: string }>();

    // Betriebe MIT Auftrag in den letzten 30 Tagen (aktiv).
    const aktiveRows = await this.orderRepo
      .createQueryBuilder('o')
      .select('DISTINCT o.tenantId', 'tenantId')
      .where('o.createdAt >= :cutoff', { cutoff })
      .getRawMany<{ tenantId: string }>();
    const aktivIds = new Set(aktiveRows.map((r) => r.tenantId));

    const alleBetriebe = await this.tenantRepo.find({ select: ['id', 'name'] });
    const nameById = new Map(alleBetriebe.map((t) => [t.id, t.name]));
    const inaktiv = alleBetriebe.filter((t) => !aktivIds.has(t.id));

    return {
      topBetriebe: topRows.map((r) => ({ name: nameById.get(r.tenantId) ?? '—', auftraege: Number(r.anzahl) })),
      inaktivAnzahl: inaktiv.length,
      inaktivBetriebe: inaktiv.slice(0, 6).map((t) => ({ name: t.name })),
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
