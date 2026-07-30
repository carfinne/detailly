import type { NextFunction, Request, Response } from 'express';
import { resolveRequestId, sanitizePath } from './request-id';
import { emitLog, LogLevel } from './structured-logger';

/**
 * Request-ID + strukturiertes Access-Log (Betriebsfaehigkeit fuer den Pilot).
 *
 * Aufgabe: jeder Anfrage eine Korrelations-ID zuordnen (`X-Request-Id` – aus dem
 * Header uebernommen oder generiert), im Response-Header zurueckgeben und je
 * API-Request eine strukturierte Logzeile schreiben (Methode, aufbereiteter
 * Pfad, Status, Dauer, Tenant-/User-ID). So laesst sich ein Kundenproblem ("bei
 * mir ging Rechnung X nicht") ueber die Request-ID einer konkreten Anfrage
 * zuordnen.
 *
 * DSGVO: es werden NUR IDs + der via sanitizePath maskierte Pfad geloggt – nie
 * E-Mail/Name/Kennzeichen/Token/Passwort/Body/Query.
 *
 * Anti-Spam: Health-/Readiness-Pfade und statische SPA-Assets erzeugen KEINE
 * Access-Logzeile (nur echte API-Routen). Die Request-ID + der Response-Header
 * werden dennoch fuer JEDE Anfrage gesetzt (billig, hilft auch bei 4xx/5xx).
 */

/** Header-Name (Response) – der Client kann die ID bei Problemen durchgeben. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Request mit angehaengter Request-ID (vom Filter zur 500-Korrelation gelesen). */
export interface RequestWithId extends Request {
  requestId?: string;
}

/** Health-/Readiness-Pfade (bare + versioniert) nie ins Access-Log spammen. */
function istHealthPfad(path: string): boolean {
  return (
    path === '/health' ||
    path === '/api/v1/health' ||
    path.startsWith('/api/v1/health/')
  );
}

/**
 * Access-Log NUR fuer echte API-Routen (ohne Health/Docs). Das haelt statische
 * SPA-/Asset-Requests (/_next/…, Bilder, HTML-Fallback) und LB-Health-Pings aus
 * dem Log fern – Fokus auf der betrieblich relevanten API-Flaeche.
 */
function sollLoggen(path: string): boolean {
  if (!path.startsWith('/api/')) return false;
  if (path.startsWith('/api/docs')) return false;
  if (istHealthPfad(path)) return false;
  return true;
}

/**
 * Baut die Middleware. `sink` ist optional (Tests fangen die Logzeile ab), in
 * der App bleibt er ungesetzt -> Ausgabe via stdout/stderr.
 */
export function createRequestLoggingMiddleware(sink?: (line: string) => void) {
  return function requestLoggingMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const requestId = resolveRequestId(req.headers['x-request-id']);
    (req as RequestWithId).requestId = requestId;
    // Immer setzen (auch fuer Health/Assets/Fehler) – der Client kann die ID
    // dann selbst bei einem 500 aus dem Header ablesen und durchgeben.
    res.setHeader(REQUEST_ID_HEADER, requestId);

    // Query bewusst abschneiden (Tokens/E-Mails stecken oft dort); Pfad maskieren.
    const rawPath = (req.originalUrl || req.url || '/').split('?')[0];
    if (!sollLoggen(rawPath)) {
      next();
      return;
    }

    const method = req.method;
    const path = sanitizePath(rawPath);
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
      const status = res.statusCode;
      // req.user wird von der JwtStrategy gesetzt (nur { id, tenantId, … }).
      const user = (req as Request & {
        user?: { id?: string; tenantId?: string };
      }).user;
      const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      emitLog(
        level,
        'http_request',
        {
          requestId,
          method,
          path,
          statusCode: status,
          durationMs,
          // NUR IDs – nie Klartext.
          tenantId: user?.tenantId,
          userId: user?.id,
        },
        sink,
      );
    });

    next();
  };
}
