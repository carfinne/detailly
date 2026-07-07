// Zentrale, leicht pflegbare Quelle der oeffentlichen Produkt-News/Updates.
//
// MVP-Hinweis: Alle Eintraege sind bewusst als PLATZHALTER markiert
// (`platzhalter: true`) und werden vom Betreiber vor dem Launch durch echte
// Meldungen ersetzt. Pflege ist absichtlich simpel gehalten: einen neuen
// Eintrag oben in `NEWS` einfuegen – Sortierung erfolgt automatisch nach Datum
// (neueste zuerst) ueber `neuesteNews()`.

export type NewsKategorie = 'Produkt' | 'Verbesserung' | 'Ankündigung';

export interface NewsEintrag {
  /** Stabiler, URL-tauglicher Schluessel (fuer React-Keys/Anker). */
  slug: string;
  /** ISO-Datum im Format YYYY-MM-DD. */
  datum: string;
  kategorie: NewsKategorie;
  titel: string;
  kurztext: string;
  /** true = Beispiel-/Platzhalter-Eintrag, der noch durch echte News ersetzt wird. */
  platzhalter?: boolean;
}

// PLATZHALTER-Eintraege: Struktur und Tonalitaet stehen, Inhalte sind Beispiele.
// Vor dem oeffentlichen Launch durch echte Meldungen ersetzen und
// `platzhalter` entfernen.
export const NEWS: NewsEintrag[] = [
  {
    slug: 'beispiel-offene-testphase',
    datum: '2026-07-01',
    kategorie: 'Ankündigung',
    titel: 'Beispiel: Detailly startet in die offene Testphase',
    kurztext:
      'Platzhalter-Meldung. Hier steht spaeter eine echte Ankuendigung – zum Beispiel der Start der offenen Testphase, inklusive der wichtigsten Neuerungen fuer Aufbereitung, Folierung und PPF.',
    platzhalter: true,
  },
  {
    slug: 'beispiel-3d-schadenserfassung',
    datum: '2026-06-15',
    kategorie: 'Produkt',
    titel: 'Beispiel: 3D-Schadenserfassung jetzt für alle Gewerke',
    kurztext:
      'Platzhalter-Meldung. Beispiel fuer eine Produkt-News: Schaeden lassen sich direkt am 3D-Fahrzeugmodell markieren, mit Fotos dokumentieren und digital unterschreiben – hier spaeter mit echten Details.',
    platzhalter: true,
  },
  {
    slug: 'beispiel-plantafel-wochenansicht',
    datum: '2026-05-20',
    kategorie: 'Verbesserung',
    titel: 'Beispiel: Schnellere Plantafel und neue Wochenansicht',
    kurztext:
      'Platzhalter-Meldung. Beispiel fuer eine Verbesserung: Die Plantafel laedt schneller und zeigt eine neue Wochenansicht. Der echte Text beschreibt spaeter konkret, was sich fuer den Betrieb aendert.',
    platzhalter: true,
  },
  {
    slug: 'beispiel-gobd-rechnungen-mahnwesen',
    datum: '2026-04-28',
    kategorie: 'Produkt',
    titel: 'Beispiel: GoBD-konforme Rechnungen mit Mahnwesen',
    kurztext:
      'Platzhalter-Meldung. Beispiel fuer eine Produkt-News: Aus jedem Auftrag entsteht per Klick eine GoBD-konforme Rechnung inklusive Faelligkeiten und Mahnwesen – hier spaeter mit echten Angaben.',
    platzhalter: true,
  },
];

/** Eintraege nach Datum sortiert (neueste zuerst); optional auf `limit` gekuerzt. */
export function neuesteNews(limit?: number): NewsEintrag[] {
  const sortiert = [...NEWS].sort((a, b) => b.datum.localeCompare(a.datum));
  return typeof limit === 'number' ? sortiert.slice(0, limit) : sortiert;
}

/** Langes deutsches Datum, z. B. "1. Juli 2026". Faellt bei ungueltigem Wert auf den ISO-String zurueck. */
export function formatNewsDatum(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}
