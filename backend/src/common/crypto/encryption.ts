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
 * Schluessel: ENV `DATA_ENC_KEY` (aktueller Schluessel, es wird IMMER damit
 * verschluesselt).
 *  - 64 Hex-Zeichen  -> direkt als 32-Byte-Schluessel,
 *  - sonst beliebiger String -> per SHA-256 auf 32 Byte abgeleitet.
 * Ohne gesetzten Key gilt ein klar markierter Dev-Fallback (Prod + Postgres
 * erzwingen den Key via env.validation, Dev-SQLite warnt laut).
 *
 * KEY-ROTATION (Lese-Seite): ENV `DATA_ENC_KEY_OLD` nimmt einen ODER MEHRERE
 * Altschluessel (kommagetrennt) auf. Beim Entschluesseln wird zuerst der aktuelle
 * Schluessel, dann der Reihe nach jeder Altschluessel probiert – so bleiben unter
 * einem frueheren Schluessel abgelegte Bestandsdaten lesbar, waehrend NEUES
 * Schreiben schon den aktuellen Schluessel nutzt. Ein spaeterer Re-Encrypt-Lauf
 * (alle Bestandswerte einmal neu speichern) macht die Altschluessel dann
 * ueberfluessig. WICHTIG: Passt KEIN Schluessel, wird weiterhin LAUT ein
 * DecryptionError geworfen (nie still Muell/Chiffretext liefern) – der Schutz
 * gegen falschen Key/Manipulation wird durch die Mehrschluessel-Logik NICHT
 * schwaecher. Das Hilfsskript/die Anleitung fuer den eigentlichen Wechsel
 * (Re-Encrypt-Batch) ist bewusst NICHT Teil dieses Moduls -> Folge-Ticket.
 * Schluesselverlust (aller Schluessel) = Datenverlust.
 */
const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:'; // Marker, um verschluesselte Werte zu erkennen
const IV_LEN = 12; // GCM-Standard
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;
let cachedOldKeys: Buffer[] | null = null;
let warnedFallback = false;

/** Leitet aus einem Roh-String einen 32-Byte-Schluessel ab: 64 Hex direkt, sonst
 *  per SHA-256. Zentral, damit aktueller und Alt-Schluessel identisch abgeleitet
 *  werden (ein Wert entschluesselt, egal ob er heute aktiv oder ein Altschluessel ist). */
function deriveKey(raw: string): Buffer {
  return /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : crypto.createHash('sha256').update(raw).digest();
}

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
  if (raw) {
    cachedKey = deriveKey(raw);
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

/**
 * Altschluessel fuer die Rotation (nur LESEN). Kommagetrennt aus `DATA_ENC_KEY_OLD`;
 * leere Eintraege werden verworfen. Fehlt die Variable, ist die Liste leer und das
 * Verhalten identisch zu vorher (nur aktueller Schluessel).
 */
function getOldKeys(): Buffer[] {
  if (cachedOldKeys) return cachedOldKeys;
  const raw = process.env.DATA_ENC_KEY_OLD || '';
  cachedOldKeys = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(deriveKey);
  return cachedOldKeys;
}

/** Entschluesselungs-Schluessel in Prioritaet: erst aktueller, dann Altschluessel. */
function getDecryptionKeys(): Buffer[] {
  return [getKey(), ...getOldKeys()];
}

/** Nur fuer Tests: Key-Caches (aktuell + Alt) leeren (z. B. nach Setzen von process.env). */
export function resetEncryptionKeyCache(): void {
  cachedKey = null;
  cachedOldKeys = null;
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
 * Binaerer Datei-Marker (8 Byte) fuer AT-REST verschluesselte Dokumente. Bewusst
 * getrennt vom Text-PREFIX (String-Spalten): der Datei-Header wird VOR dem
 * Entschluesseln validiert, damit eine fremde/kaputte Datei LAUT (DecryptionError)
 * statt mit GCM-Muell scheitert.
 */
const FILE_MAGIC = Buffer.from('DLYENC1\0', 'utf8');

/**
 * Verschluesselt einen ROHEN Buffer (z. B. eine hochgeladene PDF/JPG/PNG) fuer die
 * Ablage unter private-uploads. Format: `FILE_MAGIC | iv(12) | tag(16) | ciphertext`.
 * Gleicher AES-256-GCM-Schluessel (DATA_ENC_KEY) wie die Feld-Verschluesselung.
 */
export function encryptBuffer(plain: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([FILE_MAGIC, iv, tag, ct]);
}

/**
 * Entschluesselt einen zuvor mit encryptBuffer erzeugten Datei-Buffer. Wirft LAUT
 * eine DecryptionError, wenn der Marker fehlt, die Datei zu kurz ist oder die
 * Authentifizierung fehlschlaegt (falscher DATA_ENC_KEY / manipuliert) - es wird
 * NIE Chiffretext/Muell zurueckgegeben.
 */
export function decryptBuffer(data: Buffer): Buffer {
  const kopf = FILE_MAGIC.length;
  if (
    data.length < kopf + IV_LEN + TAG_LEN ||
    !data.subarray(0, kopf).equals(FILE_MAGIC)
  ) {
    throw new DecryptionError();
  }
  const iv = data.subarray(kopf, kopf + IV_LEN);
  const tag = data.subarray(kopf + IV_LEN, kopf + IV_LEN + TAG_LEN);
  const ct = data.subarray(kopf + IV_LEN + TAG_LEN);
  // Rotation: aktuellen Schluessel zuerst, dann Altschluessel probieren.
  for (const key of getDecryptionKeys()) {
    try {
      const decipher = crypto.createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ct), decipher.final()]);
    } catch {
      // GCM-Tag passte nicht -> naechsten (Alt-)Schluessel versuchen.
    }
  }
  // Kein Schluessel passte -> LAUT scheitern, nie Chiffretext/Muell zurueckgeben.
  throw new DecryptionError();
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
  const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  // Rotation: aktuellen Schluessel zuerst, dann Altschluessel der Reihe nach.
  for (const key of getDecryptionKeys()) {
    try {
      const decipher = crypto.createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    } catch {
      // GCM-Tag passte nicht -> naechsten (Alt-)Schluessel versuchen.
    }
  }
  // Kein Schluessel passte (falscher/rotierter Key oder Manipulation) -> LAUT
  // scheitern, nie den Roh-Chiffretext zurueckgeben (sonst leiser §14-Datenverlust).
  throw new DecryptionError();
}
