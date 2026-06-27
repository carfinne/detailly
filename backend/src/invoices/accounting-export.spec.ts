import { AccountingExportService, DatevConfig } from './accounting-export.service';

/**
 * Tests fuer den Buchhaltungs-Export. Reine Formatierung ohne DB -> direkte
 * Instanziierung, Plain-Objekte als Invoice/Customer.
 */
describe('AccountingExportService', () => {
  const svc = new AccountingExportService();

  const cust = new Map<string, any>([
    ['c1', { type: 'private', firstName: 'Max', lastName: 'Mustermann' }],
    ['c2', { type: 'business', companyName: 'Auto & Co; KG' }],
  ]);

  const inv = (over: Partial<any> = {}): any => ({
    nummer: 'RE-2026-0001',
    customerId: 'c1',
    datum: new Date(2026, 0, 15), // 15.01.2026
    leistungsdatum: new Date(2026, 0, 14),
    netto: 100,
    mwst: 19,
    brutto: 119,
    mwstSatz: 19,
    status: 'offen',
    zahldatum: null,
    ...over,
  });

  describe('buildCsv', () => {
    it('Kopfzeile + deutsche Zahlen/Datumsformate', () => {
      const text = svc.buildCsv([inv()], cust).toString('utf-8');
      const lines = text.replace(/^﻿/, '').trim().split('\r\n');
      expect(lines[0]).toBe(
        'Belegnummer;Belegdatum;Leistungsdatum;Kunde;Netto;MwSt-Satz;MwSt-Betrag;Brutto;Status;Zahldatum',
      );
      expect(lines[1]).toBe('RE-2026-0001;15.01.2026;14.01.2026;Max Mustermann;100,00;19;19,00;119,00;offen;');
    });

    it('beginnt mit UTF-8-BOM (Excel-Umlaute)', () => {
      const buf = svc.buildCsv([inv()], cust);
      expect(buf[0]).toBe(0xef);
      expect(buf[1]).toBe(0xbb);
      expect(buf[2]).toBe(0xbf);
    });

    it('escaped Felder mit Semikolon (Kundenname in Anfuehrungszeichen)', () => {
      const text = svc.buildCsv([inv({ customerId: 'c2' })], cust).toString('utf-8');
      const row = text.replace(/^﻿/, '').trim().split('\r\n')[1];
      expect(row).toContain('"Auto & Co; KG"');
    });

    it('§19 / 0%: MwSt-Satz 0, Brutto = Netto', () => {
      const text = svc
        .buildCsv([inv({ mwstSatz: 0, mwst: 0, brutto: 100 })], cust)
        .toString('utf-8');
      const row = text.replace(/^﻿/, '').trim().split('\r\n')[1];
      expect(row).toContain(';0;0,00;100,00;');
    });

    it('Zahldatum nur bei bezahlt gefuellt', () => {
      const text = svc
        .buildCsv([inv({ status: 'bezahlt', zahldatum: new Date(2026, 0, 20) })], cust)
        .toString('utf-8');
      const row = text.replace(/^﻿/, '').trim().split('\r\n')[1];
      expect(row.endsWith(';bezahlt;20.01.2026')).toBe(true);
    });
  });

  describe('buildDatev', () => {
    const cfg: DatevConfig = {
      beraterNr: '1001',
      mandantNr: '456',
      skr: '03',
      erloeskonto19: '8400',
      erloeskonto7: '8300',
      erloeskonto0: '8195',
      debitorSammelkonto: '1400',
    };
    const von = new Date(2026, 0, 1);
    const bis = new Date(2026, 0, 31);

    const lines = (invoices: any[]) =>
      svc.buildDatev(invoices, cust, cfg, von, bis).toString('latin1').trim().split('\r\n');

    it('Kopfzeile: EXTF, Berater/Mandant, Zeitraum', () => {
      const head = lines([inv()])[0];
      expect(head.startsWith('"EXTF";700;21;"Buchungsstapel";13;')).toBe(true);
      expect(head).toContain(';1001;456;20260101;4;20260101;20260131;');
      expect(head).toContain('"EUR"');
    });

    it('Captions-Zeile enthaelt die Pflichtspalten', () => {
      const caps = lines([inv()])[1];
      expect(caps).toContain('Umsatz (ohne Soll/Haben-Kz)');
      expect(caps).toContain('Gegenkonto (ohne BU-Schlüssel)');
      expect(caps).toContain('Buchungstext');
    });

    it('Buchungszeile 19%: Brutto/S/Debitor 1400 an Erloes 8400, BU leer, Belegdatum TTMM', () => {
      const f = lines([inv()])[2].split(';');
      expect(f[0]).toBe('119,00'); // Umsatz brutto
      expect(f[1]).toBe('"S"'); // Soll
      expect(f[2]).toBe('"EUR"');
      expect(f[6]).toBe('1400'); // Konto = Debitor-Sammelkonto
      expect(f[7]).toBe('8400'); // Gegenkonto = Erloes 19%
      expect(f[8]).toBe(''); // BU-Schluessel leer (Automatikkonto)
      expect(f[9]).toBe('1501'); // Belegdatum TTMM (15.01.)
      expect(f[10]).toBe('"RE-2026-0001"'); // Belegfeld 1
      expect(f[13]).toBe('"Rechnung RE-2026-0001 Max Mustermann"'); // Buchungstext
    });

    it('Erloeskonto nach Steuersatz: 7% -> 8300, 0% -> 8195', () => {
      expect(lines([inv({ mwstSatz: 7 })])[2].split(';')[7]).toBe('8300');
      expect(lines([inv({ mwstSatz: 0 })])[2].split(';')[7]).toBe('8195');
    });
  });
});
