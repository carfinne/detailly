import { Betriebstyp } from '../tenants/entities/tenant.entity';
import type { PublicMitglied } from './public-members.service';
import { ortGruppeKey } from './orts-slug';
import {
  gruppiereNachOrt,
  renderOrtsPageHtml,
  renderOrts404Html,
  renderOrtsSitemapXml,
  type OrtsGruppe,
} from './orts-page.render';

const BASE = 'https://app.detailly.test';
const opts = { baseUrl: BASE };

function mitglied(over: Partial<PublicMitglied> = {}): PublicMitglied {
  return {
    firmenname: 'Glanzwerk',
    slug: 'glanzwerk',
    betriebstyp: Betriebstyp.AUFBEREITUNG,
    stadt: 'Regensburg',
    kurzbeschreibung: 'Premium-Aufbereitung.',
    webseite: 'https://glanzwerk.de',
    logoUrl: null,
    initiale: 'GW',
    plzRegion: '93',
    ...over,
  };
}

function gruppe(over: Partial<OrtsGruppe> = {}): OrtsGruppe {
  return {
    gewerk: 'aufbereitung',
    citySlug: 'regensburg',
    ortAnzeige: 'Regensburg',
    betriebe: [mitglied()],
    ...over,
  };
}

/** Extrahiert den Inhalt des ld+json-<script>-Blocks aus dem gerenderten HTML. */
function extractJsonLd(html: string): string {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('kein ld+json-Block gefunden');
  return m[1];
}

describe('gruppiereNachOrt', () => {
  it('gruppiert nach (gewerk, citySlug)', () => {
    const g = gruppiereNachOrt([
      mitglied({ slug: 'a', stadt: 'Regensburg', betriebstyp: Betriebstyp.AUFBEREITUNG }),
      mitglied({ slug: 'b', stadt: 'Regensburg', betriebstyp: Betriebstyp.FOLIERUNG }),
    ]);
    expect(g.get(ortGruppeKey('aufbereitung', 'regensburg'))?.betriebe.map((m) => m.slug)).toEqual(['a']);
    expect(g.get(ortGruppeKey('folierung', 'regensburg'))?.betriebe.map((m) => m.slug)).toEqual(['b']);
  });

  it('legt einen KOMPLETT-Betrieb auf alle drei Gewerk-Seiten seiner Stadt', () => {
    const g = gruppiereNachOrt([mitglied({ slug: 'k', stadt: 'Regensburg', betriebstyp: Betriebstyp.KOMPLETT })]);
    expect(g.get(ortGruppeKey('aufbereitung', 'regensburg'))?.betriebe.map((m) => m.slug)).toEqual(['k']);
    expect(g.get(ortGruppeKey('folierung', 'regensburg'))?.betriebe.map((m) => m.slug)).toEqual(['k']);
    expect(g.get(ortGruppeKey('ppf', 'regensburg'))?.betriebe.map((m) => m.slug)).toEqual(['k']);
  });

  it('vereint verschiedene Original-Schreibweisen derselben Stadt in EINER Gruppe', () => {
    const g = gruppiereNachOrt([
      mitglied({ slug: 'a', stadt: 'Regensburg' }),
      mitglied({ slug: 'b', stadt: 'regensburg' }),
      mitglied({ slug: 'c', stadt: 'Regensburg ' }),
    ]);
    const grp = g.get(ortGruppeKey('aufbereitung', 'regensburg'));
    expect(grp?.betriebe.map((m) => m.slug)).toEqual(['a', 'b', 'c']);
  });

  it('waehlt als Anzeige-Ort die HAEUFIGSTE Original-Schreibweise', () => {
    const g = gruppiereNachOrt([
      mitglied({ slug: 'a', stadt: 'regensburg' }),
      mitglied({ slug: 'b', stadt: 'Regensburg' }),
      mitglied({ slug: 'c', stadt: 'Regensburg' }),
    ]);
    expect(g.get(ortGruppeKey('aufbereitung', 'regensburg'))?.ortAnzeige).toBe('Regensburg');
  });

  it('laesst Betriebe ohne brauchbare Stadt heraus (kein Fehler)', () => {
    const g = gruppiereNachOrt([
      mitglied({ slug: 'ohne', stadt: '!!!' }),
      mitglied({ slug: 'leer', stadt: null }),
      mitglied({ slug: 'ok', stadt: 'Regensburg' }),
    ]);
    expect(g.size).toBe(1);
    expect(g.get(ortGruppeKey('aufbereitung', 'regensburg'))?.betriebe.map((m) => m.slug)).toEqual(['ok']);
  });
});

describe('renderOrtsPageHtml · SEO-Grundgeruest + interne Links', () => {
  it('setzt lang=de, H1, canonical, title, description, OG', () => {
    const html = renderOrtsPageHtml(
      gruppe({ gewerk: 'folierung', citySlug: 'regensburg', ortAnzeige: 'Regensburg' }),
      opts,
    );
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('<h1>Folierung in Regensburg</h1>');
    expect(html).toContain(`<link rel="canonical" href="${BASE}/betriebe/folierung/regensburg/" />`);
    expect(html).toContain('<title>Folierung in Regensburg · Detailly</title>');
    expect(html).toContain('<meta name="robots" content="index,follow" />');
    expect(html).toContain(`<meta property="og:url" content="${BASE}/betriebe/folierung/regensburg/" />`);
  });

  it('rendert jeden Betrieb als crawlbaren Link auf /betrieb/<slug>/', () => {
    const html = renderOrtsPageHtml(
      gruppe({
        betriebe: [
          mitglied({ slug: 'glanzwerk', firmenname: 'Glanzwerk', kurzbeschreibung: 'Premium.' }),
          mitglied({ slug: 'shinytec', firmenname: 'ShinyTec', kurzbeschreibung: null }),
        ],
      }),
      opts,
    );
    expect(html).toContain(`href="${BASE}/betrieb/glanzwerk/"`);
    expect(html).toContain('Glanzwerk');
    expect(html).toContain(`href="${BASE}/betrieb/shinytec/"`);
    expect(html).toContain('ShinyTec');
  });

  it('baut ein JSON-LD ItemList mit je LocalBusiness', () => {
    const html = renderOrtsPageHtml(
      gruppe({ betriebe: [mitglied({ slug: 'a', firmenname: 'A' }), mitglied({ slug: 'b', firmenname: 'B' })] }),
      opts,
    );
    const parsed = JSON.parse(extractJsonLd(html));
    expect(parsed['@type']).toBe('ItemList');
    expect(parsed.numberOfItems).toBe(2);
    expect(parsed.itemListElement).toHaveLength(2);
    expect(parsed.itemListElement[0]['@type']).toBe('ListItem');
    expect(parsed.itemListElement[0].position).toBe(1);
    expect(parsed.itemListElement[0].item['@type']).toBe('LocalBusiness');
    expect(parsed.itemListElement[0].item.url).toBe(`${BASE}/betrieb/a/`);
  });
});

// ===========================================================================
// XSS – der kritische Teil: der frei eingegebene Ortsname UND die Betriebsfelder
// duerfen im HTML-String NIE ausbrechen (sichtbares HTML + JSON-LD).
// ===========================================================================
describe('renderOrtsPageHtml · XSS-Escaping', () => {
  it('escaped einen boesartigen Ortsnamen im sichtbaren HTML (H1/Lead)', () => {
    const html = renderOrtsPageHtml(
      gruppe({ ortAnzeige: '<script>alert(1)</script>"><img src=x onerror=alert(2)>' }),
      opts,
    );
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('verhindert </script>-Ausbruch im JSON-LD ueber den Ortsnamen', () => {
    const boese = 'Ort </script><script>alert(document.cookie)</script>';
    // Default-Gruppe ist Gewerk "aufbereitung" -> Label "Fahrzeugaufbereitung".
    const html = renderOrtsPageHtml(gruppe({ gewerk: 'aufbereitung', ortAnzeige: boese }), opts);
    // Genau EIN </script> im ganzen Dokument (der des ld+json-Blocks) – kein Ausbruch.
    expect((html.match(/<\/script>/g) || []).length).toBe(1);
    const parsed = JSON.parse(extractJsonLd(html));
    expect(parsed.name).toBe(`Fahrzeugaufbereitung in ${boese}`); // Inhalt unversehrt, nur sicher kodiert
  });

  it('escaped boesartige Firmennamen/Kurzbeschreibungen der Liste', () => {
    const html = renderOrtsPageHtml(
      gruppe({
        betriebe: [
          mitglied({
            slug: 'x',
            firmenname: '<b>Hack</b>',
            kurzbeschreibung: '"><img src=x onerror=alert(1)>',
          }),
        ],
      }),
      opts,
    );
    expect(html).not.toContain('<b>Hack</b>');
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;b&gt;Hack&lt;/b&gt;');
  });
});

describe('renderOrts404Html', () => {
  it('ist noindex und lang=de', () => {
    const html = renderOrts404Html(opts);
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('<meta name="robots" content="noindex,follow" />');
  });
});

describe('renderOrtsSitemapXml', () => {
  it('rendert alle (gewerk, citySlug) als /betriebe/-URLs', () => {
    const xml = renderOrtsSitemapXml(
      [
        { gewerk: 'aufbereitung', citySlug: 'regensburg' },
        { gewerk: 'folierung', citySlug: 'muenchen' },
      ],
      opts,
    );
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(`<loc>${BASE}/betriebe/aufbereitung/regensburg/</loc>`);
    expect(xml).toContain(`<loc>${BASE}/betriebe/folierung/muenchen/</loc>`);
  });
  it('kommt mit leerer Liste zurecht (gueltiges, leeres urlset)', () => {
    const xml = renderOrtsSitemapXml([], opts);
    expect(xml).toContain('<urlset');
    expect(xml).toContain('</urlset>');
    expect(xml).not.toContain('<loc>');
  });
});
