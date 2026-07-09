import { InvoicesService } from './invoices.service';
import { InvoiceKind } from './entities/invoice.entity';
import { CustomerType } from '../customers/entities/customer.entity';
import { buildMahnungDocDef } from './invoice-pdf';

/**
 * Tests fuer die Beleg-Mail-Texte (buildBelegMail / kundenAnrede). Reine Logik
 * ohne DB – alle Deps als Platzhalter, wie in invoice-rounding.spec.
 */
describe('InvoicesService E-Mail-Texte', () => {
  const svc = new InvoicesService(
    {} as any, // repo
    {} as any, // itemRepo
    {} as any, // orderRepo
    {} as any, // customerRepo
    {} as any, // tenantRepo
    {} as any, // audit
    {} as any, // sevdesk
    {} as any, // pdf
    {} as any, // mail
    {} as any, // accExport
  );
  const buildBelegMail = (inv: any, cust: any, ten: any) => (svc as any).buildBelegMail(inv, cust, ten);
  const anrede = (c: any): string => (svc as any).kundenAnrede(c);

  it('Rechnung: Betreff, Anrede, Betrag (de) und Fälligkeit', () => {
    const inv = {
      art: InvoiceKind.RECHNUNG,
      nummer: 'RE-2026-0001',
      brutto: 119,
      faelligkeitsdatum: new Date(2026, 6, 15),
    };
    const cust = { type: CustomerType.PRIVATE, firstName: 'Max', lastName: 'Mustermann' };
    const m = buildBelegMail(inv, cust, { name: 'Glanz GmbH' });
    expect(m.subject).toBe('Rechnung RE-2026-0001 von Glanz GmbH');
    expect(m.text).toContain('Guten Tag Max Mustermann,');
    expect(m.text).toContain('119,00 €');
    expect(m.text).toContain('15.07.2026');
    expect(m.text).toContain('Mit freundlichen Grüßen');
    expect(m.html).toContain('<p');
  });

  it('Angebot: Betreff nennt Angebot, keine Zahlungsaufforderung', () => {
    const inv = { art: InvoiceKind.ANGEBOT, nummer: 'AN-2026-0007', brutto: 50 };
    const m = buildBelegMail(inv, { type: CustomerType.BUSINESS, companyName: 'Auto Meier' }, { name: 'Glanz GmbH' });
    expect(m.subject).toBe('Angebot AN-2026-0007 von Glanz GmbH');
    expect(m.text).toContain('Guten Tag Auto Meier,');
    expect(m.text).toContain('Angebot AN-2026-0007');
    expect(m.text).not.toContain('Zahlung bis');
  });

  it('ohne Tenant-Name -> Fallback im Betreff', () => {
    const m = buildBelegMail({ art: InvoiceKind.RECHNUNG, nummer: 'RE-1', brutto: 10 }, null, null);
    expect(m.subject).toBe('Rechnung RE-1 von Ihr Aufbereitungsbetrieb');
    expect(m.text).toContain('Guten Tag,');
  });

  it('Anrede: Geschäftskunde -> Firma, Privat -> Name, leer -> generisch', () => {
    expect(anrede({ type: CustomerType.BUSINESS, companyName: 'Auto Meier' })).toBe('Guten Tag Auto Meier,');
    expect(anrede({ type: CustomerType.PRIVATE, firstName: 'Lisa', lastName: 'Klein' })).toBe('Guten Tag Lisa Klein,');
    expect(anrede(null)).toBe('Guten Tag,');
    expect(anrede({ type: CustomerType.PRIVATE })).toBe('Guten Tag,');
  });

  it('HTML escaped Sonderzeichen im Namen', () => {
    const m = buildBelegMail(
      { art: InvoiceKind.RECHNUNG, nummer: 'RE-1', brutto: 10 },
      { type: CustomerType.BUSINESS, companyName: 'A & B <Co>' },
      { name: 'X' },
    );
    expect(m.html).toContain('A &amp; B &lt;Co&gt;');
    expect(m.html).not.toContain('A & B <Co>');
  });

  const buildMahnungMail = (inv: any, cust: any, ten: any, stufe: number, bis: Date, gebuehr?: number) =>
    (svc as any).buildMahnungMail(inv, cust, ten, stufe, bis, gebuehr);

  it('Mahnung Stufe 1: Betreff Zahlungserinnerung, gegenstandslos-Hinweis', () => {
    const m = buildMahnungMail(
      { art: InvoiceKind.RECHNUNG, nummer: 'RE-2026-0001', brutto: 119 },
      { type: CustomerType.PRIVATE, firstName: 'Max', lastName: 'Mustermann' },
      { name: 'Glanz GmbH' },
      1,
      new Date(2026, 6, 22),
    );
    expect(m.subject).toBe('Zahlungserinnerung: Rechnung RE-2026-0001 von Glanz GmbH');
    expect(m.text).toContain('gegenstandslos');
    expect(m.text).toContain('Ausgleich bis zum 22.07.2026');
    expect(m.text).toContain('119,00 €');
  });

  it('Mahnung Stufe 2: Betreff "1. Mahnung", ohne gegenstandslos', () => {
    const m = buildMahnungMail(
      { art: InvoiceKind.RECHNUNG, nummer: 'RE-2026-0002', brutto: 50 },
      { type: CustomerType.BUSINESS, companyName: 'Auto Meier' },
      { name: 'Glanz GmbH' },
      2,
      new Date(2026, 6, 22),
    );
    expect(m.subject).toBe('1. Mahnung: Rechnung RE-2026-0002 von Glanz GmbH');
    expect(m.text).not.toContain('gegenstandslos');
    expect(m.text).toContain('kein Zahlungseingang');
  });

  it('Mahnung Stufe 2 mit Gebühr: weist Gebühr + Gesamtbetrag (brutto+Gebühr) aus', () => {
    const m = buildMahnungMail(
      { art: InvoiceKind.RECHNUNG, nummer: 'RE-2026-0003', brutto: 119 },
      { type: CustomerType.PRIVATE, firstName: 'Max', lastName: 'Mustermann' },
      { name: 'Glanz GmbH' },
      2,
      new Date(2026, 6, 22),
      5,
    );
    // brutto 119 + Gebühr 5 = 124 (Gesamt-Zahlbetrag).
    expect(m.text).toContain('Mahngebühr 5,00 €');
    expect(m.text).toContain('offene Gesamtbetrag 124,00 €');
    expect(m.text).toContain('Ausgleich des Gesamtbetrags bis zum 22.07.2026');
  });

  it('Mahnung Stufe 1 ohne Gebühr: unverändert brutto, keine Gebühr-Zeile', () => {
    const m = buildMahnungMail(
      { art: InvoiceKind.RECHNUNG, nummer: 'RE-2026-0004', brutto: 119 },
      { type: CustomerType.PRIVATE, firstName: 'Max', lastName: 'Mustermann' },
      { name: 'Glanz GmbH' },
      1,
      new Date(2026, 6, 22),
    );
    expect(m.text).not.toContain('Mahngebühr');
    expect(m.text).not.toContain('Gesamtbetrag');
    expect(m.text).toContain('119,00 €');
    expect(m.text).toContain('Ausgleich bis zum 22.07.2026');
  });
});

describe('buildMahnungDocDef (Mahn-PDF)', () => {
  const baseInvoice = {
    nummer: 'RE-2026-0009',
    art: 'rechnung',
    datum: new Date(2026, 5, 1),
    faelligkeitsdatum: new Date(2026, 5, 15),
    netto: 100,
    mwst: 19,
    brutto: 119,
  };

  it('Stufe 1 -> Titel Zahlungserinnerung, enthält Rechnungsnummer + Betrag', () => {
    const def = buildMahnungDocDef(baseInvoice as any, { firstName: 'Max', lastName: 'M' } as any, { name: 'Glanz GmbH' } as any, {
      mahnstufe: 1,
      mahndatum: new Date(2026, 6, 1),
      zahlbarBis: new Date(2026, 6, 8),
      tageUeberfaellig: 17,
    });
    const flat = JSON.stringify(def);
    expect(flat).toContain('Zahlungserinnerung');
    expect(flat).toContain('RE-2026-0009');
    expect(flat).toContain('Glanz GmbH');
    expect(Array.isArray((def as any).content)).toBe(true);
  });

  it('Stufe 3 -> Titel "2. Mahnung"', () => {
    const def = buildMahnungDocDef(baseInvoice as any, null, { name: 'X' } as any, {
      mahnstufe: 3,
      mahndatum: new Date(2026, 6, 1),
      zahlbarBis: new Date(2026, 6, 8),
      tageUeberfaellig: 30,
    });
    expect(JSON.stringify(def)).toContain('2. Mahnung');
  });

  it('mit Gebühr: separater Posten Mahngebühr + Zahlbetrag (brutto+Gebühr)', () => {
    const def = buildMahnungDocDef(baseInvoice as any, null, { name: 'X' } as any, {
      mahnstufe: 2,
      mahndatum: new Date(2026, 6, 1),
      zahlbarBis: new Date(2026, 6, 8),
      tageUeberfaellig: 20,
      gebuehr: 5,
      gesamtbetrag: 124, // brutto 119 + Gebühr 5
    });
    const flat = JSON.stringify(def);
    expect(flat).toContain('Mahngebühr');
    expect(flat).toContain('Zu zahlen');
    expect(flat).toContain('124,00');
  });

  it('ohne Gebühr: kein Mahngebühr-Posten, Zahlbetrag = brutto', () => {
    const def = buildMahnungDocDef(baseInvoice as any, null, { name: 'X' } as any, {
      mahnstufe: 1,
      mahndatum: new Date(2026, 6, 1),
      zahlbarBis: new Date(2026, 6, 8),
      tageUeberfaellig: 10,
    });
    const flat = JSON.stringify(def);
    expect(flat).not.toContain('Mahngebühr');
    expect(flat).not.toContain('Zu zahlen');
    expect(flat).toContain('119,00');
  });
});
