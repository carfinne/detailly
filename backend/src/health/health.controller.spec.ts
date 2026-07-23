import 'reflect-metadata';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { createIpBlockMiddleware } from '../security/ip-block.middleware';
import { READY_DB_TIMEOUT_MS, READY_THROTTLE_LIMIT, READY_THROTTLE_TTL_MS } from './health.constants';

describe('HealthController', () => {
  describe('Liveness (GET /api/v1/health)', () => {
    it('liefert NUR status + version (keine Interna)', () => {
      const ctrl = new HealthController({} as any);
      const res = ctrl.live();
      expect(res.status).toBe('ok');
      expect(typeof res.version).toBe('string');
      // Keine weiteren Felder (kein app/host/timestamp/db-Leak).
      expect(Object.keys(res).sort()).toEqual(['status', 'version']);
    });
  });

  describe('Readiness (GET /api/v1/health/ready)', () => {
    it('liefert { status: ready } bei erfolgreichem DB-Ping', async () => {
      const dataSource = { query: jest.fn().mockResolvedValue([{ ok: 1 }]) };
      const ctrl = new HealthController(dataSource as any);
      await expect(ctrl.ready()).resolves.toEqual({ status: 'ready' });
      expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('wirft 503 { status: unavailable } bei DB-Fehler – ohne Detail-Leak', async () => {
      const dataSource = { query: jest.fn().mockRejectedValue(new Error('connection refused')) };
      const ctrl = new HealthController(dataSource as any);
      await expect(ctrl.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
      // Kein DB-Fehlertext im Antwort-Body.
      try {
        await ctrl.ready();
      } catch (e) {
        const body = (e as ServiceUnavailableException).getResponse();
        expect(JSON.stringify(body)).not.toContain('connection refused');
        expect(body).toEqual({ status: 'unavailable' });
      }
    });

    it('wirft 503 { status: not-ready } bei DB-Timeout (Netz-Blackhole) – haengt nicht', async () => {
      jest.useFakeTimers();
      try {
        // Query, die NIE aufloest -> nur das Zeitlimit kann die Race entscheiden.
        const dataSource = { query: jest.fn(() => new Promise(() => {})) };
        const ctrl = new HealthController(dataSource as any);
        const p = ctrl.ready();
        p.catch(() => {}); // Rejection vormerken (kein unhandledRejection beim Advance)
        await jest.advanceTimersByTimeAsync(READY_DB_TIMEOUT_MS);
        await expect(p).rejects.toBeInstanceOf(ServiceUnavailableException);
        const err = (await p.catch((e) => e)) as ServiceUnavailableException;
        expect(err.getResponse()).toEqual({ status: 'not-ready' });
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('Throttle-Politik pro Route', () => {
    // Metadaten-Schluessel aus @nestjs/throttler (setThrottlerMetadata):
    // <KONSTANTE><throttler-name>. Default-Throttler-Name = 'default'.
    const SKIP = 'THROTTLER:SKIPdefault';
    const LIMIT = 'THROTTLER:LIMITdefault';
    const TTL = 'THROTTLER:TTLdefault';

    it('Liveness ist @SkipThrottle (kein DB-Zugriff -> LB darf frei pingen)', () => {
      expect(Reflect.getMetadata(SKIP, HealthController.prototype.live)).toBe(true);
      // und NICHT zusaetzlich gedrosselt
      expect(Reflect.getMetadata(LIMIT, HealthController.prototype.live)).toBeUndefined();
    });

    it('Readiness hat einen eigenen Rate-Limit statt SkipThrottle (DB-Zugriff schuetzen)', () => {
      expect(Reflect.getMetadata(SKIP, HealthController.prototype.ready)).toBeUndefined();
      expect(Reflect.getMetadata(LIMIT, HealthController.prototype.ready)).toBe(READY_THROTTLE_LIMIT);
      expect(Reflect.getMetadata(TTL, HealthController.prototype.ready)).toBe(READY_THROTTLE_TTL_MS);
    });
  });
});

describe('Health – von der IP-Sperr-Middleware ausgenommen (LB-Pings)', () => {
  const makeReqRes = (path: string) => {
    const req: any = {
      path,
      url: path,
      ip: '203.0.113.9',
      socket: { remoteAddress: '203.0.113.9' },
    };
    const res: any = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    return { req, res };
  };

  it('laesst /api/v1/health, /api/v1/health/ready und /health IMMER durch – auch bei geblockter IP', () => {
    // Service wuerde JEDE IP als geblockt melden – die Ausnahme muss trotzdem greifen.
    const service: any = {
      isBlocked: jest.fn().mockResolvedValue({ blocked: true, retryAfterSec: 60 }),
    };
    const middleware = createIpBlockMiddleware(service, {
      exemptPrefixes: ['/api/v1/platform/security', '/api/v1/health', '/health'],
    });

    for (const path of ['/api/v1/health', '/api/v1/health/ready', '/health']) {
      const { req, res } = makeReqRes(path);
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    }
    // Fuer ausgenommene Pfade wird die (teure) DB-Sperrpruefung gar nicht erst befragt.
    expect(service.isBlocked).not.toHaveBeenCalled();
  });
});
