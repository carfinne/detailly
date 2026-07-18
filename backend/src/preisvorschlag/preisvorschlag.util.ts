/**
 * Reine, DB-freie Helfer fuer den Preisvorschlag aus der eigenen Auftragshistorie.
 *
 * Bewusst ohne Fremd-Paket (kein Fuzzy-Matching): eine einfache, robuste
 * Normalisierung + Wort-Extraktion reicht fuer Leistungsbeschreibungen. Alle
 * Funktionen sind rein und damit direkt unit-testbar (siehe *.util.spec.ts).
 */

/**
 * Kleinschreibung + Reduktion auf Buchstaben/Ziffern (Unicode, inkl. Umlauten).
 * Alles andere wird zu einem einzelnen Leerzeichen, Mehrfach-Leerzeichen werden
 * zusammengefasst. JS-`toLowerCase` behandelt Umlaute korrekt (Ae->ae etc.).
 */
export function normalisiere(text: string | null | undefined): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrahiert die "signifikanten" Suchwoerter (Laenge >= 3), dedupliziert und auf
 * `max` begrenzt (verhindert eine ueberlange AND-Verkettung). Ohne solche Woerter
 * greift ein Fallback auf die gesamte normalisierte Zeichenkette (ab Laenge 2),
 * damit auch sehr kurze Leistungsnamen (z. B. "oel") noch matchen. Liefert `[]`,
 * wenn nichts Brauchbares uebrig bleibt -> der Aufrufer liefert dann "kein Vorschlag".
 */
export function signifikanteWoerter(text: string | null | undefined, max = 6): string[] {
  const norm = normalisiere(text);
  if (!norm) return [];
  const eindeutig = Array.from(new Set(norm.split(' ').filter((w) => w.length >= 3)));
  if (eindeutig.length === 0) {
    return norm.length >= 2 ? [norm] : [];
  }
  return eindeutig.slice(0, max);
}

/**
 * Median einer Zahlenreihe.
 * - leere Reihe -> 0
 * - ungerade Anzahl -> mittleres Element
 * - gerade Anzahl  -> Mittel der beiden mittleren Elemente
 * Die Eingabe wird kopiert (keine Seiteneffekte) und aufsteigend sortiert.
 */
export function berechneMedian(werte: number[]): number {
  if (!werte || werte.length === 0) return 0;
  const sortiert = [...werte].sort((a, b) => a - b);
  const mitte = Math.floor(sortiert.length / 2);
  return sortiert.length % 2 !== 0
    ? sortiert[mitte]
    : (sortiert[mitte - 1] + sortiert[mitte]) / 2;
}

/** Kaufmaennisch auf 2 Nachkommastellen runden (Geldbetrag). */
export function runde2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
