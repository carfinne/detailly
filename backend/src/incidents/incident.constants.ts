/**
 * Konstanten, Typen und reine Helfer des Datenpannen-Registers (Art. 33/34 DSGVO).
 *
 * Status/Schweregrad/Quelle/Signaltyp bewusst als const-Arrays + Union-Typen und in
 * der DB als TEXT-Spalten (nicht Postgres-`enum`): das spaetere Aendern eines
 * Enum-WERTS ist bei Postgres teuer/heikel (vgl. Reseed-Lektion), waehrend TEXT +
 * `@IsIn(...)`-Validierung genauso strikt ist und schmerzfrei erweiterbar bleibt.
 */

/** Bearbeitungsstatus eines Vorfalls (Melde-/Eskalationskette). */
export const INCIDENT_STATUS = [
  'erkannt', // frisch (auto erkannt oder manuell angelegt) – noch nicht bewertet
  'in_pruefung', // wird bewertet (meldepflichtig?)
  'meldepflichtig', // Risiko bejaht -> Meldung an Aufsichtsbehoerde faellig
  'gemeldet', // an Aufsichtsbehoerde/Verantwortlichen gemeldet
  'nicht_meldepflichtig', // dokumentiert, kein Risiko -> keine Behoerdenmeldung
  'abgeschlossen', // erledigt
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUS)[number];

/** Schweregrad-Einschaetzung. */
export const INCIDENT_SCHWEREGRAD = ['niedrig', 'mittel', 'hoch', 'kritisch'] as const;
export type IncidentSchweregrad = (typeof INCIDENT_SCHWEREGRAD)[number];

/** Herkunft des Vorfalls. */
export const INCIDENT_QUELLE = [
  'auto_signal', // vom periodischen Auswerter aus dem Audit-Stream erkannt
  'manuell', // vom Betrieb selbst erfasst
  'extern_gemeldet', // von aussen gemeldet (z. B. Sicherheitsforscher, Behoerde)
  'kunde_gemeldet', // ein betroffener Kunde hat gemeldet
] as const;
export type IncidentQuelle = (typeof INCIDENT_QUELLE)[number];

/** Auto-Signaltyp (nur bei quelle === 'auto_signal' gesetzt). */
export const INCIDENT_SIGNAL_TYP = ['export_spike', 'login_bruteforce', 'forbidden_spike'] as const;
export type IncidentSignalTyp = (typeof INCIDENT_SIGNAL_TYP)[number];

// ---------------------------------------------------------------------------
// 72h-Meldefrist (Art. 33 Abs. 1 DSGVO): "unverzueglich und moeglichst binnen
// 72 Stunden, nachdem die Verletzung bekannt wurde". Die Frist wird NICHT in der
// DB gespeichert (keine Redundanz/Drift), sondern reine Ableitung aus kenntnisAm.
// ---------------------------------------------------------------------------

export const MELDEFRIST_STUNDEN = 72;
export const MELDEFRIST_MS = MELDEFRIST_STUNDEN * 60 * 60 * 1000;

/** Deadline = Kenntniszeitpunkt + 72h. */
export function meldefristDeadline(kenntnisAm: Date): Date {
  return new Date(kenntnisAm.getTime() + MELDEFRIST_MS);
}

/** Verbleibende Millisekunden bis zur 72h-Frist (negativ = ueberfaellig). */
export function meldefristRestMs(kenntnisAm: Date, now: Date = new Date()): number {
  return meldefristDeadline(kenntnisAm).getTime() - now.getTime();
}

/** Ist die 72h-Frist bereits ueberschritten? */
export function meldefristUeberfaellig(kenntnisAm: Date, now: Date = new Date()): boolean {
  return meldefristRestMs(kenntnisAm, now) < 0;
}

// ---------------------------------------------------------------------------
// Audit-Stream: Action-Strings, auf denen die Erkennungssignale beruhen.
// Die drei Guards emittieren je eine EIGENE Action (kein JSON-Filtern noetig,
// DB-agnostisch): nur `forbidden_access` (echte Rollen-Verweigerung) zaehlt als
// Sicherheitssignal; `subscription_denied`/`plan_feature_denied` sind fachlich
// erwartbare Tarif-/Abo-403 und bleiben nur zur Nachvollziehbarkeit im Trail.
// ---------------------------------------------------------------------------

/** Datenexporte (Einzelkunde heute; Tenant-Gesamt-Export kommt in PR 2). */
export const EXPORT_ACTIONS = ['gdpr_export', 'gdpr_tenant_export'] as const;
/** Tenant-Gesamt-Export (PR 2) – eigener, strengerer Schwellwert. */
export const TENANT_EXPORT_ACTION = 'gdpr_tenant_export';
/** Fehlgeschlagener Login (Emission in auth.service, best-effort). */
export const LOGIN_FAILED_ACTION = 'login_failed';
/** Rollen-403 (Emission in RolesGuard, best-effort) – das Sicherheitssignal. */
export const FORBIDDEN_ACTION = 'forbidden_access';
/** Abo-403 (SubscriptionGuard) – nur Trail, KEIN Incident-Trigger. */
export const SUBSCRIPTION_DENIED_ACTION = 'subscription_denied';
/** Tarif-403 (PlanFeatureGuard) – nur Trail, KEIN Incident-Trigger. */
export const PLAN_FEATURE_DENIED_ACTION = 'plan_feature_denied';

/**
 * Schwellwerte + Zeitfenster der drei Erkennungssignale. Bewusst KONSERVATIV
 * (lieber ein Vorfall zu wenig auto-erkannt als ein Betrieb mit Fehlalarmen
 * ueberflutet). Alle Schwellen sind "> Wert" bzw. ">= Wert" wie kommentiert.
 */
export const DETECTION = {
  /** Auswerter-Intervall (ENV DATENPANNE_DETECTION_INTERVAL_MS, min 60s). */
  intervalMsDefault: 15 * 60 * 1000,
  intervalMsMin: 60 * 1000,
  /** Export-Spike: > 10 Exporte/Std ODER > 3 Voll-Exporte/Std je Betrieb. */
  export: { windowMs: 60 * 60 * 1000, schwelle: 10, vollSchwelle: 3 },
  /** Login-Brute-Force: >= 20 Fehlschlaege/15min je Betrieb. */
  login: { windowMs: 15 * 60 * 1000, schwelle: 20 },
  /** Rollen-403-Haeufung: >= 15/Std je Betrieb. */
  forbidden: { windowMs: 60 * 60 * 1000, schwelle: 15 },
} as const;
