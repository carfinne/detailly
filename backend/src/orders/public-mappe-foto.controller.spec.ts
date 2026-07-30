import { PublicTrackingController } from './public-tracking.controller';
import { NoStoreMiddleware } from './no-store.middleware';
import { storage } from '../common/storage';
import { Readable } from 'stream';

/**
 * RECHT (Widerruf -> sofort 404): der token-scoped Mappe-Bildstream ist wie das
 * Schaufenster CONSENT-/Token-abhaengig und darf NICHT `public` cachebar sein.
 * Sonst koennte ein Shared Cache (CDN/Proxy) ein Bild nach dem Zurueckziehen des
 * Zugriffs (Token neu vergeben / Status zurueckgesetzt) weiter ausliefern.
 *
 * `no-store` + `nosniff` werden inzwischen ZENTRAL per NoStoreMiddleware fuer ALLE
 * /public/orders/*-Routen gesetzt (auch auf dem 404-Fehlerpfad, weil Middleware vor
 * Guards/Handler/Exception-Filter laeuft). Der Foto-Handler setzt daher nur noch den
 * Content-Type des Bildes. Beide Aspekte werden hier getrennt fixiert.
 */
describe('PublicTrackingController · Content-Type des Mappe-Foto-Endpunkts', () => {
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

  it('setzt den Content-Type des Bildes (Cache-Header kommen aus der Middleware)', async () => {
    jest.spyOn(storage, 'getStream').mockResolvedValue(Readable.from(['x']) as any);
    const { controller } = makeController();
    const res = makeRes();
    await controller.foto('a'.repeat(48), 'nachher', '0', res as any);
    expect(res.headers['Content-Type']).toBe('image/webp');
  });
});

describe('NoStoreMiddleware · zentrale Cache-/Sicherheits-Header', () => {
  function makeRes() {
    const headers: Record<string, string> = {};
    return {
      headers,
      setHeader: jest.fn((k: string, v: string) => {
        headers[k] = v;
      }),
    };
  }

  it('setzt no-store (kein `public`) + nosniff und ruft next() auf', () => {
    const mw = new NoStoreMiddleware();
    const res = makeRes();
    const next = jest.fn();

    mw.use({} as any, res as any, next);

    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.headers['Cache-Control']).not.toContain('public');
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    // next() garantiert, dass die bereits gesetzten Header auch dann am Response
    // haengen, wenn der nachfolgende Handler 404/429 wirft (Fehlerpfad-Abdeckung).
    expect(next).toHaveBeenCalledTimes(1);
  });
});
