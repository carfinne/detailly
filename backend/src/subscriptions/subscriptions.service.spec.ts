import { Logger } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Fokus dieser Suite:
 *  1. Cron-Kontext: `getTenantPlan` funktioniert OHNE aktiven Request (kein
 *     request-memo-Store) – der Lookup faellt transparent auf die DB zurueck
 *     und haengt an KEINEM Request-Scope-State. Genau dieser Pfad wird vom
 *     Auto-Mahn-Job (IntervalScheduler) genutzt.
 *  2. `getEntitlements` leitet die Frontend-Shape aus dem aktiven Tarif ab.
 *
 * Bewusst mit reinen Repo-Mocks (keine DB, kein Nest-Bootstrap, kein als.run):
 * das Fehlen der request-memo-Middleware IST der zu beweisende Cron-Zustand.
 */
describe('SubscriptionsService (Cron-Kontext + Entitlements)', () => {
  let planRepo: { findOne: jest.Mock; find: jest.Mock };
  let subRepo: { findOne: jest.Mock; find: jest.Mock };
  let tenantRepo: { find: jest.Mock };
  let svc: SubscriptionsService;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterAll(() => jest.restoreAllMocks());

  beforeEach(() => {
    planRepo = { findOne: jest.fn(), find: jest.fn() };
    subRepo = { findOne: jest.fn(), find: jest.fn() };
    tenantRepo = { find: jest.fn() };
    svc = new SubscriptionsService(planRepo as any, subRepo as any, tenantRepo as any, {} as any);
  });

  describe('getTenantPlan ohne Request-Scope (Cron/IntervalScheduler)', () => {
    it('loest den Tarif direkt aus der DB auf (kein als.run / kein Memo-Store noetig)', async () => {
      subRepo.findOne.mockResolvedValue({ planId: 'p1' });
      const plan = { id: 'p1', slug: 'basic', name: 'Basic' };
      planRepo.findOne.mockResolvedValue(plan);

      // Direkter Aufruf – KEINE requestMemoMiddleware/als.run drumherum.
      const result = await svc.getTenantPlan('t1');

      expect(result).toBe(plan);
      expect(subRepo.findOne).toHaveBeenCalledWith({ where: { tenantId: 't1' } });
      expect(planRepo.findOne).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });

    it('kein Abo bzw. kein planId -> null (kein Tarif = Vollzugriff im Gate)', async () => {
      subRepo.findOne.mockResolvedValue(null);
      expect(await svc.getTenantPlan('t1')).toBeNull();

      subRepo.findOne.mockResolvedValue({ planId: null });
      expect(await svc.getTenantPlan('t2')).toBeNull();
      expect(planRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('getEntitlements', () => {
    it('aktiver Tarif -> rohe features + normalisierte Limits', async () => {
      subRepo.findOne.mockResolvedValue({ planId: 'p1' });
      planRepo.findOne.mockResolvedValue({
        slug: 'basic',
        name: 'Basic',
        features: ['kunden', 'rechnungen', 'mahnwesen'],
        limits: { maxUsers: 10, maxLocations: 1, maxCustomers: null },
      });

      expect(await svc.getEntitlements('t1')).toEqual({
        planSlug: 'basic',
        planName: 'Basic',
        features: ['kunden', 'rechnungen', 'mahnwesen'],
        limits: { maxUsers: 10, maxLocations: 1, maxCustomers: null },
      });
    });

    it('kein aktiver Tarif -> alle Felder null (Vollzugriff)', async () => {
      subRepo.findOne.mockResolvedValue(null);
      expect(await svc.getEntitlements('t1')).toEqual({
        planSlug: null,
        planName: null,
        features: null,
        limits: null,
      });
    });
  });
});
