// Zentrale, leicht pflegbare Quelle der oeffentlichen Versionshistorie
// ("Was ist neu"). Bewusst dependency-frei: eine getypte Liste, KEIN CMS,
// KEIN Fetch. Neuen Eintrag einfach oben in CHANGELOG einfuegen – die Anzeige
// sortiert automatisch nach Datum (neueste zuerst).
//
// Die Eintragstexte sind redaktioneller deutscher Inhalt (bleiben also nicht
// uebersetzt); die UI-Rahmung der Seite laeuft ueber i18n (t()).

export type ChangelogKategorie = 'neu' | 'verbessert' | 'behoben';

export interface ChangelogEintrag {
  /** Stabiler, URL-tauglicher Schluessel (React-Keys/Anker). */
  slug: string;
  /** ISO-Datum YYYY-MM-DD. */
  datum: string;
  /** Redaktionelle Versionsbezeichnung (frei waehlbar, z. B. "1.6"). */
  version: string;
  kategorie: ChangelogKategorie;
  titel: string;
  text: string;
}

// Neueste zuerst. Ehrliche Auswahl der juengeren Produkt-Historie
// (Juni/Juli 2026) – ohne interne Kennungen, in Nutzersprache formuliert.
export const CHANGELOG: ChangelogEintrag[] = [
  {
    slug: 'gobd-schutz-belege',
    datum: '2026-07-12',
    version: '1.9',
    kategorie: 'neu',
    titel: 'GoBD-Schutz: festgeschriebene Belege bleiben unveränderbar',
    text: 'Einmal festgesetzte Rechnungen lassen sich nicht mehr löschen oder nachträglich ändern. Korrekturen laufen sauber über Storno und eine neue Rechnung – so bleibt deine Buchhaltung prüfsicher.',
  },
  {
    slug: 'kundenkommunikation',
    datum: '2026-07-06',
    version: '1.8',
    kategorie: 'neu',
    titel: 'Kundenkommunikation: Erinnerung, Fertig-Info & Bewertungs-Bitte',
    text: 'Termin-Erinnerungen, eine Info bei fertigem Fahrzeug und eine freundliche Bitte um eine Bewertung – alle Nachrichten werden vor dem Versand angezeigt und von dir bestätigt.',
  },
  {
    slug: 'rechnung-rundung-fix',
    datum: '2026-07-01',
    version: '1.7',
    kategorie: 'behoben',
    titel: 'Beträge und Rundung in Rechnungen & Auswertungen korrigiert',
    text: 'In einzelnen Fällen konnten Summen um einen Cent abweichen. Rundung und Zwischensummen sind jetzt durchgängig konsistent – auf Belegen wie in den Auswertungen.',
  },
  {
    slug: 'performance-schneller',
    datum: '2026-06-26',
    version: '1.6',
    kategorie: 'verbessert',
    titel: 'Spürbar schneller: Schadenserfassung, Dashboard & lange Listen',
    text: 'Die 3D-Schadenserfassung startet zügiger, das Dashboard reagiert flotter und lange Kunden- und Auftragslisten laden jetzt seitenweise statt am Stück.',
  },
  {
    slug: 'erfolge-jahresrueckblick',
    datum: '2026-06-22',
    version: '1.5',
    kategorie: 'neu',
    titel: 'Erfolge & Jahresrückblick',
    text: 'Meilensteine deines Betriebs werden sichtbar gefeiert, und ein Jahresrückblick fasst Umsatz, Aufträge und Highlights kompakt zusammen.',
  },
  {
    slug: 'deutschlandkarte-betriebe',
    datum: '2026-06-18',
    version: '1.4',
    kategorie: 'neu',
    titel: 'Deutschlandkarte der Mitgliedsbetriebe',
    text: 'Eine öffentliche Karte zeigt teilnehmende Betriebe – so finden Kunden Aufbereiter, Folierer und PPF-Studios in ihrer Nähe.',
  },
  {
    slug: 'ziele-steuer-erinnerungen',
    datum: '2026-06-14',
    version: '1.3',
    kategorie: 'verbessert',
    titel: 'Ziele & Steuer-Erinnerungen',
    text: 'Setz dir Monatsziele und behalte sie im Blick. Dazu erinnert dich Detailly rechtzeitig an Umsatzsteuer-Voranmeldung und wichtige Steuertermine.',
  },
  {
    slug: 'kunden-tracking-branding',
    datum: '2026-06-10',
    version: '1.2',
    kategorie: 'neu',
    titel: 'Kunden-Tracking im Look deines Betriebs',
    text: 'Kunden verfolgen den Fortschritt ihres Auftrags über einen persönlichen Link – im Design und mit dem Logo deines Betriebs.',
  },
  {
    slug: 'newsletter-double-optin',
    datum: '2026-06-06',
    version: '1.1',
    kategorie: 'neu',
    titel: 'Newsletter mit Double-Opt-in',
    text: 'Interessenten können sich DSGVO-konform für Produkt-News anmelden – mit Bestätigungs-Mail und jederzeit möglicher Abmeldung.',
  },
  {
    slug: 'mehrsprachigkeit',
    datum: '2026-06-02',
    version: '1.0',
    kategorie: 'neu',
    titel: 'Mehrsprachigkeit: Deutsch, Englisch, Russisch, Polnisch',
    text: 'Die Oberfläche spricht jetzt vier Sprachen. Jede Person im Team wählt ihre bevorzugte Sprache – der Rest passt sich automatisch an.',
  },
];

/** Eintraege nach Datum sortiert (neueste zuerst). */
export function alleEintraege(): ChangelogEintrag[] {
  return [...CHANGELOG].sort((a, b) => b.datum.localeCompare(a.datum));
}

/** Langes deutsches Datum, z. B. "12. Juli 2026". Fallback: ISO-String. */
export function formatChangelogDatum(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}
