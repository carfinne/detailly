import { formatLogLine, emitLog, sanitizeStack, HttpLogFields } from './structured-logger';

describe('sanitizeStack – entfernt die (potenziell PII-haltige) message-Zeile', () => {
  it('behaelt nur die "at …"-Frames, verwirft die message-Zeile', () => {
    // DB-Fehler mit Kundendaten in der message (typisch QueryFailedError).
    const stack =
      'QueryFailedError: duplicate key value: Key (email)=(max@mustermann.de)\n' +
      '    at Object.query (/app/db.js:10:5)\n' +
      '    at Repository.save (/app/repo.js:20:7)';
    const out = sanitizeStack(stack)!;
    expect(out).not.toContain('mustermann');
    expect(out).not.toContain('@');
    expect(out).not.toContain('QueryFailedError');
    expect(out).toContain('at Object.query (/app/db.js:10:5)');
    expect(out).toContain('at Repository.save (/app/repo.js:20:7)');
  });

  it('liefert undefined ohne Frames (nur message) oder ohne Stack', () => {
    expect(sanitizeStack('Error: geheim ohne frames')).toBeUndefined();
    expect(sanitizeStack(undefined)).toBeUndefined();
  });
});

describe('formatLogLine – Produktion (JSON)', () => {
  const fields: HttpLogFields = {
    requestId: 'req-1',
    method: 'GET',
    path: '/api/v1/orders/:x',
    statusCode: 200,
    durationMs: 12,
    tenantId: 'tenant-1',
    userId: 'user-1',
  };

  it('erzeugt eine gueltige JSON-Zeile mit allen Feldern', () => {
    const line = formatLogLine('info', 'http_request', fields, true);
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({
      level: 'info',
      msg: 'http_request',
      requestId: 'req-1',
      method: 'GET',
      path: '/api/v1/orders/:x',
      statusCode: 200,
      durationMs: 12,
      tenantId: 'tenant-1',
      userId: 'user-1',
    });
    expect(typeof parsed.ts).toBe('string');
    expect(() => new Date(parsed.ts).toISOString()).not.toThrow();
  });

  it('laesst undefined/null-Felder weg (kein "undefined" im Log)', () => {
    const line = formatLogLine('warn', 'http_request', {
      requestId: 'req-2',
      method: 'GET',
      path: '/api/v1/health-not-logged',
      statusCode: 404,
      tenantId: undefined,
      userId: null,
    }, true);
    expect(line).not.toContain('undefined');
    const parsed = JSON.parse(line);
    expect('tenantId' in parsed).toBe(false);
    expect('userId' in parsed).toBe(false);
  });
});

describe('formatLogLine – Dev (lesbar)', () => {
  it('erzeugt eine kompakte Klartext-Zeile', () => {
    const line = formatLogLine('info', 'http_request', {
      requestId: 'req-3',
      method: 'POST',
      path: '/api/v1/invoices',
      statusCode: 201,
      durationMs: 8,
      tenantId: 'tenant-9',
      userId: 'user-9',
    }, false);
    expect(line).toContain('[http_request]');
    expect(line).toContain('POST');
    expect(line).toContain('/api/v1/invoices');
    expect(line).toContain('201');
    expect(line).toContain('8ms');
    expect(line).toContain('req=req-3');
    expect(line).toContain('tenant=tenant-9');
    expect(line).toContain('user=user-9');
  });
});

describe('KEINE PII in der Logzeile (DSGVO-Pflicht)', () => {
  // Simuliert Felder, wie sie die Middleware liefert: nur IDs + maskierter Pfad.
  const fields: HttpLogFields = {
    requestId: 'req-x',
    method: 'GET',
    path: '/api/v1/public/angebote/:x', // Token bereits maskiert
    statusCode: 200,
    durationMs: 3,
    tenantId: 'tenant-1',
    userId: 'user-1',
  };

  for (const prod of [true, false]) {
    it(`enthaelt weder Mail/Name/Kennzeichen/Token (prod=${prod})`, () => {
      const line = formatLogLine('info', 'http_request', fields, prod);
      expect(line).not.toMatch(/@/); // keine E-Mail
      expect(line.toLowerCase()).not.toContain('mustermann'); // kein Nachname
      expect(line).not.toMatch(/\bB-[A-Z]{1,2}-\d{1,4}\b/); // kein Kennzeichen
      // kein roher Token (der maskierte Pfad enthaelt nur ':x')
      expect(line).not.toContain('a1b2c3d4');
    });
  }
});

describe('emitLog', () => {
  it('reicht die formatierte Zeile an den Sink weiter (kein stdout im Test)', () => {
    const lines: string[] = [];
    emitLog('info', 'http_request', { requestId: 'r', method: 'GET', path: '/api/v1/x' }, (l) =>
      lines.push(l),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('http_request');
  });
});
