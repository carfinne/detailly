/**
 * Code-Konstanten des Geraete-Gebrauchtmarkts.
 *
 * BEWUSST KEINE DB-Enums: Alle Wertelisten sind reine Code-Konstanten +
 * varchar-Spalten. Neue Werte erfordern so KEINE Enum-Schema-Migration und
 * KEINEN Dev-Reseed (die "Reseed-Falle" bei Enum-Wert-Aenderungen, vgl.
 * EMPLOYEE_FUNKTIONEN in user.entity.ts). Die Validierung uebernehmen die DTOs
 * (@IsIn(...)), NICHT die Datenbank.
 */

/**
 * Geraete-/Ausruestungs-Kategorien. BEWUSST NUR Ausruestung/Werkzeug – KEINE
 * Chemie-/Verbrauchsstoff-Kategorie (rechtlich heikler Weiterverkauf von
 * Gefahrstoffen wird auf dem Marktplatz nicht angeboten).
 */
export const GERAETE_KATEGORIEN = [
  'poliermaschine',
  'sauger_extraktor',
  'plotter',
  'ir_kurzwellen_trockner',
  'hebebuehne',
  'folier_werkzeug',
  'druckluft_kompressor',
  'dampfreiniger',
  'messtechnik',
  'sonstiges_geraet',
] as const;
export type GeraeteKategorie = (typeof GERAETE_KATEGORIEN)[number];

/**
 * Nachbarschaftshilfe-Kategorien (feat/nachbarschaftshilfe). Betriebe helfen sich
 * gegenseitig: Auftraege weitergeben, freie Kapazitaet/Dienstleistung anbieten,
 * Restmaterial (Folie u. Ae.) abgeben. Additiv ans Ende – die Geraete-Kategorien
 * bleiben unveraendert.
 *  - auftragshilfe:    Sub-Auftrag/Auftragshilfe (biete Arbeit ab / suche jemanden).
 *  - freie_kapazitaet: freie Kapazitaet / Dienstleistung (biete meine Arbeitszeit).
 *  - restmaterial:     Restmaterial wie Folie, PPF-Reste, Kleinteile (biete/suche).
 */
export const HILFE_KATEGORIEN = ['auftragshilfe', 'freie_kapazitaet', 'restmaterial'] as const;
export type HilfeKategorie = (typeof HILFE_KATEGORIEN)[number];

/** Alle zulaessigen Kategorien (Geraete + Nachbarschaftshilfe) – Validierungs-Set der DTOs. */
export const ALLE_KATEGORIEN = [...GERAETE_KATEGORIEN, ...HILFE_KATEGORIEN] as const;
export type InseratKategorie = (typeof ALLE_KATEGORIEN)[number];

/**
 * DIENSTLEISTUNGS-Kategorien: hier wechselt KEINE Ware den Besitzer, sondern
 * Arbeitszeit/Auftraege. Die weiche Chemie-Vorpruefung (geraete-chemie-heuristik)
 * wird fuer diese Kategorien BEWUSST UEBERSPRUNGEN – „Keramikversiegelung" o. Ae.
 * beschreibt hier den Arbeitsschritt, nicht den Verkauf von Chemie. Alle uebrigen
 * Kategorien (Geraete + restmaterial) bleiben chemie-geprueft. Unbekannte/leere
 * Kategorie -> NICHT ausgenommen (Pruefung greift, Default-sicher).
 */
export const DIENSTLEISTUNG_KATEGORIEN: readonly string[] = ['auftragshilfe', 'freie_kapazitaet'];

/**
 * Richtung eines Inserats: Angebot („ich biete") vs. Gesuch („ich suche").
 * Bestandsinserate (reine Geraete-Verkaeufe) sind IMMER ein Angebot -> Default.
 */
export const INSERAT_ART = ['angebot', 'gesuch'] as const;
export type InseratArt = (typeof INSERAT_ART)[number];

/** Default-Richtung fuer Bestand/fehlende Angabe (jedes Alt-Inserat ist ein Angebot). */
export const INSERAT_ART_DEFAULT: InseratArt = 'angebot';

/** Zustand des Geraets. */
export const INSERAT_ZUSTAND = ['neu', 'gebraucht', 'defekt'] as const;
export type InseratZustand = (typeof INSERAT_ZUSTAND)[number];

/** Preis-Modus: fester Preis, Verhandlungsbasis oder Preis auf Anfrage. */
export const PREIS_MODUS = ['fest', 'vb', 'anfrage'] as const;
export type PreisModus = (typeof PREIS_MODUS)[number];

/** Lebenszyklus eines Inserats (vom Verkaeufer gesteuert). */
export const INSERAT_STATUS = ['aktiv', 'reserviert', 'verkauft', 'entfernt'] as const;
export type InseratStatus = (typeof INSERAT_STATUS)[number];

/** Moderations-Status (vom Betreiber gesteuert – Melde-Logik folgt in PR3). */
export const MODERATION_STATUS = ['ok', 'verborgen', 'entfernt'] as const;
export type ModerationStatus = (typeof MODERATION_STATUS)[number];

/** Melde-Gruende (Whitelist fuer POST .../melden, inkl. Chemie-Verdacht). */
export const MELDUNG_GRUND = ['chemie_verboten', 'spam', 'betrug', 'unangemessen', 'sonstiges'] as const;
export type MeldungGrund = (typeof MELDUNG_GRUND)[number];

/**
 * Sentinel-„Melder" fuer System-Meldungen (Chemie-Heuristik). Belegt die Spalten
 * melderTenantId/melderUserId, ohne einem echten Betrieb/Nutzer zu gehoeren; die
 * UNIQUE(inseratId, melderTenantId) macht die Heuristik dadurch idempotent
 * (genau EINE System-Meldung je Inserat).
 */
export const SYSTEM_MELDER_ID = 'system';

/** Bearbeitungs-Status einer Meldung. */
export const MELDUNG_STATUS = ['offen', 'erledigt', 'verworfen'] as const;
export type MeldungStatus = (typeof MELDUNG_STATUS)[number];

/** Nur diese Status gelten cross-tenant als sichtbar (Browse/Detail). */
export const SICHTBARE_STATUS: readonly InseratStatus[] = ['aktiv', 'reserviert'];

/** Standard-Laufzeit eines Inserats in Tagen (danach automatisch nicht mehr sichtbar). */
export const INSERAT_LAUFZEIT_TAGE = 90;

/** Obergrenze fuer den Preis (fit fuer numeric(10,2); Tippfehler-Schutz). */
export const MAX_INSERAT_PREIS = 1_000_000;

// ===========================================================================
// Gebuehren-NAHT (feat/nachbarschaftshilfe) – EINGEBAUT, aber ABGESCHALTET.
// ---------------------------------------------------------------------------
// Der Inhaber will spaeter 2 EUR je Inserat nehmen. Stripe ist NICHT angebunden
// (Zahlungen laufen im Pilot manuell) -> eine scharfe Bezahlschranke waere heute
// unbenutzbar. Deshalb existiert hier NUR die Naht:
//   - INSERAT_GEBUEHR_EUR: der spaetere Preis als Konstante.
//   - INSERAT_GEBUEHR_AKTIV: EIN zentraler Schalter, standardmaessig AUS.
//   - Spalten kostenpflichtig/bezahlt am Inserat (Entity/Migration).
// Solange der Schalter AUS ist, wird jedes neue Inserat mit kostenpflichtig=false
// angelegt, das Inserieren ist frei und die Oberflaeche erwaehnt KEINE Gebuehr.
//
// SCHARFSCHALTEN (Folge-Ticket, NICHT hier bauen) erfordert mindestens:
//   1. INSERAT_GEBUEHR_AKTIV auf true (ideal spaeter ueber ENV/Config, nicht Code).
//   2. Stripe-/Zahlungsanbindung + Bezahlvorgang fuer das Inserat.
//   3. Sichtbarkeits-/Freischalt-Logik an `bezahlt` haengen (z. B. Inserat erst
//      nach Zahlung im Browse sichtbar ODER kurze Kulanz-Frist).
//   4. Belegerstellung/Rechnung fuer die Gebuehr.
//   5. UI: Gebuehr ausweisen + Bezahl-Button; i18n-Texte ergaenzen.
// Es gibt hier BEWUSST KEINEN Bezahlvorgang und KEINE Rechnungserzeugung.
// ===========================================================================

/** Spaeterer Preis je Inserat in EUR (Gebuehren-Naht). */
export const INSERAT_GEBUEHR_EUR = 2;

/**
 * ZENTRALER Gebuehren-Schalter. STANDARDMAESSIG AUS (false). Solange false, ist
 * das Inserieren frei und nichts wird blockiert. Erst true + die Punkte oben
 * schalten die Gebuehr scharf.
 */
export const INSERAT_GEBUEHR_AKTIV = false;

/**
 * Umkreis-Stufen in km (grob, Regionsebene) fuer die Nachbarschaftshilfe-Suche.
 *   0   = nur die eigene Leitregion (exakter Regions-Match wie bisher).
 *   50/100/200 = ungefaehrer Umkreis um die Zentrums-Region.
 * „ueberall" wird NICHT als Zahl kodiert, sondern durch WEGLASSEN von umkreisKm
 * (bzw. der plzRegion) ausgedrueckt. BEWUSST GROB: eine Leitregion ist selbst
 * 50-100 km gross -> kein kilometergenauer Radius (siehe geraete-umkreis.ts).
 */
export const UMKREIS_STUFEN_KM = [0, 50, 100, 200] as const;
export type UmkreisStufe = (typeof UMKREIS_STUFEN_KM)[number];
