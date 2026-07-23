import { PublicShowcaseController } from './public-showcase.controller';

/**
 * RECHT (Widerruf -> sofort 404): der oeffentliche, CONSENT-abhaengige Bildstream
 * darf NICHT `public` cachebar sein. Sonst koennte ein Shared Cache (CDN/Proxy)
 * ein widerrufenes Kundenfoto nach dem Zurueckziehen weiter ausliefern, obwohl der
 * Origin bereits 404 liefert. Dieser Test fixiert den Cache-Header (`no-store`) und
 * schliesst `public` explizit aus.
 */
describe('PublicShowcaseController · Cache-Header des Bild-Endpunkts (Widerruf-Sicherheit)', () => {
  function makeController() {
    const service = {
      // __filename existiert -> createReadStream im Controller oeffnet eine reale
      // Datei; der Stream wird im Test nicht konsumiert (nur Header geprueft).
      resolvePublicImagePath: jest.fn().mockResolvedValue(__filename),
      contentType: jest.fn().mockReturnValue('image/webp'),
    };
    const controller = new PublicShowcaseController(service as any);
    return { controller, service };
  }

  function makeRes() {
    const headers: Record<string, string> = {};
    return {
      headers,
      setHeader: jest.fn((k: string, v: string) => {
        headers[k] = v;
      }),
    };
  }

  it('setzt Cache-Control: no-store (kein `public`, kein Vorrat)', async () => {
    const { controller } = makeController();
    const res = makeRes();
    await controller.bild('glanzwerk', 'a'.repeat(48), 'vorher', res as any);
    expect(res.headers['Cache-Control']).toBe('no-store');
    // Defense-in-Depth: unter keinen Umstaenden `public` (Shared-Cache-Freigabe).
    expect(res.headers['Cache-Control']).not.toContain('public');
  });

  it('setzt nosniff + korrekten Content-Type', async () => {
    const { controller } = makeController();
    const res = makeRes();
    await controller.bild('glanzwerk', 'a'.repeat(48), 'nachher', res as any);
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.headers['Content-Type']).toBe('image/webp');
  });
});
