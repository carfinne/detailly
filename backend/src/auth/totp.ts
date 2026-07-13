import * as crypto from 'crypto';

/**
 * Dependency-freie TOTP-Implementierung (RFC 6238 / RFC 4226) auf Basis von
 * node:crypto. Bewusst KEIN externes Paket (Hausregel: keine nativen Builds).
 *
 * Parameter (Industrie-Standard, kompatibel zu Google Authenticator, Aegis,
 * 1Password, Authy): HMAC-SHA1, 30s-Zeitschritt, 6 Ziffern. Die Verifikation
 * toleriert ein Fenster von +/-1 Schritt (Uhren-Drift zwischen Client/Server).
 */

/** Zeitschritt in Sekunden. */
export const TOTP_STEP_SECONDS = 30;
/** Anzahl der ausgegebenen Ziffern. */
export const TOTP_DIGITS = 6;
/** Erlaubte Drift in Schritten (+/-1 -> aktueller, vorheriger, naechster Code). */
export const TOTP_WINDOW = 1;

// RFC 4648 Base32-Alphabet (ohne Padding-Zeichen in der Ausgabe).
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Kodiert einen Buffer als Base32 (RFC 4648, GROSSbuchstaben, OHNE '='-Padding).
 * Genau dieses Format erwarten Authenticator-Apps im `secret=`-Parameter.
 */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

/**
 * Dekodiert einen Base32-String (RFC 4648) zurueck in einen Buffer. Toleriert
 * Kleinschreibung, Leerzeichen und '='-Padding. Wirft bei ungueltigen Zeichen.
 */
export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Ungueltiges Base32-Zeichen');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Erzeugt ein neues, zufaelliges TOTP-Secret (20 Byte = 160 Bit) als Base32. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/**
 * HOTP (RFC 4226): HMAC-SHA1 ueber den 8-Byte-Zaehler, gefolgt von Dynamic
 * Truncation und Reduktion auf `digits` Dezimalstellen (fuehrende Nullen bleiben).
 */
export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binCode % 10 ** digits;
  return otp.toString().padStart(digits, '0');
}

/**
 * Berechnet den TOTP-Code fuer ein Base32-Secret zu einem Zeitpunkt (Default:
 * jetzt). `timeMs` in Millisekunden seit Epoch.
 */
export function totp(secretBase32: string, timeMs: number = Date.now(), digits = TOTP_DIGITS): string {
  const counter = Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);
  return hotp(base32Decode(secretBase32), counter, digits);
}

/** Konstantzeit-Vergleich zweier gleichlanger Strings (sonst false). */
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Prueft einen eingegebenen 6-stelligen Code gegen das Secret innerhalb des
 * Drift-Fensters (+/-`window` Schritte). Konstantzeit-Vergleich (timingSafeEqual)
 * gegen jeden Kandidaten. Nicht-6-stellige Eingaben werden ohne HMAC verworfen.
 */
export function verifyTotp(
  secretBase32: string,
  token: string,
  timeMs: number = Date.now(),
  window = TOTP_WINDOW,
): boolean {
  const clean = (token ?? '').replace(/\s+/g, '');
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(clean)) return false;
  let key: Buffer;
  try {
    key = base32Decode(secretBase32);
  } catch {
    return false;
  }
  const counter = Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);
  let match = false;
  // Alle Kandidaten im Fenster durchlaufen (kein Early-Return) -> die Laufzeit
  // haengt nicht davon ab, WELCHER Schritt passt (Timing-Neutralitaet). Negative
  // Zaehler (nur theoretisch nahe Epoch 1970) werden uebersprungen, damit
  // writeBigUInt64BE nie wirft.
  for (let w = -window; w <= window; w++) {
    const step = counter + w;
    if (step < 0) continue;
    if (timingSafeEqualStr(hotp(key, step, TOTP_DIGITS), clean)) {
      match = true;
    }
  }
  return match;
}

/**
 * Baut die otpauth://-URL fuer den QR-Code. Label und Issuer = "Detailly"
 * (Brand-Name, nicht uebersetzt). Enthaelt das Base32-Secret zum manuellen
 * Eintippen als Fallback.
 */
export function buildOtpauthUrl(email: string, secretBase32: string, issuer = 'Detailly'): string {
  // Key-URI-Konvention (Google): Issuer und Account einzeln kodieren, der
  // Doppelpunkt als Trenner bleibt literal (Authenticator-Apps erwarten das).
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(email)}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
