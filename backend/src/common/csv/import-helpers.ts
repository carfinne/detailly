import { BadRequestException } from '@nestjs/common';
import { CsvDaten, HochgeladeneDatei, parseCsv } from './csv-parse';

/**
 * Gemeinsame Bausteine des Bestandsdaten-Imports (T-007), die Kunden- UND
 * Fahrzeug-Import identisch brauchen. Frueher lagen `putzWert`, die MAX_*-Limits
 * und die Parse-Preamble in BEIDEN Services doppelt – jede Aenderung (z. B. am
 * Formel-Injection-Schutz) musste an zwei Stellen nachgezogen werden. Hier
 * gebuendelt, ohne fachliche Aenderung.
 */

/** Obergrenze Datenzeilen je Datei (DoS-Schutz; groessere Dateien werden abgelehnt). */
export const MAX_ZEILEN = 2000;
/** Kappung normaler Feldwerte (Spaltenlaenge). */
export const MAX_FELD = 255;
/** Kappung fuer Notiz-Felder (laenger als normale Felder erlaubt). */
export const MAX_NOTIZ = 2000;

/**
 * Feldwert entschaerfen: trimmen, fuehrende '='/'@'/'-'/Tab entfernen (CSV-Formel-
 * Injection – schuetzt spaetere Excel-/DATEV-Exporte; '+' bleibt bewusst erhalten,
 * Telefonnummern beginnen legitim damit) und auf die Spaltenlaenge kappen.
 */
export function putzWert(roh: string, maxLaenge = MAX_FELD): string {
  return (roh ?? '').trim().replace(/^[=@\-\t]+/, '').slice(0, maxLaenge);
}

/**
 * Parst die hochgeladene Datei (Encoding/Trennzeichen tolerant) und prueft die
 * Zeilen-Limits. Wirft `BadRequestException` (→ 400) bei
 *  - unbrauchbarer/leerer Datei bzw. fehlender Kopfzeile (Parser-Fehler),
 *  - keiner Datenzeile (nur Kopfzeile),
 *  - mehr als `MAX_ZEILEN` Datenzeilen.
 * Verhalten 1:1 wie die frueheren Inline-Preambeln beider Import-Services.
 */
export function parseImportDatei(datei: HochgeladeneDatei): CsvDaten {
  let csv: CsvDaten;
  try {
    csv = parseCsv(datei);
  } catch (err) {
    throw new BadRequestException((err as Error).message);
  }
  if (csv.zeilen.length === 0) {
    throw new BadRequestException('Die Datei enthaelt keine Datenzeilen (nur eine Kopfzeile).');
  }
  if (csv.zeilen.length > MAX_ZEILEN) {
    throw new BadRequestException(
      `Zu viele Zeilen (${csv.zeilen.length}). Bitte die Datei in Teile mit maximal ${MAX_ZEILEN} Zeilen aufteilen.`,
    );
  }
  return csv;
}
