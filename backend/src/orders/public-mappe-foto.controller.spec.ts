import { PublicTrackingController } from './public-tracking.controller';
import { storage } from '../common/storage';
import { Readable } from 'stream';

/**
 * RECHT (Widerruf -> sofort 404): der token-scoped Mappe-Bildstream ist wie das
 * Schaufenster CONSENT-/Token-abhaengig und darf NICHT `public` cachebar sein.
 * Sonst koennte ein Shared Cache (CDN/Proxy) ein Bild nach dem Zurueckziehen des
 * Zugriffs (Token neu vergeben / Status zurueckgesetzt) weiter ausliefern. Dieser
 * Test fixiert `no-store` + `nosniff` + korrekten Content-Type und schliesst
 * `public` explizit aus.
 */
describe('PublicTrackingController · Cache-/Sicherheits-Header des Mappe-Foto-Endpunkts', () => {
  function makeController() {
    const orders = {
      mappeFotoContextByToken: jest
        .fn()
        .mockResolvedValue({ key: 'orders/t1/a.webp', contentType: 'image/webp' }),
    };
    const controller = new PublicTrackingController(orders as any, {} as any);
    return { controller, orders };
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

  afterEach(() => jest.restoreAllMocks());

  it('setzt Cache-Control: no-store (kein `public`), nosniff + Content-Type', async () => {
    jest.spyOn(storage, 'getStream').mockResolvedValue(Readable.from(['x']) as any);
    const { controller } = makeController();
    const res = makeRes();
    await controller.foto('a'.repeat(48), 'nachher', '0', res as any);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.headers['Cache-Control']).not.toContain('public');
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.headers['Content-Type']).toBe('image/webp');
  });
});
