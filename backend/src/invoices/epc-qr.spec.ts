import { buildEpcQrPayload, istGueltigeIban, normalisiereIban } from './epc-qr';

/**
 * Tests fuer den GiroCode-Payload (T-006). Referenz-IBANs sind die ueblichen
 * Beispiel-IBANs mit korrekter Mod-97-Pruefsumme.
 */
const IBAN_OK = 'DE89 3704 0044 0532 0130 00'; // klassische Beispiel-IBAN (gueltig)
const IBAN_FALSCH = 'DE89370400440532013001'; // Pruefsumme kaputt

describe('istGueltigeIban', () => {
  it('gueltige IBAN (mit Leerzeichen) -> true', () => {
    expect(istGueltigeIban(IBAN_OK)).toBe(true);
  });

  it('kaputte Pruefsumme -> false', () => {
    expect(istGueltigeIban(IBAN_FALSCH)).toBe(false);
  });

  it.each(['', 'DE12', '1234567890', 'XX00!!INVALID000000000', null as unknown as string])(
    'formal unplausibel (%s) -> false',
    (iban) => {
      expect(istGueltigeIban(iban)).toBe(false);
    },
  );

  it('Kleinschreibung wird normalisiert', () => {
    expect(istGueltigeIban('de89 3704 0044 0532 0130 00')).toBe(true);
    expect(normalisiereIban('de89 37')).toBe('DE8937');
  });
});

describe('buildEpcQrPayload', () => {
  const basis = { name: 'Glanzwerk Detailing GmbH', iban: IBAN_OK, betrag: 147.56 };

  it('baut den EPC069-12-Payload in korrekter Zeilenfolge', () => {
    const payload = buildEpcQrPayload({ ...basis, bic: 'COBADEFFXXX', verwendungszweck: 'RE-2026-0042' });
    expect(payload).toBe(
      [
        'BCD',
        '002',
        '1',
        'SCT',
        'COBADEFFXXX',
        'Glanzwerk Detailing GmbH',
        'DE89370400440532013000',
        'EUR147.56',
        '',
        '',
        'RE-2026-0042',
      ].join('\n'),
    );
  });

  it('BIC ist optional (Version 002) -> leeres Feld, Zeilenzahl bleibt', () => {
    const payload = buildEpcQrPayload(basis)!;
    const zeilen = payload.split('\n');
    expect(zeilen).toHaveLength(11);
    expect(zeilen[4]).toBe('');
  });

  it('Betrag wird auf zwei Nachkommastellen formatiert (kaufmaennisch gerundet)', () => {
    expect(buildEpcQrPayload({ ...basis, betrag: 10 })!.split('\n')[7]).toBe('EUR10.00');
    expect(buildEpcQrPayload({ ...basis, betrag: 3.14159 })!.split('\n')[7]).toBe('EUR3.14');
  });

  it('Grenzfall nahe 0: NIE ein Payload mit EUR0.00', () => {
    // Math.round(0.004*100)/100 -> 0 -> ausserhalb 0.01..max -> null.
    expect(buildEpcQrPayload({ ...basis, betrag: 0.004 })).toBeNull();
  });

  it.each([0, -5, 1_000_000_000])('unplausibler Betrag %s -> null (fail-closed)', (betrag) => {
    expect(buildEpcQrPayload({ ...basis, betrag })).toBeNull();
  });

  it('ungueltige IBAN -> null (kein QR-Code fuer fehlerhafte Ueberweisung)', () => {
    expect(buildEpcQrPayload({ ...basis, iban: IBAN_FALSCH })).toBeNull();
  });

  it('leerer Name -> null', () => {
    expect(buildEpcQrPayload({ ...basis, name: '   ' })).toBeNull();
  });

  it('Zeilenumbrueche in Name/Zweck werden entschaerft (Format ist zeilenbasiert)', () => {
    const payload = buildEpcQrPayload({
      ...basis,
      name: 'Zeile1\nZeile2',
      verwendungszweck: 'RE-1\r\nBetrug',
    })!;
    const zeilen = payload.split('\n');
    expect(zeilen).toHaveLength(11);
    expect(zeilen[5]).toBe('Zeile1 Zeile2');
    expect(zeilen[10]).toBe('RE-1 Betrug');
  });

  it('Name >70 und Zweck >140 werden gekappt', () => {
    const payload = buildEpcQrPayload({
      ...basis,
      name: 'x'.repeat(100),
      verwendungszweck: 'y'.repeat(200),
    })!;
    const zeilen = payload.split('\n');
    expect(zeilen[5]).toHaveLength(70);
    expect(zeilen[10]).toHaveLength(140);
  });
});
