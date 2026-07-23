import { hasEffectiveFeature, buildEntitlements } from './plan-entitlements';
import { planSeedBySlug, FEATURE_FOLIERUNG_PPF } from './plan-catalog';
import { Plan } from './entities/plan.entity';

/**
 * Effektive Feature-Aufloesung des à-la-carte Add-ons `folierung_ppf`
 * (Trial offen · Tarif ohne Add-on gesperrt · Add-on gebucht offen) sowie die
 * Merge-Semantik in `buildEntitlements` (Nav-Filter des Frontends). Rein (kein
 * DB/Nest-Bootstrap), analog plan-catalog.spec.
 */
describe('folierung_ppf · effektive Entitlements', () => {
  const asPlan = (slug: string): Plan => ({ ...planSeedBySlug(slug) } as unknown as Plan);
  const basic = asPlan('basic');
  const pro = asPlan('pro');

  describe('hasEffectiveFeature', () => {
    it('Trial/kein Tarif (plan null): Add-on OFFEN (Vollzugriff im Test)', () => {
      expect(hasEffectiveFeature(null, null, FEATURE_FOLIERUNG_PPF)).toBe(true);
      expect(hasEffectiveFeature(null, [], FEATURE_FOLIERUNG_PPF)).toBe(true);
    });

    it('features==null (ungepflegt/Pilot): Add-on OFFEN', () => {
      const p = { features: null } as unknown as Plan;
      expect(hasEffectiveFeature(p, [], FEATURE_FOLIERUNG_PPF)).toBe(true);
    });

    it('zahlender Tarif OHNE gebuchtes Add-on: GESPERRT (auch Pro)', () => {
      expect(hasEffectiveFeature(basic, [], FEATURE_FOLIERUNG_PPF)).toBe(false);
      expect(hasEffectiveFeature(basic, null, FEATURE_FOLIERUNG_PPF)).toBe(false);
      expect(hasEffectiveFeature(pro, [], FEATURE_FOLIERUNG_PPF)).toBe(false);
    });

    it('zahlender Tarif MIT gebuchtem Add-on: OFFEN', () => {
      expect(hasEffectiveFeature(basic, [FEATURE_FOLIERUNG_PPF], FEATURE_FOLIERUNG_PPF)).toBe(true);
    });

    it('Tarif-Kernfeature bleibt unabhaengig vom Add-on erreichbar', () => {
      expect(hasEffectiveFeature(basic, [], 'kunden')).toBe(true);
      // Ein fremder, nicht gebuchter Key bleibt gesperrt.
      expect(hasEffectiveFeature(basic, [FEATURE_FOLIERUNG_PPF], 'audit')).toBe(false);
    });
  });

  describe('buildEntitlements (Nav-Filter-Quelle)', () => {
    it('kein Tarif -> features null (Vollzugriff, Add-on implizit sichtbar)', () => {
      expect(buildEntitlements(null, [FEATURE_FOLIERUNG_PPF]).features).toBeNull();
    });

    it('Tarif ohne Add-on -> features enthaelt folierung_ppf NICHT', () => {
      const e = buildEntitlements(basic, []);
      expect(e.features).not.toContain(FEATURE_FOLIERUNG_PPF);
      expect(e.features).toContain('kunden');
    });

    it('Tarif mit gebuchtem Add-on -> features enthaelt folierung_ppf (dedupliziert)', () => {
      const e = buildEntitlements(basic, [FEATURE_FOLIERUNG_PPF, FEATURE_FOLIERUNG_PPF]);
      expect(e.features).toContain(FEATURE_FOLIERUNG_PPF);
      expect(e.features!.filter((f) => f === FEATURE_FOLIERUNG_PPF)).toHaveLength(1);
      // Tarif-Features bleiben vollstaendig erhalten.
      expect(e.features).toEqual(expect.arrayContaining(basic.features));
    });

    it('Alt-Aufruf ohne addons-Argument bleibt unveraendert (nur Tarif-Features)', () => {
      const e = buildEntitlements(basic);
      expect(e.features).toEqual(basic.features);
    });
  });
});
