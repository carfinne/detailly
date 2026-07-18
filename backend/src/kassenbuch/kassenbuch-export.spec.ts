import { KassenbuchExportService, KassenbuchExportRow } from './kassenbuch-export.service';

/**
 * GoBD-CSV-Export: BOM + Semikolon + DE-Zahlen und – sicherheitskritisch –
 * Schutz vor CSV-/Formel-Injection (analog invoices/accounting-export #204).
 */
describe('KassenbuchExportService', () => {
  const svc = new KassenbuchExportService();

  function row(overrides: Partial<KassenbuchExportRow> = {}): KassenbuchExportRow {
    return {
      laufendeNummer: 1,
      datum: new Date('2026-07-18T10:00:00'),
      typ: 'einnahme',
      zweck: 'Barverkauf',
      belegNummer: 'B-1',
      kategorie: 'Verkauf',
      betrag: 100,
      mwstSatz: 19,
      kassenbestandNach: 100,
      festgeschrieben: true,
      stornoVonNummer: null,
      ...overrides,
    };
  }

  function parse(buffer: Buffer): { text: string; zeilen: string[] } {
    const text = buffer.toString('utf-8');
    // BOM entfernen, CRLF splitten, Leerzeile am Ende weg.
    const ohneBom = text.replace(/^﻿/, '');
    const zeilen = ohneBom.split('\r\n').filter((z) => z.length > 0);
    return { text, zeilen };
  }

  it('beginnt mit BOM und nutzt Semikolon + CRLF', () => {
    const buffer = svc.buildCsv([row()]);
    const text = buffer.toString('utf-8');
    expect(text.startsWith('﻿')).toBe(true);
    expect(text).toContain('\r\n');
    expect(text.split('\r\n')[0]).toContain(';');
  });

  it('schreibt Betraege im deutschen Format (Komma) und trennt Einnahme/Ausgabe-Spalten', () => {
    const einnahme = parse(svc.buildCsv([row({ typ: 'einnahme', betrag: 100, kassenbestandNach: 100 })]));
    // Kopf + eine Datenzeile.
    expect(einnahme.zeilen).toHaveLength(2);
    const zelle = einnahme.zeilen[1].split(';');
    // Reihenfolge: LfdNr;Datum;Typ;Zweck;Beleg;Kategorie;Einnahme;Ausgabe;MwSt;Bestand;Status;Storno
    expect(zelle[6]).toBe('100,00'); // Einnahme
    expect(zelle[7]).toBe(''); // Ausgabe leer
    expect(zelle[9]).toBe('100,00'); // Kassenbestand

    const ausgabe = parse(svc.buildCsv([row({ typ: 'ausgabe', betrag: 30, kassenbestandNach: 70 })]));
    const zelleA = ausgabe.zeilen[1].split(';');
    expect(zelleA[6]).toBe(''); // Einnahme leer
    expect(zelleA[7]).toBe('30,00'); // Ausgabe
  });

  it('neutralisiert Formel-Injection im Zweck (=, +, @) mit fuehrendem Apostroph', () => {
    const boese = '=HYPERLINK("http://evil","klick")';
    const { text } = parse(svc.buildCsv([row({ zweck: boese, belegNummer: '+SUM(99)', kategorie: '@cmd' })]));
    // Die gefaehrliche Formel darf NICHT roh am Zellenanfang stehen.
    expect(text).not.toMatch(/;=HYPERLINK/);
    // Sie steht escaped als '=... (mit Apostroph, in Quotes wegen der Klammern/Komma).
    expect(text).toContain(`'=HYPERLINK`);
    // Auch nicht-numerische + und @ am Zellenanfang werden neutralisiert
    // (eine rein numerische Zelle wie "+49" bliebe dagegen bewusst unveraendert).
    expect(text).toContain(`'+SUM(99)`);
    expect(text).toContain(`'@cmd`);
  });

  it('neutralisiert eine mit "-" beginnende Formel, laesst aber echte negative Zahlen unangetastet', () => {
    const { text } = parse(svc.buildCsv([row({ zweck: '-2+3' })]));
    // '-2+3' ist keine reine Zahl -> Apostroph davor.
    expect(text).toContain(`'-2+3`);
    // Ein echter Negativbetrag im Zahlenfeld bleibt unveraendert (kein Apostroph).
    const negativ = parse(svc.buildCsv([row({ kassenbestandNach: -50 })]));
    expect(negativ.zeilen[1].split(';')[9]).toBe('-50,00');
  });

  it('quotet Zellen mit Semikolon/Anfuehrungszeichen RFC-4180-konform', () => {
    const { text } = parse(svc.buildCsv([row({ zweck: 'Kauf; "bar"' })]));
    expect(text).toContain('"Kauf; ""bar"""');
  });

  it('zeigt die Original-Nummer bei Storno-Zeilen', () => {
    const { zeilen } = parse(
      svc.buildCsv([row({ laufendeNummer: 5, typ: 'ausgabe', stornoVonNummer: 3 })]),
    );
    const zelle = zeilen[1].split(';');
    expect(zelle[11]).toBe('3'); // Storno zu Nr.
  });
});
