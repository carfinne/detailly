// ===========================================================================
// Bausteine für strukturierte Daten (schema.org / JSON-LD). Reine Objekt-Fabriken
// ohne Fremdpaket – werden über <JsonLd> (components/seo/JsonLd) gerendert.
//
// Grundsatz: NUR Angaben, die stimmen. Keine erfundenen Bewertungen
// (aggregateRating), keine erfundenen Nutzerzahlen, keine unsicheren Preise.
// ===========================================================================
import { SITE_URL } from './seo';

/** Stabile @id der Organisation, damit andere Knoten sie referenzieren können. */
const ORG_ID = `${SITE_URL}/#organization`;

/** Organisation (Anbieter der Software). Reale, belegbare Angaben. */
export function organizationNode(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'Detailly',
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/icon.svg`,
    description:
      'Detailly ist eine deutsche Werkstatt-Software für Fahrzeugaufbereitung, Folierung und PPF.',
  };
}

/**
 * Die Software selbst. BEWUSST OHNE `offers`/Preis: die auf der Landing gezeigten
 * Beträge sind teils „ca./effektiv" und ohne Netto-/Brutto-Kennzeichnung – eine
 * falsche Preisangabe im Suchergebnis wäre wettbewerbsrechtlich riskant. Ein
 * fehlendes Feld schadet nicht, ein falscher Preis schon. BEWUSST OHNE
 * `aggregateRating`: es liegen keine echten Bewertungen vor.
 */
export function softwareApplicationNode(): Record<string, unknown> {
  return {
    '@type': 'SoftwareApplication',
    name: 'Detailly',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: `${SITE_URL}/`,
    inLanguage: 'de',
    description:
      'Werkstatt-Software für Fahrzeugaufbereitung, Folierung und PPF: Kunden, Fahrzeuge, Aufträge, Plantafel, 3D-Schadenserfassung und GoBD-konforme Rechnungen in einer mandantenfähigen Web-Anwendung.',
    provider: { '@id': ORG_ID },
  };
}

/** FAQ-Knoten aus echten Frage-/Antwort-Paaren (Antworten als reiner Text). */
export function faqPageNode(items: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: { '@type': 'Answer', text: it.answer },
    })),
  };
}

/** Ratgeber-Artikel. Datum stammt aus der echten Git-Historie der Seite. */
export function articleNode(input: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
}): Record<string, unknown> {
  return {
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    inLanguage: 'de',
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    mainEntityOfPage: `${SITE_URL}${input.path}`,
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
  };
}

/**
 * Öffentliches Betriebs-Verzeichnis als ItemList von LocalBusiness-Einträgen.
 * STRIKT nur die vom Betrieb freigegebenen, PII-armen Whitelist-Felder aus dem
 * Backend (PublicMitglied): Name, Gewerk, Ort, grobe Leitregion, Webseite, Logo,
 * Kurzbeschreibung. NIEMALS Straße, volle PLZ, Telefon oder E-Mail.
 */
export interface PublicMitgliedInput {
  firmenname: string;
  gewerkLabel?: string | null;
  stadt?: string | null;
  plzRegion?: string | null;
  webseite?: string | null;
  logoUrl?: string | null;
  kurzbeschreibung?: string | null;
}

export function betriebeItemListNode(mitglieder: PublicMitgliedInput[]): Record<string, unknown> {
  return {
    '@type': 'ItemList',
    name: 'Betriebe mit Detailly',
    numberOfItems: mitglieder.length,
    itemListElement: mitglieder.map((m, i) => {
      const business: Record<string, unknown> = {
        '@type': 'LocalBusiness',
        name: m.firmenname,
      };
      if (m.kurzbeschreibung) business.description = m.kurzbeschreibung;
      else if (m.gewerkLabel) business.description = m.gewerkLabel;
      if (m.webseite) business.url = m.webseite;
      if (m.logoUrl) business.image = m.logoUrl;
      // Ort nur als addressLocality; Leitregion als areaServed (bewusst KEINE
      // volle PLZ – nur die grobe 2-stellige Region, die der Betrieb freigab).
      if (m.stadt) business.address = { '@type': 'PostalAddress', addressLocality: m.stadt };
      if (m.plzRegion) business.areaServed = `${m.plzRegion} (Leitregion)`;
      return { '@type': 'ListItem', position: i + 1, item: business };
    }),
  };
}

/** Verpackt einen oder mehrere Knoten in einen @graph mit @context. */
export function jsonLdGraph(nodes: Record<string, unknown>[]): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
