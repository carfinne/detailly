import { KassenbuchTyp } from './kassenbuch.constants';

/**
 * Reine GoBD-Rechenregeln des Kassenbuchs (KEINE DB-/Nest-Abhaengigkeit), damit
 * die kritische Verkettungs-/Saldo-Logik isoliert und deterministisch testbar
 * ist (die Jest-Suite bootet bewusst keine echte DB).
 */

/** Kaufmaennisch auf Cent runden (vermeidet Float-Drift bei fortlaufendem Saldo). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Vorzeichen einer Bewegung: Einnahme erhoeht, Ausgabe verringert den Bestand. */
export function vorzeichen(typ: KassenbuchTyp): 1 | -1 {
  return typ === 'einnahme' ? 1 : -1;
}

/**
 * Laufender Kassenbestand NACH einer Bewegung, aus dem Vorgaenger-Saldo
 * berechnet. `vorherBestand` ist der kassenbestandNach des letzten Eintrags
 * (0 fuer den allerersten Eintrag – die Barkasse startet bei 0).
 */
export function berechneKassenbestandNach(
  vorherBestand: number,
  typ: KassenbuchTyp,
  betrag: number,
): number {
  return round2(vorherBestand + vorzeichen(typ) * betrag);
}

/**
 * Wuerde diese Bewegung den Bestand unter 0 druecken? Eine Barkasse kann physisch
 * nicht negativ werden – eine Ausgabe groesser als der aktuelle Bestand ist ein
 * Erfassungsfehler und wird abgewiesen. Einnahmen koennen nie negativ werden.
 * Toleranz gegen Float-Rundung (halber Cent).
 */
export function wuerdeBestandNegativ(
  vorherBestand: number,
  typ: KassenbuchTyp,
  betrag: number,
): boolean {
  return berechneKassenbestandNach(vorherBestand, typ, betrag) < -0.005;
}

/** Gegenrichtung fuer die Storno-Gegenbuchung (Einnahme <-> Ausgabe). */
export function gegenTyp(typ: KassenbuchTyp): KassenbuchTyp {
  return typ === 'einnahme' ? 'ausgabe' : 'einnahme';
}
