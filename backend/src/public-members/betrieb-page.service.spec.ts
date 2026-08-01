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
function setup() {
  const members = {
    findePublicBySlug: jest.fn(),
    listeSlugsFuerSitemap: jest.fn(),
  };
  let jetzt = 0;
  const svc = new BetriebPageService(members as any, () => jetzt);
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

  it('cached auch die 404 (Slug-Spam trifft die DB nicht wiederholt)', async () => {
    const { svc, members } = setup();
    members.findePublicBySlug.mockResolvedValue(null);
    await svc.renderSlug('spam', BASE);
    await svc.renderSlug('spam', BASE);
    expect(members.findePublicBySlug).toHaveBeenCalledTimes(1);
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
