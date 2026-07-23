import * as crypto from 'crypto';

/**
 * Affiliate-/Empfehlungsprogramm – zentrale Konstanten & Code-Erzeugung.
 *
 * Bewusst OHNE DB-Enum: Status-Werte sind varchar + Code-Konstante/@IsIn (kein
 * Postgres-`enum`) – so erfordert ein neuer Wert keine Enum-Schema-Migration und
 * keinen Dev-Reseed (Reseed-Falle bei Enum-Wert-Aenderungen).
 */

/**
 * Zeichenvorrat des Empfehlungs-Codes. BEWUSST OHNE verwechselbare Zeichen
 * (kein 0/O, 1/I/L) – der Code wird abgetippt/vorgelesen und muss eindeutig
 * bleiben. 31 Zeichen ^ 8 Stellen ≈ 8,5 · 10^11 Kombinationen (kollisionsarm).
 */
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Laenge des Empfehlungs-Codes (kurz, teilbar, abtippbar). */
export const REFERRAL_CODE_LENGTH = 8;

/**
 * Lebenszyklus einer Werbung (varchar + @IsIn, KEIN DB-Enum):
 * - `registriert` Der geworbene Betrieb hat sich registriert (Anwartschaft offen).
 * - `zahlend`     Der geworbene Betrieb hat ein bezahltes Abo (Status ACTIVE) –
 *                 die Gutschrift-Anwartschaft ist verdient (idempotent, einmalig).
 */
export const REFERRAL_STATUS = ['registriert', 'zahlend'] as const;
export type ReferralStatus = (typeof REFERRAL_STATUS)[number];

/**
 * Art der Gutschrift-Anwartschaft (varchar + @IsIn). Aktuell nur ein Typ; als
 * stabiler Maschinen-Key gespeichert, damit das Frontend die Anzeige lokalisiert
 * (nie fest verdrahteter deutscher Text in der DB).
 */
export const REWARD_TYPES = ['monat_basic'] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

/** Standard-Gutschrift beim Wechsel eines geworbenen Betriebs auf „zahlend". */
export const DEFAULT_REWARD_TYPE: RewardType = 'monat_basic';

/**
 * Erzeugt einen kryptografisch zufaelligen Empfehlungs-Code aus dem
 * verwechslungsarmen Alphabet. `crypto.randomInt` liefert eine unverzerrte
 * Gleichverteilung (kein Modulo-Bias). Die Eindeutigkeit stellt zusaetzlich der
 * UNIQUE-Index + die Retry-Schleife im Service sicher (kollisionsfest).
 */
export function generateReferralCode(length = REFERRAL_CODE_LENGTH): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += REFERRAL_CODE_ALPHABET[crypto.randomInt(REFERRAL_CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Normalisiert eine eingegebene Code-Zeichenkette fuer den exakten Lookup:
 * getrimmt + Grossbuchstaben (das Alphabet ist rein gross). Ein leerer/whitespace-
 * Wert wird zu '' – der Aufrufer verwirft ihn dann still (kein Fehler, kein Orakel).
 */
export function normalizeReferralCode(raw: string | null | undefined): string {
  return (raw ?? '').trim().toUpperCase();
}
