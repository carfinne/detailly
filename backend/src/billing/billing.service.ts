import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Plan } from '../subscriptions/entities/plan.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { ProcessedStripeEvent } from './entities/processed-stripe-event.entity';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { isUniqueViolation } from '../common/numbering';

/**
 * Stripe-Anbindung fuer das Self-Service-Abo (Checkout + Customer Portal +
 * Webhooks). Quelle der Wahrheit fuer den Abo-STATUS bleibt unsere DB; Stripe
 * meldet Aenderungen per Webhook, die wir auf die lokale Subscription mappen.
 *
 * Opt-in wie SMTP/sevDesk: ohne STRIPE_SECRET_KEY ist alles deaktiviert (kein
 * Boot-Bruch). Geld bewegt ausschliesslich Stripe – wir erzeugen nur Sessions.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe?: Stripe;
  private readonly webhookSecret?: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(ProcessedStripeEvent)
    private readonly eventRepo: Repository<ProcessedStripeEvent>,
    private readonly audit: AuditService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (key) this.stripe = new Stripe(key);
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
  }

  get isConfigured(): boolean {
    return Boolean(this.stripe);
  }

  private client(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Online-Bezahlung ist derzeit nicht aktiviert.');
    }
    return this.stripe;
  }

  private baseUrl(): string {
    const raw =
      this.config.get<string>('APP_BASE_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    return raw.replace(/\/$/, '');
  }

  // ---------------------------------------------------------------------------
  // Checkout / Portal (Inhaber)
  // ---------------------------------------------------------------------------

  /** Erzeugt eine Stripe-Checkout-Session fuer den gewaehlten Tarif + Zahlweise. */
  async createCheckout(
    user: AuthUser,
    planId: string,
    interval: 'month' | 'year' = 'month',
  ): Promise<{ url: string }> {
    const stripe = this.client();
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Tarif nicht gefunden');
    if (!plan.istAktiv) throw new BadRequestException('Dieser Tarif wird nicht mehr angeboten.');
    const priceId = interval === 'year' ? plan.stripePriceIdYearly : plan.stripePriceId;
    if (!priceId) {
      throw new BadRequestException(
        `Dieser Tarif ist für die ${interval === 'year' ? 'jährliche' : 'monatliche'} Zahlweise noch nicht mit Stripe verknüpft.`,
      );
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: user.tenantId } });
    if (!tenant) throw new NotFoundException('Betrieb nicht gefunden');

    const sub = await this.ensureSubscription(user.tenantId);
    const customerId = await this.ensureCustomer(stripe, tenant, sub);

    const base = this.baseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // tenantId NUR serverseitig in die Metadaten – nie aus dem Client-Body.
      client_reference_id: user.tenantId,
      metadata: { tenantId: user.tenantId, planId: plan.id, interval },
      subscription_data: { metadata: { tenantId: user.tenantId, planId: plan.id } },
      allow_promotion_codes: true,
      success_url: `${base}/abo?status=success`,
      cancel_url: `${base}/abo?status=cancel`,
    });

    if (!session.url) throw new ServiceUnavailableException('Checkout konnte nicht gestartet werden.');
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'billing.checkout_started',
      entityType: 'Subscription',
      entityId: sub.id,
      payload: { planId: plan.id },
    });
    return { url: session.url };
  }

  /** Erzeugt eine Customer-Portal-Session (Zahlungsmittel/Kuendigung verwalten). */
  async createPortal(user: AuthUser): Promise<{ url: string }> {
    const stripe = this.client();
    const sub = await this.subRepo.findOne({ where: { tenantId: user.tenantId } });
    if (!sub?.stripeCustomerId) {
      throw new BadRequestException('Für diesen Betrieb besteht noch kein Stripe-Abo.');
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${this.baseUrl()}/abo`,
    });
    return { url: session.url };
  }

  /**
   * Holt den aktuellen Stripe-Stand aktiv ab und schreibt ihn in die lokale
   * Subscription (Fallback fuer die Rueckkehr aus dem Checkout, falls der Webhook
   * – z. B. lokal ohne oeffentliche URL – noch nicht angekommen ist).
   */
  async syncFromStripe(tenantId: string): Promise<void> {
    if (!this.stripe) return;
    const sub = await this.subRepo.findOne({ where: { tenantId } });
    if (!sub?.stripeCustomerId) return;
    const list = await this.stripe.subscriptions.list({
      customer: sub.stripeCustomerId,
      status: 'all',
      limit: 10,
    });
    // Aktivste/neueste Subscription bevorzugen.
    const best =
      list.data.find((s) => s.status === 'active' || s.status === 'trialing') ??
      list.data.sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0];
    if (best) await this.applyStripeSubscription(best, tenantId);
  }

  // ---------------------------------------------------------------------------
  // Webhook
  // ---------------------------------------------------------------------------

  /** Verifiziert die Stripe-Signatur und liefert das geparste Event. */
  verifyEvent(rawBody: Buffer, signature: string | undefined): Stripe.Event {
    const stripe = this.client();
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException('Webhook ist nicht konfiguriert.');
    }
    if (!signature) throw new BadRequestException('Signatur fehlt.');
    return stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }

  /**
   * Reserviert eine Stripe-Event-ID fuer die einmalige Verarbeitung. Gibt `false`
   * zurueck, wenn das Event bereits verarbeitet wurde (Replay/Retry -> ueberspringen).
   */
  private async tryClaimEvent(id: string, type: string): Promise<boolean> {
    try {
      await this.eventRepo.insert({ id, type });
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) return false; // schon verarbeitet
      throw err;
    }
  }

  /** Verarbeitet ein verifiziertes Stripe-Event genau einmal (Idempotenz ueber event.id). */
  async handleEvent(event: Stripe.Event): Promise<void> {
    // Replay-/Retry-Schutz: jede event.id nur einmal verarbeiten.
    if (!(await this.tryClaimEvent(event.id, event.type))) {
      this.logger.debug(`Stripe-Event ${event.id} bereits verarbeitet – uebersprungen.`);
      return;
    }
    try {
      await this.dispatchEvent(event);
    } catch (err) {
      // Verarbeitung fehlgeschlagen -> Reservierung loesen, damit Stripe es erneut
      // zustellen darf (sonst ginge die Aenderung dauerhaft verloren).
      await this.eventRepo.delete({ id: event.id }).catch(() => undefined);
      throw err;
    }
  }

  private async dispatchEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        const tenantId = (session.metadata?.tenantId as string) || (session.client_reference_id ?? undefined);
        if (subId && this.stripe) {
          const full = await this.stripe.subscriptions.retrieve(subId);
          await this.applyStripeSubscription(full, tenantId);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await this.applyStripeSubscription(sub);
        break;
      }
      default:
        // Andere Events ignorieren wir bewusst (kein Fehler -> Stripe sieht 200).
        this.logger.debug(`Ignoriertes Stripe-Event: ${event.type}`);
    }
  }

  // ---------------------------------------------------------------------------
  // intern
  // ---------------------------------------------------------------------------

  /**
   * Stellt sicher, dass ein lokaler Subscription-Datensatz existiert. Wird nur als
   * Vorbedingung fuer den Checkout angelegt -> KEIN unbefristeter Trial: `trialEndsAt`
   * wird auf JETZT gesetzt (sofort abgelaufen). Sonst wuerde ein abgebrochener
   * Checkout einen TRIAL ohne Enddatum hinterlassen = dauerhaft freier Zugriff.
   * Echte Testphasen werden ausschliesslich bei der Registrierung mit Laufzeit vergeben.
   */
  private async ensureSubscription(tenantId: string): Promise<Subscription> {
    const existing = await this.subRepo.findOne({ where: { tenantId } });
    if (existing) return existing;
    return this.subRepo.save(
      this.subRepo.create({
        tenantId,
        status: SubscriptionStatus.TRIAL,
        trialEndsAt: new Date(),
      }),
    );
  }

  /** Stellt einen Stripe-Customer sicher und merkt sich dessen ID lokal. */
  private async ensureCustomer(
    stripe: Stripe,
    tenant: Tenant,
    sub: Subscription,
  ): Promise<string> {
    if (sub.stripeCustomerId) return sub.stripeCustomerId;
    const customer = await stripe.customers.create({
      email: tenant.email || undefined,
      name: tenant.name || undefined,
      metadata: { tenantId: tenant.id },
    });
    sub.stripeCustomerId = customer.id;
    await this.subRepo.save(sub);
    return customer.id;
  }

  /** Stripe-Status -> lokaler Abo-Status (konservativ: Zugriff nur bei aktiv/Test). */
  private mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
    switch (s) {
      case 'active':
      case 'trialing':
        return SubscriptionStatus.ACTIVE;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'canceled':
        return SubscriptionStatus.CANCELED;
      case 'unpaid':
      case 'incomplete':
      case 'incomplete_expired':
      case 'paused':
        return SubscriptionStatus.SUSPENDED;
      default:
        return SubscriptionStatus.PAST_DUE;
    }
  }

  /**
   * Schreibt den Stripe-Zustand auf die lokale Subscription. Findet den Datensatz
   * ueber stripeSubscriptionId -> stripeCustomerId -> metadata/Parameter-tenantId.
   * Defensiv ueber SDK-Versionen: Perioden liegen je nach API-Version auf Sub-
   * ODER Item-Ebene.
   */
  private async applyStripeSubscription(
    stripeSub: Stripe.Subscription,
    fallbackTenantId?: string,
  ): Promise<void> {
    const raw = stripeSub as unknown as Record<string, any>;
    const item = raw.items?.data?.[0] ?? {};
    const customerId = typeof raw.customer === 'string' ? raw.customer : raw.customer?.id;
    const metaTenantId = (raw.metadata?.tenantId as string) || fallbackTenantId;

    // Zuordnung: stripeSubscriptionId -> stripeCustomerId (starker Anker, wird beim
    // Checkout gesetzt) -> erst zuletzt die tenantId aus den Event-Metadaten.
    let sub =
      (await this.subRepo.findOne({ where: { stripeSubscriptionId: stripeSub.id } })) ||
      (customerId ? await this.subRepo.findOne({ where: { stripeCustomerId: customerId } }) : null) ||
      (metaTenantId ? await this.subRepo.findOne({ where: { tenantId: metaTenantId } }) : null);

    if (!sub) {
      this.logger.warn(`Stripe-Subscription ${stripeSub.id} keinem Betrieb zuordenbar – ignoriert.`);
      return;
    }

    // Sicherheit: Wenn der gefundene Datensatz bereits mit einem ANDEREN Stripe-
    // Customer verknuepft ist, NICHT ueberschreiben (kein Cross-Linking ueber eine
    // evtl. falsche metaTenantId). Lieber verwerfen + warnen.
    if (sub.stripeCustomerId && customerId && sub.stripeCustomerId !== customerId) {
      this.logger.warn(
        `Customer-Mismatch fuer Abo ${sub.id}: ${sub.stripeCustomerId} != ${customerId} – Event ignoriert.`,
      );
      return;
    }

    const unix = (n?: number | null) => (n ? new Date(n * 1000) : null);
    const priceId: string | undefined = item.price?.id;
    // Preis kann der Monats- ODER der Jahres-Price-ID des Plans entsprechen.
    const plan = priceId
      ? await this.planRepo.findOne({
          where: [{ stripePriceId: priceId }, { stripePriceIdYearly: priceId }],
        })
      : null;

    sub.stripeSubscriptionId = stripeSub.id;
    if (customerId) sub.stripeCustomerId = customerId;
    sub.status = this.mapStatus(stripeSub.status);
    if (plan) sub.planId = plan.id;
    sub.currentPeriodStart = unix(raw.current_period_start ?? item.current_period_start);
    sub.currentPeriodEnd = unix(raw.current_period_end ?? item.current_period_end);
    sub.cancelAtPeriodEnd = Boolean(raw.cancel_at_period_end);
    sub.canceledAt = unix(raw.canceled_at);

    await this.subRepo.save(sub);
    await this.audit.log({
      tenantId: sub.tenantId,
      action: 'billing.sync',
      entityType: 'Subscription',
      entityId: sub.id,
      payload: { stripeStatus: stripeSub.status, status: sub.status, planId: sub.planId },
    });
  }
}
