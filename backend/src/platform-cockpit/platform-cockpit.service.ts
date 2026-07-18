import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';
import { Tenant, TenantStatus, Betriebstyp } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { Plan } from '../subscriptions/entities/plan.entity';
import { Order } from '../orders/entities/order.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { SupportTicket, TicketStatus } from '../support/entities/support-ticket.entity';
import { MarketplaceDealer } from '../marketplace/entities/marketplace-dealer.entity';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

// ---------------------------------------------------------------------------
// Antwort-Formen (WHITELIST). Der Service liefert bewusst NUR diese schlanken,
// explizit gemappten Objekte aus – NIE eine rohe Entity. Damit koennen Secrets
// (passwordHash, totpSecret, sevdeskApiToken, settings/§14 ...) auch dann nicht
// durchsickern, wenn das Repository (oder eine kuenftige Aenderung) eine volle
// Entity zurueckgibt.
// ---------------------------------------------------------------------------

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  ort: string | null;
  betriebstyp: Betriebstyp;
  status: TenantStatus;
  createdAt: Date;
  nutzerAnzahl: number;
  abo: { status: SubscriptionStatus; tarif: string | null; tarifSlug: string | null } | null;
}

export interface TenantListResult {
  data: TenantListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface TenantDetail {
  profil: {
    id: string;
    name: string;
    slug: string;
    street: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
    betriebstyp: Betriebstyp;
    status: TenantStatus;
    createdAt: Date;
  };
  nutzer: {
    id: string;
    name: string;
    email: string;
    rolle: string;
    aktiv: boolean;
    letzterLogin: Date | null;
  }[];
  nutzung: { auftraege: number; belege: number };
  abo: {
    status: SubscriptionStatus;
    tarif: string | null;
    tarifSlug: string | null;
    preisMonatlich: number | null;
    trialEndsAt: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
    notiz: string | null;
  } | null;
}

export interface UserLookupItem {
  id: string;
  email: string;
  name: string;
  rolle: string;
  aktiv: boolean;
  betrieb: { id: string; name: string; slug: string } | null;
}

export interface RegionAggregat {
  region: string;
  anzahl: number;
  typen: Record<Betriebstyp, number>;
}

export interface LiveKpi {
  testphasenEndenIn7Tagen: number;
  aktiveNutzer24h: number;
  offeneSupportTickets: number;
  offeneKybBewerbungen: number;
}

export interface AuditReadResult {
  data: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * BETRIEBER-COCKPIT (Detailly-Plattform, Teil 1 = nur Backend). BEWUSST
 * betriebsuebergreifend, OHNE Mandantenfilter – der Controller ist strikt auf
 * Plattform-Rollen begrenzt (RolesGuard). Reines Aggregieren/Lesen ueber
 * Bestandsentitaeten, KEINE Schreibpfade, KEINE Migration. Sensible Cross-Tenant-
 * Reads (Betriebs-Detail, Nutzer-Lookup) werden per AuditService protokolliert
 * (DSGVO-Rechenschaft) – best-effort, nie den Request brechend.
 */
@Injectable()
export class PlatformCockpitService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(SupportTicket) private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(MarketplaceDealer) private readonly dealerRepo: Repository<MarketplaceDealer>,
    private readonly audit: AuditService,
  ) {}

  // 1) Paginierte Betriebs-Suche + #Nutzer + Abo-Summary. -----------------------
  async listTenants(params: {
    q?: string;
    status?: string;
    plan?: string;
    limit?: string;
    offset?: string;
  }): Promise<TenantListResult> {
    const limit = clampLimit(params.limit, 25, 100);
    const offset = clampOffset(params.offset);

    const qb = this.tenantRepo
      .createQueryBuilder('t')
      .select([
        't.id',
        't.name',
        't.slug',
        't.email',
        't.city',
        't.betriebstyp',
        't.status',
        't.createdAt',
      ]);

    const q = (params.q ?? '').trim().toLowerCase();
    if (q) {
      qb.andWhere(
        '(LOWER(t.name) LIKE :q OR LOWER(t.slug) LIKE :q OR LOWER(t.email) LIKE :q OR LOWER(t.city) LIKE :q)',
        { q: `%${q}%` },
      );
    }

    // Status filtert die Betriebs-Ebene (Tenant.status), nur bei gueltigem Wert.
    if (params.status && (Object.values(TenantStatus) as string[]).includes(params.status)) {
      qb.andWhere('t.status = :status', { status: params.status });
    }

    // Plan-Filter ueber das (pro Tenant eindeutige) Abo -> kein Zeilen-Multiplizieren.
    if (params.plan) {
      qb.innerJoin(Subscription, 's', 's.tenantId = t.id')
        .innerJoin(Plan, 'p', 'p.id = s.planId')
        .andWhere('p.slug = :plan', { plan: params.plan });
    }

    qb.orderBy('t.createdAt', 'DESC').skip(offset).take(limit);

    const [rows, total] = await qb.getManyAndCount();
    const ids = rows.map((r) => r.id);

    const [nutzerByTenant, aboByTenant] = await Promise.all([
      this.countUsersByTenant(ids),
      this.aboSummaryByTenant(ids),
    ]);

    const data: TenantListItem[] = rows.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      email: t.email ?? null,
      ort: t.city ?? null,
      betriebstyp: t.betriebstyp,
      status: t.status,
      createdAt: t.createdAt,
      nutzerAnzahl: nutzerByTenant.get(t.id) ?? 0,
      abo: aboByTenant.get(t.id) ?? null,
    }));

    return { data, total, limit, offset };
  }

  private async countUsersByTenant(ids: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (ids.length === 0) return map;
    const rows = await this.userRepo
      .createQueryBuilder('u')
      .select('u.tenantId', 'tenantId')
      .addSelect('COUNT(*)', 'anzahl')
      .where('u.tenantId IN (:...ids)', { ids })
      .groupBy('u.tenantId')
      .getRawMany<{ tenantId: string; anzahl: string }>();
    for (const r of rows) map.set(r.tenantId, Number(r.anzahl));
    return map;
  }

  private async aboSummaryByTenant(
    ids: string[],
  ): Promise<Map<string, { status: SubscriptionStatus; tarif: string | null; tarifSlug: string | null }>> {
    const map = new Map<string, { status: SubscriptionStatus; tarif: string | null; tarifSlug: string | null }>();
    if (ids.length === 0) return map;
    const rows = await this.subRepo
      .createQueryBuilder('s')
      .leftJoin(Plan, 'p', 'p.id = s.planId')
      .select('s.tenantId', 'tenantId')
      .addSelect('s.status', 'status')
      .addSelect('p.name', 'planName')
      .addSelect('p.slug', 'planSlug')
      .where('s.tenantId IN (:...ids)', { ids })
      .getRawMany<{ tenantId: string; status: SubscriptionStatus; planName: string | null; planSlug: string | null }>();
    for (const r of rows) {
      map.set(r.tenantId, { status: r.status, tarif: r.planName ?? null, tarifSlug: r.planSlug ?? null });
    }
    return map;
  }

  // 2) Betriebs-Detail (sensibler Cross-Tenant-Read -> Audit). -------------------
  async getTenantDetail(actor: AuthUser, id: string): Promise<TenantDetail> {
    const tenant = await this.tenantRepo.findOne({
      where: { id },
      // Whitelist – bewusst OHNE settings (§14/IBAN) und ohne die select:false-Secrets.
      select: ['id', 'name', 'slug', 'street', 'city', 'postalCode', 'country', 'betriebstyp', 'status', 'createdAt'],
    });
    if (!tenant) throw new NotFoundException('Betrieb nicht gefunden');

    const [userRows, auftraege, belege, sub] = await Promise.all([
      this.userRepo.find({
        where: { tenantId: id },
        // Whitelist – KEIN passwordHash/totpSecret/recoveryCodes.
        select: ['id', 'firstName', 'lastName', 'email', 'role', 'isActive', 'lastLoginAt'],
        order: { role: 'ASC', lastName: 'ASC' },
      }),
      this.orderRepo.count({ where: { tenantId: id } }),
      this.invoiceRepo.count({ where: { tenantId: id } }),
      this.subRepo.findOne({ where: { tenantId: id } }),
    ]);

    let abo: TenantDetail['abo'] = null;
    if (sub) {
      const plan = sub.planId ? await this.planRepo.findOne({ where: { id: sub.planId } }) : null;
      abo = {
        status: sub.status,
        tarif: plan?.name ?? null,
        tarifSlug: plan?.slug ?? null,
        preisMonatlich: plan ? Number(plan.preisMonatlich) : null,
        trialEndsAt: sub.trialEndsAt ?? null,
        currentPeriodEnd: sub.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        canceledAt: sub.canceledAt ?? null,
        notiz: sub.notiz ?? null,
      };
    }

    // DSGVO-Rechenschaft: Zugriff auf Betriebsdaten protokollieren. AuditService.log
    // schluckt jeden Fehler -> kann den Request nie brechen.
    await this.audit.log({
      tenantId: id,
      userId: actor?.id,
      action: 'platform.viewTenant',
      entityType: 'tenant',
      entityId: id,
    });

    return {
      profil: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        street: tenant.street ?? null,
        city: tenant.city ?? null,
        postalCode: tenant.postalCode ?? null,
        country: tenant.country ?? null,
        betriebstyp: tenant.betriebstyp,
        status: tenant.status,
        createdAt: tenant.createdAt,
      },
      nutzer: userRows.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        rolle: u.role,
        aktiv: u.isActive,
        letzterLogin: u.lastLoginAt ?? null,
      })),
      nutzung: { auftraege, belege },
      abo,
    };
  }

  // 3) Cross-Tenant-Nutzer-Lookup (nur PLATFORM_ADMIN -> Controller). ------------
  async lookupUsers(actor: AuthUser, q?: string): Promise<{ data: UserLookupItem[] }> {
    const term = (q ?? '').trim().toLowerCase();
    // Kein Enumerieren des gesamten Nutzerbestands: erst ab 3 Zeichen suchen.
    if (term.length < 3) return { data: [] };

    const users = await this.userRepo
      .createQueryBuilder('u')
      // Whitelist – KEINE Secrets, minimale Projektion.
      .select(['u.id', 'u.email', 'u.firstName', 'u.lastName', 'u.role', 'u.isActive', 'u.tenantId'])
      .where('LOWER(u.email) LIKE :q', { q: `%${term}%` })
      .orderBy('u.email', 'ASC')
      .take(20)
      .getMany();

    const tenantIds = Array.from(new Set(users.map((u) => u.tenantId).filter((v): v is string => !!v)));
    const betriebById = new Map<string, { id: string; name: string; slug: string }>();
    if (tenantIds.length > 0) {
      const tenants = await this.tenantRepo.find({
        where: tenantIds.map((id) => ({ id })),
        select: ['id', 'name', 'slug'],
      });
      for (const t of tenants) betriebById.set(t.id, { id: t.id, name: t.name, slug: t.slug });
    }

    // DSGVO-Rechenschaft: WER hat WONACH gesucht + wie viele Treffer (ohne die
    // gefundenen Fremd-Adressen zu speichern -> Datensparsamkeit).
    await this.audit.log({
      tenantId: actor?.tenantId || 'platform',
      userId: actor?.id,
      action: 'platform.viewUserLookup',
      entityType: 'user',
      payload: { query: term, treffer: users.length },
    });

    return {
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: `${u.firstName} ${u.lastName}`.trim(),
        rolle: u.role,
        aktiv: u.isActive,
        betrieb: (u.tenantId && betriebById.get(u.tenantId)) || null,
      })),
    };
  }

  // 4) Region-Aggregation je 2-stelliger Leitregion (datensparsam). --------------
  async locations(): Promise<RegionAggregat[]> {
    const rows = await this.tenantRepo
      .createQueryBuilder('t')
      // SUBSTR ist in SQLite wie PostgreSQL identisch verfuegbar (portabel).
      .select('SUBSTR(t.postalCode, 1, 2)', 'region')
      .addSelect('t.betriebstyp', 'betriebstyp')
      .addSelect('COUNT(*)', 'anzahl')
      .where('t.postalCode IS NOT NULL')
      .andWhere("t.postalCode <> ''")
      .groupBy('SUBSTR(t.postalCode, 1, 2)')
      .addGroupBy('t.betriebstyp')
      .getRawMany<{ region: string; betriebstyp: Betriebstyp; anzahl: string }>();

    const byRegion = new Map<string, RegionAggregat>();
    for (const r of rows) {
      const region = (r.region ?? '').trim();
      if (!region) continue;
      let agg = byRegion.get(region);
      if (!agg) {
        agg = { region, anzahl: 0, typen: emptyTypen() };
        byRegion.set(region, agg);
      }
      const n = Number(r.anzahl);
      agg.anzahl += n;
      if (r.betriebstyp && r.betriebstyp in agg.typen) agg.typen[r.betriebstyp] += n;
    }

    return Array.from(byRegion.values()).sort((a, b) => a.region.localeCompare(b.region));
  }

  // 5) Live-KPI. -----------------------------------------------------------------
  async live(): Promise<LiveKpi> {
    const now = new Date();
    const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const seit24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [testphasenEndenIn7Tagen, aktiveNutzer24h, offeneSupportTickets, offeneKybBewerbungen] =
      await Promise.all([
        this.subRepo.count({ where: { status: SubscriptionStatus.TRIAL, trialEndsAt: Between(now, in7d) } }),
        this.userRepo.count({ where: { lastLoginAt: MoreThanOrEqual(seit24h) } }),
        this.ticketRepo.count({ where: { status: TicketStatus.OFFEN } }),
        this.dealerRepo.count({ where: { status: 'beantragt' } }),
      ]);

    return { testphasenEndenIn7Tagen, aktiveNutzer24h, offeneSupportTickets, offeneKybBewerbungen };
  }

  // 6) Plattformweite Audit-Lesesicht (nur PLATFORM_ADMIN -> Controller). --------
  async readAudit(params: {
    action?: string;
    tenantId?: string;
    limit?: string;
    offset?: string;
  }): Promise<AuditReadResult> {
    const limit = clampLimit(params.limit, 50, 200);
    const offset = clampOffset(params.offset);

    const where: Record<string, unknown> = {};
    if (params.action) where.action = params.action;
    if (params.tenantId) where.tenantId = params.tenantId;

    const [data, total] = await this.auditRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }
}

// --- Hilfen -----------------------------------------------------------------

function clampLimit(raw: string | undefined, def: number, max: number): number {
  const n = raw != null ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(n)) return def;
  return Math.min(Math.max(1, n), max);
}

function clampOffset(raw: string | undefined): number {
  const n = raw != null ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(n)) return 0;
  return Math.max(0, n);
}

function emptyTypen(): Record<Betriebstyp, number> {
  return {
    [Betriebstyp.AUFBEREITUNG]: 0,
    [Betriebstyp.FOLIERUNG]: 0,
    [Betriebstyp.PPF]: 0,
    [Betriebstyp.KOMPLETT]: 0,
  };
}
