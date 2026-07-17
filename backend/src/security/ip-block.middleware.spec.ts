import { createIpBlockMiddleware } from './ip-block.middleware';
import type { IpBlockService } from './ip-block.service';

/** Wartet, bis die vom Middleware gestartete Promise-Kette abgearbeitet ist. */
const flush = () => new Promise((r) => setImmediate(r));

function makeRes() {
  const res: any = {
    statusCode: 0,
    body: undefined,
    headers: {} as Record<string, string>,
    setHeader: jest.fn((k: string, v: string) => {
      res.headers[k] = v;
    }),
    status: jest.fn((c: number) => {
      res.statusCode = c;
      return res;
    }),
    json: jest.fn((b: unknown) => {
      res.body = b;
      return res;
    }),
  };
  return res;
}

function makeReq(clientIp: string, socketIp: string) {
  return { ip: clientIp, socket: { remoteAddress: socketIp } } as any;
}

describe('IpBlockMiddleware (e2e-artig, echte Middleware)', () => {
  it('geblockte IP -> sofort 429 mit Retry-After, KEIN next()', async () => {
    const service = {
      isBlocked: jest.fn(async () => ({ blocked: true, retryAfterSec: 42 })),
    } as unknown as IpBlockService;
    const mw = createIpBlockMiddleware(service);
    const req = makeReq('203.0.113.10', '203.0.113.10');
    const res = makeRes();
    const next = jest.fn();

    mw(req, res, next);
    await flush();

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.headers['Retry-After']).toBe('42');
    expect(next).not.toHaveBeenCalled();
  });

  it('nicht geblockte IP -> next(), keine Antwort geschrieben', async () => {
    const service = {
      isBlocked: jest.fn(async () => ({ blocked: false })),
    } as unknown as IpBlockService;
    const mw = createIpBlockMiddleware(service);
    const res = makeRes();
    const next = jest.fn();

    mw(makeReq('203.0.113.11', '203.0.113.11'), res, next);
    await flush();

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('Allowlist: echter Loopback-Peer + Loopback-Client wird NIE geblockt (kein Service-Aufruf)', async () => {
    const isBlocked = jest.fn(async () => ({ blocked: true }));
    const service = { isBlocked } as unknown as IpBlockService;
    const mw = createIpBlockMiddleware(service);
    const res = makeRes();
    const next = jest.fn();

    mw(makeReq('127.0.0.1', '127.0.0.1'), res, next);
    await flush();

    // Kurzschluss VOR dem Service -> isBlocked gar nicht erst aufgerufen.
    expect(isBlocked).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('gespoofter XFF (Client 127.0.0.1) bei PUBLIC Socket -> keine Ausnahme, wird geprueft/geblockt', async () => {
    const isBlocked = jest.fn(async () => ({ blocked: true, retryAfterSec: 10 }));
    const service = { isBlocked } as unknown as IpBlockService;
    const mw = createIpBlockMiddleware(service);
    const res = makeRes();
    const next = jest.fn();

    // req.ip = 127.0.0.1 (gespooft ueber X-Forwarded-For), echter Socket-Peer public.
    mw(makeReq('127.0.0.1', '203.0.113.66'), res, next);
    await flush();

    expect(isBlocked).toHaveBeenCalledWith('127.0.0.1');
    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it('fail-open: wirft der Service, wird die Anfrage durchgelassen (next)', async () => {
    const service = {
      isBlocked: jest.fn(async () => {
        throw new Error('service kaputt');
      }),
    } as unknown as IpBlockService;
    const mw = createIpBlockMiddleware(service);
    const res = makeRes();
    const next = jest.fn();

    mw(makeReq('203.0.113.99', '203.0.113.99'), res, next);
    await flush();

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
