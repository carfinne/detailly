/**
 * Fachliche Konstanten des GoBD-Kassenbuchs. Die Wertespalten (typ) sind
 * BEWUSST varchar + Code-Konstante, KEIN DB-Enum – so erzwingen neue Werte keine
 * Enum-Migration und keinen Dev-Reseed (Reseed-Falle bei Enum-Wert-Aenderungen).
 * Die Validierung uebernimmt das DTO (@IsIn).
 */

/** Buchungsart eines Kassenbuch-Eintrags. */
export const KASSENBUCH_TYPEN = ['einnahme', 'ausgabe'] as const;
export type KassenbuchTyp = (typeof KASSENBUCH_TYPEN)[number];

/**
 * Obergrenze fuer einen Einzelbetrag (Bargeld-Plausibilitaet). Verhindert
 * versehentliche Extremwerte; die decimal(10,2)-Spalte traegt bis < 100 Mio.
 */
export const MAX_KASSENBUCH_BETRAG = 1_000_000;

/**
 * Sicherheitsventil fuer den unpaginierten Export/CSV-Modus (analog
 * MAX_ARRAY_INVOICES) – KEIN fachliches Limit, nur ein DoS-Deckel.
 */
export const MAX_EXPORT_EINTRAEGE = 20_000;
