import * as zlib from 'zlib';
import type { Request, Response, NextFunction } from 'express';

/**
 * gzip-Response-Kompression mit NODE-BORDMITTELN (zlib) - bewusst OHNE das
 * npm-Paket `compression`.
 *
 * WARUM kein `compression`-Paket: das Backend-`node_modules` wird ueber eine
 * Junction geteilt und `npm install`/`npm ci` scheitert in dieser Umgebung
 * (better-sqlite3 vs. Node 24). Ein neuer Dependency-Eintrag waere zur Laufzeit
 * schlicht nicht installiert -> `Cannot find module 'compression'` beim Start.
 * zlib ist ein Node-Builtin und immer da; wir bilden das noetige Verhalten mit
 * wenigen Zeilen selbst nach.
 *
 * VERHALTEN (bewusst konservativ, an die `compression`-Defaults angelehnt):
 * - Nur wenn der Client `Accept-Encoding: gzip` schickt (und nicht q=0).
 * - Nur KOMPRIMIERBARE Content-Types (text/*, JSON, JS, XML, SVG ...). Bereits
 *   komprimierte Typen (image/*, PDF, application/gzip) und Antworten, die schon
 *   ein Content-Encoding tragen, laufen unveraendert durch (Pass-Through).
 * - Datei-DOWNLOADS (Content-Disposition: attachment, z. B. der DSGVO-Betriebs-
 *   export oder CSV-Exporte) werden NICHT abgefangen: die schreiben direkt und
 *   ggf. gross in den Response-Stream -> wir lassen deren Streaming unberuehrt,
 *   statt sie im Speicher zu puffern.
 * - Erst ab THRESHOLD (1 KB) - kleine Antworten lohnen den CPU/Overhead nicht.
 * - Ausschliesslich auf der ANTWORT. Der Request-Body (Stripe-Webhook-Rohbody
 *   fuer die Signaturpruefung, Body-Limits D1) bleibt voellig unberuehrt.
 *
 * Registrierung: FRUEH (direkt nach Helmet, vor den Body-Parsern), damit jede
 * spaetere Antwort - auch die des SPA-Fallbacks - durch den Kompressor laeuft.
 */

const THRESHOLD_BYTES = 1024;

// Kompressible Content-Types (an das `compressible`-Modul angelehnt; deckt
// unsere Antworten ab: JSON-APIs + statische SPA-Assets HTML/JS/CSS/SVG).
const COMPRESSIBLE =
  /^(?:text\/|application\/(?:json|javascript|xml|manifest\+json|ld\+json|x-ndjson|graphql|.*\+json|.*\+xml)|image\/svg\+xml)/i;

function acceptsGzip(req: Request): boolean {
  const ae = req.headers['accept-encoding'];
  if (typeof ae !== 'string') return false;
  return ae.split(',').some((part) => {
    const tokens = part.trim().split(';').map((s) => s.trim());
    const enc = (tokens[0] || '').toLowerCase();
    if (enc !== 'gzip' && enc !== '*') return false;
    const q = tokens.find((t) => t.toLowerCase().startsWith('q='));
    return q ? parseFloat(q.slice(2)) > 0 : true;
  });
}

function toBuffer(chunk: unknown, encoding?: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (typeof chunk === 'string') {
    const enc = (typeof encoding === 'string' ? encoding : 'utf8') as BufferEncoding;
    return Buffer.from(chunk, enc);
  }
  return Buffer.from(chunk as ArrayBufferView as Uint8Array);
}

function appendVary(res: Response): void {
  const existing = res.getHeader('Vary');
  if (!existing) {
    res.setHeader('Vary', 'Accept-Encoding');
    return;
  }
  const val = Array.isArray(existing) ? existing.join(', ') : String(existing);
  if (!/\bAccept-Encoding\b/i.test(val)) {
    res.setHeader('Vary', `${val}, Accept-Encoding`);
  }
}

export function gzipMiddleware(req: Request, res: Response, next: NextFunction): void {
  // HEAD hat keinen Body; explizit gzip-lose Clients ebenfalls ueberspringen.
  if (req.method === 'HEAD' || !acceptsGzip(req)) {
    next();
    return;
  }

  const originalWrite = res.write.bind(res) as Response['write'];
  const originalEnd = res.end.bind(res) as Response['end'];

  const chunks: Buffer[] = [];
  let decided = false;
  let compress = false;
  let restored = false;

  const restore = (): void => {
    if (restored) return;
    restored = true;
    res.write = originalWrite;
    res.end = originalEnd;
  };

  // Entscheidung faellt beim ERSTEN write/end - dann steht der Content-Type
  // (res.json/res.send/res.sendFile setzen ihn vor dem Schreiben des Bodys).
  const decide = (): void => {
    if (decided) return;
    decided = true;
    if (res.getHeader('Content-Encoding')) return; // schon codiert -> nie anfassen
    const disp = res.getHeader('Content-Disposition');
    if (typeof disp === 'string' && /attachment/i.test(disp)) return; // Download-Stream
    const type = res.getHeader('Content-Type');
    compress = typeof type === 'string' && COMPRESSIBLE.test(type);
  };

  res.write = function write(chunk: unknown, encodingOrCb?: unknown, cb?: unknown): boolean {
    decide();
    if (!compress) {
      restore();
      return (originalWrite as (...a: unknown[]) => boolean)(chunk, encodingOrCb, cb);
    }
    if (chunk) chunks.push(toBuffer(chunk, encodingOrCb));
    if (typeof encodingOrCb === 'function') (encodingOrCb as () => void)();
    else if (typeof cb === 'function') (cb as () => void)();
    return true;
  } as Response['write'];

  res.end = function end(chunk?: unknown, encodingOrCb?: unknown, cb?: unknown): Response {
    decide();
    // end() kann als erstes Argument eine Callback bekommen: end(cb).
    if (typeof chunk === 'function') {
      cb = chunk;
      chunk = undefined;
    } else if (typeof encodingOrCb === 'function') {
      cb = encodingOrCb;
      encodingOrCb = undefined;
    }

    if (!compress) {
      restore();
      return (originalEnd as (...a: unknown[]) => Response)(chunk, encodingOrCb, cb);
    }

    if (chunk) chunks.push(toBuffer(chunk, encodingOrCb));
    const body = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);

    // Zu klein -> Kompression lohnt nicht: unveraendert ausliefern.
    if (body.length < THRESHOLD_BYTES) {
      restore();
      const result = (originalEnd as (...a: unknown[]) => Response)(body);
      if (typeof cb === 'function') (cb as () => void)();
      return result;
    }

    zlib.gzip(body, (err, zipped) => {
      restore();
      if (err) {
        (originalEnd as (...a: unknown[]) => Response)(body);
      } else {
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Content-Length', String(zipped.length));
        appendVary(res);
        (originalEnd as (...a: unknown[]) => Response)(zipped);
      }
      if (typeof cb === 'function') (cb as () => void)();
    });
    return res;
  } as Response['end'];

  next();
}
