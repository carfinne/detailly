import { BillingService } from './billing.service';
import { SubscriptionStatus } from '../subscriptions/entities/subscription.entity';

/**
 * Tests fuer die korrektheitskritische Webhook-Logik: Stripe-Status -> lokaler
 * Abo-Status + Zuordnung des lokalen Datensatzes + Perioden-Extraktion (Sub- ODER
 * Item-Ebene). Kein echter Stripe-Client noetig (applyStripeSubscription nutzt nur
 * Repos). Aufruf der privaten Methode bewusst ueber `as any`.
 */
function makeService(localSub: Record<string, unknown> | null) {
  const config = { get: () => undefined };
  const planRepo = {
    // where ist je nach Aufruf ein Objekt ODER ein OR-Array (Monats-/Jahres-Price).
    findOne: jest.fn(async ({ where }: any) => {
      const conds = Array.isArray(where) ? where : [where];
      const treffer = conds.some(
        (c: any) => c.stripePriceId === 'price_pro' || c.stripePriceIdYearly === 'price_pro_year',
      );
      return treffer ? { id: 'plan_pro' } : null;
    }),
  };
  const subRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      if (where.stripeSubscriptionId) return null;
      if (where.stripeCustomerId) return null;
      if (where.tenantId && localSub && (localSub as any).tenantId === where.tenantId) return localSub;
      return null;
    }),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
  };
  const tenantRepo = { findOne: jest.fn() };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new BillingService(
    config as any,
    planRepo as any,
    subRepo as any,
    tenantRepo as any,
    audit as any,
  );
  return { svc, planRepo, subRepo, audit };
}

function stripeSub(over: Record<string, unknown> = {}): any {
  return {
    id: 'sub_1',
    status: 'active',
    customer: 'cus_1',
    cancel_at_period_end: false,
    canceled_at: null,
    current_period_start: 1_700_000_000,
    current_period_end: 1_702_592_000,
    items: { data: [{ price: { id: 'price_pro' } }] },
    metadata: { tenantId: 'TENANT-1' },
    ...over,
  };
}

describe('BillingService · isConfigured / client-Gate', () => {
  it('ist ohne STRIPE_SECRET_KEY deaktiviert', () => {
    const { svc } = makeService(null);
    expect(svc.isConfigured).toBe(false);
  });
});

/**
 * C2-A: Der "Tarif wechseln"-Pfad (POST /billing/checkout) darf bei einem Betrieb
 * mit BEREITS aktiver Stripe-Subscription KEINEN zweiten Checkout starten (zweite
 * parallele Subscription -> Doppelzahlung), sondern die laufende Subscription auf
 * den neuen Price umstellen. Ohne aktives Stripe-Abo bleibt der Checkout-Weg korrekt.
 */
function makeCheckout(opts: { localSub: any; stripe: any; plan?: any; tenant?: any }) {
  const plan = opts.plan ?? {
    id: 'plan_pro',
    istAktiv: true,
    stripePriceId: 'price_pro',
    stripePriceIdYearly: 'price_pro_year',
  };
  const tenant = opts.tenant ?? { id: 'T1', email: 'inhaber@betrieb.de', name: 'Betrieb' };
  const config = { get: () => undefined };
  const planRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const conds = Array.isArray(where) ? where : [where];
      if (conds.some((c: any) => c.id === plan.id)) return plan;
      // applyStripeSubscription mappt Price -> Plan (OR-Array Monats-/Jahres-Price).
      if (conds.some((c: any) => c.stripePriceId === 'price_pro' || c.stripePriceIdYearly === 'price_pro_year'))
        return { id: plan.id };
      return null;
    }),
  };
  const subRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const s = opts.localSub;
      if (!s) return null;
      if (where.tenantId && s.tenantId === where.tenantId) return s;
      if (where.stripeSubscriptionId && s.stripeSubscriptionId === where.stripeSubscriptionId) return s;
      if (where.stripeCustomerId && s.stripeCustomerId === where.stripeCustomerId) return s;
      return null;
    }),
    save: jest.fn(async (x: any) => x),
    create: jest.fn((x: any) => x),
  };
  const tenantRepo = { findOne: jest.fn(async () => tenant) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new BillingService(
    config as any,
    planRepo as any,
    subRepo as any,
    tenantRepo as any,
    audit as any,
  );
  // Gemockter Stripe-Client (Konstruktor liess `stripe` ohne Key undefined).
  (svc as any).stripe = opts.stripe;
  return { svc, planRepo, subRepo, tenantRepo, audit };
}

const USER: any = { id: 'u1', tenantId: 'T1' };

function stripeMock(over: Record<string, unknown> = {}): any {
  return {
    subscriptions: {
      retrieve: jest.fn(),
      update: jest.fn(),
    },
    checkout: { sessions: { create: jest.fn(async () => ({ url: 'https://checkout.stripe.test/x' })) } },
    customers: { create: jest.fn(async () => ({ id: 'cus_new' })) },
    ...over,
  };
}

describe('BillingService · createCheckout (C2-A Doppelzahlung)', () => {
  it('OHNE bestehendes Stripe-Abo: startet regulaeren Checkout (kein subscriptions.update)', async () => {
    const localSub: any = { id: 's1', tenantId: 'T1', status: SubscriptionStatus.TRIAL };
    const stripe = stripeMock();
    const { svc } = makeCheckout({ localSub, stripe });

    const res = await svc.createCheckout(USER, 'plan_pro', 'month');

    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(stripe.customers.create).toHaveBeenCalledTimes(1); // neuer Customer
    expect(res.url).toBe('https://checkout.stripe.test/x');
  });

  it('MIT aktivem Stripe-Abo: stellt bestehende Subscription um (Proration), KEIN zweiter Checkout', async () => {
    const localSub: any = {
      id: 's1',
      tenantId: 'T1',
      status: SubscriptionStatus.ACTIVE,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
    };
    const stripe = stripeMock();
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_1',
      status: 'active',
      customer: 'cus_1',
      items: { data: [{ id: 'si_1', price: { id: 'price_old' } }] },
    });
    stripe.subscriptions.update.mockResolvedValue({
      id: 'sub_1',
      status: 'active',
      customer: 'cus_1',
      cancel_at_period_end: false,
      canceled_at: null,
      current_period_start: 1_700_000_000,
      current_period_end: 1_702_592_000,
      items: { data: [{ id: 'si_1', price: { id: 'price_pro' } }] },
      metadata: { tenantId: 'T1' },
    });
    const { svc, audit } = makeCheckout({ localSub, stripe });

    const res = await svc.createCheckout(USER, 'plan_pro', 'month');

    // Kernaussage C2-A: Umstellung statt zweiter Subscription.
    expect(stripe.subscriptions.update).toHaveBeenCalledTimes(1);
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', {
      items: [{ id: 'si_1', price: 'price_pro' }],
      proration_behavior: 'create_prorations',
      metadata: { tenantId: 'T1', planId: 'plan_pro' },
    });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    // Lokaler Datensatz sofort nachgezogen.
    expect(localSub.planId).toBe('plan_pro');
    expect(res.url).toContain('/abo?status=success');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing.plan_switched' }),
    );
  });

  it('bestehende Subscription in Stripe gekuendigt: faellt auf Checkout zurueck (Neuabschluss)', async () => {
    const localSub: any = {
      id: 's1',
      tenantId: 'T1',
      status: SubscriptionStatus.CANCELED,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_old',
    };
    const stripe = stripeMock();
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_old',
      status: 'canceled',
      customer: 'cus_1',
      items: { data: [{ id: 'si_1', price: { id: 'price_old' } }] },
    });
    const { svc } = makeCheckout({ localSub, stripe });

    const res = await svc.createCheckout(USER, 'plan_pro', 'month');

    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    // Bestehender Customer wird wiederverwendet (kein neuer Customer).
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(res.url).toBe('https://checkout.stripe.test/x');
  });
});

describe('BillingService · applyStripeSubscription', () => {
  it('mappt active -> ACTIVE und schreibt Stripe-IDs, Plan, Periode', async () => {
    const localSub: any = { id: 's1', tenantId: 'TENANT-1' };
    const { svc, subRepo } = makeService(localSub);
    await (svc as any).applyStripeSubscription(stripeSub(), 'TENANT-1');
    expect(localSub.status).toBe(SubscriptionStatus.ACTIVE);
    expect(localSub.planId).toBe('plan_pro');
    expect(localSub.stripeSubscriptionId).toBe('sub_1');
    expect(localSub.stripeCustomerId).toBe('cus_1');
    expect(localSub.cancelAtPeriodEnd).toBe(false);
    expect(localSub.currentPeriodEnd).toEqual(new Date(1_702_592_000 * 1000));
    expect(subRepo.save).toHaveBeenCalled();
  });

  it.each([
    ['active', SubscriptionStatus.ACTIVE],
    ['trialing', SubscriptionStatus.ACTIVE],
    ['past_due', SubscriptionStatus.PAST_DUE],
    ['canceled', SubscriptionStatus.CANCELED],
    ['unpaid', SubscriptionStatus.SUSPENDED],
    ['incomplete', SubscriptionStatus.SUSPENDED],
    ['paused', SubscriptionStatus.SUSPENDED],
  ])('mappt Stripe-Status %s -> %s', async (stripeStatus, erwartet) => {
    const localSub: any = { id: 's1', tenantId: 'TENANT-1' };
    const { svc } = makeService(localSub);
    await (svc as any).applyStripeSubscription(stripeSub({ status: stripeStatus }), 'TENANT-1');
    expect(localSub.status).toBe(erwartet);
  });

  it('liest die Periode auch von der Item-Ebene (neuere API-Versionen)', async () => {
    const localSub: any = { id: 's1', tenantId: 'TENANT-1' };
    const { svc } = makeService(localSub);
    const sub = stripeSub({
      current_period_end: undefined,
      items: { data: [{ current_period_end: 1_702_592_000, price: { id: 'price_pro' } }] },
    });
    await (svc as any).applyStripeSubscription(sub, 'TENANT-1');
    expect(localSub.currentPeriodEnd).toEqual(new Date(1_702_592_000 * 1000));
  });

  it('uebernimmt cancel_at_period_end', async () => {
    const localSub: any = { id: 's1', tenantId: 'TENANT-1' };
    const { svc } = makeService(localSub);
    await (svc as any).applyStripeSubscription(stripeSub({ cancel_at_period_end: true }), 'TENANT-1');
    expect(localSub.cancelAtPeriodEnd).toBe(true);
  });

  it('ignoriert eine nicht zuordenbare Subscription (kein Save)', async () => {
    const { svc, subRepo } = makeService(null);
    await (svc as any).applyStripeSubscription(stripeSub({ metadata: {} }), undefined);
    expect(subRepo.save).not.toHaveBeenCalled();
  });

  it('verwirft Event bei Customer-Mismatch (kein Cross-Linking)', async () => {
    // Lokaler Datensatz haengt an cus_OLD; Event kommt mit cus_NEW (nur via
    // tenantId-Fallback gefunden) -> NICHT ueberschreiben.
    const localSub: any = { id: 's1', tenantId: 'TENANT-1', stripeCustomerId: 'cus_OLD' };
    const { svc, subRepo } = makeService(localSub);
    await (svc as any).applyStripeSubscription(stripeSub({ customer: 'cus_NEW' }), 'TENANT-1');
    expect(subRepo.save).not.toHaveBeenCalled();
  });

  it('ordnet den Plan auch ueber die Jahres-Price-ID zu', async () => {
    const localSub: any = { id: 's1', tenantId: 'TENANT-1' };
    const { svc } = makeService(localSub);
    const sub = stripeSub({ items: { data: [{ price: { id: 'price_pro_year' } }] } });
    await (svc as any).applyStripeSubscription(sub, 'TENANT-1');
    expect(localSub.planId).toBe('plan_pro');
  });
});
