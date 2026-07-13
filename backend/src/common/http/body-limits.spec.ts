import type { Express, Request, Response, NextFunction } from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
// Runtime-Wert via require: tsconfig hat KEIN esModuleInterop -> ein
// `import express from 'express'` waere zur Laufzeit `undefined`. Typen kommen
// aus dem `import type` oben.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');
import {
  registerBodyParsers,
  JSON_LIMIT_DEFAULT,
  JSON_LIMIT_UPLOAD_SINGLE,
  JSON_LIMIT_UPLOAD_BATCH,
} from './body-limits';

/**
 * D1 (Sicherheitsaudit Welle 1): Body-Groessen-Limits.
 *
 * Echter HTTP-Roundtrip OHNE Zusatz-Dependency (kein supertest im Projekt,
 * neue Pakete sind tabu): express-App mit registerBodyParsers + Dummy-Routen
 * auf Port 0, Requests via globalem fetch (Node >= 18).
 *
 * Der Error-Handler drainiert den Request VOR der 413-Antwort (req.resume()),
 * damit der Client die Response moeglichst deterministisch lesen kann. Bei sehr
 * grossen Bodies kann der Server den Socket dennoch schliessen, bevor der Client
 * fertig gesendet hat -> fuer die "zu gross"-Faelle akzeptieren wir daher 413
 * ODER einen fetch-Netzwerkfehler (beides = "Body abgelehnt, nicht akzeptiert").
 */
describe('Body-Limits (D1)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app: Express = express();
    registerBodyParsers(app);

    // Dummy-Routen mit denselben Pfadformen wie die echte API.
    app.post('/api/v1/public/booking/anfrage', (_req: Request, res: Response) =>
      res.json({ ok: true }),
    );
    app.post('/api/v1/orders/abc-123/fotos', (req: Request, res: Response) =>
      res.json({ ok: true, bilder: Array.isArray(req.body?.bilder) ? req.body.bilder.length : 0 }),
    );
    app.post('/api/v1/inspections/abc-123/photos', (_req: Request, res: Response) =>
      res.json({ ok: true }),
    );
    app.post('/api/v1/billing/webhook', (req: Request, res: Response) => {
      const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
      res.json({
        hatRawBody: Buffer.isBuffer(raw),
        rawText: Buffer.isBuffer(raw) ? raw.toString('utf8') : null,
      });
    });

    // Fehler (u.a. PayloadTooLargeError) -> Request drainieren, dann Status senden.
    app.use((err: { status?: number }, req: Request, res: Response, _next: NextFunction) => {
      req.resume();
      res.status(err.status || 500).json({ fehler: true });
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  /** Sendet POST; liefert HTTP-Status oder 'neterr' bei Verbindungsabbruch. */
  async function postStatus(pfad: string, body: string): Promise<number | 'neterr'> {
    try {
      const res = await fetch(baseUrl + pfad, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      return res.status;
    } catch {
      return 'neterr';
    }
  }

  /** JSON-Body mit gewuenschter Nutzlastgroesse (grob) in Bytes. */
  function jsonMitGroesse(bytes: number): string {
    return JSON.stringify({ bilder: ['x'.repeat(bytes)] });
  }

  it('konfigurierte Limits sind wie im Audit festgelegt (256kb / 12mb / 25mb)', () => {
    expect(JSON_LIMIT_DEFAULT).toBe('256kb');
    expect(JSON_LIMIT_UPLOAD_SINGLE).toBe('12mb');
    expect(JSON_LIMIT_UPLOAD_BATCH).toBe('25mb');
  });

  it('oeffentlicher Endpunkt: normaler kleiner Body -> 200', async () => {
    const res = await fetch(baseUrl + '/api/v1/public/booking/anfrage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('oeffentlicher Endpunkt: grosser Body (400kb > 256kb) -> 413', async () => {
    const status = await postStatus('/api/v1/public/booking/anfrage', jsonMitGroesse(400 * 1024));
    expect(status).toBe(413);
  });

  it('Auftrags-Foto-Batch-Route akzeptiert grosse Foto-Payload (20MB < 25mb)', async () => {
    const res = await fetch(baseUrl + '/api/v1/orders/abc-123/fotos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: jsonMitGroesse(20 * 1024 * 1024),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, bilder: 1 });
  });

  it('Auftrags-Foto-Batch-Route deckelt trotzdem (26MB > 25mb) -> nicht akzeptiert', async () => {
    const status = await postStatus('/api/v1/orders/abc-123/fotos', jsonMitGroesse(26 * 1024 * 1024));
    expect(status).not.toBe(200);
    expect([413, 'neterr']).toContain(status);
  });

  it('Inspektions-Einzelbild-Route akzeptiert 10MB (< 12mb)', async () => {
    const res = await fetch(baseUrl + '/api/v1/inspections/abc-123/photos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: jsonMitGroesse(10 * 1024 * 1024),
    });
    expect(res.status).toBe(200);
  });

  it('Inspektions-Einzelbild-Route deckelt bei 13MB (> 12mb) -> nicht akzeptiert', async () => {
    const status = await postStatus(
      '/api/v1/inspections/abc-123/photos',
      jsonMitGroesse(13 * 1024 * 1024),
    );
    expect(status).not.toBe(200);
    expect([413, 'neterr']).toContain(status);
  });

  it('Stripe-Webhook: req.rawBody ist Buffer und byte-identisch zum gesendeten Body', async () => {
    const gesendet = JSON.stringify({ id: 'evt_test_123', type: 'invoice.paid' });
    const res = await fetch(baseUrl + '/api/v1/billing/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: gesendet,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hatRawBody: boolean; rawText: string | null };
    expect(body.hatRawBody).toBe(true);
    expect(body.rawText).toBe(gesendet);
  });
});
