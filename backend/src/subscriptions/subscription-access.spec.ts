import { evaluateSubscription } from './subscription-access';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';

/**
 * Tests fuer die geschaeftskritische Abo-Sperrlogik (`evaluateSubscription`).
 *
 * Die Funktion ist bewusst REIN (keine DB, kein `this`); `now` wird als 2. Argument
 * fix injiziert, damit jeder Datums-Grenzfall deterministisch ist. Wir importieren
 * nur die Funktion + das Enum, keine DataSource -> kein nativer Treiber noetig.
 *
 * WICHTIG: Das FAIL-OPEN-Verhalten (kein Abo / unbekannter Status -> 'full') ist
 * gewolltes Soll und wird hier festgeschrieben, damit es nicht versehentlich auf
 * fail-closed gedreht wird (das wuerde Bestandskunden aussperren).
 */
describe('evaluateSubscription', () => {
  // Fixer Bezugszeitpunkt fuer alle Datums-abhaengigen Faelle.
  const now = new Date('2026-01-15T12:00:00.000Z');
  const inDerZukunft = new Date('2026-02-01T00:00:00.000Z');
  const inDerVergangenheit = new Date('2026-01-01T00:00:00.000Z');

  // Baut ein Test-Abo. strictNullChecks:false -> Teil-Objekt als Subscription ok.
  const sub = (over: Partial<Subscription>): Subscription => ({ ...over } as Subscription);

  describe('Fail-open (kein Aussperren)', () => {
    it('null-Abo -> full / none (Bestandskunde ohne Abo-Datensatz)', () => {
      expect(evaluateSubscription(null, now)).toEqual({
        access: 'full',
        status: 'none',
        reason: 'Kein Abo hinterlegt',
      });
    });

    it('undefined-Abo -> full / none', () => {
      const r = evaluateSubscription(undefined, now);
      expect(r.access).toBe('full');
      expect(r.status).toBe('none');
    });

    it('unbekannter Status -> full / none (defensiv, kein Aussperren)', () => {
      const r = evaluateSubscription(sub({ status: 'galaktisch' as SubscriptionStatus }), now);
      expect(r.access).toBe('full');
      expect(r.status).toBe('none');
      expect(r.reason).toBe('Unbekannter Status');
    });
  });

  describe('ACTIVE', () => {
    it('-> full', () => {
      const r = evaluateSubscription(sub({ status: SubscriptionStatus.ACTIVE }), now);
      expect(r.access).toBe('full');
      expect(r.status).toBe(SubscriptionStatus.ACTIVE);
    });
  });

  describe('TRIAL', () => {
    it('trialEndsAt in der Zukunft -> full (Testphase aktiv)', () => {
      const r = evaluateSubscription(
        sub({ status: SubscriptionStatus.TRIAL, trialEndsAt: inDerZukunft }),
        now,
      );
      expect(r.access).toBe('full');
      expect(r.reason).toBe('Testphase aktiv');
    });

    it('now > trialEndsAt -> blocked (Testphase abgelaufen)', () => {
      const r = evaluateSubscription(
        sub({ status: SubscriptionStatus.TRIAL, trialEndsAt: inDerVergangenheit }),
        now,
      );
      expect(r.access).toBe('blocked');
      expect(r.reason).toBe('Testphase abgelaufen');
    });

    it('trialEndsAt = null -> full (kein Ablaufdatum -> nicht sperren)', () => {
      const r = evaluateSubscription(
        sub({ status: SubscriptionStatus.TRIAL, trialEndsAt: null }),
        now,
      );
      expect(r.access).toBe('full');
    });
  });

  describe('PAST_DUE', () => {
    it('-> warn (Zugriff mit Hinweis, Zahlung offen)', () => {
      const r = evaluateSubscription(sub({ status: SubscriptionStatus.PAST_DUE }), now);
      expect(r.access).toBe('warn');
      expect(r.status).toBe(SubscriptionStatus.PAST_DUE);
    });
  });

  describe('CANCELED', () => {
    it('cancelAtPeriodEnd=true && now < currentPeriodEnd -> warn (Zugang bis Laufzeitende)', () => {
      const r = evaluateSubscription(
        sub({
          status: SubscriptionStatus.CANCELED,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: inDerZukunft,
        }),
        now,
      );
      expect(r.access).toBe('warn');
    });

    it('cancelAtPeriodEnd=false -> blocked (sofort gesperrt)', () => {
      const r = evaluateSubscription(
        sub({
          status: SubscriptionStatus.CANCELED,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: inDerZukunft,
        }),
        now,
      );
      expect(r.access).toBe('blocked');
    });

    it('cancelAtPeriodEnd=true aber now >= currentPeriodEnd -> blocked (Laufzeit vorbei)', () => {
      const r = evaluateSubscription(
        sub({
          status: SubscriptionStatus.CANCELED,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: inDerVergangenheit,
        }),
        now,
      );
      expect(r.access).toBe('blocked');
    });

    it('cancelAtPeriodEnd=true aber currentPeriodEnd=null -> blocked', () => {
      const r = evaluateSubscription(
        sub({
          status: SubscriptionStatus.CANCELED,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: null,
        }),
        now,
      );
      expect(r.access).toBe('blocked');
    });
  });

  describe('SUSPENDED', () => {
    it('-> blocked (vom Betreiber gesperrt)', () => {
      const r = evaluateSubscription(sub({ status: SubscriptionStatus.SUSPENDED }), now);
      expect(r.access).toBe('blocked');
      expect(r.status).toBe(SubscriptionStatus.SUSPENDED);
    });
  });
});
