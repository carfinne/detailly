import {
  dekodiereTextBuffer,
  erkenneTrennzeichen,
  parseCsv,
  parseCsvText,
} from './csv-parse';

/** Tests fuer den dependency-freien CSV-Parser (T-007). */

describe('erkenneTrennzeichen', () => {
  it('Excel/DE (Semikolon) -> ";"', () => {
    expect(erkenneTrennzeichen('Vorname;Nachname;E-Mail\r\nMax;Muster;m@x.de')).toBe(';');
  });

  it('Komma-CSV -> ","', () => {
    expect(erkenneTrennzeichen('firstName,lastName,email\nMax,Muster,m@x.de')).toBe(',');
  });

  it('Kopfzeile mit mehr Semikolons als Kommas -> ";" (Komma im Titel)', () => {
    expect(erkenneTrennzeichen('Name;Ort, Land;PLZ\n')).toBe(';');
  });

  it('einspaltige Datei -> Default ";"', () => {
    expect(erkenneTrennzeichen('email\nm@x.de')).toBe(';');
  });
});

describe('dekodiereTextBuffer', () => {
  it('UTF-8 mit Umlauten bleibt UTF-8', () => {
    const { text, encoding } = dekodiereTextBuffer(Buffer.from('Straße;Müller', 'utf8'));
    expect(encoding).toBe('utf-8');
    expect(text).toBe('Straße;Müller');
  });

  it('UTF-8-BOM wird entfernt', () => {
    const { text } = dekodiereTextBuffer(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('a;b', 'utf8')]));
    expect(text).toBe('a;b');
  });

  it('Windows-1252 (Excel/DE): Umlaute + Euro korrekt dekodiert', () => {
    // "Müller" + 0x80 (€) in cp1252 – als UTF-8 UNGUELTIG -> Fallback greift.
    const buf = Buffer.from([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72, 0x3b, 0x80]);
    const { text, encoding } = dekodiereTextBuffer(buf);
    expect(encoding).toBe('windows-1252');
    expect(text).toBe('Müller;€');
  });
});

describe('parseCsvText', () => {
  it('einfache Zeilen, CRLF und LF gemischt', () => {
    const rows = parseCsvText('a;b\r\nc;d\ne;f', ';');
    expect(rows).toEqual([
      { nr: 1, felder: ['a', 'b'] },
      { nr: 2, felder: ['c', 'd'] },
      { nr: 3, felder: ['e', 'f'] },
    ]);
  });

  it('Quotes: Trennzeichen und doppelte Anfuehrungszeichen im Feld', () => {
    const rows = parseCsvText('"Meier; Sohn";"Zitat: ""hallo"""\n', ';');
    expect(rows).toEqual([{ nr: 1, felder: ['Meier; Sohn', 'Zitat: "hallo"'] }]);
  });

  it('Zeilenumbruch INNERHALB eines Feldes: Zeilennummer = Satzbeginn', () => {
    const rows = parseCsvText('"Zeile1\nZeile2";x\r\nnaechster;y', ';');
    expect(rows).toEqual([
      { nr: 1, felder: ['Zeile1\nZeile2', 'x'] },
      { nr: 3, felder: ['naechster', 'y'] },
    ]);
  });

  it('leere Zeilen werden uebersprungen, leere Endfelder bleiben', () => {
    const rows = parseCsvText('a;b;\n\n   \nc;;\n', ';');
    expect(rows).toEqual([
      { nr: 1, felder: ['a', 'b', ''] },
      { nr: 4, felder: ['c', '', ''] },
    ]);
  });

  it('letzter Satz ohne abschliessenden Zeilenumbruch', () => {
    expect(parseCsvText('a;b', ';')).toEqual([{ nr: 1, felder: ['a', 'b'] }]);
  });
});

describe('parseCsv (Komplett)', () => {
  it('liefert normalisierte Header + Datenzeilen + Metadaten', () => {
    const buffer = Buffer.from('Vorname; Nachname ;E-Mail\r\nMax;Muster;m@x.de\r\n', 'utf8');
    const csv = parseCsv({ buffer });
    expect(csv.header).toEqual(['vorname', 'nachname', 'e-mail']);
    expect(csv.headerOriginal).toEqual(['Vorname', 'Nachname', 'E-Mail']);
    expect(csv.zeilen).toEqual([{ nr: 2, felder: ['Max', 'Muster', 'm@x.de'] }]);
    expect(csv.trennzeichen).toBe(';');
    expect(csv.encoding).toBe('utf-8');
  });

  it('leere Datei -> Error (Service uebersetzt in 400)', () => {
    expect(() => parseCsv({ buffer: Buffer.alloc(0) })).toThrow(/leer/);
    expect(() => parseCsv({} as never)).toThrow(/leer/);
  });
});
