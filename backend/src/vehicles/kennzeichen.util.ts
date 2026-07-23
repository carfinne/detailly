/** Obergrenze fuer das rohe Kennzeichen aus dem Client (DoS-/Muell-Schutz). */
export const MAX_KENNZEICHEN_LEN = 32;

/**
 * Normalisiert ein Kennzeichen fuer den toleranten Vergleich: Gross-/Kleinschreibung,
 * Leerzeichen und Bindestriche werden vereinheitlicht ("k-ab 123" == "KAB123").
 * Gleiche Regel wie die Duplikat-Heuristik des CSV-Imports (normKennung), damit
 * Lookup und Import konsistent bleiben.
 *
 * WICHTIG: Die Normalisierung passiert bewusst in JS (nicht per SQL UPPER()) —
 * SQLite uppercased nur ASCII, Umlaut-Kuerzel wie LÖ/MÜ/SÜW blieben sonst klein
 * und traefen nie. Eigene Datei (statt vehicles.service), damit die Vehicle-Entity
 * sie im BeforeInsert/BeforeUpdate-Hook nutzen kann ohne Zirkular-Import.
 */
export function normalizeKennzeichen(roh: string | null | undefined): string {
  return (roh ?? '').replace(/[\s-]+/g, '').toUpperCase().slice(0, MAX_KENNZEICHEN_LEN);
}
