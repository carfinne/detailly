import {
  hasFeature,
  checkLimit,
  featureMissingPayload,
  limitReachedPayload,
  buildEntitlements,
  PLAN_FEATURE_MISSING,
  PLAN_LIMIT_REACHED,
} from './plan-entitlements';
import { Plan } from './entities/plan.entity';

/**
 * Tests fuer die geschaeftskritische Tarif-Entitlement-Logik (T-002).
 * Rein wie subscription-access.spec: keine DB, kein Nest-Bootstrap.
 */
describe('plan-entitlements', () => {
  // strictNullChecks:false -> Teil-Objekt als Plan ok (wie in subscription-access.spec).
  const plan = (over: Partial<Plan>): Plan => ({ ...over } as Plan);

  describe('hasFeature', () => {
    it('kein Plan (null/undefined) -> alles erlaubt (Trial ohne Tarif)', () => {
      expect(hasFeature(null, 'shop')).toBe(true);
      expect(hasFeature(undefined, 'shop')).toBe(true);
    });

    it('features == null (nicht gepflegt) -> alles erlaubt', () => {
      expect(hasFeature(plan({ features: null as unknown as string[] }), 'shop')).toBe(true);
      expect(hasFeature(plan({}), 'shop')).toBe(true);
    });

    it('Key enthalten -> erlaubt', () => {
      expect(hasFeature(plan({ features: ['kunden', 'shop'] }), 'shop')).toBe(true);
    });

    it('Key fehlt -> verboten (Starter ohne Pro-Modul)', () => {
      expect(hasFeature(plan({ features: ['kunden', 'auftraege'] }), 'shop')).toBe(false);
    });

    it('leeres Array -> NICHTS erlaubt (bewusst, leer gepflegt)', () => {
      expect(hasFeature(plan({ features: [] }), 'kunden')).toBe(false);
    });
  });

  describe('checkLimit', () => {
    it('limits fehlt komplett -> unbegrenzt', () => {
      expect(checkLimit(null, 'maxUsers', 999)).toEqual({ allowed: true, max: null });
      expect(checkLimit(undefined, 'maxUsers', 999)).toEqual({ allowed: true, max: null });
    });

    it('limits[key] == null -> unbegrenzt (Pro: maxCustomers null)', () => {
      expect(checkLimit({ maxCustomers: null }, 'maxCustomers', 100000)).toEqual({
        allowed: true,
        max: null,
      });
    });

    it('limits[key] fehlt -> unbegrenzt', () => {
      expect(checkLimit({ maxUsers: 5 }, 'maxCustomers', 100000).allowed).toBe(true);
    });

    it('current < max -> erlaubt', () => {
      expect(checkLimit({ maxUsers: 5 }, 'maxUsers', 4)).toEqual({ allowed: true, max: 5 });
    });

    it('current == max -> Block (Limit voll)', () => {
      expect(checkLimit({ maxUsers: 5 }, 'maxUsers', 5)).toEqual({ allowed: false, max: 5 });
    });

    it('current > max -> Block (Downgrade-Fall: Limit bereits ueberschritten)', () => {
      expect(checkLimit({ maxCustomers: 500 }, 'maxCustomers', 800)).toEqual({
        allowed: false,
        max: 500,
      });
    });

    it('max: 0 -> gar nichts anlegbar', () => {
      expect(checkLimit({ maxLocations: 0 }, 'maxLocations', 0).allowed).toBe(false);
    });
  });

  describe('Fehler-Payloads (Frontend-Kontrakt)', () => {
    it('featureMissingPayload: eigener Code + feature-Feld + deutscher Text', () => {
      const p = featureMissingPayload('shop', 'Starter');
      expect(p.code).toBe(PLAN_FEATURE_MISSING);
      expect(p.feature).toBe('shop');
      expect(p.message).toContain('Shop & Lager');
      expect(p.message).toContain('Starter');
    });

    it('featureMissingPayload ohne Plan-Name: generischer Tarif-Text, unbekannter Key als Label', () => {
      const p = featureMissingPayload('zeitmaschine');
      expect(p.message).toContain('im aktuellen Tarif');
      expect(p.message).toContain('zeitmaschine');
    });

    it('featureMissingPayload nutzt die neuen V2-Labels (z. B. inspektion/mahnwesen)', () => {
      expect(featureMissingPayload('inspektion', 'Starter').message).toContain('3D-Schadenserfassung');
      expect(featureMissingPayload('mahnwesen', 'Starter').message).toContain('Mahnwesen');
      expect(featureMissingPayload('export', 'Basic').message).toContain('Buchhaltungs-Export');
    });

    it('limitReachedPayload: eigener Code + limit/max/current fuer gezielte Upgrade-Hinweise', () => {
      const p = limitReachedPayload('maxUsers', 5, 5);
      expect(p.code).toBe(PLAN_LIMIT_REACHED);
      expect(p.limit).toBe('maxUsers');
      expect(p.max).toBe(5);
      expect(p.current).toBe(5);
      expect(p.message).toContain('maximal 5 Mitarbeiter');
    });

    it('limitReachedPayload haengt optionalen Hinweis (fachlicher Ausweg) an', () => {
      const p = limitReachedPayload('maxCustomers', 500, 500, 'Ausweg XYZ.');
      expect(p.message).toContain('Ausweg XYZ.');
    });

    it('die Codes unterscheiden sich von SUBSCRIPTION_INACTIVE (kein Sperrseiten-Redirect)', () => {
      expect(PLAN_FEATURE_MISSING).not.toBe('SUBSCRIPTION_INACTIVE');
      expect(PLAN_LIMIT_REACHED).not.toBe('SUBSCRIPTION_INACTIVE');
      expect(PLAN_FEATURE_MISSING).not.toBe(PLAN_LIMIT_REACHED);
    });
  });

  describe('buildEntitlements (Frontend-Kontrakt /tenants/me/entitlements)', () => {
    it('kein Tarif (null/undefined) -> alle Felder null (Vollzugriff/unbegrenzt)', () => {
      const erwartet = { planSlug: null, planName: null, features: null, limits: null };
      expect(buildEntitlements(null)).toEqual(erwartet);
      expect(buildEntitlements(undefined)).toEqual(erwartet);
    });

    it('features == null (nicht gepflegt) -> features: null, Limits normalisiert', () => {
      const e = buildEntitlements(plan({ slug: 'pro', name: 'Pro', features: null as unknown as string[], limits: { maxUsers: 25, maxCustomers: null } }));
      expect(e).toEqual({
        planSlug: 'pro',
        planName: 'Pro',
        features: null,
        limits: { maxUsers: 25, maxLocations: null, maxCustomers: null },
      });
    });

    it('gepflegter Tarif -> rohe features-Liste + exakte Limit-Shape', () => {
      const e = buildEntitlements(
        plan({
          slug: 'basic',
          name: 'Basic',
          features: ['kunden', 'rechnungen', 'mahnwesen'],
          limits: { maxUsers: 10, maxLocations: 1, maxCustomers: 500 },
        }),
      );
      expect(e).toEqual({
        planSlug: 'basic',
        planName: 'Basic',
        features: ['kunden', 'rechnungen', 'mahnwesen'],
        limits: { maxUsers: 10, maxLocations: 1, maxCustomers: 500 },
      });
    });

    it('leeres features-Array bleibt [] (bewusst KEIN Modul, nicht null)', () => {
      const e = buildEntitlements(plan({ slug: 's', name: 'S', features: [] }));
      expect(e.features).toEqual([]);
    });

    it('Tarif ohne limits -> alle Limit-Keys null (unbegrenzt), Ebene nicht null', () => {
      const e = buildEntitlements(plan({ slug: 's', name: 'S', features: ['kunden'] }));
      expect(e.limits).toEqual({ maxUsers: null, maxLocations: null, maxCustomers: null });
    });
  });
});
