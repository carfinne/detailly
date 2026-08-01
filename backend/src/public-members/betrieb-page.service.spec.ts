import { Betriebstyp } from '../tenants/entities/tenant.entity';
import type { PublicMitglied } from './public-members.service';
import { BetriebPageService, BETRIEB_PAGE_CACHE_TTL_MS } from './betrieb-page.service';

const BASE = 'https://app.detailly.test';

function mitglied(): PublicMitglied {
  return {
    firmenname: 'Glanzwerk Aufbereitung',
    slug: 'glanzwerk-aufbereitung',
    betriebstyp: Betriebstyp.AUFBEREITUNG,
    stadt: 'Berlin',
    kurzbeschreibung: 'Premium.',
    webseite: 'https://glanzwerk.de',
    logoUrl: null,
    initiale: 'GA',
    plzRegion: '10',
  };
}

/** Baut Service + gemockten PublicMembersService + kontrollierbare Uhr. */
function setup(maxEntries?: number) {
  const members = {
    findePublicBySlug: jest.fn(),
    listeSlugsFuerSitemap: jest.fn(),
  };
  let jetzt = 0;
  const svc = new BetriebPageService(members as any, () => jetzt, maxEntries);
  return { svc, members, setTime: (t: number) => (jetzt = t), advance: (d: number) => (jetzt += d) };
}

describe('BetriebPageService · renderSlug', () => {
  it('liefert Status 200 + HTML fuer einen bekannten Slug', async () => {
    const { svc, members } = setup();
    members.findePublicBySlug.mockResolvedValue(mitglied());
    const res = await svc.renderSlug('glanzwerk-aufbereitung', BASE);
    expect(res.status).toBe(200);
    expect(res.html).toContain('<h1>Glanzwerk Aufbereitung</h1>');
    expect(res.html).toContain(`href="${BASE}/betrieb/glanzwerk-aufbereitung/"`);
  });

  it('liefert Status 404 + noindex-HTML fuer unbekannten/abgemeldeten Slug', async () => {
    const { svc, members } = setup();
    members.findePublicBySlug.mockResolvedValue(null);
    const res = await svc.renderSlug('gibt-es-nicht', BASE);
    expect(res.status).toBe(404);
    expect(res.html).toContain('noindex');
  });

  it('cached das 200-Ergebnis: zweiter Aufruf innerhalb der TTL trifft die DB NICHT erneut', async () => {
    const { svc, members } = setup();
    members.findePublicBySlug.mockResolvedValue(mitglied());
    await svc.renderSlug('glanzwerk-aufbereitung', BASE);
    await svc.renderSlug('glanzwerk-aufbereitung', BASE);
    expect(members.findePublicBySlug).toHaveBeenCalledTimes(1);
  });

  it('cached die 404 NICHT (kein unbegrenzt wachsender Negativ-Cache)', async () => {
    const { svc, members } = setup();
    members.findePublicBySlug.mockResolvedValue(null);
    // Viele verschiedene GUELTIGE, aber nicht existierende Slugs (der DoS-Vektor).
    for (let i = 0; i < 1000; i++) {
      const res = await svc.renderSlug(`gibt-es-nicht-${i}`, BASE);
      expect(res.status).toBe(404);
    }
    // Kein einziger 404 landet im Cache -> Map bleibt leer.
    expect(svc.cacheSize).toBe(0);
    // Derselbe Miss-Slug fragt jedes Mal erneut die (billige, indizierte) DB.
    await svc.renderSlug('gibt-es-nicht-0', BASE);
    expect(members.findePublicBySlug).toHaveBeenCalledTimes(1001);
  });

  it('weist einen ungueltigen Slug (Traversal/Grossbuchstaben/zu lang/Sonderzeichen) ohne DB + ohne Cache ab', async () => {
    const { svc, members } = setup();
    const boese = ['../etc/passwd', 'Foo', 'a'.repeat(81), 'a b', 'x%2e%2e', 'sub/seg', 'a_b', 'ä'];
    for (const s of boese) {
      const res = await svc.renderSlug(s, BASE);
      expect(res.status).toBe(404);
      expect(res.html).toContain('noindex');
    }
    // Kein DB-Zugriff und kein Cache-Eintrag fuer Muell-Slugs.
    expect(members.findePublicBySlug).not.toHaveBeenCalled();
    expect(svc.cacheSize).toBe(0);
  });

  it('deckelt den Positiv-Cache und verdraengt LRU-artig bei Ueberschreiten des Maximums', async () => {
    const { svc, members } = setup(2); // Maximum 2 Eintraege
    members.findePublicBySlug.mockImplementation(async (slug: string) => ({ ...mitglied(), slug }));
    await svc.renderSlug('aaa', BASE); // Cache: [aaa]
    await svc.renderSlug('bbb', BASE); // Cache: [aaa, bbb]
    await svc.renderSlug('ccc', BASE); // aaa verdraengt -> Cache: [bbb, ccc]
    expect(svc.cacheSize).toBeLessThanOrEqual(2);
    // bbb + ccc sind noch da (kein erneuter DB-Lookup) ...
    await svc.renderSlug('bbb', BASE);
    await svc.renderSlug('ccc', BASE);
    // ... aaa wurde verdraengt -> erneuter DB-Lookup.
    await svc.renderSlug('aaa', BASE);
    const calls = members.findePublicBySlug.mock.calls.map((c: any[]) => c[0]);
    expect(calls).toEqual(['aaa', 'bbb', 'ccc', 'aaa']);
  });

  it('laedt nach Ablauf der TTL neu', async () => {
    const { svc, members, advance } = setup();
    members.findePublicBySlug.mockResolvedValue(mitglied());
    await svc.renderSlug('glanzwerk-aufbereitung', BASE);
    advance(BETRIEB_PAGE_CACHE_TTL_MS + 1);
    await svc.renderSlug('glanzwerk-aufbereitung', BASE);
    expect(members.findePublicBySlug).toHaveBeenCalledTimes(2);
  });

  it('trennt den Cache je baseUrl (kein Ausliefern falscher canonical-/OG-URLs)', async () => {
    const { svc, members } = setup();
    members.findePublicBySlug.mockResolvedValue(mitglied());
    await svc.renderSlug('glanzwerk-aufbereitung', 'https://a.de');
    await svc.renderSlug('glanzwerk-aufbereitung', 'https://b.de');
    expect(members.findePublicBySlug).toHaveBeenCalledTimes(2);
  });
});

describe('BetriebPageService · renderSitemap', () => {
  it('rendert die Slugs als /betrieb/<slug>/-URLs', async () => {
    const { svc, members } = setup();
    members.listeSlugsFuerSitemap.mockResolvedValue(['a', 'b']);
    const xml = await svc.renderSitemap(BASE);
    expect(xml).toContain(`<loc>${BASE}/betrieb/a/</loc>`);
    expect(xml).toContain(`<loc>${BASE}/betrieb/b/</loc>`);
  });

  it('cached die Sitemap innerhalb der TTL', async () => {
    const { svc, members } = setup();
    members.listeSlugsFuerSitemap.mockResolvedValue(['a']);
    await svc.renderSitemap(BASE);
    await svc.renderSitemap(BASE);
    expect(members.listeSlugsFuerSitemap).toHaveBeenCalledTimes(1);
  });
});
