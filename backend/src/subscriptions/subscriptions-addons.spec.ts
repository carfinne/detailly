import { ForbiddenException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionStatus } from './entities/subscription.entity';
import { planSeedBySlug, FEATURE_FOLIERUNG_PPF } from './plan-catalog';

/**
 * Service-Ebene: das à-la-carte Add-on `folierung_ppf` wird TENANT-GETRENNT aus
 * `subscription.addons` aufgeloest und zu den Tarif-Features gemischt.
 *  - Trial (planId null)            -> offen
 *  - zahlender Tarif ohne Add-on    -> 403 PLAN_FEATURE_MISSING
 *  - zahlender Tarif mit Add-on     -> offen
 *  - Isolation: Tenant A (gebucht) offen, Tenant B (nicht) gesperrt – gleicher Tarif.
 * Mockt nur die Repos (keine DB); getTenantSubscription/-Plan sind ausserhalb
 * eines Requests memo-frei (rufen die Repo-Mocks je Aufruf).
 */

const BASIC = { id: 'plan-basic', name: 'Basic', ...planSeedBySlug('basic') };

// Ein Abo je Tenant – deckt Trial/Pilot/ohne-Add-on/mit-Add-on + Isolation ab.
const SUBS: Record<string, any> = {
  'trial': { tenantId: 'trial', planId: null, status: SubscriptionStatus.TRIAL, addons: null },
  // Pilot BEWUSST auf einem Tarif OHNE das Add-on-Feature (plan-basic): der
  // Status muss den Zugriff oeffnen, unabhaengig vom zugewiesenen Tarif.
  'pilot': { tenantId: 'pilot', planId: 'plan-basic', status: SubscriptionStatus.PILOT, addons: null },
  // Aktives Trial mit Tarif ohne Add-on -> Vollzugriff (offen).
  'trial-aktiv': {
    tenantId: 'trial-aktiv',
    planId: 'plan-basic',
    status: SubscriptionStatus.TRIAL,
    trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    addons: null,
  },
  // ABGELAUFENES Trial mit Tarif ohne Add-on -> KEIN Vollzugriff (gesperrt);
  // sonst gaebe die guard-lose oeffentliche Flaeche das Feature frei.
  'trial-abgelaufen': {
    tenantId: 'trial-abgelaufen',
    planId: 'plan-basic',
    status: SubscriptionStatus.TRIAL,
    trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    addons: null,
  },
  'basic-ohne': { tenantId: 'basic-ohne', planId: 'plan-basic', status: SubscriptionStatus.ACTIVE, addons: [] },
  'basic-mit': {
    tenantId: 'basic-mit',
    planId: 'plan-basic',
    status: SubscriptionStatus.ACTIVE,
    addons: [FEATURE_FOLIERUNG_PPF],
  },
};

function makeService() {
  const subRepo = {
    findOne: jest.fn(async ({ where }: any) => SUBS[where.tenantId] ?? null),
  };
  const planRepo = {
    findOne: jest.fn(async ({ where }: any) => (where.id === 'plan-basic' ? BASIC : null)),
  };
  const tenantRepo = { findOne: jest.fn() };
  const audit = { log: jest.fn() };
  return new SubscriptionsService(
    planRepo as any,
    subRepo as any,
    tenantRepo as any,
    audit as any,
  );
}

describe('SubscriptionsService · folierung_ppf Add-on (effektiv, tenant-getrennt)', () => {
  let svc: SubscriptionsService;
  beforeEach(() => {
    svc = makeService();
  });

  it('Trial: Folierer/PPF offen (assertFeature wirft nicht, hasFeatureForTenant true)', async () => {
    await expect(svc.assertFeature('trial', FEATURE_FOLIERUNG_PPF)).resolves.toBeUndefined();
    await expect(svc.hasFeatureForTenant('trial', FEATURE_FOLIERUNG_PPF)).resolves.toBe(true);
  });

  it('Pilot auf einem Tarif OHNE das Add-on: trotzdem offen (Vollzugriff-Status)', async () => {
    await expect(svc.assertFeature('pilot', FEATURE_FOLIERUNG_PPF)).resolves.toBeUndefined();
    await expect(svc.hasFeatureForTenant('pilot', FEATURE_FOLIERUNG_PPF)).resolves.toBe(true);
    expect((await svc.getEntitlements('pilot')).features).toBeNull();
  });

  it('aktives Trial + Tarif ohne Add-on: offen (Vollzugriff im Test)', async () => {
    await expect(svc.hasFeatureForTenant('trial-aktiv', FEATURE_FOLIERUNG_PPF)).resolves.toBe(true);
    await expect(svc.assertFeature('trial-aktiv', FEATURE_FOLIERUNG_PPF)).resolves.toBeUndefined();
    expect((await svc.getEntitlements('trial-aktiv')).features).toBeNull();
  });

  it('ABGELAUFENES Trial + Tarif ohne Add-on: GESPERRT (oeffentliche Flaeche gibt nichts frei)', async () => {
    // Regressionsschutz: der Vollzugriff-Kurzschluss darf ein abgelaufenes Trial
    // NICHT oeffnen (hasFeatureForTenant wird guard-los oeffentlich genutzt).
    await expect(svc.hasFeatureForTenant('trial-abgelaufen', FEATURE_FOLIERUNG_PPF)).resolves.toBe(false);
    await expect(svc.assertFeature('trial-abgelaufen', FEATURE_FOLIERUNG_PPF)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    // Nav-Filter zeigt dann nur die Tarif-Features (ohne Add-on).
    expect((await svc.getEntitlements('trial-abgelaufen')).features).not.toContain(FEATURE_FOLIERUNG_PPF);
  });

  it('zahlender Tarif OHNE Add-on: 403 PLAN_FEATURE_MISSING', async () => {
    await expect(svc.assertFeature('basic-ohne', FEATURE_FOLIERUNG_PPF)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.hasFeatureForTenant('basic-ohne', FEATURE_FOLIERUNG_PPF)).resolves.toBe(false);
    // Kernmodul bleibt trotzdem erreichbar (Add-on gated nur sein Feature).
    await expect(svc.assertFeature('basic-ohne', 'kunden')).resolves.toBeUndefined();
  });

  it('zahlender Tarif MIT gebuchtem Add-on: offen', async () => {
    await expect(svc.assertFeature('basic-mit', FEATURE_FOLIERUNG_PPF)).resolves.toBeUndefined();
    await expect(svc.hasFeatureForTenant('basic-mit', FEATURE_FOLIERUNG_PPF)).resolves.toBe(true);
  });

  it('Tenant-Isolation: Add-on von "basic-mit" schaltet "basic-ohne" NICHT frei', async () => {
    await expect(svc.hasFeatureForTenant('basic-mit', FEATURE_FOLIERUNG_PPF)).resolves.toBe(true);
    await expect(svc.hasFeatureForTenant('basic-ohne', FEATURE_FOLIERUNG_PPF)).resolves.toBe(false);
  });

  it('getEntitlements mischt gebuchte Add-ons in die features-Liste (Nav-Filter)', async () => {
    const mit = await svc.getEntitlements('basic-mit');
    const ohne = await svc.getEntitlements('basic-ohne');
    const trial = await svc.getEntitlements('trial');
    expect(mit.features).toContain(FEATURE_FOLIERUNG_PPF);
    expect(ohne.features).not.toContain(FEATURE_FOLIERUNG_PPF);
    expect(trial.features).toBeNull(); // Trial: Vollzugriff (null)
  });
});
