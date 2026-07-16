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

/**
 * Kanonischer Feature-Key des Mahnwesens – die EINE Quelle fuer diesen String.
 * Referenziert von der Katalog-Definition (BASIC_PLUS) UND vom Auto-Mahn-Gate
 * (mahn-automatik.service), damit Katalog, Feature-Gate und der Entitlements-
 * Endpoint (roh `plan.features`) exakt denselben Schluessel verwenden.
 */
export const FEATURE_MAHNWESEN = 'mahnwesen';

/**
 * Kanonischer Feature-Key des Pro-Add-ons "Kunden-Erlebnis" (gebrandeter Live-
 * Ticker + Uebergabe-Mappe; spaeter Vorher/Nachher-Reveal). EINE Quelle fuer
 * diesen String: referenziert vom Katalog (PRO_PLUS) UND vom serverseitigen
 * Tenant-Gate der oeffentlichen Endpunkte (orders.service -> hasFeatureForTenant).
 *
 * Add-on-Naht: Der Key steht bewusst EIGENSTAENDIG in PRO_PLUS (keine gebuendelte
 * Logik). Wird er spaeter à la carte verkauft, aendert sich nur die Feature-
 * Aufloesung (getTenantPlan/getEffectiveFeatures) – nicht die Aufrufstellen.
 */
export const FEATURE_KUNDENERLEBNIS = 'kundenerlebnis';

/**
 * Kanonischer Feature-Key des Pro-Add-ons "Schichtdicken-Messprotokoll"
 * (Lackschichtdicke, µm: 3D-Heatmap + Auffaelligkeits-Hinweis + PDF-Bericht).
 * EINE Quelle fuer diesen String: referenziert vom Katalog (PRO_PLUS) UND vom
 * Controller-Gate (@RequiresFeature).
 *
 * Add-on-Naht (analog kundenerlebnis): steht EIGENSTAENDIG in PRO_PLUS. Wird er
 * spaeter à la carte verkauft, aendert sich nur die Feature-Aufloesung
 * (getTenantPlan/getEffectiveFeatures) – nicht die Aufrufstellen.
 */
export const FEATURE_SCHICHTDICKE = 'schichtdicke';

/**
 * Kanonischer Feature-Key des Pro-Add-ons "E-Rechnungs-Eingang – Komfort".
 *
 * WICHTIG: Der EMPFANG/das LESEN/das ARCHIV einer eingehenden E-Rechnung ist
 * gesetzliche Pflicht (§14 UStG) und daher KERN – der Empfangs-Controller
 * (e-invoice-eingang) traegt bewusst KEIN Klassen-Gate und dieser Key steht
 * NICHT in KERN. Dieser Key gatet allein die KOMFORT-Schicht (Stapel-/Massen-
 * Import, Uebergabe an den Buchhaltungs-Export, spaeter eigene Empfangs-Mailbox)
 * – Mehrwert, keine Pflicht (Welle 2).
 *
 * Add-on-Naht wie FEATURE_KUNDENERLEBNIS: steht eigenstaendig in PRO_PLUS. Wird
 * er spaeter à la carte verkauft, aendert sich nur die Feature-Aufloesung, nicht
 * die (kuenftigen) Aufrufstellen der Komfort-Endpunkte.
 */
export const FEATURE_ERECHNUNG_EINGANG = 'erechnungEingang';

/**
 * Mehrwert-Module ab Basic (3D-Schadenserfassung, Auswertungen, Mahnwesen,
 * Buchhaltungs-Export) sowie der gewerkespezifische Sofortpreis-USP `kalkulation`.
 *
 * `kalkulation` = 3D-Klick->Sofortpreis + Flaechenkalkulation.
 * V3: gewerkespezifischer USP Folierung/PPF, Betreiber-Entscheidung 2026-07-12.
 * Enthalten in Basic und Pro, NICHT in Starter (Pro fuehrt alle Basic-Plus-Keys,
 * der Pilot auf Pro erhaelt den Key also automatisch).
 */
const BASIC_PLUS = ['inspektion', 'auswertungen', FEATURE_MAHNWESEN, 'export', 'kalkulation'] as const;

/**
 * Pro-exklusive Module (zusaetzlich zu Basic): Zeiterfassung, Wirtschaftlichkeit,
 * Audit-Log, das Kunden-Erlebnis-Add-on (gebrandeter Ticker + Uebergabe-Mappe)
 * und das Schichtdicken-Messprotokoll (Lackschichtdicke, µm).
 */
const PRO_PLUS = [
  'zeiterfassung',
  'wirtschaftlichkeit',
  'audit',
  FEATURE_KUNDENERLEBNIS,
  FEATURE_SCHICHTDICKE,
  FEATURE_ERECHNUNG_EINGANG,
] as const;

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
