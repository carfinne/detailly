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
 *
 * WICHTIG (Segment-Grenze): das Match prueft die PFAD-SEGMENT-Grenze, nicht bares
 * startsWith. Sonst wuerde ein kuenftiger Geschwister-Pfad wie
 * `/api/v1/platform/security-report` faelschlich mit-ausgenommen und waere nie
 * IP-geblockt. Ausgenommen ist nur `path === prefix` ODER `path` unter `prefix/`.
 *
 * BEWUSSTE GRENZE (kein Bug): der Auth-Bereich `/api/v1/auth/` ist NICHT
 * ausgenommen – sonst koennte ein geblockter Angreifer weiter Login-Requests
 * haemmern. Folge: Ist eine ganze NAT-IP auto-gesperrt (TTL max 1h, heilt selbst)
 * UND das Admin-JWT abgelaufen, muss der Admin bis zum TTL-Ablauf warten oder von
 * einer anderen IP (Mobilfunk/VPN) entsperren. Bewusster Tradeoff (Abwehr > Komfort).
 */
export function createIpBlockMiddleware(
  service: IpBlockService,
  opts: { exemptPrefixes?: readonly string[] } = {},
  logger = new Logger('IpBlockMiddleware'),
) {
  const exemptPrefixes = opts.exemptPrefixes ?? [];
  const isExempt = (path: string): boolean =>
    exemptPrefixes.some((p) => path === p || path.startsWith(p.endsWith('/') ? p : p + '/'));
  return function ipBlockMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Ausgenommene Pfade (z. B. platform/security/*) NIE blocken – SEGMENT-genau.
    const path = req.path || req.url || '';
    if (isExempt(path)) {
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
