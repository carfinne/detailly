import { ForbiddenException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionStatus } from './entities/subscription.entity';
import { PLAN_FEATURE_MISSING, PLAN_LIMIT_REACHED } from './plan-entitlements';

/**
 * Tests fuer die serverseitige Tarif-Durchsetzung (T-002) auf Service-Ebene:
 * `assertFeature` / `assertLimit` mit gemockten Repositories (keine DB).
 * Die pure Logik dahinter testet plan-entitlements.spec.ts – hier geht es um
 * das Laden Sub -> Plan und den 403-Kontrakt (code/feature/limit/max/current).
 */
describe('SubscriptionsService - Tarif-Durchsetzung (assertFeature/assertLimit)', () => {
  const makeService = (opts: {
    sub?: Partial<{ tenantId: string; planId: string | null; status: SubscriptionStatus }> | null;
    plan?: Partial<{ id: string; name: string; features: string[] | null; limits: any }> | null;
  }) => {
    const subRepo = { findOne: jest.fn().mockResolvedValue(opts.sub ?? null) };
    const planRepo = { findOne: jest.fn().mockResolvedValue(opts.plan ?? null) };
    const tenantRepo = {};
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new SubscriptionsService(
      planRepo as any,
      subRepo as any,
      tenantRepo as any,
      audit as any,
    );
    return { service, subRepo, planRepo };
  };

  const starterPlan = {
    id: 'p-starter',
    name: 'Starter',
    features: ['kunden', 'fahrzeuge', 'auftraege', 'termine', 'rechnungen'],
    limits: { maxUsers: 5, maxLocations: 1, maxCustomers: 500 },
  };

  describe('assertFeature', () => {
    it('kein Abo-Datensatz -> kein Wurf (Sperre regelt der SubscriptionGuard davor)', async () => {
      const { service } = makeService({ sub: null });
      await expect(service.assertFeature('t1', 'shop')).resolves.toBeUndefined();
    });

    it('Abo ohne Tarif (Trial, planId null) -> Vollzugriff, Plan wird nicht geladen', async () => {
      const { service, planRepo } = makeService({
        sub: { tenantId: 't1', planId: null, status: SubscriptionStatus.TRIAL },
      });
      await expect(service.assertFeature('t1', 'shop')).resolves.toBeUndefined();
      expect(planRepo.findOne).not.toHaveBeenCalled();
    });

    it('Feature im Tarif -> kein Wurf', async () => {
      const { service } = makeService({
        sub: { tenantId: 't1', planId: 'p-starter', status: SubscriptionStatus.ACTIVE },
        plan: starterPlan,
      });
      await expect(service.assertFeature('t1', 'kunden')).resolves.toBeUndefined();
    });

    it('Feature NICHT im Tarif -> 403 PLAN_FEATURE_MISSING mit feature + Tarifname', async () => {
      const { service } = makeService({
        sub: { tenantId: 't1', planId: 'p-starter', status: SubscriptionStatus.ACTIVE },
        plan: starterPlan,
      });
      const err = await service.assertFeature('t1', 'shop').catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = err.getResponse() as Record<string, unknown>;
      expect(body.code).toBe(PLAN_FEATURE_MISSING);
      expect(body.feature).toBe('shop');
      expect(String(body.message)).toContain('Starter');
    });

    it('features nicht gepflegt (null) -> alles erlaubt', async () => {
      const { service } = makeService({
        sub: { tenantId: 't1', planId: 'p-x', status: SubscriptionStatus.ACTIVE },
        plan: { id: 'p-x', name: 'X', features: null, limits: null },
      });
      await expect(service.assertFeature('t1', 'shop')).resolves.toBeUndefined();
    });

    it('Abfrage laeuft tenant-scoped (Sub des EIGENEN Betriebs)', async () => {
      const { service, subRepo } = makeService({ sub: null });
      await service.assertFeature('t-adversarial', 'shop');
      expect(subRepo.findOne).toHaveBeenCalledWith({ where: { tenantId: 't-adversarial' } });
    });
  });

  describe('assertLimit', () => {
    const withStarter = () =>
      makeService({
        sub: { tenantId: 't1', planId: 'p-starter', status: SubscriptionStatus.ACTIVE },
        plan: starterPlan,
      });

    it('unter dem Limit -> kein Wurf', async () => {
      const { service } = withStarter();
      await expect(service.assertLimit('t1', 'maxUsers', 4)).resolves.toBeUndefined();
    });

    it('Limit voll (current == max) -> 403 PLAN_LIMIT_REACHED mit limit/max/current', async () => {
      const { service } = withStarter();
      const err = await service.assertLimit('t1', 'maxUsers', 5).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = err.getResponse() as Record<string, unknown>;
      expect(body.code).toBe(PLAN_LIMIT_REACHED);
      expect(body.limit).toBe('maxUsers');
      expect(body.max).toBe(5);
      expect(body.current).toBe(5);
    });

    it('Limit bereits ueberschritten (Downgrade Pro->Starter) -> 403, Bestandsdaten unangetastet', async () => {
      const { service } = withStarter();
      await expect(service.assertLimit('t1', 'maxCustomers', 800)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('Limit null (Pro: maxCustomers unbegrenzt) -> kein Wurf', async () => {
      const { service } = makeService({
        sub: { tenantId: 't1', planId: 'p-pro', status: SubscriptionStatus.ACTIVE },
        plan: { id: 'p-pro', name: 'Pro', features: null, limits: { maxUsers: 25, maxCustomers: null } },
      });
      await expect(service.assertLimit('t1', 'maxCustomers', 100000)).resolves.toBeUndefined();
    });

    it('kein Abo / kein Tarif -> unbegrenzt (kein Wurf)', async () => {
      const { service } = makeService({ sub: null });
      await expect(service.assertLimit('t1', 'maxUsers', 999)).resolves.toBeUndefined();
    });

    it('optionaler Hinweis (fachlicher Ausweg) landet in der Fehlermeldung', async () => {
      const { service } = withStarter();
      const err = await service
        .assertLimit('t1', 'maxCustomers', 500, 'Annahme ohne Kundenanlage moeglich.')
        .catch((e) => e);
      const body = err.getResponse() as Record<string, unknown>;
      expect(String(body.message)).toContain('Annahme ohne Kundenanlage moeglich.');
    });
  });
});
