import { resolveRequestId, sanitizePath } from './request-id';

describe('resolveRequestId', () => {
  it('uebernimmt eine sichere, mitgeschickte X-Request-Id', () => {
    expect(resolveRequestId('abc-123_DEF.456')).toBe('abc-123_DEF.456');
    // Typischer Trace-Header (32 Hex) wird uebernommen.
    expect(resolveRequestId('0af7651916cd43dd8448eb211c80319c')).toBe(
      '0af7651916cd43dd8448eb211c80319c',
    );
  });

  it('erzeugt eine UUID, wenn kein Header vorhanden ist', () => {
    const id = resolveRequestId(undefined);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('verwirft Log-Injection (Zeilenumbruch/Steuerzeichen) -> frische UUID', () => {
    const boese = 'ok\n[fake] level=error injected';
    const id = resolveRequestId(boese);
    expect(id).not.toContain('\n');
    expect(id).not.toContain('injected');
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('verwirft zu lange Header (> 128) -> frische UUID', () => {
    const id = resolveRequestId('x'.repeat(200));
    expect(id.length).toBe(36);
  });

  it('nimmt bei Array-Header den ersten Wert (Express-Mehrfach-Header)', () => {
    expect(resolveRequestId(['first-id', 'second'])).toBe('first-id');
  });
});

describe('sanitizePath (PII-/Token-Maskierung)', () => {
  it('laesst gewoehnliche Routen-Woerter stehen', () => {
    expect(sanitizePath('/api/v1/orders')).toBe('/api/v1/orders');
    expect(sanitizePath('/api/v1/public/angebote')).toBe('/api/v1/public/angebote');
    expect(sanitizePath('/api/v1/invoices/download-token')).toBe(
      '/api/v1/invoices/download-token',
    );
  });

  it('maskiert einen Freigabe-TOKEN im Pfad (hex, 48 Zeichen)', () => {
    const token = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6';
    const out = sanitizePath(`/api/v1/public/angebote/${token}`);
    expect(out).toBe('/api/v1/public/angebote/:x');
    expect(out).not.toContain(token);
  });

  it('maskiert eine UUID (Ressourcen-ID) sicherheitshalber ebenfalls', () => {
    const out = sanitizePath('/api/v1/orders/550e8400-e29b-41d4-a716-446655440000/fotos');
    expect(out).toBe('/api/v1/orders/:x/fotos');
  });

  it('maskiert ein Kennzeichen (Kennzeichen sind grossgeschrieben)', () => {
    const out = sanitizePath('/api/v1/vehicles/B-MW-1234');
    expect(out).toBe('/api/v1/vehicles/:x');
    expect(out).not.toContain('MW-1234');
  });

  it('schneidet den Query-String ab (dort stecken Tokens/E-Mails)', () => {
    const out = sanitizePath('/api/v1/orders/abc?email=max@mustermann.de&token=geheim');
    expect(out).toBe('/api/v1/orders/abc');
    expect(out).not.toContain('mustermann');
    expect(out).not.toContain('geheim');
  });

  it('faellt bei leerem Pfad auf / zurueck', () => {
    expect(sanitizePath('')).toBe('/');
  });
});
