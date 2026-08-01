import type { Metadata } from 'next';

// ===========================================================================
// ZENTRALE SEO-Konfiguration + Metadaten-Helfer.
//
// Keine Fremdpakete – nur Next-Bordmittel. Diese Datei ist die EINE Quelle für:
//   1. die öffentliche Basis-URL (SITE_URL),
//   2. die Liste der indexierbaren Seiten (PUBLIC_ROUTES → sitemap.ts),
//   3. die Liste der NIEMALS zu indexierenden Routen (PRIVATE_DISALLOW → robots.ts),
//   4. die einheitliche Metadaten-Erzeugung (buildMetadata / noindexMetadata).
// ===========================================================================

// ---------------------------------------------------------------------------
// !!!!!  ACHTUNG – VOR DEM GO-LIVE ZWINGEND SETZEN  !!!!!
// Die öffentliche Basis-URL MUSS über die Umgebungsvariable NEXT_PUBLIC_SITE_URL
// gesetzt werden (z. B. NEXT_PUBLIC_SITE_URL=https://app.detailly.de), BEVOR der
// erste öffentliche Build/Deploy passiert.
//
// Wird sie NICHT gesetzt, greift der Platzhalter unten. Dann zeigen die Sitemap,
// alle kanonischen Links (rel=canonical) und die Open-Graph-URLs auf eine
// womöglich FALSCHE oder FREMDE Domain. Das ist nicht nur ein SEO-Fehler,
// sondern ein rechtliches Risiko (Verweis auf fremde Domain). Der Wert wird zur
// Bauzeit fest ins statische Export-HTML eingebacken – ein nachträgliches Ändern
// erfordert einen neuen Build.
// ---------------------------------------------------------------------------
const DEFAULT_SITE_URL = 'https://detailly.de'; // PLATZHALTER – siehe Warnung oben.

/** Öffentliche Basis-URL, ohne abschließenden Slash (für saubere Verkettung). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');

export type ChangeFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

export interface PublicRoute {
  /** Pfad mit führendem UND abschließendem Slash (trailingSlash:true), z. B. '/agb/'. */
  path: string;
  priority: number;
  changeFrequency: ChangeFrequency;
}

// ---------------------------------------------------------------------------
// ÖFFENTLICH indexierbare Seiten (→ sitemap.xml). Bewusst NUR Seiten ohne
// Kundendaten. Token-/Kundenseiten und der eingeloggte Bereich stehen hier NIE.
//
// Abweichung vom ursprünglichen Auftrag (dokumentiert): /haendler ist KEINE
// Marketing-Seite, sondern das token-gebundene Händler-Portal (Produkte,
// Bestellungen, Provisionssatz hinter einem geheimen ?t=-Link) → es steht in
// PRIVATE_DISALLOW, nicht hier. /grosshaendler (öffentliches Bewerbungsformular)
// bleibt indexierbar.
// ---------------------------------------------------------------------------
export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/schaufenster/', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/gruendung/', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/kleinunternehmer/', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/grosshaendler/', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/masterclass/', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/news/', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/changelog/', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/registrieren/', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/login/', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/agb/', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/avv/', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/datenschutz/', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/impressum/', priority: 0.3, changeFrequency: 'yearly' },
];

// ---------------------------------------------------------------------------
// Routen, die NIEMALS in einen Suchindex dürfen (→ robots.ts Disallow).
// Zwei Klassen:
//   (a) Token-/Kundenseiten mit echten Kundendaten hinter einem Link – ein
//       Treffer im Index wäre ein DATENSCHUTZVORFALL, kein bloßer SEO-Fehler.
//       Diese tragen ZUSÄTZLICH ein seitenweises robots:{index:false} (eigenes
//       layout.tsx), damit der Schutz nicht allein an dieser Datei hängt.
//   (b) Der eingeloggte Bereich. Achtung: die Route-Group (app) taucht NICHT in
//       der URL auf – ihre Kinder liegen an Wurzel-URLs (/dashboard/, /kunden/…).
//       Deshalb müssen diese Pfade hier einzeln stehen.
//
// WARTUNG: Kommt im eingeloggten Bereich eine neue Top-Level-Route hinzu, muss
// sie hier ergänzt werden. Der Primärschutz ist die Auth (diese Seiten sind
// client-gerenderte SPA-Shells ohne indexierbaren Inhalt) – dieser Eintrag ist
// Defense-in-Depth.
// ---------------------------------------------------------------------------
export const PRIVATE_DISALLOW: string[] = [
  '/api/',
  // (a) Token-/Kundenseiten
  '/mappe/',
  '/track/',
  '/angebot/',
  '/rechnung/',
  '/status/',
  '/buchen/',
  '/einladung/',
  '/email-bestaetigen/',
  '/passwort-vergessen/',
  '/passwort-zuruecksetzen/',
  '/abo-gesperrt/',
  '/haendler/', // token-gebundenes Händler-Portal (Bestellungen/Provision)
  '/haendler-portal/', // login-gebundenes Händler-Portal
  '/newsletter/', // deckt /newsletter/abmelden/ + /newsletter/bestaetigen/
  // (b) Eingeloggter Bereich – Route-Group (app), an Wurzel-URLs
  '/abo/',
  '/abos/',
  '/anfragen/',
  '/assistent/',
  '/audit/',
  '/auftraege/',
  '/auswertungen/',
  '/buchhaltung/',
  '/cockpit/',
  '/dashboard/',
  '/datenpannen/',
  '/datenschutz-cockpit/',
  '/dellenkalkulation/',
  '/eingangsrechnungen/',
  '/einstellungen/',
  '/erfolge/',
  '/fahrzeugannahme/',
  '/fahrzeuge/',
  '/feedback/',
  '/geraetemarkt/',
  '/hilfe/',
  '/kalkulation/',
  '/kassenbuch/',
  '/kunden/',
  '/leistungen/',
  '/mahnungen/',
  '/marktplatz/',
  '/mitarbeiter/',
  '/plantafel/',
  '/plattform-analysen/',
  '/plattform-geraetemarkt/',
  '/plattform-marktplatz/',
  '/plattform-newsletter/',
  '/plattform-sicherheit/',
  '/plattform-support/',
  '/rechnungen/',
  '/referenzen/',
  '/schadenserfassung/',
  '/schichtdicke/',
  '/shop/',
  '/standorte/',
  '/weiterempfehlen/',
  '/zeiterfassung/',
];

interface BuildMetadataInput {
  /** Seitentitel OHNE Marken-Suffix – das Root-Template hängt „ · Detailly" an. */
  title: string;
  description: string;
  /** Kanonischer Pfad, mit führendem UND abschließendem Slash, z. B. '/agb/'. */
  path: string;
}

/**
 * Einheitliche Metadaten für eine ÖFFENTLICHE, indexierbare Seite: Titel +
 * Beschreibung, kanonische URL sowie Open-Graph-/Twitter-Card-Angaben (damit
 * geteilte Links in WhatsApp & sozialen Netzen ordentlich aussehen).
 *
 * Bild: best-effort /icon.svg (analog zur bestehenden apple-touch-icon-
 * Konvention). Ein echtes 1200×630-PNG (/og-image.png) ist eine offene
 * Design-Folgeaufgabe – manche Plattformen rendern SVG-OG-Bilder nicht.
 */
export function buildMetadata({ title, description, path }: BuildMetadataInput): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: 'Detailly',
      locale: 'de_DE',
      url,
      title,
      description,
      images: [{ url: '/icon.svg' }],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: ['/icon.svg'],
    },
  };
}

/**
 * Metadaten für Seiten, die NIEMALS in einen Suchindex dürfen (Token-/Kunden-
 * seiten). Setzt robots:{index:false,follow:false} als Defense-in-Depth
 * ZUSÄTZLICH zum Disallow in robots.ts. Wird über ein eigenes Server-layout.tsx
 * eingehängt, weil die Seiten selbst Client-Komponenten sind.
 */
export function noindexMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}
