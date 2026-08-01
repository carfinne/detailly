/**
 * REINE, seiteneffektfreie Primitive fuer die oeffentlichen Orts-/Kategorieseiten
 * ("<Gewerk> in <Ort>", z. B. /betriebe/folierung/regensburg/). BEWUSST ein eigenes,
 * winziges Modul (kein NestJS-DI, kein fs/DB, kein Fremdpaket): so sind Ort-
 * Kanonisierung UND die betriebstyp->Gewerk-Zuordnung vollstaendig unit-testbar und
 * von BEIDEN Render-Dateien (betrieb-page.render fuer die Rueckwaerts-Verlinkung und
 * orts-page.render fuer die Ortsseite selbst) importierbar, OHNE einen Import-Zyklus
 * zu erzeugen. betrieb-page.render <- orts-slug -> orts-page.render (nur eine Richtung).
 */
import { Betriebstyp } from '../tenants/entities/tenant.entity';

/**
 * Gewerk-Kategorien, aus denen eine Orts-URL gebaut wird – FESTE Whitelist. Der
 * URL-Parameter wird HART hiergegen validiert (unbekannt -> 404), bevor irgendeine
 * Gruppierung/DB-Arbeit passiert. `komplett` ist bewusst KEINE eigene Kategorie:
 * ein Komplett-Betrieb macht alle drei Gewerke und erscheint daher auf allen drei
 * Gewerk-Seiten seiner Stadt (siehe gewerkeFuerBetrieb).
 */
export type GewerkKategorie = 'aufbereitung' | 'folierung' | 'ppf';
export const GEWERK_KATEGORIEN: readonly GewerkKategorie[] = ['aufbereitung', 'folierung', 'ppf'];

/** Type-Guard: ist der (frei uebergebene) URL-Parameter eine gueltige Gewerk-Kategorie? */
export function isValidGewerk(g: string | null | undefined): g is GewerkKategorie {
  return (GEWERK_KATEGORIEN as readonly string[]).includes(String(g ?? ''));
}

/**
 * EXPLIZITE Zuordnung betriebstyp -> Gewerk-Seiten, auf denen der Betrieb erscheint.
 *
 * Begruendung: `betriebstyp` ist die Ausrichtung des Betriebs (steuert bereits
 * Theming/Katalog). Die drei Spezial-Typen erscheinen jeweils genau auf IHRER
 * Gewerk-Seite. `komplett` ist die Sammelkategorie ("alle Bereiche", Default fuer
 * Bestandsbetriebe – siehe Betriebstyp-Doku) und deckt daher ALLE drei Gewerke ab
 * -> ein Komplett-Betrieb erscheint auf der Aufbereitungs-, Folierungs- UND PPF-Seite
 * seiner Stadt. Ein unbekannter/zukuenftiger Typ erscheint bewusst NIRGENDS (leer),
 * bis er hier explizit zugeordnet wird (fail-closed, keine falsche Zuordnung).
 */
export function gewerkeFuerBetrieb(typ: Betriebstyp): GewerkKategorie[] {
  switch (typ) {
    case Betriebstyp.AUFBEREITUNG:
      return ['aufbereitung'];
    case Betriebstyp.FOLIERUNG:
      return ['folierung'];
    case Betriebstyp.PPF:
      return ['ppf'];
    case Betriebstyp.KOMPLETT:
      return ['aufbereitung', 'folierung', 'ppf'];
    default:
      return [];
  }
}

/**
 * Deutsches Label je Gewerk-Kategorie (fuer H1/Title/Beschreibung der Ortsseite und
 * die Rueckwaerts-Verlinkung auf der Einzelseite). Spiegelt exakt die drei
 * Spezial-Labels aus gewerkLabelDe (betrieb-page.render) – dieselbe kanonische
 * deutsche Locale wie die uebrigen Server-HTML-Fixtexte.
 */
export function gewerkKategorieLabelDe(g: GewerkKategorie): string {
  switch (g) {
    case 'aufbereitung':
      return 'Fahrzeugaufbereitung';
    case 'folierung':
      return 'Folierung';
    case 'ppf':
      return 'PPF / Lackschutz';
  }
}

/**
 * Strenges citySlug-Format: nur klein-alphanumerisch + Bindestrich, 1–80 Zeichen
 * (deckungsgleich mit isValidSlug fuer Betriebs-Slugs). Wird VOR jeder Gruppierung/
 * jedem Cache-Zugriff geprueft, damit ein Angreifer mit Muell-/Traversal-citySlugs
 * (`../`, Grossbuchstaben, Sonderzeichen) keine Arbeit ausloest. INVARIANTE:
 * stadtZuSlug liefert entweder `null` oder einen String, der genau dieses Format
 * erfuellt (siehe Test) -> eine aus unserer Sitemap stammende URL resolved immer.
 */
export const CITY_SLUG_MAX_LENGTH = 80;
export function isValidCitySlug(s: string | null | undefined): boolean {
  return /^[a-z0-9-]{1,80}$/.test(String(s ?? ''));
}

/**
 * Ort-KANONISIERUNG (die knifflige Stelle): macht aus dem frei eingegebenen Freitext
 * `stadt` einen stabilen, umlautfesten citySlug – oder `null`, wenn nichts Brauchbares
 * uebrig bleibt. So landen "Regensburg", "regensburg" und "Regensburg " auf DEMSELBEN
 * citySlug "regensburg". Schritte:
 *  1. lowercase (danach faltet 'Ä'->'ä' bereits),
 *  2. deutsche Umlaute/ß falten (ae/oe/ue/ss) – identisch zur Such-Normalisierung,
 *  3. alles ausser [a-z0-9] zu Bindestrichen zusammenfassen (`+` collapsed Laeufe),
 *  4. Rand-Bindestriche entfernen,
 *  5. leer -> null (unbrauchbare Eingabe wie "!!!" oder "" ergibt keine Ortsseite),
 *  6. auf CITY_SLUG_MAX_LENGTH kappen (Rand-Bindestrich danach erneut entfernen),
 *     damit die INVARIANTE isValidCitySlug(result)===true immer gilt.
 * Betriebe ohne brauchbare Stadt (`null`) erscheinen auf KEINER Ortsseite (kein Fehler).
 */
export function stadtZuSlug(stadt: string | null | undefined): string | null {
  let s = String(stadt ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!s) return null;
  if (s.length > CITY_SLUG_MAX_LENGTH) {
    s = s.slice(0, CITY_SLUG_MAX_LENGTH).replace(/-+$/g, '');
  }
  return s || null;
}

/** Stabiler Gruppen-Schluessel (gewerk + citySlug). `|` kommt in keinem der beiden vor. */
export function ortGruppeKey(gewerk: GewerkKategorie, citySlug: string): string {
  return `${gewerk}|${citySlug}`;
}

/**
 * Kanonische URL einer Ortsseite (mit abschliessendem Slash, wie /betrieb/<slug>/).
 * Praefix `/betriebe/` (Plural) ist bewusst kollisionssicher gewaehlt: die Roh-Route
 * wird VOR der SPA-Catch-all registriert und wuerde eine kuenftige Marketing-Seite
 * `/folierung/...` sonst ueberschatten – unter `/betriebe/<gewerk>/<citySlug>/` (drei
 * Segmente) kann keine bestehende oder plausible App-Seite verdeckt werden.
 */
export function ortsPageCanonicalUrl(baseUrl: string, gewerk: GewerkKategorie, citySlug: string): string {
  return `${baseUrl}/betriebe/${gewerk}/${citySlug}/`;
}
