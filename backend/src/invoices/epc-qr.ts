/**
 * EPC-QR ("GiroCode") – SEPA-Ueberweisungsdaten als QR-Payload nach der
 * EPC-Guideline EPC069-12, Version 002 (Service-Tag BCD / SEPA Credit Transfer).
 *
 * P3-4 (T-006): Die oeffentliche Belegseite zeigt fuer OFFENE Rechnungen einen
 * QR-Code, den Banking-Apps scannen -> Ueberweisung ist mit Empfaenger, IBAN,
 * Betrag und Verwendungszweck vorausgefuellt. Es fliesst KEIN Geld ueber die
 * Plattform – der QR-Code beschreibt nur eine normale SEPA-Ueberweisung an den
 * Betrieb (Stripe Connect fuer echten Online-Checkout ist ein eigenes Ticket).
 *
 * Bewusst REIN (keine DB, kein Nest) wie invoice-rules.ts, damit die Logik
 * ohne Mocks testbar ist. Fail-closed: bei ungueltiger IBAN, leerem Namen oder
 * unplausiblem Betrag liefert der Builder `null` – lieber KEIN QR-Code als ein
 * QR-Code, der eine fehlerhafte Ueberweisung ausloest.
 */

export interface EpcQrDaten {
  /** Zahlungsempfaenger (Name des Betriebs), Pflicht, max. 70 Zeichen. */
  name: string;
  /** IBAN des Betriebs (Leerzeichen erlaubt, werden entfernt). */
  iban: string;
  /** BIC – seit Version 002 im EWR optional. */
  bic?: string;
  /** Betrag in Euro (0.01 .. 999999999.99). */
  betrag: number;
  /** Unstrukturierter Verwendungszweck (z. B. Rechnungsnummer), max. 140 Zeichen. */
  verwendungszweck?: string;
}

/** Normalisiert eine IBAN: Leerzeichen raus, Grossbuchstaben. */
export function normalisiereIban(raw: string): string {
  return (raw || '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Formale IBAN-Pruefung inkl. Mod-97 (ISO 7064) – wie sie jede Bank rechnet:
 * die ersten 4 Zeichen ans Ende, Buchstaben -> Zahlen (A=10..Z=35), Rest 1.
 * Kein Laendervergleich der Laenge (dafuer reicht der Zweck hier nicht aus);
 * die Pruefsumme faengt Tippfehler zuverlaessig ab.
 */
export function istGueltigeIban(raw: string): boolean {
  const iban = normalisiereIban(raw);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const umgestellt = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const zeichen of umgestellt) {
    const wert = zeichen >= '0' && zeichen <= '9' ? zeichen : String(zeichen.charCodeAt(0) - 55);
    rest = Number(`${rest}${wert}`) % 97;
  }
  return rest === 1;
}

/** Entfernt Zeilenumbrueche (Zeilen sind das Trennzeichen des Formats) + kappt. */
function feld(value: string | undefined, maxLaenge: number): string {
  return (value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, maxLaenge);
}

/**
 * Baut den EPC-QR-Payload (Zeilen mit LF getrennt, UTF-8 = Zeichensatz "1").
 * Rueckgabe `null`, wenn die Daten keine korrekte Ueberweisung ergeben wuerden.
 */
export function buildEpcQrPayload(daten: EpcQrDaten): string | null {
  const iban = normalisiereIban(daten.iban);
  if (!istGueltigeIban(iban)) return null;

  const name = feld(daten.name, 70);
  if (!name) return null;

  // Betrag kaufmaennisch auf Cent runden; ausserhalb des SEPA-Rahmens -> kein QR.
  const betrag = Math.round((daten.betrag ?? 0) * 100) / 100;
  if (!(betrag >= 0.01 && betrag <= 999999999.99)) return null;

  // BIC ist seit Version 002 im EWR optional – nur formal gueltige BICs
  // (ISO 9362: 4 Bank / 2 Land / 2 Ort / optional 3 Filiale) uebernehmen.
  // Ein kaputter Wert wuerde die vorausgefuellte Ueberweisung stoeren; das
  // Feld leer zu lassen ist dagegen normkonform.
  const bicRoh = normalisiereIban(daten.bic || '');
  const bic = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bicRoh) ? bicRoh : '';
  const zweck = feld(daten.verwendungszweck, 140);

  // Feldfolge laut EPC069-12: Service Tag, Version, Zeichensatz, Identifikation,
  // BIC, Name, IBAN, Betrag, Purpose (leer), strukturierte Referenz (leer),
  // unstrukturierter Verwendungszweck. Nachlaufende Leerfelder sind erlaubt.
  return ['BCD', '002', '1', 'SCT', bic, name, iban, `EUR${betrag.toFixed(2)}`, '', '', zweck].join(
    '\n',
  );
}
