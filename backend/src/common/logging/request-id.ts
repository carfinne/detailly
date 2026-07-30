import { randomUUID } from 'node:crypto';

/**
 * Betriebsfaehigkeit (Pilot): Request-ID + PII-sichere Pfad-Aufbereitung fuer
 * strukturierte Logs. Bordmittel-only (node:crypto) – KEIN Log-Framework.
 */

/** Obergrenze fuer eine uebernommene X-Request-Id (Log-Bloat-/DoS-Schutz). */
const MAX_REQUEST_ID_LENGTH = 128;

/**
 * Nur unbedenkliche Zeichen (keine Steuerzeichen/Zeilenumbrueche) und begrenzte
 * Laenge: sonst koennte ein Angreifer ueber den X-Request-Id-Header eine
 * gefaelschte zweite Logzeile einschmuggeln (Log-Injection) oder das Log
 * aufblaehen. Werte, die das nicht erfuellen, werden verworfen (frische UUID).
 */
const SAFE_REQUEST_ID = new RegExp(`^[A-Za-z0-9._-]{1,${MAX_REQUEST_ID_LENGTH}}$`);

/**
 * Ermittelt die Request-ID: uebernimmt einen mitgeschickten, STRENG validierten
 * `X-Request-Id`-Header (z.B. vom Reverse-Proxy/Client zwecks Ende-zu-Ende-
 * Korrelation) oder erzeugt sonst eine neue UUID. Der uebernommene Wert wird
 * gegen `SAFE_REQUEST_ID` geprueft (Zeichenklasse + Laenge) – so kann ueber den
 * Header niemals ein Zeilenumbruch/Steuerzeichen in die Logzeile gelangen.
 */
export function resolveRequestId(headerValue: unknown): string {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof raw === 'string' && SAFE_REQUEST_ID.test(raw)) return raw;
  return randomUUID();
}

/** Nur kurze, kleingeschriebene Routen-Woerter (inkl. Ziffern/Bindestrich). */
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9-]{0,19}$/;

/** Deckel gegen absurd lange Pfade in der Logzeile. */
const MAX_PATH_LENGTH = 200;

/**
 * Maskiert potentiell SENSIBLE Pfad-Segmente fuer die Logzeile (DSGVO-Pflicht).
 *
 * Hintergrund: oeffentliche Freigabe-Links tragen ihr GEHEIMNIS direkt als
 * Pfad-Segment – z.B. `/api/v1/public/angebote/<token>`,
 * `/api/v1/public/calendar/<token>`, `/api/v1/public/invoices/<token>` – und
 * Kennzeichen/Namen duerfen ohnehin nie in ein Betriebs-Log. Deshalb bleiben nur
 * kurze, kleingeschriebene Routen-Woerter (api, v1, public, angebote, orders …)
 * und kurze Zahlen stehen; alles andere – Tokens (hex/base64), UUIDs,
 * gemischt-/grossgeschriebene Opaque-Werte, Kennzeichen, E-Mails – wird zu `:x`
 * maskiert. Das Ergebnis zeigt die ROUTEN-FORM (welcher Endpunkt), nie den
 * konkreten Geheim-/Personenbezug.
 *
 * Der Query-String (dort stecken Magic-Link-Tokens, E-Mail-Parameter …) wird
 * hier zusaetzlich abgeschnitten – der Aufrufer verwirft ihn ohnehin bereits.
 */
export function sanitizePath(rawPath: string): string {
  const path = (rawPath || '/').split('?')[0].split('#')[0].slice(0, MAX_PATH_LENGTH);
  const masked = path
    .split('/')
    .map((seg) => (seg === '' || SAFE_SEGMENT.test(seg) ? seg : ':x'))
    .join('/');
  return masked.length > 0 ? masked : '/';
}
