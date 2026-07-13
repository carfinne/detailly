import { json, urlencoded } from 'express';
import type { Express } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Zentrale Body-Groessen-Limits (Sicherheitsaudit Welle 1, Finding D1).
 *
 * AUSGANGSLAGE: Vorher war NIRGENDS ein Limit konfiguriert -> es galt der
 * body-parser-Default von 100kb fuer ALLE Routen. Das hat still auch die
 * Foto-Uploads gedeckelt (Base64-Data-URLs im JSON-Body): jedes Bild ueber
 * ~75kb Rohdaten lief in ein 413, obwohl die DTOs bis zu 20 x 8MB erlauben.
 *
 * NEU (drei Stufen, bewusst dokumentiert):
 * - JSON_LIMIT_DEFAULT '256kb': globales Default-Limit. Deckt alle normalen
 *   DTOs grosszuegig ab und verhindert, dass anonyme Endpunkte (/public/*,
 *   Login, Registrierung) mit Riesen-Bodies Speicher binden (DoS/Bot-Schutz).
 * - JSON_LIMIT_UPLOAD_SINGLE '12mb': Einzelbild-Uploads der Inspektion
 *   (max. 8MB Bild -> ~10,7MB als Base64) + Signatur (PNG-Data-URL bis ~1,4MB).
 * - JSON_LIMIT_UPLOAD_BATCH '25mb': Auftrags-Fotos. Das Frontend (FotoBereich)
 *   schickt ALLE gewaehlten Bilder in EINEM POST -> 25mb erlaubt realistische
 *   Batches (z.B. 3-5 Handyfotos) ohne den 160MB-Exzess des reinen DTO-Limits.
 *
 * Alle Upload-Routen sind authentifiziert (JwtAuthGuard) - anonyme Pfade
 * bleiben beim kleinen Default-Limit.
 *
 * STRIPE-WEBHOOK: /api/v1/billing/webhook braucht den ROHEN Body fuer die
 * Signaturpruefung. Der verify-Callback unten setzt req.rawBody exakt so, wie
 * es Nests eingebaute rawBody:true-Option taete (die ist jetzt abgeschaltet,
 * weil wir die Parser selbst registrieren, siehe main.ts).
 */
export const JSON_LIMIT_DEFAULT = '256kb';
export const JSON_LIMIT_UPLOAD_SINGLE = '12mb';
export const JSON_LIMIT_UPLOAD_BATCH = '25mb';

/** Auftrags-Fotos (Batch: mehrere Data-URLs in einem POST). Authentifiziert. */
export const UPLOAD_BATCH_PATHS: ReadonlyArray<RegExp> = [
  /^\/api\/v1\/orders\/[^/]+\/fotos\/?$/,
];

/** Einzelbild-/Signatur-Uploads der Inspektion (je ein Bild pro POST). Authentifiziert. */
export const UPLOAD_SINGLE_PATHS: ReadonlyArray<RegExp> = [
  /^\/api\/v1\/inspections\/[^/]+\/photos\/?$/,
  /^\/api\/v1\/items\/[^/]+\/photos\/?$/,
  /^\/api\/v1\/inspections\/[^/]+\/signatur\/?$/,
];

/**
 * Identisch zu Nests interner rawBody-Implementierung
 * (@nestjs/platform-express getBodyParserOptions): puffert den rohen Body als
 * req.rawBody, damit die Stripe-Webhook-Signaturpruefung weiter funktioniert.
 */
const rawBodySaver = (
  req: IncomingMessage & { rawBody?: Buffer },
  _res: ServerResponse,
  buffer: Buffer,
): void => {
  if (Buffer.isBuffer(buffer)) {
    req.rawBody = buffer;
  }
};

/**
 * Registriert die Body-Parser in der richtigen Reihenfolge:
 * 1) route-scoped grosse Limits NUR auf den Upload-Pfaden (body-parser markiert
 *    den Request als geparst -> der globale Parser danach ueberspringt ihn),
 * 2) globaler JSON-Parser mit kleinem Default-Limit,
 * 3) urlencoded analog (gleiches kleines Limit).
 *
 * GET/HEAD ohne Body (SPA-Fallback, statische Assets) laufen als No-op durch.
 */
export function registerBodyParsers(expressApp: Express): void {
  expressApp.use(
    [...UPLOAD_BATCH_PATHS],
    json({ limit: JSON_LIMIT_UPLOAD_BATCH, verify: rawBodySaver }),
  );
  expressApp.use(
    [...UPLOAD_SINGLE_PATHS],
    json({ limit: JSON_LIMIT_UPLOAD_SINGLE, verify: rawBodySaver }),
  );
  expressApp.use(json({ limit: JSON_LIMIT_DEFAULT, verify: rawBodySaver }));
  expressApp.use(urlencoded({ extended: true, limit: JSON_LIMIT_DEFAULT, verify: rawBodySaver }));
}
