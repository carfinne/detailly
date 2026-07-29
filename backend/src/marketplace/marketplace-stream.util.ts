import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import type { Readable } from 'stream';

/**
 * Gemeinsame Antwort-Header fuer die Marktplatz-Datei-Streams (Dealer-Portal,
 * Token-Portal und Buy-Side nutzen dieselbe Auslieferung – keine Duplikation).
 *
 * Bilder: liegen UNVERSCHLUESSELT auf der Platte, werden aber NIE oeffentlich
 * gemountet; die Zugriffskontrolle sitzt in der Route. `Cache-Control: private`
 * erlaubt Browser-Caching pro Nutzer (Galerie-Performance) ohne geteilte Caches.
 * `nosniff` verhindert MIME-Sniffing (SVG/HTML-XSS ist bereits per Magic-Byte
 * ausgeschlossen, hier zusaetzlich defensiv).
 */
export function streameBild(
  res: Response,
  daten: { stream: Readable; mime: string },
): StreamableFile {
  res.setHeader('Content-Type', daten.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return new StreamableFile(daten.stream);
}

/**
 * SDB-Download (entschluesseltes PDF): IMMER als Anhang (attachment) + nosniff –
 * es soll nie inline im Browser als Dokument gerendert/gesnifft werden. `no-store`,
 * damit das entschluesselte PDF nicht in Zwischen-Caches liegen bleibt.
 */
export function streameSdb(
  res: Response,
  daten: { buffer: Buffer; filename: string },
): StreamableFile {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `attachment; filename="${daten.filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  return new StreamableFile(daten.buffer);
}
