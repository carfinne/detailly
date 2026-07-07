/**
 * Gemeinsame Berichts-Typen des CSV-Imports (T-007) fuer Kunden UND Fahrzeuge.
 * Der Bericht ist die einzige Antwort beider Endpunkte – im Preview-Modus als
 * Vorschau ("was WUERDE passieren"), im Commit-Modus als Ergebnisprotokoll.
 */

export type ImportZeilenStatus = 'neu' | 'aktualisiert' | 'uebersprungen' | 'fehler';

export interface ImportZeile {
  /** Zeilennummer in der Datei (Kopfzeile = 1, erste Datenzeile = 2). */
  zeile: number;
  /** Anzeigename des Datensatzes (Kunde bzw. Fahrzeug) fuer die Vorschau. */
  name: string;
  status: ImportZeilenStatus;
  /** Begruendung bei fehler/uebersprungen/aktualisiert (menschlesbar, deutsch). */
  hinweis?: string;
}

export interface ImportBericht {
  modus: 'preview' | 'commit';
  encoding: string;
  trennzeichen: string;
  /** Anzahl der Datenzeilen in der Datei (ohne Kopfzeile, ohne Leerzeilen). */
  gesamt: number;
  neu: number;
  aktualisiert: number;
  uebersprungen: number;
  fehler: number;
  /** Unbekannte Spalten der Kopfzeile (werden ignoriert, aber gemeldet). */
  ignorierteSpalten: string[];
  /** Tarif-Limit-Kontext (nur Kunden-Import; null max = unbegrenzt). */
  limit?: { max: number | null; aktiv: number; frei: number | null; ueberschritten: boolean };
  zeilen: ImportZeile[];
}
