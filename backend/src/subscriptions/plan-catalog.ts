import { PlanLimits } from './entities/plan.entity';

/**
 * Tarif-Katalog (Preismodell V2, siehe docs/PRICING_V2.md) – die EINE Quelle der
 * Wahrheit fuer die drei Self-Service-Stufen Starter/Basic/Pro. Sowohl der Seed
 * (`database/seed.ts`) als auch die Tarif-Matrix-Tests lesen von hier, damit
 * Seed und Test nie auseinanderlaufen.
 *
 * Semantik-Erinnerung (siehe `plan-entitlements.ts`): eine gepflegte
 * `features[]`-Liste gatet exakt die enthaltenen Keys; Bestands-/Trial-Betriebe
 * OHNE Tarif bzw. mit `features == null` behalten Vollzugriff. Pro fuehrt bewusst
 * ALLE Feature-Keys, damit ein Pro-Betrieb (z. B. der Pilot) durch das Nachziehen
 * neuer Gates niemals ein Modul verliert.
 *
 * Preise sind Default/Anzeige; verbindlich fuer den Kauf ist die in Stripe
 * gepflegte Price-ID (stripePriceId/…Yearly, vom Betreiber im Tarif-Editor
 * gesetzt). Jahrespreis = preisMonatlich * 10 (~2 Monate gratis, Seed-Konvention).
 */
export interface PlanSeed {
  slug: string;
  name: string;
  beschreibung: string;
  preisMonatlich: number;
  preisJaehrlich: number;
  features: string[];
  limits: PlanLimits;
}

/**
 * Kernmodule in JEDER Stufe. Der Shop ist ab Preismodell V2 bewusst ueberall
 * gratis (frueher Pro-only). `mitarbeiter`/`standorte` bleiben in allen Stufen
 * aktiv – die Differenzierung laeuft ueber die Limits `maxUsers`/`maxLocations`.
 */
const KERN = [
  'kunden',
  'fahrzeuge',
  'auftraege',
  'termine',
  'rechnungen',
  'shop',
  'mitarbeiter',
  'standorte',
] as const;

/** Mehrwert-Module ab Basic (3D-Schadenserfassung, Auswertungen, Mahnwesen, Buchhaltungs-Export). */
const BASIC_PLUS = ['inspektion', 'auswertungen', 'mahnwesen', 'export'] as const;

/** Pro-exklusive Module (zusaetzlich zu Basic): Zeiterfassung, Wirtschaftlichkeit, Audit-Log. */
const PRO_PLUS = ['zeiterfassung', 'wirtschaftlichkeit', 'audit'] as const;

/**
 * Die drei buchbaren Tarife (aufsteigender Preis). Reihenfolge = Anzeige-/Seed-
 * Reihenfolge; der Seed haengt den Pilotbetrieb an den `pro`-Eintrag.
 */
export const PLAN_CATALOG: PlanSeed[] = [
  {
    slug: 'starter',
    name: 'Starter',
    beschreibung: 'Einstieg: alle Kernmodule inkl. Shop/Lager fuer einen Standort.',
    preisMonatlich: 29,
    preisJaehrlich: 290,
    features: [...KERN],
    limits: { maxUsers: 3, maxLocations: 1, maxCustomers: 500 },
  },
  {
    slug: 'basic',
    name: 'Basic',
    beschreibung:
      'Etablierter Betrieb: Kern + 3D-Schadenserfassung, Auswertungen, Mahnwesen und Buchhaltungs-Export.',
    preisMonatlich: 49,
    preisJaehrlich: 490,
    features: [...KERN, ...BASIC_PLUS],
    limits: { maxUsers: 10, maxLocations: 1, maxCustomers: null },
  },
  {
    slug: 'pro',
    name: 'Pro',
    beschreibung:
      'Alles inklusive: zusaetzlich Zeiterfassung, Wirtschaftlichkeit, Audit-Log und bis zu 5 Standorte.',
    preisMonatlich: 79,
    preisJaehrlich: 790,
    features: [...KERN, ...BASIC_PLUS, ...PRO_PLUS],
    limits: { maxUsers: 25, maxLocations: 5, maxCustomers: null },
  },
];

/** Katalog-Eintrag per slug (fuer Seed/Tests). Wirft, wenn der slug fehlt. */
export function planSeedBySlug(slug: string): PlanSeed {
  const found = PLAN_CATALOG.find((p) => p.slug === slug);
  if (!found) throw new Error(`Unbekannter Tarif-slug: ${slug}`);
  return found;
}
