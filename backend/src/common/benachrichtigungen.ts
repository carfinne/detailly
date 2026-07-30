/**
 * Benachrichtigungs-Praeferenzen JE NUTZER (Welle 3-A): welche In-App-Hinweise
 * (Glocke/NotificationBell) der einzelne Nutzer sehen moechte. Reine
 * Anzeige-Steuerung – nichts geht nach aussen. Gespeichert als kleines JSON in
 * `user.benachrichtigungen` (additive Spalte).
 *
 * Wichtig: Default ist fuer JEDE Kategorie AN. Fehlt der Block (Altbestand) oder
 * ein einzelner Key, gilt er als AN – so aendert die Einfuehrung kein Verhalten.
 * Nur ein explizites `false` schaltet eine Kategorie ab.
 *
 * Kategorien spiegeln die beiden Quellen der Glocke:
 *  - Server-Reminder (/reminders, alle Rollen): rechnungenFaellig / termineHeute /
 *    materialKnapp (Item-Keys rechnungen/termine/material).
 *  - Client-Nudges (nur Inhaber): steuerTermine / auslastung / par19 (Nudge-id-
 *    Praefixe steuer:/auslastung:/par19:).
 */

export const BENACHRICHTIGUNG_KEYS = [
  'rechnungenFaellig',
  'termineHeute',
  'materialKnapp',
  // Welle 1-A (F3): Kunde nimmt ein Angebot ONLINE an (Server-Reminder, Empfang/
  // Leitung – gleiches Muster wie das Buchungsanfrage-Badge).
  'angeboteAngenommen',
  // Welle 2-C: neues privates Kunden-Feedback aus der Uebergabe-Mappe (Server-
  // Reminder, Empfang/Leitung; Item-Key `feedback`).
  'feedbackNeu',
  // Welle 2-B (Teil 1): offenes Angebot ist nachfassreif (seit X Tagen offen).
  // Server-Reminder, Empfang/Leitung (Verkauf) – In-App-Vorschlag, kein Auto-Mail.
  'angebotNachfassen',
  // Welle 2-B (Teil 2): faellige Nachsorge-Wiedervorlage (Keramik/PPF/Coating).
  // Server-Reminder, Empfang/Leitung – In-App-Erinnerung, kein Auto-Mail.
  'nachsorgeFaellig',
  'steuerTermine',
  'auslastung',
  'par19',
] as const;
export type BenachrichtigungKey = (typeof BENACHRICHTIGUNG_KEYS)[number];

/** Aufgeloeste Praeferenzen (immer vollstaendig, jede Kategorie bool). */
export type BenachrichtigungenConfig = Record<BenachrichtigungKey, boolean>;

/** Betreiber-Default: ALLES an (kein Verhaltensbruch bei Einfuehrung). */
export const BENACHRICHTIGUNGEN_DEFAULTS: BenachrichtigungenConfig = {
  rechnungenFaellig: true,
  termineHeute: true,
  materialKnapp: true,
  angeboteAngenommen: true,
  feedbackNeu: true,
  angebotNachfassen: true,
  nachsorgeFaellig: true,
  steuerTermine: true,
  auslastung: true,
  par19: true,
};

/**
 * Liest die Praeferenzen DEFENSIV aus dem Rohwert (user.benachrichtigungen).
 * Nur ein explizites `false` schaltet eine Kategorie ab; alles andere (fehlend,
 * null, "nein", …) bleibt AN. Wirft NIE.
 */
export function resolveBenachrichtigungen(raw: unknown): BenachrichtigungenConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = {} as BenachrichtigungenConfig;
  for (const k of BENACHRICHTIGUNG_KEYS) {
    out[k] = o[k] === false ? false : true;
  }
  return out;
}

/** Form des eingehenden PATCH-Teilobjekts (alle Kategorien optional). */
export type BenachrichtigungenPatch = Partial<Record<BenachrichtigungKey, boolean>>;

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nur bool-Werte werden uebernommen; nicht angegebene Kategorien bleiben
 * unveraendert -> echtes Teil-Update.
 */
export function mergeBenachrichtigungen(
  base: BenachrichtigungenConfig,
  patch: BenachrichtigungenPatch,
): BenachrichtigungenConfig {
  const out: BenachrichtigungenConfig = { ...base };
  for (const k of BENACHRICHTIGUNG_KEYS) {
    if (typeof patch[k] === 'boolean') out[k] = patch[k] as boolean;
  }
  return out;
}
