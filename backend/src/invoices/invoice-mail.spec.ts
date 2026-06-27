import { InvoicesService } from './invoices.service';
import { InvoiceKind } from './entities/invoice.entity';
import { CustomerType } from '../customers/entities/customer.entity';

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
});
