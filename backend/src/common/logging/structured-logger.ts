/**
 * Schlanker strukturierter Logger (Bordmittel, KEIN pino/winston).
 *
 * - PRODUKTION: eine JSON-Zeile je Ereignis (maschinenlesbar in journald/docker
 *   logs, filterbar nach requestId/tenantId).
 * - DEV: eine gut lesbare Klartext-Zeile (kein Entwickler-Aerger).
 *
 * DSGVO/Sicherheit: `HttpLogFields` ist eine ALLOWLIST rein technischer Felder
 * (Request-ID, Methode, aufbereiteter Pfad, Status, Dauer, Tenant-/User-ID).
 * Es gibt bewusst KEIN Feld fuer E-Mail, Name, Kennzeichen, Token, Passwort oder
 * den Request-Body – solche Daten duerfen NICHT geloggt werden. Der Pfad ist vom
 * Aufrufer bereits via `sanitizePath` maskiert (keine Tokens/Personendaten).
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface HttpLogFields {
  /** Korrelations-ID (aus X-Request-Id oder generiert). */
  requestId?: string;
  method?: string;
  /** Bereits via sanitizePath maskierter Pfad – nie roher Pfad/Query. */
  path?: string;
  statusCode?: number;
  durationMs?: number;
  /** NUR IDs (kein Klartext) – Mandant/Nutzer zur Zuordnung. */
  tenantId?: string | null;
  userId?: string | null;
  /** Fehlerklasse (z.B. 'QueryFailedError') – kein Klartext-Detail. */
  error?: string;
  /** Stacktrace: NUR im Fehlerpfad, NUR serverseitig (nie an den Client). */
  stack?: string;
}

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Reduziert einen Stacktrace auf die reinen Code-Frames ("at …"-Zeilen).
 *
 * DSGVO-Haertung: die ERSTE Stack-Zeile ist "<ErrorName>: <message>". Eine
 * Fehler-message – vor allem von DB-Fehlern (QueryFailedError o.ae.) – kann
 * Parameterwerte / Kundendaten im Klartext enthalten (E-Mail, Kennzeichen,
 * eindeutige Constraint-Werte). Deshalb wird die Message-Zeile entfernt und nur
 * die Datei/Zeilen-Frames bleiben stehen (reine Code-Orte, kein Personenbezug).
 * So bleibt ein 500er lokalisierbar, ohne PII in die Logs zu leaken. Die
 * Fehlerklasse wird separat als `error`-Feld geloggt (Klassenname ist unbedenklich).
 */
export function sanitizeStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  const frames = stack.split('\n').filter((line) => /^\s*at\s/.test(line));
  return frames.length > 0 ? frames.join('\n') : undefined;
}

/**
 * Formatiert eine Logzeile. `prod` steuert JSON (Prod) vs. Klartext (Dev);
 * per Default aus NODE_ENV abgeleitet, fuer Tests explizit setzbar.
 */
export function formatLogLine(
  level: LogLevel,
  msg: string,
  fields: HttpLogFields,
  prod: boolean = isProd(),
): string {
  if (prod) {
    // JSON-Zeile: nur definierte, nicht-leere Felder aufnehmen (kein "undefined").
    const record: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      msg,
    };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null && value !== '') record[key] = value;
    }
    return JSON.stringify(record);
  }

  // Dev: kompakte, lesbare Zeile.
  const parts: string[] = [];
  if (fields.method) parts.push(fields.method);
  if (fields.path) parts.push(fields.path);
  if (fields.statusCode !== undefined && fields.statusCode !== null) {
    parts.push(String(fields.statusCode));
  }
  if (fields.durationMs !== undefined && fields.durationMs !== null) {
    parts.push(`${fields.durationMs}ms`);
  }
  if (fields.requestId) parts.push(`req=${fields.requestId}`);
  if (fields.tenantId) parts.push(`tenant=${fields.tenantId}`);
  if (fields.userId) parts.push(`user=${fields.userId}`);
  if (fields.error) parts.push(`error=${fields.error}`);
  let line = `[${msg}] ${parts.join(' ')}`.trimEnd();
  // Stacktrace nur im Dev-Fehlerpfad angehaengt (mehrzeilig, gut lesbar).
  if (fields.stack) line += `\n${fields.stack}`;
  return line;
}

/**
 * Gibt eine Logzeile aus. Fehler/Warnungen -> stderr, sonst stdout. Ein
 * optionaler `sink` erlaubt Tests, die Ausgabe abzufangen (kein Monkey-Patch).
 */
export function emitLog(
  level: LogLevel,
  msg: string,
  fields: HttpLogFields,
  sink?: (line: string) => void,
): void {
  const line = formatLogLine(level, msg, fields);
  if (sink) {
    sink(line);
    return;
  }
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}
