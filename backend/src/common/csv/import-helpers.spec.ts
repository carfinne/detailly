import { BadRequestException } from '@nestjs/common';
import { MAX_FELD, MAX_NOTIZ, MAX_ZEILEN, parseImportDatei, putzWert } from './import-helpers';

/**
 * Tests fuer die gemeinsamen CSV-Import-Bausteine (T-007). Diese Logik lag frueher
 * doppelt in customers-import und vehicles-import; hier wird die Gleichheit direkt
 * abgesichert (Formel-Injection-Schutz + Limits + Parse-Preamble).
 */

const datei = (text: string) => ({ buffer: Buffer.from(text, 'utf8'), originalname: 'x.csv' });

describe('putzWert · Formel-Injection-Schutz + Kappung', () => {
  it('entfernt fuehrende =/@/-/Tab (CSV-Formel-Injection), trimmt und laesst "+" stehen', () => {
    expect(putzWert('=SUM(A1)')).toBe('SUM(A1)');
    expect(putzWert('@cmd')).toBe('cmd');
    expect(putzWert('-1234')).toBe('1234');
    expect(putzWert('\t=boese')).toBe('boese'); // Tab + = zusammen weg
    expect(putzWert('  Max Muster  ')).toBe('Max Muster'); // getrimmt
    expect(putzWert('+49 221 123')).toBe('+49 221 123'); // "+" bleibt (Telefon)
  });

  it('kappt auf die Default-Feldlaenge bzw. eine uebergebene Laenge', () => {
    expect(putzWert('a'.repeat(300))).toHaveLength(MAX_FELD);
    expect(putzWert('a'.repeat(300), MAX_NOTIZ)).toHaveLength(300); // 300 < MAX_NOTIZ
    expect(putzWert('a'.repeat(5000), MAX_NOTIZ)).toHaveLength(MAX_NOTIZ);
  });

  it('behandelt null/undefined als leeren String', () => {
    expect(putzWert(undefined as unknown as string)).toBe('');
    expect(putzWert(null as unknown as string)).toBe('');
  });
});

describe('parseImportDatei · Preamble (Parsen + Zeilen-Limits)', () => {
  it('liefert Kopfzeile + Datenzeilen bei gueltiger CSV', () => {
    const csv = parseImportDatei(datei('Nachname;Ort\nMuster;Koeln\n'));
    expect(csv.header).toEqual(['nachname', 'ort']);
    expect(csv.zeilen).toHaveLength(1);
    expect(csv.zeilen[0].felder).toEqual(['Muster', 'Koeln']);
  });

  it('leere Datei -> 400', () => {
    expect(() => parseImportDatei({ buffer: Buffer.alloc(0) })).toThrow(BadRequestException);
  });

  it('nur Kopfzeile (keine Datenzeile) -> 400', () => {
    expect(() => parseImportDatei(datei('Nachname;Ort\n'))).toThrow(BadRequestException);
  });

  it('mehr als MAX_ZEILEN Datenzeilen -> 400 (DoS-Schutz)', () => {
    const zeilen = Array.from({ length: MAX_ZEILEN + 1 }, (_, i) => `K${i}`).join('\n');
    expect(() => parseImportDatei(datei(`Nachname\n${zeilen}\n`))).toThrow(BadRequestException);
  });

  it('genau MAX_ZEILEN Datenzeilen ist noch erlaubt', () => {
    const zeilen = Array.from({ length: MAX_ZEILEN }, (_, i) => `K${i}`).join('\n');
    const csv = parseImportDatei(datei(`Nachname\n${zeilen}\n`));
    expect(csv.zeilen).toHaveLength(MAX_ZEILEN);
  });
});
