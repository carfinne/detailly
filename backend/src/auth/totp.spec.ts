import {
  base32Encode,
  base32Decode,
  generateTotpSecret,
  hotp,
  totp,
  verifyTotp,
  buildOtpauthUrl,
  TOTP_STEP_SECONDS,
} from './totp';

/**
 * RFC-6238-Referenz-Secret "12345678901234567890" (20 ASCII-Bytes) als Base32.
 * Die Testvektoren des RFC nutzen fuer SHA1 genau dieses Secret.
 */
const RFC_SECRET_ASCII = '12345678901234567890';
const RFC_SECRET_BASE32 = base32Encode(Buffer.from(RFC_SECRET_ASCII, 'ascii'));

describe('TOTP · Base32', () => {
  it('encode/decode ist verlustfrei (Roundtrip)', () => {
    const buf = Buffer.from('12345678901234567890', 'ascii');
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });

  it('RFC-4648-Vektor: "foobar" -> MZXW6YTBOI', () => {
    expect(base32Encode(Buffer.from('foobar', 'ascii'))).toBe('MZXW6YTBOI');
  });

  it('decode toleriert Kleinschreibung, Leerzeichen und Padding', () => {
    const canonical = base32Encode(Buffer.from('foobar', 'ascii'));
    const messy = 'mz xw6y tboi====';
    expect(base32Decode(messy).equals(base32Decode(canonical))).toBe(true);
  });
});

describe('TOTP · HOTP RFC-4226-Testvektoren (Appendix D)', () => {
  // Erwartete 6-stellige HOTP-Werte fuer Counter 0..9 (Secret = RFC_SECRET_ASCII).
  const EXPECTED = [
    '755224',
    '287082',
    '359152',
    '969429',
    '338314',
    '254676',
    '287922',
    '162583',
    '399871',
    '520489',
  ];
  it.each(EXPECTED.map((v, i) => [i, v]))('Counter %i -> %s', (counter, expected) => {
    expect(hotp(Buffer.from(RFC_SECRET_ASCII, 'ascii'), counter as number)).toBe(expected);
  });
});

describe('TOTP · RFC-6238-Testvektoren (SHA1, 30s, 8-stellig gekuerzt auf 6)', () => {
  // RFC 6238 Appendix B: (Unix-Zeit in s -> erwarteter 8-stelliger TOTP-Wert).
  // Wir pruefen die 6 hinteren Stellen, da unsere Implementierung 6 Ziffern liefert.
  const VECTORS: Array<[number, string]> = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ];

  it.each(VECTORS)('t=%i s -> ...%s (letzte 6 Stellen)', (seconds, eightDigit) => {
    const sixExpected = eightDigit.slice(-6);
    expect(totp(RFC_SECRET_BASE32, seconds * 1000)).toBe(sixExpected);
  });
});

describe('TOTP · verifyTotp', () => {
  const NOW = 1111111109 * 1000;

  it('akzeptiert den aktuellen Code', () => {
    const code = totp(RFC_SECRET_BASE32, NOW);
    expect(verifyTotp(RFC_SECRET_BASE32, code, NOW)).toBe(true);
  });

  it('akzeptiert den vorherigen und naechsten Schritt (+/-1 Fenster)', () => {
    const stepMs = TOTP_STEP_SECONDS * 1000;
    const prev = totp(RFC_SECRET_BASE32, NOW - stepMs);
    const next = totp(RFC_SECRET_BASE32, NOW + stepMs);
    expect(verifyTotp(RFC_SECRET_BASE32, prev, NOW)).toBe(true);
    expect(verifyTotp(RFC_SECRET_BASE32, next, NOW)).toBe(true);
  });

  it('lehnt Code ausserhalb des Fensters ab (2 Schritte entfernt)', () => {
    const stepMs = TOTP_STEP_SECONDS * 1000;
    const far = totp(RFC_SECRET_BASE32, NOW + 2 * stepMs);
    // Nur ablehnen, wenn sich der Code tatsaechlich unterscheidet (Kollisionen selten).
    if (far !== totp(RFC_SECRET_BASE32, NOW)) {
      expect(verifyTotp(RFC_SECRET_BASE32, far, NOW)).toBe(false);
    }
  });

  it('lehnt falsche/leere/nicht-6-stellige Eingaben ab', () => {
    expect(verifyTotp(RFC_SECRET_BASE32, '000000', NOW)).toBe(false);
    expect(verifyTotp(RFC_SECRET_BASE32, '', NOW)).toBe(false);
    expect(verifyTotp(RFC_SECRET_BASE32, '12345', NOW)).toBe(false);
    expect(verifyTotp(RFC_SECRET_BASE32, 'abcdef', NOW)).toBe(false);
  });

  it('toleriert Leerzeichen in der Eingabe', () => {
    const code = totp(RFC_SECRET_BASE32, NOW);
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(verifyTotp(RFC_SECRET_BASE32, spaced, NOW)).toBe(true);
  });
});

describe('TOTP · Secret + otpauth-URL', () => {
  it('generateTotpSecret liefert 160-Bit-Base32 (32 Zeichen)', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(base32Decode(secret).length).toBe(20);
  });

  it('buildOtpauthUrl enthaelt Issuer, Label und Secret', () => {
    const url = buildOtpauthUrl('max@example.com', 'JBSWY3DPEHPK3PXP');
    expect(url.startsWith('otpauth://totp/Detailly:max%40example.com?')).toBe(true);
    expect(url).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(url).toContain('issuer=Detailly');
    expect(url).toContain('algorithm=SHA1');
    expect(url).toContain('digits=6');
    expect(url).toContain('period=30');
  });
});
