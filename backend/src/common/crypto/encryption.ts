import * as crypto from 'crypto';

/**
 * Anwendungs-Verschluesselung fuer sensible, NICHT durchsuchte Felder
 * (AES-256-GCM, authentifiziert -> erkennt Manipulation).
 *
 * Zweck: Schutz gegen DB-Auslesen (z. B. geklautes Backup / SQL-Injection) – die
 * betroffenen Spalten enthalten dann nur Chiffretext. Es ist KEIN Schutz gegen
 * eine kompromittierte laufende App (die haelt den Schluessel) und ersetzt NICHT
 * die Transport- (TLS) bzw. At-Rest-Verschluesselung der ganzen DB.
 *
 * Schluessel: ENV `DATA_ENC_KEY`.
 *  - 64 Hex-Zeichen  -> direkt als 32-Byte-Schluessel,
 *  - sonst beliebiger String -> per SHA-256 auf 32 Byte abgeleitet.
 * Ohne gesetzten Key gilt ein klar markierter Dev-Fallback (Prod + Postgres
 * erzwingen den Key via env.validation, Dev-SQLite warnt laut). WICHTIG:
 * Schluesselverlust = Datenverlust. Key-ROTATION wird (noch) nicht unterstuetzt:
 * ein geaenderter Key macht Bestandsdaten unlesbar (decrypt wirft dann LAUT statt
 * still Muell zu liefern). Fuer Rotation braucht es eine Key-ID im Marker
 * (`enc:v1:<keyId>:...`) + einen Re-Encrypt-Lauf -> Folge-Ticket.
 */
const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:'; // Marker, um verschluesselte Werte zu erkennen
const IV_LEN = 12; // GCM-Standard
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;
let warnedFallback = false;

/** Entschluesselung eines markierten Werts fehlgeschlagen (falscher/rotierter Key
 *  oder manipuliert/korrupt). Wird LAUT geworfen, nie stillschweigend ignoriert. */
export class DecryptionError extends Error {
  constructor() {
    super('Entschluesselung fehlgeschlagen (falscher DATA_ENC_KEY oder Daten manipuliert).');
    this.name = 'DecryptionError';
  }
}

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.DATA_ENC_KEY || '';
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    cachedKey = Buffer.from(raw, 'hex');
  } else if (raw) {
    cachedKey = crypto.createHash('sha256').update(raw).digest();
  } else {
    // Nur Dev: deterministischer, BEWUSST unsicherer Fallback. Prod + Postgres
    // erzwingen DATA_ENC_KEY in env.validation; hier zusaetzlich einmalig laut
    // warnen, damit niemand versehentlich echte Daten mit dem Repo-Key ablegt.
    if (!warnedFallback) {
      warnedFallback = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[encryption] WARNUNG: Kein DATA_ENC_KEY gesetzt - es wird der UNSICHERE Dev-Fallback-Schluessel benutzt. NIEMALS mit echten Daten verwenden!',
      );
    }
    cachedKey = crypto.createHash('sha256').update('detailly-dev-insecure-key').digest();
  }
  return cachedKey;
}

/** Nur fuer Tests: Key-Cache leeren (z. B. nach Setzen von process.env). */
export function resetEncryptionKeyCache(): void {
  cachedKey = null;
}

/** Ist der Wert bereits ein von uns erzeugter Chiffretext? */
export function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/** Verschluesselt einen Klartext-String -> `enc:v1:<base64(iv|tag|ct)>`. */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

/**
 * Entschluesselt einen zuvor erzeugten Chiffretext. Werte OHNE unseren Marker
 * (z. B. Altbestand-Klartext vor der Umstellung) werden UNVERAENDERT
 * zurueckgegeben -> bruchfreie Migration.
 *
 * WICHTIG: Schlaegt die Entschluesselung eines MARKIERTEN Werts fehl (falscher/
 * rotierter DATA_ENC_KEY oder Manipulation), wird LAUT eine DecryptionError
 * geworfen – NIE der Roh-Chiffretext zurueckgegeben. Sonst landete Chiffretext-
 * Muell still z. B. als Steuernummer/IBAN auf §14-Rechnungen.
 */
export function decrypt(value: string): string {
  if (!isEncrypted(value)) return value; // markerloser Altbestand -> unveraendert
  try {
    const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    throw new DecryptionError();
  }
}
