import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

/** Baut einen minimalen ArgumentsHost mit Mock-Request/-Response. */
function makeHost(req: Record<string, unknown>) {
  const headers: Record<string, unknown> = {};
  const res = {
    statusCode: 200,
    _body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this._body = body;
      return this;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    setHeader(name: string, value: unknown) {
      headers[name.toLowerCase()] = value;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost;
  return { host, res, headers };
}

describe('AllExceptionsFilter – Request-ID-Korrelation', () => {
  it('500: setzt X-Request-Id-Header und legt requestId in den Body', () => {
    const filter = new AllExceptionsFilter();
    const { host, res, headers } = makeHost({
      requestId: 'req-500',
      method: 'GET',
      originalUrl: '/api/v1/orders/xyz',
    });

    filter.catch(new Error('boom'), host);

    expect(res.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(headers['x-request-id']).toBe('req-500');
    expect(res._body).toEqual({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Interner Serverfehler',
      requestId: 'req-500',
    });
  });

  it('500 in Produktion: strukturierte Fehlerzeile mit requestId, OHNE PII (Query/Token maskiert)', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const filter = new AllExceptionsFilter();
      const { host } = makeHost({
        requestId: 'req-abc',
        method: 'POST',
        originalUrl: '/api/v1/public/angebote/deadbeefdeadbeefdeadbeef?token=geheim',
      });
      // Fehler-message simuliert Kundendaten (wie eine DB-Fehler-message).
      filter.catch(new TypeError('kaputt bei email=max@mustermann.de'), host);

      expect(stderr).toHaveBeenCalledTimes(1);
      const line = String(stderr.mock.calls[0][0]);
      const parsed = JSON.parse(line.trim());
      expect(parsed).toMatchObject({
        level: 'error',
        msg: 'unhandled_exception',
        requestId: 'req-abc',
        method: 'POST',
        statusCode: 500,
        error: 'TypeError',
      });
      // Pfad maskiert; kein roher Token/Query im Log.
      expect(parsed.path).toBe('/api/v1/public/angebote/:x');
      expect(line).not.toContain('geheim');
      expect(line).not.toContain('deadbeef');
      // Die message-Zeile (mit simulierter PII) ist aus dem Stack entfernt.
      expect(line).not.toContain('kaputt');
      expect(line).not.toContain('mustermann');
      expect(line).not.toContain('@');
      // Der Stack enthaelt – falls vorhanden – nur reine Code-Frames.
      if (parsed.stack) expect(parsed.stack).toMatch(/^\s*at\s/m);
    } finally {
      stderr.mockRestore();
      process.env.NODE_ENV = prev;
    }
  });

  it('HttpException: Body unveraendert durchgereicht, Request-ID nur im Header', () => {
    const filter = new AllExceptionsFilter();
    const { host, res, headers } = makeHost({
      requestId: 'req-400',
      method: 'GET',
      originalUrl: '/api/v1/orders',
    });

    filter.catch(new BadRequestException('Feld fehlt'), host);

    expect(res.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(headers['x-request-id']).toBe('req-400');
    // Body ist die unveraenderte Nest-Form (kein zusaetzliches requestId-Feld).
    expect(res._body).toMatchObject({ statusCode: 400, message: 'Feld fehlt' });
    expect((res._body as Record<string, unknown>).requestId).toBeUndefined();
  });
});
