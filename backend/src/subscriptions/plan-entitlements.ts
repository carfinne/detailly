import { Plan, PlanLimits } from './entities/plan.entity';

/**
 * Pure Entitlement-Logik eines Tarifs (T-002, Umsatzsicherung): Welche Module
 * (features[]) und Mengen-Limits (limits) ein Betrieb laut Tarif nutzen darf.
 *
 * Bewusst **rein** (keine DB, kein `this`) wie `subscription-access.ts`, damit
 * `PlanFeatureGuard`, die Create-Pfade und Tests dieselbe Logik verwenden.
 *
 * Semantik (rueckwaertskompatibel):
 * - Kein Tarif zugewiesen (z. B. Trial mit planId null) -> alles erlaubt.
 * - `features == null` (nicht gepflegt)                 -> alle Module erlaubt.
 * - `features == []` (leer gepflegt)                    -> KEIN Modul erlaubt.
 * - `limits` fehlt oder `limits[key] == null`           -> unbegrenzt.
 *
 * TOCTOU-Hinweis (gilt fuer ALLE Aufrufer der Limit-Pruefung): Die Durchsetzung
 * ist count-then-save, Zaehlen und Speichern sind NICHT atomar. n parallele
 * Requests koennen das Limit daher um bis zu n-1 ueberschreiten. Fuer diese
 * Business-Limits bewusst toleriert - kein Lock, kein DB-Constraint.
 */

/** 403-Code: Modul ist im aktuellen Tarif nicht enthalten (Feature-Gate). */
export const PLAN_FEATURE_MISSING = 'PLAN_FEATURE_MISSING';
/** 403-Code: Mengen-Limit des Tarifs erreicht (maxUsers/maxLocations/maxCustomers). */
export const PLAN_LIMIT_REACHED = 'PLAN_LIMIT_REACHED';

/** Anzeigenamen der Feature-Keys fuer Fehlermeldungen (Fallback: der Key selbst). */
const FEATURE_LABELS: Record<string, string> = {
  kunden: 'Kundenverwaltung',
  fahrzeuge: 'Fahrzeugverwaltung',
  auftraege: 'Auftragsverwaltung',
  termine: 'Terminplanung',
  rechnungen: 'Rechnungen',
  shop: 'Shop & Lager',
  mitarbeiter: 'Mitarbeiterverwaltung',
  standorte: 'Standortverwaltung',
  audit: 'Audit-Log',
  // Preismodell V2 (docs/PRICING_V2.md): Mehrwert-Module ab Basic/Pro.
  zeiterfassung: 'Zeiterfassung',
  inspektion: '3D-Schadenserfassung',
  auswertungen: 'Auswertungen',
  wirtschaftlichkeit: 'Wirtschaftlichkeit',
  mahnwesen: 'Mahnwesen',
  export: 'Buchhaltungs-Export',
  // Preismodell V3 (2026-07-12): 3D-Klick->Sofortpreis + Flaechenkalkulation (ab Basic).
  kalkulation: '3D-Sofortkalkulation',
  // Smart Repair / PDR: 3D-Klick -> Dellen-Sofortpreis (ab Basic).
  dellenkalkulation: 'Dellenkalkulation',
  // Oeffentliches Schaufenster (Vorher/Nachher-Referenzen mit Consent, ab Basic).
  schaufenster: 'Schaufenster / Referenzen',
  // Pro-Add-on: gebrandeter Live-Ticker + Uebergabe-Mappe fuer den Endkunden.
  kundenerlebnis: 'Kunden-Erlebnis',
  // Pro-Add-on: Komfort beim E-Rechnungs-Eingang (Stapel-Import, Export-Uebergabe,
  // spaeter Mailbox). Empfang/Ansicht/Archiv selbst sind KERN (ungegated).
  erechnungEingang: 'E-Rechnungs-Eingang (Komfort)',
};

/** Anzeigenamen der Limit-Keys fuer Fehlermeldungen. */
const LIMIT_LABELS: Record<keyof PlanLimits, string> = {
  maxUsers: 'Mitarbeiter',
  maxLocations: 'Standorte',
  maxCustomers: 'Kunden',
};

/** Ist das Modul (Feature-Key) im Tarif enthalten? */
export function hasFeature(plan: Plan | null | undefined, feature: string): boolean {
  if (!plan) return true; // kein Tarif zugewiesen (z. B. Trial) -> Vollzugriff
  if (plan.features == null) return true; // features nicht gepflegt -> alles erlaubt
  return plan.features.includes(feature);
}

/**
 * Tarif-Berechtigungen des Betriebs, wie sie das Frontend zum Routen->Feature-
 * Mapping (Nav-Filter) liest (`GET /tenants/me/entitlements`). `features` wird
 * ROH durchgereicht – das Frontend mappt selbst; `null` = Vollzugriff.
 */
export interface TenantEntitlements {
  /** Slug des aktiven Tarifs (z. B. `basic`) – `null` ohne aktiven Tarif. */
  planSlug: string | null;
  /** Anzeigename des aktiven Tarifs – `null` ohne aktiven Tarif. */
  planName: string | null;
  /**
   * Rohe Feature-Key-Liste des Tarifs. `null` = kein/ungepflegter Tarif =
   * Vollzugriff (Backward-compat, siehe `hasFeature`); `[]` = bewusst KEIN Modul.
   */
  features: string[] | null;
  /** Mengen-Limits (je Key `null` = unbegrenzt). Ganze Ebene `null` ohne aktiven Tarif. */
  limits: { maxUsers: number | null; maxLocations: number | null; maxCustomers: number | null } | null;
}

/**
 * Leitet die `TenantEntitlements` REIN aus dem aktiven Tarif ab (keine DB, kein
 * `this` – wie `hasFeature`). Kein Tarif -> alle Felder `null` (= Vollzugriff/
 * unbegrenzt). Mit Tarif werden `features` roh durchgereicht und die Limits auf
 * die drei bekannten Keys normalisiert (fehlend -> `null` = unbegrenzt).
 */
export function buildEntitlements(plan: Plan | null | undefined): TenantEntitlements {
  if (!plan) {
    return { planSlug: null, planName: null, features: null, limits: null };
  }
  return {
    planSlug: plan.slug ?? null,
    planName: plan.name ?? null,
    features: plan.features ?? null,
    limits: {
      maxUsers: plan.limits?.maxUsers ?? null,
      maxLocations: plan.limits?.maxLocations ?? null,
      maxCustomers: plan.limits?.maxCustomers ?? null,
    },
  };
}

/**
 * Prueft ein Mengen-Limit: Darf bei `current` bestehenden Datensaetzen noch
 * EINER angelegt werden? Block bei `current >= max` (deckt auch den
 * Downgrade-Fall ab, in dem das Limit bereits ueberschritten ist).
 */
export function checkLimit(
  limits: PlanLimits | null | undefined,
  key: keyof PlanLimits,
  current: number,
): { allowed: boolean; max: number | null } {
  const max = limits?.[key];
  if (max === null || max === undefined) return { allowed: true, max: null };
  return { allowed: current < max, max };
}

/**
 * 403-Body fuer "Modul nicht im Tarif". Bewusst ein EIGENER Code (nicht
 * SUBSCRIPTION_INACTIVE), damit das Frontend einen gezielten Upgrade-Hinweis
 * zeigen kann statt auf die Sperrseite umzuleiten.
 */
export function featureMissingPayload(
  feature: string,
  planName?: string | null,
): { code: string; feature: string; message: string } {
  const label = FEATURE_LABELS[feature] ?? feature;
  const tarif = planName ? `im Tarif "${planName}"` : 'im aktuellen Tarif';
  return {
    code: PLAN_FEATURE_MISSING,
    feature,
    message: `Das Modul "${label}" ist ${tarif} nicht enthalten. Ein Upgrade schaltet es frei.`,
  };
}

/**
 * 403-Body fuer "Limit erreicht". `limit`/`max`/`current` geben dem Frontend
 * den Kontext fuer einen konkreten Upgrade-Hinweis; `hinweis` ergaenzt optional
 * einen fachlichen Ausweg (z. B. Annahme ohne Kundenanlage).
 */
export function limitReachedPayload(
  key: keyof PlanLimits,
  max: number,
  current: number,
  hinweis?: string,
): { code: string; limit: keyof PlanLimits; max: number; current: number; message: string } {
  const label = LIMIT_LABELS[key] ?? key;
  const basis = `Tarif-Limit erreicht: maximal ${max} ${label} im aktuellen Tarif (aktuell ${current}). Ein Upgrade erhoeht das Limit.`;
  return {
    code: PLAN_LIMIT_REACHED,
    limit: key,
    max,
    current,
    message: hinweis ? `${basis} ${hinweis}` : basis,
  };
}
