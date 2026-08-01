import { Betriebstyp } from '../tenants/entities/tenant.entity';
import type { PublicMitglied } from './public-members.service';
import { OrtsPageService } from './orts-page.service';
import { BETRIEB_PAGE_CACHE_TTL_MS } from './betrieb-page.service';

const BASE = 'https://app.detailly.test';

function mitglied(over: Partial<PublicMitglied> = {}): PublicMitglied {
  return {
    firmenname: 'Glanzwerk',
    slug: 'glanzwerk',
    betriebstyp: Betriebstyp.AUFBEREITUNG,
    stadt: 'Regensburg',
    kurzbeschreibung: 'Premium.',
    webseite: null,
    logoUrl: null,
    initiale: 'GW',
    plzRegion: '93',
    ...over,
  };
}

/** Baut Service + gemockten PublicMembersService + kontrollierbare Uhr. */
function setup() {
  const members = { ladeSichtbareOptinMitglieder: jest.fn() };
  let jetzt = 0;
  const svc = new OrtsPageService(members as any, () => jetzt);
  return { svc, members, setTime: (t: number) => (jetzt = t), advance: (d: number) => (jetzt += d) };
}

describe('OrtsPageService · renderPage', () => {
  it('liefert 200 + HTML fuer eine Gruppe mit >=1 Betrieb', async () => {
    const { svc, members } = setup();
    members.ladeSichtbareOptinMitglieder.mockResolvedValue([mitglied({ stadt: 'Regensburg' })]);
    const res = await svc.renderPage('aufbereitung', 'regensburg', BASE);
    expect(res.status).toBe(200);
    expect(res.html).toContain('<h1>Fahrzeugaufbereitung in Regensburg</h1>');
    expect(res.html).toContain(`href="${BASE}/betrieb/glanzwerk/"`);
  });

  it('liefert 404 + noindex fuer einen Ort ohne passenden Betrieb – OHNE Cache-Eintrag', async () => {
    const { svc, members } = setup();
    members.ladeSichtbareOptinMitglieder.mockResolvedValue([mitglied({ stadt: 'Regensburg' })]);
    // Viele verschiedene GUELTIG formatierte, aber nicht existierende citySlugs.
    for (let i = 0; i < 500; i++) {
      const res = await svc.renderPage('aufbereitung', `gibt-es-nicht-${i}`, BASE);
      expect(res.status).toBe(404);
      expect(res.html).toContain('noindex');
    }
    // Kein negativer Vektor: nur die EINE Gruppierung ist gecacht (cacheSize <= 1) ...
    expect(svc.cacheSize).toBe(1);
    // ... und die Gruppierung wurde nur EINMAL geladen (alle Misses teilen den Cache).
    expect(members.ladeSichtbareOptinMitglieder).toHaveBeenCalledTimes(1);
  });

  it('weist ein ungueltiges Gewerk ab – OHNE Gruppierung/DB', async () => {
    const { svc, members } = setup();
    members.ladeSichtbareOptinMitglieder.mockResolvedValue([mitglied()]);
    for (const g of ['komplett', 'lackierung', 'AUFBEREITUNG', '']) {
      const res = await svc.renderPage(g, 'regensburg', BASE);
      expect(res.status).toBe(404);
      expect(res.html).toContain('noindex');
    }
    expect(members.ladeSichtbareOptinMitglieder).not.toHaveBeenCalled();
    expect(svc.cacheSize).toBe(0);
  });

  it('weist einen ungueltigen citySlug (Traversal/Grossbuchstaben/Sonderzeichen) ab – OHNE Gruppierung/DB', async () => {
    const { svc, members } = setup();
    members.ladeSichtbareOptinMitglieder.mockResolvedValue([mitglied()]);
    for (const c of ['../etc/passwd', 'Regensburg', 'a b', 'a_b', 'a'.repeat(81), '']) {
      const res = await svc.renderPage('aufbereitung', c, BASE);
      expect(res.status).toBe(404);
    }
    expect(members.ladeSichtbareOptinMitglieder).not.toHaveBeenCalled();
    expect(svc.cacheSize).toBe(0);
  });

  it('escaped einen boesartigen Ortsnamen in der 200-Seite (XSS)', async () => {
    const { svc, members } = setup();
    members.ladeSichtbareOptinMitglieder.mockResolvedValue([
      mitglied({ slug: 'x', stadt: 'Berlin<script>alert(1)</script>' }),
    ]);
    // citySlug der boesen Stadt: "berlin-script-alert-1-script" (Sonderzeichen gefaltet).
    const res = await svc.renderPage('aufbereitung', 'berlin-script-alert-1-script', BASE);
    expect(res.status).toBe(200);
    expect(res.html).not.toContain('<script>alert(1)</script>');
    expect(res.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('cached die Gruppierung: zweiter Aufruf innerhalb der TTL laedt NICHT erneut', async () => {
    const { svc, members } = setup();
    members.ladeSichtbareOptinMitglieder.mockResolvedValue([mitglied()]);
    await svc.renderPage('aufbereitung', 'regensburg', BASE);
    await svc.renderPage('aufbereitung', 'regensburg', BASE);
    expect(members.ladeSichtbareOptinMitglieder).toHaveBeenCalledTimes(1);
  });

  it('laedt nach Ablauf der TTL neu', async () => {
    const { svc, members, advance } = setup();
    members.ladeSichtbareOptinMitglieder.mockResolvedValue([mitglied()]);
    await svc.renderPage('aufbereitung', 'regensburg', BASE);
    advance(BETRIEB_PAGE_CACHE_TTL_MS + 1);
    await svc.renderPage('aufbereitung', 'regensburg', BASE);
    expect(members.ladeSichtbareOptinMitglieder).toHaveBeenCalledTimes(2);
  });

  it('legt einen KOMPLETT-Betrieb auf allen drei Gewerk-Seiten seiner Stadt ab', async () => {
    const { svc, members } = setup();
    members.ladeSichtbareOptinMitglieder.mockResolvedValue([
      mitglied({ slug: 'k', stadt: 'Regensburg', betriebstyp: Betriebstyp.KOMPLETT }),
    ]);
    for (const g of ['aufbereitung', 'folierung', 'ppf']) {
      const res = await svc.renderPage(g, 'regensburg', BASE);
      expect(res.status).toBe(200);
      expect(res.html).toContain(`href="${BASE}/betrieb/k/"`);
    }
  });
});

describe('OrtsPageService · renderSitemap', () => {
  it('rendert alle (gewerk, citySlug)-Seiten als /betriebe/-URLs', async () => {
    const { svc, members } = setup();
    members.ladeSichtbareOptinMitglieder.mockResolvedValue([
      mitglied({ slug: 'a', stadt: 'Regensburg', betriebstyp: Betriebstyp.AUFBEREITUNG }),
      mitglied({ slug: 'b', stadt: 'München', betriebstyp: Betriebstyp.FOLIERUNG }),
    ]);
    const xml = await svc.renderSitemap(BASE);
    expect(xml).toContain(`<loc>${BASE}/betriebe/aufbereitung/regensburg/</loc>`);
    expect(xml).toContain(`<loc>${BASE}/betriebe/folierung/muenchen/</loc>`);
  });

  it('teilt die gecachte Gruppierung mit renderPage (ein Load)', async () => {
    const { svc, members } = setup();
    members.ladeSichtbareOptinMitglieder.mockResolvedValue([mitglied()]);
    await svc.renderSitemap(BASE);
    await svc.renderPage('aufbereitung', 'regensburg', BASE);
    expect(members.ladeSichtbareOptinMitglieder).toHaveBeenCalledTimes(1);
  });
});
