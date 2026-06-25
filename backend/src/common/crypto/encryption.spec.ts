import { encrypt, decrypt, isEncrypted, resetEncryptionKeyCache, DecryptionError } from './encryption';
import { encryptedStringTransformer, encryptedJsonTransformer } from './encrypted-column';

/**
 * App-Feld-Verschluesselung (AES-256-GCM). Wichtige Eigenschaften:
 * - Round-trip korrekt inkl. Umlauten/Sonderzeichen,
 * - jedes encrypt erzeugt anderen Chiffretext (zufaelliger IV), beide entschluesseln gleich,
 * - Chiffretext traegt den Marker und ist nicht der Klartext,
 * - Altbestand-Klartext (ohne Marker) wird unveraendert durchgereicht (bruchfreie Migration),
 * - Manipulation am Chiffretext wird erkannt (GCM) -> nie der Originaltext.
 */
beforeAll(() => {
  process.env.DATA_ENC_KEY = 'a'.repeat(64); // deterministischer Test-Key (64 Hex)
  resetEncryptionKeyCache();
});

describe('encryption (AES-256-GCM)', () => {
  it('verschluesselt und entschluesselt verlustfrei (inkl. Umlaute)', () => {
    const klar = 'Müller & Söhne — IBAN DE02 1203 0000 0000 2020 51';
    const ct = encrypt(klar);
    expect(isEncrypted(ct)).toBe(true);
    expect(ct).not.toContain('IBAN');
    expect(decrypt(ct)).toBe(klar);
  });

  it('erzeugt bei gleichem Klartext unterschiedliche Chiffretexte (zufaelliger IV)', () => {
    const a = encrypt('geheim');
    const b = encrypt('geheim');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('geheim');
    expect(decrypt(b)).toBe('geheim');
  });

  it('gibt Altbestand-Klartext (ohne Marker) unveraendert zurueck', () => {
    expect(decrypt('12/345/67890')).toBe('12/345/67890');
    expect(isEncrypted('12/345/67890')).toBe(false);
  });

  it('erkennt Manipulation -> wirft DecryptionError (kein Rohwert-Passthrough)', () => {
    const ct = encrypt('Top Secret');
    // letztes Zeichen des base64-Teils kippen
    const manipuliert = ct.slice(0, -1) + (ct.endsWith('A') ? 'B' : 'A');
    expect(() => decrypt(manipuliert)).toThrow(DecryptionError);
  });

  it('falscher/rotierter Key -> wirft (gibt NICHT den Roh-Chiffretext zurueck)', () => {
    const ct = encrypt('IBAN DE0212030000000020205');
    // Key wechseln (Rotation/Fehlkonfiguration simulieren)
    process.env.DATA_ENC_KEY = 'b'.repeat(64);
    resetEncryptionKeyCache();
    expect(() => decrypt(ct)).toThrow(DecryptionError);
    // zuruecksetzen fuer Folge-Tests
    process.env.DATA_ENC_KEY = 'a'.repeat(64);
    resetEncryptionKeyCache();
  });
});

describe('encrypted-column-Transformer', () => {
  it('String-Transformer: null bleibt null, Werte round-trippen', () => {
    expect(encryptedStringTransformer.to(null)).toBeNull();
    expect(encryptedStringTransformer.to(undefined)).toBeUndefined();
    const stored = encryptedStringTransformer.to('Geheimnis') as string;
    expect(isEncrypted(stored)).toBe(true);
    expect(encryptedStringTransformer.from(stored)).toBe('Geheimnis');
    // Altbestand-Klartext aus der DB
    expect(encryptedStringTransformer.from('alt-klartext')).toBe('alt-klartext');
  });

  it('JSON-Transformer: Objekt round-trippt, Altbestand-JSON wird geparst', () => {
    const t = encryptedJsonTransformer<{ steuernummer: string; iban: string }>();
    const obj = { steuernummer: '12/345/67890', iban: 'DE0212030000000020205' };
    const stored = t.to(obj) as string;
    expect(isEncrypted(stored)).toBe(true);
    expect(stored).not.toContain('steuernummer');
    expect(t.from(stored)).toEqual(obj);
    // Altbestand: Klartext-JSON ohne Marker
    expect(t.from('{"steuernummer":"99"}')).toEqual({ steuernummer: '99' });
    expect(t.to(null)).toBeNull();
  });
});
