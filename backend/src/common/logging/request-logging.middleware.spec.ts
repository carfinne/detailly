import type { Express, Request, Response } from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
// Runtime-Wert via require: tsconfig hat KEIN esModuleInterop (wie in
// body-limits.spec.ts). Typen kommen aus dem `import type` oben.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');
import { createRequestLoggingMiddleware, REQUEST_ID_HEADER } from './request-logging.middleware';

/**
 * Echter HTTP-Roundtrip OHNE Zusatz-Dependency (kein supertest im Projekt):
 * express-App mit der request-logging-Middleware, Dummy-Routen, Port 0, Requests
 * via globalem fetch. Die Access-Logzeilen werden ueber den injizierten `sink`
 * abgefangen (kein stdout-Monkey-Patch).
 */
describe('request-logging.middleware (Request-ID + Access-Log)', () => {
  let server: Server;
  let baseUrl: string;
  let logs: string[];

  beforeAll(async () => {
    logs = [];
    const app: Express = express();
    app.use(createRequestLoggingMiddleware((line) => logs.push(line)));

    // Authentifizierte Route: simuliert req.user wie die JwtStrategy (nur IDs).
    app.get('/api/v1/orders/:id', (req: Request, res: Response) => {
      (req as Request & { user?: unknown }).user = { id: 'user-1', tenantId: 'tenant-1' };
      res.json({ ok: true });
    });
    // Oeffentliche Token-Route: der Token darf NIE im Log landen.
    app.get('/api/v1/public/angebote/:token', (_req: Request, res: Response) =>
      res.json({ ok: true }),
    );
    // Health: darf NICHT geloggt werden (kein Spam), Header trotzdem gesetzt.
    app.get('/api/v1/health', (_req: Request, res: Response) => res.json({ status: 'ok' }));
    // Fehlerroute (4xx) zum Level-Test.
    app.get('/api/v1/missing', (_req: Request, res: Response) => res.status(404).json({ nope: true }));

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    logs.length = 0;
  });

  /** Wartet, bis mind. `n` Logzeilen da sind (res.on('finish') ist async). */
  async function warteAufLogs(n: number): Promise<void> {
    for (let i = 0; i < 50 && logs.length < n; i++) {
      await new Promise((r) => setTimeout(r, 5));
    }
  }

  it('setzt einen X-Request-Id-Response-Header (generiert, UUID-Form)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/abc`);
    const id = res.headers.get(REQUEST_ID_HEADER.toLowerCase());
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('uebernimmt eine mitgeschickte X-Request-Id und gibt sie zurueck', async () => {
    const vorgabe = 'client-trace-42';
    const res = await fetch(`${baseUrl}/api/v1/orders/abc`, {
      headers: { [REQUEST_ID_HEADER]: vorgabe },
    });
    expect(res.headers.get(REQUEST_ID_HEADER.toLowerCase())).toBe(vorgabe);
    await warteAufLogs(1);
    expect(logs.some((l) => l.includes('req=client-trace-42'))).toBe(true);
  });

  it('loggt eine API-Route mit Methode, maskiertem Pfad, Status und Tenant-/User-ID', async () => {
    await fetch(`${baseUrl}/api/v1/orders/550e8400-e29b-41d4-a716-446655440000`);
    await warteAufLogs(1);
    const line = logs.find((l) => l.includes('http_request'));
    expect(line).toBeDefined();
    expect(line).toContain('GET');
    // UUID im Pfad ist maskiert.
    expect(line).toContain('/api/v1/orders/:x');
    expect(line).not.toContain('550e8400');
    expect(line).toContain('200');
    expect(line).toContain('tenant=tenant-1');
    expect(line).toContain('user=user-1');
  });

  it('KEINE PII: ein Freigabe-Token im Pfad landet NICHT im Log', async () => {
    const token = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6';
    await fetch(`${baseUrl}/api/v1/public/angebote/${token}`);
    await warteAufLogs(1);
    const line = logs.find((l) => l.includes('http_request'));
    expect(line).toBeDefined();
    expect(line).not.toContain(token);
    expect(line).toContain('/api/v1/public/angebote/:x');
  });

  it('KEINE PII: E-Mail/Token im Query-String landen NICHT im Log', async () => {
    await fetch(`${baseUrl}/api/v1/orders/abc?email=max@mustermann.de&token=geheim`);
    await warteAufLogs(1);
    const line = logs.find((l) => l.includes('http_request'));
    expect(line).toBeDefined();
    expect(line).not.toContain('@');
    expect(line).not.toContain('mustermann');
    expect(line).not.toContain('geheim');
  });

  it('spammt Health-Pings NICHT ins Log, setzt aber trotzdem die Request-ID', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    expect(res.headers.get(REQUEST_ID_HEADER.toLowerCase())).toBeTruthy();
    await new Promise((r) => setTimeout(r, 30));
    expect(logs.some((l) => l.includes('http_request'))).toBe(false);
  });

  it('markiert 4xx als warn-Level', async () => {
    await fetch(`${baseUrl}/api/v1/missing`);
    await warteAufLogs(1);
    const line = logs.find((l) => l.includes('http_request'));
    // Dev-Format enthaelt Status 404; ein anonymer Request hat keine Tenant-/User-ID.
    expect(line).toContain('404');
    expect(line).not.toContain('tenant=');
    expect(line).not.toContain('user=');
  });
});
