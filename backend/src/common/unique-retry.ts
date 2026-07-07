/**
 * Erkennt eine DB-Unique-Constraint-Verletzung treiberuebergreifend (SQLite Dev,
 * PostgreSQL Prod). TypeORM wirft solche Fehler als QueryFailedError, der den
 * Treiber-Fehler durchreicht.
 *
 *  - PostgreSQL: SQLSTATE '23505' (unique_violation)
 *  - SQLite (better-sqlite3/sqlite3): Message enthaelt "UNIQUE constraint failed"
 *  - MySQL/MariaDB (defensiv): ER_DUP_ENTRY / Code 1062
 */
export function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const anyErr = err as { code?: unknown; driverError?: { code?: unknown } };
  const code = anyErr.code ?? anyErr.driverError?.code;
  if (code === '23505') return true;
  if (code === 'ER_DUP_ENTRY' || code === 1062) return true;
  return /UNIQUE constraint failed/i.test(err.message || '');
}

/**
 * Fuehrt `fn` aus und wiederholt es bei einer Unique-Constraint-Verletzung
 * (bis `retries` mal). Gedacht fuer die Vergabe fortlaufender Nummern: `fn` zieht
 * die Nummer selbst neu (count-basiert) und speichert erneut – nach der Kollision
 * ist die konkurrierende Zeile committet und wird mitgezaehlt, sodass der naechste
 * Versuch eine freie Nummer erhaelt. Andere Fehler werden sofort weitergereicht.
 */
export async function withUniqueRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 5;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw lastErr;
}
