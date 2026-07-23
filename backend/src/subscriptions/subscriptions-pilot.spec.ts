import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionStatus } from './entities/subscription.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Pilot-Verwaltung (Betreiber-Cockpit) in der Subscriptions-Domaene:
 *  - setPilot: Betrieb auf `pilot` (unbefristet) setzen, idempotent, schuetzt
 *    zahlende Tarife (nur aus trial/pilot heraus).
 *  - extendTrial: Testphase additiv um N Tage verlaengern, nur im Trial-Status
 *    (reaktiviert auch eine abgelaufene Testphase), zahlende Tarife unberuehrt.
 *
 * Reine Repo-Mocks (keine DB, kein Nest-Boot). Der Audit-Mock beweist, dass jede
 * Aktion protokolliert wird (Rechenschaft). Der Affiliate-Service wird bewusst
 * NICHT injiziert (@Optional) – Pilot/Trial machen einen Betrieb nicht zahlend.
 */
describe('SubscriptionsService · Pilot-Verwaltung (setPilot / extendTrial)', () => {
  let planRepo: { findOne: jest.Mock };
  let subRepo: { findOne: jest.Mock; save: jest.Mock };
  let tenantRepo: Record<string, jest.Mock>;
  let audit: { log: jest.Mock };
  let svc: SubscriptionsService;

  const user = { id: 'admin1', tenantId: 'plat', role: 'platform_admin' } as unknown as AuthUser;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterAll(() => jest.restoreAllMocks());

  beforeEach(() => {
    planRepo = { findOne: jest.fn().mockResolvedValue(null) };
    subRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((s: any) => Promise.resolve(s)),
    };
    tenantRepo = { find: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    svc = new SubscriptionsService(planRepo as any, subRepo as any, tenantRepo as any, audit as any);
  });

  // --- setPilot -------------------------------------------------------------

  describe('setPilot', () => {
    it('setzt einen Trial-Betrieb auf pilot + protokolliert', async () => {
      subRepo.findOne.mockResolvedValue({ id: 's1', tenantId: 't1', status: SubscriptionStatus.TRIAL });
      const view = await svc.setPilot(user, 't1', { notiz: '  Pilot Nord  ' });

      expect(view.status).toBe(SubscriptionStatus.PILOT);
      expect(view.access.access).toBe('full');
      // Notiz getrimmt gespeichert.
      expect(subRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'pilot', notiz: 'Pilot Nord' }));
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'subscription.set_pilot', tenantId: 't1', userId: 'admin1' }),
      );
    });

    it('idempotent: bereits pilot -> bleibt pilot (kein Fehler)', async () => {
      subRepo.findOne.mockResolvedValue({ id: 's1', tenantId: 't1', status: SubscriptionStatus.PILOT });
      const view = await svc.setPilot(user, 't1');
      expect(view.status).toBe(SubscriptionStatus.PILOT);
    });

    it('schuetzt zahlende Tarife: ACTIVE -> 409, kein Save', async () => {
      subRepo.findOne.mockResolvedValue({ id: 's1', tenantId: 't1', status: SubscriptionStatus.ACTIVE });
      await expect(svc.setPilot(user, 't1')).rejects.toBeInstanceOf(ConflictException);
      expect(subRepo.save).not.toHaveBeenCalled();
    });

    it('kein Abo -> 404', async () => {
      subRepo.findOne.mockResolvedValue(null);
      await expect(svc.setPilot(user, 't1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // --- extendTrial ----------------------------------------------------------

  describe('extendTrial', () => {
    it('verlaengert additiv ab dem zukuenftigen Trial-Ende', async () => {
      const ende = new Date(Date.now() + 3 * 24 * 3600e3); // in 3 Tagen
      subRepo.findOne.mockResolvedValue({ id: 's1', tenantId: 't1', status: SubscriptionStatus.TRIAL, trialEndsAt: ende });

      const view = await svc.extendTrial(user, 't1', { days: 14 });

      const neu = new Date(view.trialEndsAt!);
      const erwartet = new Date(ende);
      erwartet.setDate(erwartet.getDate() + 14);
      expect(neu.getTime()).toBe(erwartet.getTime());
      expect(view.status).toBe(SubscriptionStatus.TRIAL);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'subscription.extend_trial', tenantId: 't1', userId: 'admin1' }),
      );
    });

    it('reaktiviert eine abgelaufene Testphase: rechnet ab jetzt (nicht ab Vergangenheit)', async () => {
      const abgelaufen = new Date(Date.now() - 10 * 24 * 3600e3); // vor 10 Tagen
      subRepo.findOne.mockResolvedValue({ id: 's1', tenantId: 't1', status: SubscriptionStatus.TRIAL, trialEndsAt: abgelaufen });

      const vorher = Date.now();
      const view = await svc.extendTrial(user, 't1', { days: 7 });
      const neu = new Date(view.trialEndsAt!).getTime();

      // Neues Ende liegt ~7 Tage in der Zukunft (ab jetzt), nicht 3 Tage in der Vergangenheit.
      expect(neu).toBeGreaterThan(vorher + 6 * 24 * 3600e3);
      // access wieder full (Testphase reaktiviert).
      expect(view.access.access).toBe('full');
    });

    it('schuetzt zahlende Tarife: ACTIVE -> 409, kein Downgrade auf trial', async () => {
      subRepo.findOne.mockResolvedValue({ id: 's1', tenantId: 't1', status: SubscriptionStatus.ACTIVE });
      await expect(svc.extendTrial(user, 't1', { days: 14 })).rejects.toBeInstanceOf(ConflictException);
      expect(subRepo.save).not.toHaveBeenCalled();
    });

    it('Pilot-Betrieb -> 409 (extendTrial nicht anwendbar)', async () => {
      subRepo.findOne.mockResolvedValue({ id: 's1', tenantId: 't1', status: SubscriptionStatus.PILOT });
      await expect(svc.extendTrial(user, 't1', { days: 14 })).rejects.toBeInstanceOf(ConflictException);
    });

    it('kein Abo -> 404', async () => {
      subRepo.findOne.mockResolvedValue(null);
      await expect(svc.extendTrial(user, 't1', { days: 14 })).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
