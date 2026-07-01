import { Like, Repository, ObjectLiteral } from 'typeorm';

/**
 * Erzeugt eine fortlaufende Nummer je Tenant im Format `<PREFIX>-<JAHR>-<LFD>`.
 *
 * Standard (ohne `nummerFeld`): zaehlt ALLE Datensaetze des Tenants +1 – passt
 * fuer Entitaeten mit nur EINEM Praefix (Auftraege 'AU', Bestellungen 'BE').
 *
 * Mit `nummerFeld` (Rechnungen): zaehlt NUR Datensaetze mit demselben Praefix
 * UND Jahr ueber dieses Feld -> getrennte, je lueckenlose Nummernkreise (AN/RE).
 * Belege OHNE gesetzte Nummer (Rechnungs-Entwuerfe) zaehlen NICHT mit, damit
 * verworfene Entwuerfe keine Rechnungsnummer "verbrauchen" (GoBD: lueckenlos).
 *
 * Hinweis: count-basiert -> bei echter Nebenlaeufigkeit koennen zwei Anfragen
 * dieselbe Nummer berechnen. Der harte Schutz ist der UNIQUE-Index (tenantId,
 * nummer): der zweite Save schlaegt fehl, und `withSequentialNumber` vergibt
 * automatisch die naechste freie Nummer (Retry). So bleibt der Kreis lueckenlos
 * UND eindeutig - auf SQLite (Writes serialisiert) wie auf PostgreSQL.
 */
export async function nextSequentialNumber<T extends ObjectLiteral>(
  repo: Repository<T>,
  tenantId: string,
  prefix: string,
  opts?: { nummerFeld?: string },
): Promise<string> {
  const year = new Date().getFullYear();
  const where: Record<string, unknown> = { tenantId };
  if (opts?.nummerFeld) {
    where[opts.nummerFeld] = Like(`${prefix}-${year}-%`);
  }
  const count = await repo.count({ where: where as any });
  const laufend = String(count + 1).padStart(4, '0');
  return `${prefix}-${year}-${laufend}`;
}

/** Erkennt eine UNIQUE-Constraint-Verletzung treiberuebergreifend (PG + SQLite). */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string; driverError?: { code?: string } };
  const code = e?.code ?? e?.driverError?.code;
  return (
    code === '23505' || // PostgreSQL unique_violation
    code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    code === 'SQLITE_CONSTRAINT' ||
    /unique/i.test(e?.message ?? '')
  );
}

/**
 * Vergibt eine fortlaufende Nummer und persistiert den Beleg unter Schutz des
 * UNIQUE-Index. Bei einer Nummern-Kollision (paralleler Save) wird die naechste
 * Nummer neu berechnet und erneut gespeichert (max. `attempts` Versuche).
 *
 * @param assignAndSave Bekommt die berechnete Nummer, setzt sie am Beleg und
 *   speichert ihn (gibt den gespeicherten Beleg zurueck).
 */
export async function withSequentialNumber<T extends ObjectLiteral, R>(
  repo: Repository<T>,
  tenantId: string,
  prefix: string,
  assignAndSave: (nummer: string) => Promise<R>,
  opts?: { nummerFeld?: string; attempts?: number },
): Promise<R> {
  const attempts = opts?.attempts ?? 5;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const nummer = await nextSequentialNumber(repo, tenantId, prefix, opts);
    try {
      return await assignAndSave(nummer);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      lastErr = err; // Kollision -> naechste Nummer probieren
    }
  }
  throw lastErr;
}
