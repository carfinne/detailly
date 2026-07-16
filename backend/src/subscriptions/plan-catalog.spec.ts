import { PLAN_CATALOG, planSeedBySlug, PlanSeed } from './plan-catalog';
import { hasFeature } from './plan-entitlements';
import { Plan } from './entities/plan.entity';

/**
 * Tarif-Matrix-Tests (Preismodell V2, docs/PRICING_V2.md). Sichert die
 * geschaeftskritische Zuordnung Feature -> Tarif ab: dass jeder der neuen sechs
 * Gates GENAU die berechtigten Stufen durchlaesst und die anderen sperrt, und
 * dass Pro (Pilot/Bestand) ALLE Module fuehrt. Rein (kein DB/Nest-Bootstrap):
 * `hasFeature` liest nur `plan.features`, daher genuegt der Katalog-Eintrag.
 */
describe('plan-catalog (Preismodell V2)', () => {
  const asPlan = (seed: PlanSeed): Plan => ({ ...seed } as unknown as Plan);
  const starter = planSeedBySlug('starter');
  const basic = planSeedBySlug('basic');
  const pro = planSeedBySlug('pro');

  const KERN = ['kunden', 'fahrzeuge', 'auftraege', 'termine', 'rechnungen', 'shop', 'mitarbeiter', 'standorte'];
  const NEUE_GATES = ['zeiterfassung', 'inspektion', 'auswertungen', 'wirtschaftlichkeit', 'mahnwesen', 'export', 'kalkulation', 'kundenerlebnis', 'schichtdicke'];

  it('genau drei buchbare Stufen in aufsteigender Preis-Reihenfolge', () => {
    expect(PLAN_CATALOG.map((p) => p.slug)).toEqual(['starter', 'basic', 'pro']);
    expect(PLAN_CATALOG.map((p) => p.preisMonatlich)).toEqual([29, 49, 79]);
    expect(PLAN_CATALOG.map((p) => p.preisJaehrlich)).toEqual([290, 490, 790]);
  });

  it('Jahrespreis ist jeweils das Zehnfache des Monatspreises (~2 Monate gratis)', () => {
    for (const p of PLAN_CATALOG) expect(p.preisJaehrlich).toBe(p.preisMonatlich * 10);
  });

  it('Kernmodule inkl. Shop sind in JEDER Stufe enthalten (Shop ist ueberall gratis)', () => {
    for (const p of PLAN_CATALOG) {
      for (const key of KERN) expect(hasFeature(asPlan(p), key)).toBe(true);
    }
  });

  describe('Limits je Stufe', () => {
    it('Starter: 3 Nutzer / 1 Standort / 500 Kunden', () => {
      expect(starter.limits).toEqual({ maxUsers: 3, maxLocations: 1, maxCustomers: 500 });
    });
    it('Basic: 10 Nutzer / 1 Standort / unbegrenzt Kunden', () => {
      expect(basic.limits).toEqual({ maxUsers: 10, maxLocations: 1, maxCustomers: null });
    });
    it('Pro: 25 Nutzer / 5 Standorte / unbegrenzt Kunden', () => {
      expect(pro.limits).toEqual({ maxUsers: 25, maxLocations: 5, maxCustomers: null });
    });
  });

  describe('Feature-Gates (die neuen Keys) je Stufe', () => {
    // Erwartete Freischaltung laut PRICING_V2 §2 + V3-Update (2026-07-12).
    // true = im Tarif enthalten.
    const MATRIX: Record<string, { starter: boolean; basic: boolean; pro: boolean }> = {
      inspektion: { starter: false, basic: true, pro: true },
      auswertungen: { starter: false, basic: true, pro: true },
      mahnwesen: { starter: false, basic: true, pro: true },
      export: { starter: false, basic: true, pro: true },
      // V3: 3D-Klick->Sofortpreis + Flaechenkalkulation (Gewerke-USP), ab Basic.
      kalkulation: { starter: false, basic: true, pro: true },
      wirtschaftlichkeit: { starter: false, basic: false, pro: true },
      zeiterfassung: { starter: false, basic: false, pro: true },
      audit: { starter: false, basic: false, pro: true },
      // Pro-Add-on Kunden-Erlebnis (gebrandeter Ticker + Uebergabe-Mappe).
      kundenerlebnis: { starter: false, basic: false, pro: true },
      // Pro-Add-on Schichtdicken-Messprotokoll (Lackschichtdicke, µm).
      schichtdicke: { starter: false, basic: false, pro: true },
    };

    for (const [key, erwartet] of Object.entries(MATRIX)) {
      it(`${key}: Starter=${erwartet.starter} Basic=${erwartet.basic} Pro=${erwartet.pro}`, () => {
        expect(hasFeature(asPlan(starter), key)).toBe(erwartet.starter);
        expect(hasFeature(asPlan(basic), key)).toBe(erwartet.basic);
        expect(hasFeature(asPlan(pro), key)).toBe(erwartet.pro);
      });
    }
  });

  it('kalkulation (V3, 2026-07-12): in Basic und Pro enthalten, NICHT in Starter', () => {
    expect(hasFeature(asPlan(starter), 'kalkulation')).toBe(false);
    expect(hasFeature(asPlan(basic), 'kalkulation')).toBe(true);
    expect(hasFeature(asPlan(pro), 'kalkulation')).toBe(true);
  });

  it('Pro fuehrt ALLE Feature-Keys (Bestand/Pilot verliert durch neue Gates nichts)', () => {
    for (const key of [...KERN, ...NEUE_GATES, 'audit']) {
      expect(hasFeature(asPlan(pro), key)).toBe(true);
    }
  });

  it('Bestand ohne Tarif bzw. mit features=null behaelt Vollzugriff auf alle neuen Gates', () => {
    for (const key of NEUE_GATES) {
      expect(hasFeature(null, key)).toBe(true);
      expect(hasFeature({ features: null } as unknown as Plan, key)).toBe(true);
    }
  });
});
