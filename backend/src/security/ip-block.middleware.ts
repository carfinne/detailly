import { Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { IpBlockService } from './ip-block.service';
import { isAllowlistedPeer } from './ip-utils';
import { IP_BLOCKED_MESSAGE } from './security.constants';

/**
 * Baut die Express-Middleware, die geblockte IPs frueh (nach `trust proxy`, VOR
 * Body-Parsing) mit 429 abweist – bevor ein Controller/Body-Parser CPU verbraucht.
 *
 * WICHTIG (Allowlist-Invariante aus Teil 1): die Ausnahme haengt am ECHTEN Socket-
 * Peer (req.socket.remoteAddress), NICHT an der XFF-faelschbaren req.ip. Loopback-
 * Peer + Loopback-Client wird NIE geblockt (Selbst-Aussperrung des Same-Host-
 * Reverse-Proxy / lokale Direktverbindung vermeiden). Zum SPERREN dagegen zaehlt
 * die ueber `trust proxy` aufgeloeste Client-IP (req.ip).
 *
 * Fail-open: schlaegt die Sperr-Pruefung fehl (DB/Service), wird die Anfrage
 * durchgelassen (Verfuegbarkeit > Abwehr bei internem Fehler) und nur geloggt.
 *
 * `exemptPrefixes` (FIX B): Pfad-Praefixe, die NIE geblockt werden – v. a. der
 * Betreiber-Bereich `platform/security/*`, damit ein PLATFORM_ADMIN mit gesperrter
 * (Buero-NAT-)IP die Entsperr-Route weiterhin erreicht (Selbstsperr-Deadlock-
 * Schutz). Diese Routen sind ohnehin auth-gegatet (kein neues Loch fuer den
 * geblockten Angreifer).
 */
export function createIpBlockMiddleware(
  service: IpBlockService,
  opts: { exemptPrefixes?: readonly string[] } = {},
  logger = new Logger('IpBlockMiddleware'),
) {
  const exemptPrefixes = opts.exemptPrefixes ?? [];
  return function ipBlockMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Ausgenommene Pfade (z. B. platform/security/*) NIE blocken.
    const path = req.path || req.url || '';
    if (exemptPrefixes.some((p) => path.startsWith(p))) {
      next();
      return;
    }

    const clientIp = (req.ip || req.socket?.remoteAddress || '').toString();
    const socketIp = (req.socket?.remoteAddress || '').toString();

    // Allowlist: echter Loopback-Peer + Loopback-Client -> nie sperren.
    if (isAllowlistedPeer(clientIp, socketIp)) {
      next();
      return;
    }

    service
      .isBlocked(clientIp)
      .then((r) => {
        if (!r.blocked) {
          next();
          return;
        }
        if (r.retryAfterSec && r.retryAfterSec > 0) {
          res.setHeader('Retry-After', String(r.retryAfterSec));
        }
        // Generisch + enumerationssicher (kein Grund/keine Dauer im Body).
        res.status(429).json({ statusCode: 429, message: IP_BLOCKED_MESSAGE });
      })
      .catch((err) => {
        logger.warn(`IP-Sperr-Pruefung fehlgeschlagen (fail-open): ${(err as Error).message}`);
        next();
      });
  };
}
