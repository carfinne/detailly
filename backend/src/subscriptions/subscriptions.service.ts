import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { evaluateSubscription, AccessResult } from './subscription-access';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import {
  AssignSubscriptionDto,
  UpdateSubscriptionDto,
  ExtendSubscriptionDto,
} from './dto/subscription.dto';

/** Abo angereichert um Tarif und abgeleitete Zugriffsstufe (fuer die API/Anzeige). */
export interface SubscriptionView extends Subscription {
  plan: Plan | null;
  access: AccessResult;
}

/**
 * KUNDENSICHERE Projektion des EIGENEN Abos (GET /subscriptions/me). Bewusst OHNE
 * interne Betreiber-Felder: `notiz` (z. B. Sperrgrund) und die rohen Stripe-IDs
 * verlassen den Server hier NICHT – ein `hatStripeAbo`-Flag genuegt der /abo-Seite.
 * Die volle Entity gibt es nur ueber die platform_admin-Endpunkte (listOverview).
 */
export interface MySubscriptionView {
  id: string;
  tenantId: string;
  planId: string | null;
  plan: Plan | null;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  cancelAtPeriodEnd: boolean;
  hatStripeAbo: boolean;
  access: AccessResult;
}

/** Eintrag der Betreiber-Uebersicht: ein Betrieb mit seinem Abo. */
export interface TenantSubscriptionOverview {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  subscription: SubscriptionView | null;
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Tarife (Plans)
  // ---------------------------------------------------------------------------

  listPlans(includeInactive = false): Promise<Plan[]> {
    return this.planRepo.find({
      where: includeInactive ? {} : { istAktiv: true },
      order: { preisMonatlich: 'ASC' },
    });
  }

  async createPlan(user: AuthUser, dto: CreatePlanDto): Promise<Plan> {
    const exists = await this.planRepo.findOne({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException(`Tarif mit slug "${dto.slug}" existiert bereits`);
    const plan = await this.planRepo.save(this.planRepo.create(dto));
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'Plan',
      entityId: plan.id,
      payload: { slug: plan.slug, name: plan.name },
    });
    return plan;
  }

  async updatePlan(user: AuthUser, id: string, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Tarif nicht gefunden');
    Object.assign(plan, dto);
    const saved = await this.planRepo.save(plan);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'Plan',
      entityId: id,
      payload: dto as Record<string, unknown>,
    });
    return saved;
  }

  // ---------------------------------------------------------------------------
  // Abos (Subscriptions)
  // ---------------------------------------------------------------------------

  /** Roh-Abo eines Betriebs (oder null). Genutzt vom Guard und intern. */
  getTenantSubscription(tenantId: string): Promise<Subscription | null> {
    return this.subRepo.findOne({ where: { tenantId } });
  }

  /** Zugriffsbewertung fuer einen Betrieb – die Quelle der Wahrheit fuer den Guard. */
  async evaluateAccess(tenantId: string): Promise<AccessResult> {
    const sub = await this.getTenantSubscription(tenantId);
    return evaluateSubscription(sub);
  }

  /** Abo des aktuellen Betriebs inkl. Tarif + Zugriffsstufe (fuer "Mein Abo").
   *  Gibt bewusst NUR die kundensichere Projektion zurueck (kein notiz/Stripe-IDs). */
  async getMyView(tenantId: string): Promise<MySubscriptionView | null> {
    const sub = await this.getTenantSubscription(tenantId);
    if (!sub) return null;
    const plan = sub.planId ? await this.planRepo.findOne({ where: { id: sub.planId } }) : null;
    return {
      id: sub.id,
      tenantId: sub.tenantId,
      planId: sub.planId ?? null,
      plan: plan ?? null,
      status: sub.status,
      trialEndsAt: sub.trialEndsAt ?? null,
      currentPeriodStart: sub.currentPeriodStart ?? null,
      currentPeriodEnd: sub.currentPeriodEnd ?? null,
      canceledAt: sub.canceledAt ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      hatStripeAbo: Boolean(sub.stripeSubscriptionId),
      access: evaluateSubscription(sub),
    };
  }

  /** Betreiber-Uebersicht: alle Betriebe mit ihrem Abo. */
  async listOverview(): Promise<TenantSubscriptionOverview[]> {
    const [tenants, subs, plans] = await Promise.all([
      this.tenantRepo.find({ order: { name: 'ASC' } }),
      this.subRepo.find(),
      this.planRepo.find(),
    ]);
    const planById = new Map(plans.map((p) => [p.id, p]));
    const subByTenant = new Map(subs.map((s) => [s.tenantId, s]));

    return tenants.map((t) => {
      const sub = subByTenant.get(t.id) ?? null;
      return {
        tenantId: t.id,
        tenantName: t.name,
        tenantSlug: t.slug,
        subscription: sub
          ? { ...sub, plan: planById.get(sub.planId) ?? null, access: evaluateSubscription(sub) }
          : null,
      };
    });
  }

  /** Weist einem Betrieb einen Tarif zu bzw. ersetzt das bestehende Abo. */
  async assign(user: AuthUser, tenantId: string, dto: AssignSubscriptionDto): Promise<SubscriptionView> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Betrieb nicht gefunden');
    const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Tarif nicht gefunden');

    const existing = await this.subRepo.findOne({ where: { tenantId } });
    const status = dto.status ?? SubscriptionStatus.ACTIVE;
    const now = new Date();

    // Bei aktivem Abo ohne explizite Laufzeit: laufender Monat als Standardperiode.
    const periodStart = dto.currentPeriodStart
      ? new Date(dto.currentPeriodStart)
      : existing?.currentPeriodStart ?? (status === SubscriptionStatus.ACTIVE ? now : null);
    const periodEnd = dto.currentPeriodEnd
      ? new Date(dto.currentPeriodEnd)
      : existing?.currentPeriodEnd ??
        (status === SubscriptionStatus.ACTIVE ? addMonths(now, 1) : null);

    const data: Partial<Subscription> = {
      tenantId,
      planId: dto.planId,
      status,
      trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : existing?.trialEndsAt ?? null,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      notiz: dto.notiz ?? existing?.notiz ?? null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    };

    const sub = existing ? this.subRepo.merge(existing, data) : this.subRepo.create(data);
    const saved = await this.subRepo.save(sub);
    await this.logSub(user, tenantId, saved.id, 'assign', { planId: dto.planId, status });
    return this.decorate(saved);
  }

  /** Teil-Aktualisierung eines bestehenden Abos (Status, Kuendigung, Laufzeit ...). */
  async update(user: AuthUser, tenantId: string, dto: UpdateSubscriptionDto): Promise<SubscriptionView> {
    const sub = await this.subRepo.findOne({ where: { tenantId } });
    if (!sub) throw new NotFoundException('Fuer diesen Betrieb existiert noch kein Abo');

    if (dto.planId !== undefined) {
      const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
      if (!plan) throw new NotFoundException('Tarif nicht gefunden');
      sub.planId = dto.planId;
    }
    if (dto.status !== undefined) {
      sub.status = dto.status;
      // Statuswechsel haelt die Kuendigungs-Metadaten konsistent.
      if (dto.status === SubscriptionStatus.CANCELED) {
        sub.canceledAt = sub.canceledAt ?? new Date();
      } else if (dto.status === SubscriptionStatus.ACTIVE) {
        sub.canceledAt = null;
        sub.cancelAtPeriodEnd = false;
      }
    }
    if (dto.cancelAtPeriodEnd !== undefined) {
      sub.cancelAtPeriodEnd = dto.cancelAtPeriodEnd;
      if (dto.cancelAtPeriodEnd) sub.canceledAt = sub.canceledAt ?? new Date();
    }
    if (dto.trialEndsAt !== undefined) sub.trialEndsAt = new Date(dto.trialEndsAt);
    if (dto.currentPeriodStart !== undefined) sub.currentPeriodStart = new Date(dto.currentPeriodStart);
    if (dto.currentPeriodEnd !== undefined) sub.currentPeriodEnd = new Date(dto.currentPeriodEnd);
    if (dto.notiz !== undefined) sub.notiz = dto.notiz;

    const saved = await this.subRepo.save(sub);
    await this.logSub(user, tenantId, saved.id, 'update', dto as Record<string, unknown>);
    return this.decorate(saved);
  }

  /** Verlaengert das Abo um N Monate ab dem spaeteren von "jetzt"/Periodenende. */
  async extend(user: AuthUser, tenantId: string, dto: ExtendSubscriptionDto): Promise<SubscriptionView> {
    const sub = await this.subRepo.findOne({ where: { tenantId } });
    if (!sub) throw new NotFoundException('Fuer diesen Betrieb existiert noch kein Abo');

    const now = new Date();
    const aktuellesEnde = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : now;
    const basis = aktuellesEnde.getTime() > now.getTime() ? aktuellesEnde : now;

    sub.currentPeriodStart = sub.currentPeriodStart ?? now;
    sub.currentPeriodEnd = addMonths(basis, dto.months);
    sub.status = SubscriptionStatus.ACTIVE;
    sub.cancelAtPeriodEnd = false;
    sub.canceledAt = null;

    const saved = await this.subRepo.save(sub);
    await this.logSub(user, tenantId, saved.id, 'extend', { months: dto.months });
    return this.decorate(saved);
  }

  // ---------------------------------------------------------------------------
  // intern
  // ---------------------------------------------------------------------------

  private async decorate(sub: Subscription): Promise<SubscriptionView> {
    const plan = sub.planId ? await this.planRepo.findOne({ where: { id: sub.planId } }) : null;
    return { ...sub, plan: plan ?? null, access: evaluateSubscription(sub) };
  }

  private logSub(
    user: AuthUser,
    tenantId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    // Aktion auf den ZIEL-Betrieb buchen, nicht auf den des platform_admin.
    return this.audit.log({
      tenantId,
      userId: user.id,
      action: `subscription.${action}`,
      entityType: 'Subscription',
      entityId,
      payload,
    });
  }
}
