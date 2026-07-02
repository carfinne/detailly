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
