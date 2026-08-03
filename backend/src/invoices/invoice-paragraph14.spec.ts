import { buildInvoiceDocDef, PdfInvoice, PdfCustomer, PdfTenant } from './invoice-pdf';
import { eur, datum } from '../common/util/format';
import { createRobotoPrinter, renderPdf } from '../common/pdf/pdf-printer';

/**
 * Beweis, dass beim Umbau auf den gemeinsamen Theme-Baustein NICHTS vom
 * Rechnungs-PDF verlorenging: eine vollstaendig gepflegte Rechnung wird gebaut und
 * jede §14-UStG-Pflichtangabe im erzeugten Dokument nachgewiesen (Feld fuer Feld,
 * inkl. Aussteller-Fuss + Firmierung). Zusaetzlich ein echter Render (nicht-leerer
 * PDF-Buffer). KEIN blosser "PDF ist nicht leer"-Test.
 */

/** Sammelt REKURSIV alle String-Werte einer pdfmake-Struktur (inkl. footer()). */
function alleStrings(node: unknown, acc: string[] = []): string[] {
  if (typeof node === 'string') acc.push(node);
  else if (Array.isArray(node)) node.forEach((n) => alleStrings(n, acc));
  else if (node && typeof node === 'object') Object.values(node).forEach((v) => alleStrings(v, acc));
  return acc;
}

function volltext(doc: Record<string, unknown>): string {
  const acc = alleStrings(doc.content);
  const footer = typeof doc.footer === 'function' ? (doc.footer as () => unknown)() : doc.footer;
  alleStrings(footer, acc);
  return acc.join('  ¶  ');
}

const vollRechnung: PdfInvoice = {
  nummer: 'RE-2026-0123',
  art: 'rechnung',
  datum: new Date(Date.UTC(2026, 6, 10)),
  leistungsdatum: new Date(Date.UTC(2026, 6, 8)),
  faelligkeitsdatum: new Date(Date.UTC(2026, 6, 24)),
  netto: 1000,
  mwst: 190,
  brutto: 1190,
  mwstSatz: 19,
  items: [
    { beschreibung: 'Fahrzeugaufbereitung Komplett', menge: 1, einzelpreis: 1000, gesamtpreis: 1000 },
  ],
};

const kunde: PdfCustomer = {
  type: 'business',
  companyName: 'Kunde AG',
  street: 'Kundenweg 5',
  postalCode: '80331',
  city: 'München',
};

const betrieb: PdfTenant = {
  name: 'Muster Aufbereitung GmbH',
  street: 'Musterstr. 1',
  postalCode: '10115',
  city: 'Berlin',
  phone: '030 1234567',
  email: 'rechnung@muster-aufbereitung.de',
  settings: {
    steuernummer: '12/345/67890',
    ustId: 'DE123456789',
    iban: 'DE02120300000000202051',
    bic: 'BYLADEM1001',
    bankname: 'Musterbank',
    rechnungFusstext: 'Zahlbar ohne Abzug.',
    steuer: {
      rechtsform: 'gmbh',
      registergericht: 'Amtsgericht Charlottenburg',
      registernummer: 'HRB 123456',
      vertretungsberechtigte: 'Erika Musterfrau',
    },
  },
};

describe('Rechnungs-PDF · §14-UStG-Vollstaendigkeit (nichts verlorengegangen)', () => {
  const text = volltext(buildInvoiceDocDef(vollRechnung, kunde, betrieb));

  it('Aussteller: vollstaendiger Name + Anschrift + Kontakt (§14 Abs.4 Nr.1)', () => {
    expect(text).toContain('Muster Aufbereitung GmbH');
    expect(text).toContain('Musterstr. 1');
    expect(text).toContain('10115 Berlin');
    expect(text).toContain('rechnung@muster-aufbereitung.de');
    expect(text).toContain('Tel. 030 1234567');
  });

  it('Leistungsempfaenger: vollstaendiger Name + Anschrift (§14 Abs.4 Nr.1)', () => {
    expect(text).toContain('Kunde AG');
    expect(text).toContain('Kundenweg 5');
    expect(text).toContain('80331 München');
  });

  it('Steuernummer / USt-IdNr. (§14 Abs.4 Nr.2)', () => {
    expect(text).toContain('Steuernummer: 12/345/67890');
    expect(text).toContain('USt-IdNr.: DE123456789');
  });

  it('Ausstellungsdatum, Leistungsdatum, Faelligkeit (§14 Abs.4 Nr.3 + Nr.6)', () => {
    expect(text).toContain(datum(vollRechnung.datum)); // 10.07.2026
    expect(text).toContain(datum(vollRechnung.leistungsdatum)); // 08.07.2026
    expect(text).toContain('Leistungsdatum');
    expect(text).toContain('Fällig bis');
    expect(text).toContain(datum(vollRechnung.faelligkeitsdatum));
  });

  it('Fortlaufende Rechnungsnummer (§14 Abs.4 Nr.4)', () => {
    expect(text).toContain('Belegnummer');
    expect(text).toContain('RE-2026-0123');
    expect(text).toContain('Rechnung RE-2026-0123'); // Titel
  });

  it('Menge/Art der Leistung (§14 Abs.4 Nr.5)', () => {
    expect(text).toContain('Fahrzeugaufbereitung Komplett');
    expect(text).toContain('Beschreibung');
    expect(text).toContain('Menge');
  });

  it('Entgelt netto, Steuersatz + Steuerbetrag, Bruttobetrag (§14 Abs.4 Nr.7+8)', () => {
    expect(text).toContain('Zwischensumme netto');
    expect(text).toContain(eur(1000));
    expect(text).toContain('zzgl. 19% MwSt');
    expect(text).toContain(eur(190));
    expect(text).toContain('Gesamtbetrag brutto');
    expect(text).toContain(eur(1190));
  });

  it('Geschaeftsbrief-Firmierung: Rechtsform, Sitz, Register, Vertretung (§37a HGB)', () => {
    expect(text).toContain('GmbH');
    expect(text).toContain('Sitz: Berlin');
    expect(text).toContain('Amtsgericht Charlottenburg HRB 123456');
    expect(text).toContain('Vertretungsberechtigt: Erika Musterfrau');
  });

  it('Bankverbindung + freier Betriebs-Fusstext im Fuss', () => {
    expect(text).toContain('IBAN DE02120300000000202051');
    expect(text).toContain('BIC BYLADEM1001');
    expect(text).toContain('Musterbank');
    expect(text).toContain('Zahlbar ohne Abzug.');
  });

  it('dezenter Detailly-Fusshinweis vorhanden, aber KEIN "undefined" im Dokument', () => {
    expect(text).toContain('Erstellt mit Detailly');
    expect(text).not.toContain('undefined');
  });

  it('rendert einen validen, nicht-leeren PDF-Buffer (%PDF)', async () => {
    const buffer = await renderPdf(createRobotoPrinter(), buildInvoiceDocDef(vollRechnung, kunde, betrieb));
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });
});
