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
  const eventRepo = {
    insert: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new BillingService(
    config as any,
    planRepo as any,
    subRepo as any,
    tenantRepo as any,
    eventRepo as any,
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
