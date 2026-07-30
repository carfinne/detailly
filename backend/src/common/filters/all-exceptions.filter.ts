import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { emitLog, sanitizeStack } from '../logging/structured-logger';
import { sanitizePath } from '../logging/request-id';
import { REQUEST_ID_HEADER } from '../logging/request-logging.middleware';

/**
 * Globaler Exception-Filter (FIX 6).
 *
 * Ziel: KEINE Stacktraces / internen Details an den Client leaken und ein
 * EINHEITLICHES Fehlerformat liefern – ohne das bestehende NestJS-Format zu
 * brechen, auf das sich das Frontend verlaesst.
 *
 * Verhalten:
 * - `HttpException` (z.B. NotFound, Forbidden, BadRequest, das vom
 *   SubscriptionGuard geworfene `{ code: 'SUBSCRIPTION_INACTIVE', message }`):
 *   Body UNVERAENDERT durchreichen. Das Frontend (frontend/src/lib/api.ts)
 *   liest `body.code` und `body.message` und steuert daraus den 401-Redirect
 *   und die Abo-Sperrseite – dieses Format MUSS erhalten bleiben.
 * - Alles andere (unbehandelte Fehler): generische 500-Antwort
 *   `{ statusCode, message: 'Interner Serverfehler' }`. Der echte Fehler inkl.
 *   Stacktrace wird NUR serverseitig geloggt, nie an den Client gesendet.
 *
 * Sentinel Teil 2 (optional): ein `scanRecorder`-Callback wird bei jedem 4xx
 * fire-and-forget aufgerufen (Scan/Probing-Signal `scan_4xx` je IP). Der Filter
 * reicht Kontext durch (Status, IP, Methode, `authenticated`, `path`); WELCHE 4xx
 * wirklich zaehlen entscheidet der Recorder (shouldCountScan) – nur
 * UNAUTHENTIFIZIERTE 401/404 ausserhalb des Auth-Bereichs (Review-Gate FIX A).
 * Bewusst als Callback statt harter Service-Abhaengigkeit -> common/ bleibt von
 * security/ entkoppelt und die bestehenden `new AllExceptionsFilter()`-Aufrufe/
 * Tests laufen unveraendert (Parameter ist optional).
 */
export type ClientErrorRecorder = (info: {
  ip?: string;
  status: number;
  method?: string;
  /** War ein gueltig authentifizierter Principal vorhanden (req.user gesetzt)? */
  authenticated: boolean;
  /** Request-Pfad (ohne Query) – fuer den Auth-Routen-Ausschluss. */
  path?: string;
}) => void;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly scanRecorder?: ClientErrorRecorder) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Request-ID (von der request-logging-Middleware gesetzt) fuer die
    // Fehler-Korrelation. Defensiv auch als Response-Header setzen, falls die
    // Middleware in einem Kontext nicht lief (z.B. isolierter Unit-Test).
    const requestId = (request as Request & { requestId?: string })?.requestId;
    if (requestId && response && !response.getHeader(REQUEST_ID_HEADER)) {
      response.setHeader(REQUEST_ID_HEADER, requestId);
    }

    // Bekannte HttpExceptions: Status + Body unveraendert durchreichen. Die
    // Request-ID reist bereits im X-Request-Id-Header mit (Body-Form bleibt
    // fuer das Frontend unveraendert -> kein Breaking-Change).
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      // Scan/Probing-Signal (nie Body-Daten). Best-effort: ein werfender Recorder
      // darf die Fehlerantwort nie stoeren. Die Zaehl-Policy (nur unauth. 401/404)
      // liegt im Recorder (shouldCountScan).
      this.recordScan(request, status);
      response.status(status).json(body);
      return;
    }

    // Unbehandelter Fehler -> serverseitig vollstaendig loggen, mit derselben
    // Struktur + Request-ID wie das Access-Log, damit ein 500 im Betrieb einer
    // konkreten Anfrage zuordenbar ist. DSGVO: nur Fehlerklasse + auf reine Code-
    // Frames reduzierter Stacktrace (sanitizeStack entfernt die message-Zeile, die
    // bei DB-Fehlern Kundendaten enthalten koennte) + maskierter Pfad – niemals
    // Body/Query/PII und niemals an den Client.
    const err = exception instanceof Error ? exception : undefined;
    // Fehlerklasse ist unbedenklich; bei Nicht-Error-Wuerfen den Typ statt des
    // (potenziell datenhaltigen) Rohwerts loggen.
    const errorName = err?.name ?? typeof exception;
    const stack = sanitizeStack(err?.stack);
    const method = request?.method;
    const path = sanitizePath(request?.originalUrl || request?.url || '/');
    if (process.env.NODE_ENV === 'production') {
      emitLog('error', 'unhandled_exception', {
        requestId,
        method,
        path,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: errorName,
        stack,
      });
    } else {
      // Dev: gut lesbares Nest-Logger-Format – ergaenzt um Request-ID + Fehler-
      // klasse; ebenfalls OHNE message-Zeile (nur Frames), damit auch das Dev-Log
      // keine PII aus einer Fehler-message zeigt.
      this.logger.error(
        `Unbehandelte Ausnahme bei ${method} ${path} [req=${requestId ?? '-'}] (${errorName}):\n${stack ?? '(kein Stacktrace)'}`,
      );
    }

    // ... aber dem Client nur eine generische 500 zeigen (kein Detail-Leak).
    // Die Request-ID gehoert bewusst mit in den Body: so kann ein Nutzer sie aus
    // der Fehlermeldung ablesen und dem Support durchgeben (additiv, kein Bruch).
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Interner Serverfehler',
      ...(requestId ? { requestId } : {}),
    });
  }

  /** Meldet 4xx an den Scan-Recorder (falls gesetzt); Policy liegt dort. Wirft nie. */
  private recordScan(request: Request | undefined, status: number): void {
    if (!this.scanRecorder) return;
    if (status < 400 || status >= 500) return;
    try {
      this.scanRecorder({
        ip: (request?.ip || request?.socket?.remoteAddress || undefined)?.toString(),
        status,
        method: request?.method,
        // Ein authentifizierter Principal (req.user von der JwtStrategy gesetzt)
        // ist per Definition kein Scanner -> shouldCountScan schliesst ihn aus.
        authenticated: !!(request as unknown as { user?: unknown })?.user,
        path: request?.path,
      });
    } catch {
      /* best effort – ein Recorder-Fehler darf die Fehlerantwort nie stoeren */
    }
  }
}
