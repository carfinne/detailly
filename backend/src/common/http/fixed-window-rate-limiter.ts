import type { Request, Response, NextFunction } from 'express';

/**
 * Schlanker In-Memory-Ratelimiter mit FESTEN Fenstern (fixed window), gebaut mit
 * NODE-BORDMITTELN – bewusst OHNE `express-rate-limit`/ein anderes npm-Paket.
 *
 * WARUM kein Paket: das Backend-`node_modules` wird ueber eine Junction geteilt und
 * `npm install`/`npm ci` scheitert in dieser Umgebung (better-sqlite3 vs. Node 24).
 * Ein neuer Dependency-Eintrag waere zur Laufzeit schlicht nicht installiert.
 *
 * WOFUER: die oeffentlichen Roh-Express-Routen in main.ts (/betrieb/:slug,
 * /sitemap-betriebe.xml). Der Nest-ThrottlerGuard greift dort NICHT (er haengt an
 * der Nest-Controller-Pipeline, nicht an Roh-Routen). Ohne Drosselung waere die
 * ungegatete Roh-Route ein DoS-Vektor.
 *
 * MEMORY-BOUND (kritisch – der Limiter darf nicht selbst ein unbegrenzter Vektor
 * werden): Es wird pro Schluessel (IP) genau EIN {count, resetAt} gehalten. Beim
 * Fensterwechsel wird der Eintrag ueberschrieben. Ist die Zahl verschiedener
 * Schluessel zu gross (maxKeys), werden zuerst abgelaufene Fenster gefegt und, falls
 * noetig, die aeltesten (FIFO) verdraengt. So bleibt der Speicher hart begrenzt.
 */
interface Fenster {
  count: number;
  /** Zeitpunkt (ms), ab dem das Fenster abgelaufen ist und zuruecksetzt. */
  resetAt: number;
}

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Fenster>();

  constructor(
    /** Erlaubte Anfragen pro Fenster und Schluessel. */
    private readonly limit: number,
    /** Fensterlaenge in Millisekunden. */
    private readonly windowMs: number,
    /** Harte Obergrenze verschiedener Schluessel (Memory-Bound). */
    private readonly maxKeys: number = 10000,
    /** Zeitquelle (in Tests injizierbar). */
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** true = Anfrage erlaubt, false = ueber dem Limit (429). */
  hit(key: string): boolean {
    const jetzt = this.now();
    const vorhanden = this.buckets.get(key);

    if (!vorhanden || jetzt >= vorhanden.resetAt) {
      // Neues Fenster. Vor dem Einfuegen ggf. aufraeumen (Memory-Bound).
      if (!vorhanden && this.buckets.size >= this.maxKeys) this.aufraeumen(jetzt);
      this.buckets.set(key, { count: 1, resetAt: jetzt + this.windowMs });
      return true;
    }

    if (vorhanden.count >= this.limit) return false;
    vorhanden.count += 1;
    return true;
  }

  /** Aktuelle Zahl getrackter Schluessel (fuer Tests des Memory-Bounds). */
  get size(): number {
    return this.buckets.size;
  }

  /** Entfernt abgelaufene Fenster; wenn danach immer noch voll, FIFO-Verdraengung. */
  private aufraeumen(jetzt: number): void {
    for (const [k, v] of this.buckets) {
      if (jetzt >= v.resetAt) this.buckets.delete(k);
    }
    while (this.buckets.size >= this.maxKeys) {
      const aeltester = this.buckets.keys().next().value;
      if (aeltester === undefined) break;
      this.buckets.delete(aeltester);
    }
  }
}

export interface RateLimitOptions {
  /** Erlaubte Anfragen pro Fenster und IP. */
  limit: number;
  /** Fensterlaenge in Millisekunden. */
  windowMs: number;
  /** Harte Obergrenze getrackter IPs (Default 10000). */
  maxKeys?: number;
  /** Zeitquelle (in Tests injizierbar). */
  now?: () => number;
}

/**
 * Baut eine Express-Middleware, die pro Client-IP (req.ip – trust proxy ist in
 * main.ts gesetzt) drosselt. Ueber dem Limit -> 429 mit Retry-After-Header. Der
 * interne Speicher ist ueber FixedWindowRateLimiter hart begrenzt.
 */
export function createRateLimitMiddleware(opts: RateLimitOptions) {
  const limiter = new FixedWindowRateLimiter(
    opts.limit,
    opts.windowMs,
    opts.maxKeys ?? 10000,
    opts.now,
  );
  const retryAfterSek = Math.max(1, Math.ceil(opts.windowMs / 1000));

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    if (limiter.hit(key)) return next();
    res.setHeader('Retry-After', String(retryAfterSek));
    res.status(429).json({
      statusCode: 429,
      message: 'Zu viele Anfragen. Bitte spaeter erneut versuchen.',
    });
  };
}
