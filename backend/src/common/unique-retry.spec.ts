import { isUniqueViolation, withUniqueRetry } from './unique-retry';

/** Baut einen Fehler mit optionalem Treiber-Code (wie QueryFailedError ihn traegt). */
function dbError(message: string, code?: string | number): Error {
  const err = new Error(message) as Error & { code?: string | number };
  if (code !== undefined) err.code = code;
  return err;
}

describe('isUniqueViolation', () => {
  it('erkennt PostgreSQL 23505', () => {
    expect(isUniqueViolation(dbError('duplicate key value', '23505'))).toBe(true);
  });

  it('erkennt SQLite-Message', () => {
    expect(
      isUniqueViolation(dbError('SQLITE_CONSTRAINT: UNIQUE constraint failed: invoices.nummer')),
    ).toBe(true);
  });

  it('erkennt MySQL ER_DUP_ENTRY / 1062', () => {
    expect(isUniqueViolation(dbError('dup', 'ER_DUP_ENTRY'))).toBe(true);
    expect(isUniqueViolation(dbError('dup', 1062))).toBe(true);
  });

  it('liest den Code aus driverError, wenn oben nicht vorhanden', () => {
    const err = new Error('failed') as Error & { driverError?: { code?: string } };
    err.driverError = { code: '23505' };
    expect(isUniqueViolation(err)).toBe(true);
  });

  it('ist false fuer andere Fehler', () => {
    expect(isUniqueViolation(dbError('not null violation', '23502'))).toBe(false);
    expect(isUniqueViolation(new Error('irgendein Fehler'))).toBe(false);
    expect(isUniqueViolation('kein Error')).toBe(false);
  });
});

describe('withUniqueRetry', () => {
  it('gibt das Ergebnis beim ersten Erfolg zurueck', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(withUniqueRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('wiederholt bei Unique-Verletzung und liefert dann das Ergebnis', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(dbError('UNIQUE constraint failed: invoices.nummer'))
      .mockRejectedValueOnce(dbError('duplicate', '23505'))
      .mockResolvedValue('RE-2026-0003');
    await expect(withUniqueRetry(fn)).resolves.toBe('RE-2026-0003');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('reicht Nicht-Unique-Fehler sofort durch (kein Retry)', async () => {
    const fn = jest.fn().mockRejectedValue(dbError('not null violation', '23502'));
    await expect(withUniqueRetry(fn)).rejects.toThrow('not null violation');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gibt nach erschoepften Retries den letzten Fehler weiter', async () => {
    const fn = jest.fn().mockRejectedValue(dbError('UNIQUE constraint failed'));
    await expect(withUniqueRetry(fn, { retries: 2 })).rejects.toThrow('UNIQUE constraint failed');
    // 1 Erstversuch + 2 Retries.
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
