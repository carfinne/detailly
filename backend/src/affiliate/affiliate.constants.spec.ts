import {
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  generateReferralCode,
  normalizeReferralCode,
} from './affiliate.constants';

describe('affiliate.constants · generateReferralCode', () => {
  it('erzeugt einen Code der konfigurierten Laenge (8) nur aus dem Alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateReferralCode();
      expect(code).toHaveLength(REFERRAL_CODE_LENGTH);
      for (const ch of code) {
        expect(REFERRAL_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it('enthaelt KEINE verwechselbaren Zeichen (0/O, 1/I/L)', () => {
    // Das Alphabet selbst ist verwechslungsfrei -> jeder erzeugte Code auch.
    for (const verboten of ['0', 'O', '1', 'I', 'L']) {
      expect(REFERRAL_CODE_ALPHABET).not.toContain(verboten);
    }
    const joined = Array.from({ length: 100 }, () => generateReferralCode()).join('');
    expect(joined).not.toMatch(/[01OIL]/);
  });

  it('ist praktisch kollisionsfrei ueber viele Ziehungen (Zufallsverteilung)', () => {
    const set = new Set<string>();
    for (let i = 0; i < 5000; i++) set.add(generateReferralCode());
    // Bei 31^8 Kombinationen sind 5000 eindeutige Codes praktisch garantiert.
    expect(set.size).toBe(5000);
  });

  it('respektiert eine abweichende Laenge', () => {
    expect(generateReferralCode(12)).toHaveLength(12);
  });
});

describe('affiliate.constants · normalizeReferralCode', () => {
  it('trimmt und macht Grossbuchstaben', () => {
    expect(normalizeReferralCode('  abc23xyz ')).toBe('ABC23XYZ');
  });

  it('leerer/undefinierter Wert -> leerer String (still verwerfen)', () => {
    expect(normalizeReferralCode('')).toBe('');
    expect(normalizeReferralCode('   ')).toBe('');
    expect(normalizeReferralCode(null)).toBe('');
    expect(normalizeReferralCode(undefined)).toBe('');
  });
});
