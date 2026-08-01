import { Betriebstyp } from '../tenants/entities/tenant.entity';
import type { PublicMitglied } from './public-members.service';
import {
  escapeHtml,
  escapeXml,
  isSafeHttpUrl,
  gewerkLabelDe,
  resolveSiteUrl,
  canonicalUrl,
  localBusinessNode,
  renderBetriebPageHtml,
  render404Html,
  renderBetriebeSitemapXml,
  jsonLdScriptContent,
  PLATZHALTER_SITE_URL,
} from './betrieb-page.render';

const BASE = 'https://app.detailly.test';
const opts = { baseUrl: BASE };

function mitglied(over: Partial<PublicMitglied> = {}): PublicMitglied {
  return {
    firmenname: 'Glanzwerk Aufbereitung',
    slug: 'glanzwerk-aufbereitung',
    betriebstyp: Betriebstyp.AUFBEREITUNG,
    stadt: 'Berlin',
    kurzbeschreibung: 'Premium-Aufbereitung seit 2012.',
    webseite: 'https://glanzwerk.de',
    logoUrl: null,
    initiale: 'GA',
    plzRegion: '10',
    ...over,
  };
}

/** Extrahiert den Inhalt des ld+json-<script>-Blocks aus dem gerenderten HTML. */
function extractJsonLd(html: string): string {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('kein ld+json-Block gefunden');
  return m[1];
}

describe('escapeHtml', () => {
  it('neutralisiert alle HTML-/Attribut-Sonderzeichen', () => {
    expect(escapeHtml('<b>"x"&\'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/b&gt;');
  });
  it('escaped `&` zuerst (kein Doppel-Escaping)', () => {
    expect(escapeHtml('a & <b')).toBe('a &amp; &lt;b');
  });
});

describe('escapeXml', () => {
  it('nutzt &apos; statt &#39; (XML-gueltig)', () => {
    expect(escapeXml(`a'&<>"`)).toBe('a&apos;&amp;&lt;&gt;&quot;');
  });
});

describe('isSafeHttpUrl', () => {
  it('akzeptiert http/https', () => {
    expect(isSafeHttpUrl('https://x.de')).toBe(true);
    expect(isSafeHttpUrl('http://x.de')).toBe(true);
  });
  it('lehnt gefaehrliche Schemata + Leeres ab', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,x')).toBe(false);
    expect(isSafeHttpUrl('')).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
  });
});

describe('gewerkLabelDe', () => {
  it('mappt jeden Betriebstyp auf sein deutsches Label', () => {
    expect(gewerkLabelDe(Betriebstyp.AUFBEREITUNG)).toBe('Fahrzeugaufbereitung');
    expect(gewerkLabelDe(Betriebstyp.FOLIERUNG)).toBe('Folierung');
    expect(gewerkLabelDe(Betriebstyp.PPF)).toBe('PPF / Lackschutz');
    expect(gewerkLabelDe(Betriebstyp.KOMPLETT)).toBe('Komplett-Anbieter');
  });
});

describe('resolveSiteUrl', () => {
  it('PUBLIC_SITE_URL hat Vorrang', () => {
    expect(resolveSiteUrl({ PUBLIC_SITE_URL: 'https://a.de/', FRONTEND_URL: 'https://b.de' })).toBe('https://a.de');
  });
  it('faellt auf FRONTEND_URL zurueck', () => {
    expect(resolveSiteUrl({ FRONTEND_URL: 'https://b.de/' })).toBe('https://b.de');
  });
  it('faellt sonst auf den Platzhalter zurueck', () => {
    expect(resolveSiteUrl({})).toBe(PLATZHALTER_SITE_URL);
  });
});

describe('canonicalUrl', () => {
  it('haengt /betrieb/<slug>/ mit abschliessendem Slash an', () => {
    expect(canonicalUrl(BASE, 'abc')).toBe(`${BASE}/betrieb/abc/`);
  });
});

describe('localBusinessNode (spiegelt structured-data.ts, nur Whitelist)', () => {
  it('nimmt nur freigegebene Felder auf', () => {
    const node = localBusinessNode(mitglied(), opts);
    expect(node['@type']).toBe('LocalBusiness');
    expect(node.name).toBe('Glanzwerk Aufbereitung');
    expect(node.description).toBe('Premium-Aufbereitung seit 2012.');
    expect(node.url).toBe(`${BASE}/betrieb/glanzwerk-aufbereitung/`);
    expect(node.sameAs).toEqual(['https://glanzwerk.de']);
    expect(node.address).toEqual({ '@type': 'PostalAddress', addressLocality: 'Berlin' });
    expect(node.areaServed).toBe('10 (Leitregion)');
  });
  it('faellt bei fehlender Kurzbeschreibung auf das Gewerk-Label zurueck', () => {
    const node = localBusinessNode(mitglied({ kurzbeschreibung: null }), opts);
    expect(node.description).toBe('Fahrzeugaufbereitung');
  });
  it('nimmt eine unsichere Webseite NICHT als sameAs auf', () => {
    const node = localBusinessNode(mitglied({ webseite: 'javascript:alert(1)' }), opts);
    expect(node.sameAs).toBeUndefined();
  });
});

// ===========================================================================
// XSS – der kritische Teil: nutzergesteuerte Felder duerfen im HTML-String NIE
// ausbrechen (weder sichtbares HTML noch der JSON-LD-Block).
// ===========================================================================
describe('renderBetriebPageHtml · XSS-Escaping', () => {
  it('escaped einen boesartigen Firmennamen (<script>/"/&) im sichtbaren HTML', () => {
    const html = renderBetriebPageHtml(
      mitglied({ firmenname: '<script>alert(1)</script>"><img src=x onerror=alert(2)>' }),
      opts,
    );
    // Der rohe Angriff darf NIRGENDS unescaped stehen.
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<img src=x onerror');
    // Stattdessen escaped.
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('verhindert </script>-Ausbruch im JSON-LD (Kurzbeschreibung)', () => {
    const boese = 'Angebot </script><script>alert(document.cookie)</script>';
    const html = renderBetriebPageHtml(mitglied({ kurzbeschreibung: boese }), opts);
    // Genau EIN </script> im ganzen Dokument (der des ld+json-Blocks) – kein Ausbruch.
    expect((html.match(/<\/script>/g) || []).length).toBe(1);
    // Der ld+json-Inhalt enthaelt kein rohes </script>, aber die Daten parsen zurueck.
    const jsonLd = extractJsonLd(html);
    expect(jsonLd).not.toContain('</script>');
    const parsed = JSON.parse(jsonLd);
    expect(parsed.description).toBe(boese); // Inhalt unversehrt, nur sicher kodiert
  });

  it('escaped Anfuehrungszeichen im Attribut-Kontext (kein Attribut-Ausbruch)', () => {
    const html = renderBetriebPageHtml(mitglied({ stadt: 'Bad "Zwischenahn"' }), opts);
    expect(html).not.toContain('"Zwischenahn"'); // rohe Quotes brechen kein Attribut
    expect(html).toContain('&quot;Zwischenahn&quot;');
  });

  it('rendert eine unsichere Webseite NICHT als klickbaren Link', () => {
    const html = renderBetriebPageHtml(mitglied({ webseite: 'javascript:alert(1)' }), opts);
    expect(html).not.toContain('javascript:alert(1)');
    // Kein Website-CTA-ANKER ohne sichere URL (die CSS-Regel .db-cta--primary im
    // <style> bleibt bestehen -> gezielt auf den <a class="…"> pruefen).
    expect(html).not.toContain('<a class="db-cta db-cta--primary"');
    // Gegenprobe: bei sicherer URL WIRD der Anker gerendert.
    const okHtml = renderBetriebPageHtml(mitglied({ webseite: 'https://glanzwerk.de' }), opts);
    expect(okHtml).toContain('<a class="db-cta db-cta--primary"');
  });

  it('jsonLdScriptContent neutralisiert < > &', () => {
    const c = jsonLdScriptContent({ x: '<a> & </b>' });
    expect(c).not.toContain('<');
    expect(c).not.toContain('>');
    expect(c).toContain('\\u003c');
    expect(c).toContain('\\u0026');
    expect(JSON.parse(c).x).toBe('<a> & </b>');
  });
});

describe('renderBetriebPageHtml · SEO-Grundgeruest', () => {
  it('setzt lang=de, canonical, title, description, Open Graph', () => {
    const html = renderBetriebPageHtml(mitglied(), opts);
    expect(html).toContain('<html lang="de">');
    expect(html).toContain(`<link rel="canonical" href="${BASE}/betrieb/glanzwerk-aufbereitung/" />`);
    expect(html).toContain('<title>Glanzwerk Aufbereitung – Fahrzeugaufbereitung in Berlin · Detailly</title>');
    expect(html).toContain('<meta name="description" content="Premium-Aufbereitung seit 2012." />');
    expect(html).toContain('<meta name="robots" content="index,follow" />');
    expect(html).toContain(`<meta property="og:url" content="${BASE}/betrieb/glanzwerk-aufbereitung/" />`);
    expect(html).toContain('<h1>Glanzwerk Aufbereitung</h1>');
  });

  it('laesst „in <Stadt>" weg, wenn keine Stadt bekannt ist', () => {
    const html = renderBetriebPageHtml(mitglied({ stadt: null }), opts);
    expect(html).toContain('<title>Glanzwerk Aufbereitung – Fahrzeugaufbereitung · Detailly</title>');
  });
});

describe('render404Html', () => {
  it('ist noindex und lang=de', () => {
    const html = render404Html(opts);
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('<meta name="robots" content="noindex,follow" />');
  });
});

describe('renderBetriebeSitemapXml', () => {
  it('rendert alle Slugs als /betrieb/<slug>/-URLs mit XML-Kopf', () => {
    const xml = renderBetriebeSitemapXml(['a', 'b-c'], opts);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain(`<loc>${BASE}/betrieb/a/</loc>`);
    expect(xml).toContain(`<loc>${BASE}/betrieb/b-c/</loc>`);
  });
  it('kommt mit einer leeren Liste zurecht (gueltiges, leeres urlset)', () => {
    const xml = renderBetriebeSitemapXml([], opts);
    expect(xml).toContain('<urlset');
    expect(xml).toContain('</urlset>');
    expect(xml).not.toContain('<loc>');
  });
});
