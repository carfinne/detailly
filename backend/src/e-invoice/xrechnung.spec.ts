import { UnprocessableEntityException } from '@nestjs/common';
import {
  buildXRechnungXml,
  collectMissingXRechnungFields,
  escapeXml,
  XRECHNUNG_CUSTOMIZATION_ID,
  XRECHNUNG_PROFILE_ID,
  XrInvoice,
  XrTenant,
  XrCustomer,
} from './xrechnung.builder';

/**
 * Tests fuer den XRechnung-Builder. Reine Funktion ohne DB -> direkte Aufrufe mit
 * Plain-Objekten. HINWEIS: `assertWellFormed` ist ein LEICHTGEWICHTIGER
 * Tag-Balance-Check (kein XSD/Schematron). Die echte KoSIT-Validierung muss vor
 * Go-Live separat gegen den offiziellen Validator laufen.
 */

/** Minimaler Wohlgeformtheits-Check: Tag-Stack muss aufgehen (Inhalt ist escaped). */
function assertWellFormed(xml: string): void {
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, '');
  const tagRe = /<(\/?)([a-zA-Z][\w:.-]*)(\s[^>]*?)?(\/?)>/g;
  const stack: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(body))) {
    const closing = m[1] === '/';
    const selfClose = m[4] === '/';
    if (selfClose) continue;
    if (closing) {
      expect(stack.pop()).toBe(m[2]);
    } else {
      stack.push(m[2]);
    }
  }
  expect(stack).toHaveLength(0);
}

/** Summiert die LineExtensionAmount-Werte NUR innerhalb der InvoiceLine-Bloecke. */
function sumLineExtensions(xml: string): number {
  const lines: string[] = xml.match(/<cac:InvoiceLine>[\s\S]*?<\/cac:InvoiceLine>/g) ?? [];
  return lines.reduce((sum: number, block: string) => {
    const mm = block.match(/<cbc:LineExtensionAmount currencyID="EUR">([\d.]+)<\/cbc:LineExtensionAmount>/);
    return sum + (mm ? Number(mm[1]) : 0);
  }, 0);
}

const validTenant = (): XrTenant => ({
  name: 'Glanz GmbH',
  street: 'Hauptstr. 1',
  city: 'Berlin',
  postalCode: '10115',
  country: 'DE',
  phone: '030 1234567',
  email: 'info@glanz.de',
  settings: {
    steuernummer: '12/345/67890',
    ustId: 'DE123456789',
    iban: 'DE02120300000000202051',
    bic: 'BYLADEM1001',
    bankname: 'Test Bank',
  },
});

const validCustomer = (): XrCustomer => ({
  type: 'business',
  companyName: 'Fuhrpark AG',
  vatNumber: 'DE987654321',
  email: 'buchhaltung@fuhrpark.de',
  street: 'Werkstr. 5',
  city: 'Hamburg',
  postalCode: '20095',
  country: 'DE',
});

const validInvoice = (over: Partial<XrInvoice> = {}): XrInvoice => ({
  nummer: 'RE-2026-0001',
  art: 'rechnung',
  datum: new Date(2026, 0, 15),
  faelligkeitsdatum: new Date(2026, 0, 29),
  netto: 100,
  mwst: 19,
  brutto: 119,
  mwstSatz: 19,
  items: [{ beschreibung: 'Fahrzeugpolitur', menge: 1, einzelpreis: 100, gesamtpreis: 100 }],
  ...over,
});

describe('buildXRechnungXml', () => {
  it('erzeugt wohlgeformtes UBL-XML mit Deklaration und Wurzelelement', () => {
    const xml = buildXRechnungXml(validInvoice(), validTenant(), validCustomer());
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(
      '<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
    );
    expect(xml).toContain('</ubl:Invoice>');
    assertWellFormed(xml);
  });

  it('enthaelt CustomizationID + ProfileID der XRechnung 3.0', () => {
    const xml = buildXRechnungXml(validInvoice(), validTenant(), validCustomer());
    expect(xml).toContain(`<cbc:CustomizationID>${XRECHNUNG_CUSTOMIZATION_ID}</cbc:CustomizationID>`);
    expect(xml).toContain(`<cbc:ProfileID>${XRECHNUNG_PROFILE_ID}</cbc:ProfileID>`);
    expect(XRECHNUNG_CUSTOMIZATION_ID).toBe(
      'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0',
    );
  });

  it('mappt die Pflicht-BTs im Kopf (BT-1/2/3/5/9/10)', () => {
    const xml = buildXRechnungXml(validInvoice(), validTenant(), validCustomer());
    expect(xml).toContain('<cbc:ID>RE-2026-0001</cbc:ID>'); // BT-1
    expect(xml).toContain('<cbc:IssueDate>2026-01-15</cbc:IssueDate>'); // BT-2
    expect(xml).toContain('<cbc:DueDate>2026-01-29</cbc:DueDate>'); // BT-9
    expect(xml).toContain('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>'); // BT-3
    expect(xml).toContain('<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>'); // BT-5
    expect(xml).toContain('<cbc:BuyerReference>RE-2026-0001</cbc:BuyerReference>'); // BT-10
  });

  it('mappt den Verkaeufer (Name/Anschrift/Kontakt + BT-31 VAT und BT-32 FC)', () => {
    const xml = buildXRechnungXml(validInvoice(), validTenant(), validCustomer());
    expect(xml).toContain('<cbc:EndpointID schemeID="EM">info@glanz.de</cbc:EndpointID>'); // BT-34
    expect(xml).toContain('<cac:PartyName><cbc:Name>Glanz GmbH</cbc:Name></cac:PartyName>');
    expect(xml).toContain('<cbc:CityName>Berlin</cbc:CityName>');
    expect(xml).toContain('<cbc:PostalZone>10115</cbc:PostalZone>');
    // BT-31 USt-IdNr -> VAT-Schema, BT-32 Steuernummer -> FC-Schema
    expect(xml).toMatch(
      /<cac:PartyTaxScheme>\s*<cbc:CompanyID>DE123456789<\/cbc:CompanyID>\s*<cac:TaxScheme><cbc:ID>VAT<\/cbc:ID>/,
    );
    expect(xml).toMatch(
      /<cac:PartyTaxScheme>\s*<cbc:CompanyID>12\/345\/67890<\/cbc:CompanyID>\s*<cac:TaxScheme><cbc:ID>FC<\/cbc:ID>/,
    );
    // BR-DE-6/7: Kontakt Telefon + E-Mail
    expect(xml).toContain('<cbc:Telephone>030 1234567</cbc:Telephone>');
    expect(xml).toContain('<cbc:ElectronicMail>info@glanz.de</cbc:ElectronicMail>');
  });

  it('mappt den Kaeufer (BG-7) inkl. USt-IdNr und Anschrift', () => {
    const xml = buildXRechnungXml(validInvoice(), validTenant(), validCustomer());
    const buyer = xml.match(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/)![0];
    expect(buyer).toContain('<cbc:RegistrationName>Fuhrpark AG</cbc:RegistrationName>');
    expect(buyer).toContain('<cbc:CityName>Hamburg</cbc:CityName>');
    expect(buyer).toContain('<cbc:PostalZone>20095</cbc:PostalZone>');
    expect(buyer).toContain('<cbc:CompanyID>DE987654321</cbc:CompanyID>');
  });

  it('mappt die Zahlungsangaben (BG-16): SEPA-Code 58 + IBAN + BIC', () => {
    const xml = buildXRechnungXml(validInvoice(), validTenant(), validCustomer());
    expect(xml).toContain('<cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>');
    expect(xml).toContain('<cbc:ID>DE02120300000000202051</cbc:ID>');
    expect(xml).toContain('<cac:FinancialInstitutionBranch><cbc:ID>BYLADEM1001</cbc:ID>');
  });

  it('Steueraufschluesselung (BG-23): Steuer = Netto × Satz, Kategorie S', () => {
    const xml = buildXRechnungXml(validInvoice(), validTenant(), validCustomer());
    const tax = xml.match(/<cac:TaxTotal>[\s\S]*?<\/cac:TaxTotal>/)![0];
    expect(tax).toContain('<cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>');
    expect(tax).toContain('<cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount>');
    expect(tax).toContain('<cbc:ID>S</cbc:ID>');
    expect(tax).toContain('<cbc:Percent>19</cbc:Percent>');
  });

  it('Summen (BG-22): Netto/Netto/Brutto/Brutto stimmen', () => {
    const xml = buildXRechnungXml(validInvoice(), validTenant(), validCustomer());
    const totals = xml.match(/<cac:LegalMonetaryTotal>[\s\S]*?<\/cac:LegalMonetaryTotal>/)![0];
    expect(totals).toContain('<cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>');
    expect(totals).toContain('<cbc:TaxExclusiveAmount currencyID="EUR">100.00</cbc:TaxExclusiveAmount>');
    expect(totals).toContain('<cbc:TaxInclusiveAmount currencyID="EUR">119.00</cbc:TaxInclusiveAmount>');
    expect(totals).toContain('<cbc:PayableAmount currencyID="EUR">119.00</cbc:PayableAmount>');
  });

  it('Positionssummen: Σ LineExtensionAmount = Netto (BR-CO-10) bei mehreren Positionen', () => {
    const inv = validInvoice({
      netto: 200,
      mwst: 38,
      brutto: 238,
      mwstSatz: 19,
      items: [
        { beschreibung: 'Lackaufbereitung', menge: 1, einzelpreis: 120, gesamtpreis: 120 },
        { beschreibung: 'Innenreinigung', menge: 2, einzelpreis: 40, gesamtpreis: 80 },
      ],
    });
    const xml = buildXRechnungXml(inv, validTenant(), validCustomer());
    expect(sumLineExtensions(xml)).toBeCloseTo(200, 2);
    const tax = xml.match(/<cac:TaxTotal>[\s\S]*?<\/cac:TaxTotal>/)![0];
    // Steuer = Netto × Satz
    expect(tax).toContain('<cbc:TaxAmount currencyID="EUR">38.00</cbc:TaxAmount>');
    // Position 2: Menge 2, Einzelpreis 40, Zeilensumme 80
    const line2 = (xml.match(/<cac:InvoiceLine>[\s\S]*?<\/cac:InvoiceLine>/g) ?? [])[1];
    expect(line2).toContain('<cbc:InvoicedQuantity unitCode="C62">2</cbc:InvoicedQuantity>');
    expect(line2).toContain('<cbc:LineExtensionAmount currencyID="EUR">80.00</cbc:LineExtensionAmount>');
    expect(line2).toContain('<cbc:PriceAmount currencyID="EUR">40.00</cbc:PriceAmount>');
  });

  it('0 % (Kleinunternehmer): Kategorie Z, Percent 0, Brutto = Netto', () => {
    const inv = validInvoice({ netto: 100, mwst: 0, brutto: 100, mwstSatz: 0 });
    const xml = buildXRechnungXml(inv, validTenant(), validCustomer());
    const tax = xml.match(/<cac:TaxTotal>[\s\S]*?<\/cac:TaxTotal>/)![0];
    expect(tax).toContain('<cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount>');
    expect(tax).toContain('<cbc:ID>Z</cbc:ID>');
    expect(tax).toContain('<cbc:Percent>0</cbc:Percent>');
    expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="EUR">100.00</cbc:TaxInclusiveAmount>');
  });

  it('escaped Sonderzeichen in Name/Beschreibung (kein Broken-XML)', () => {
    const inv = validInvoice({
      items: [{ beschreibung: 'Polier & Schutz <Premium> "A"', menge: 1, einzelpreis: 100, gesamtpreis: 100 }],
    });
    const tenant = { ...validTenant(), name: 'Auto & Co <GmbH>' };
    const xml = buildXRechnungXml(inv, tenant, validCustomer());
    expect(xml).toContain('Polier &amp; Schutz &lt;Premium&gt; &quot;A&quot;');
    expect(xml).toContain('Auto &amp; Co &lt;GmbH&gt;');
    expect(xml).not.toContain('<Premium>');
    assertWellFormed(xml);
  });

  it('DueDate entfaellt ohne Faelligkeitsdatum', () => {
    const xml = buildXRechnungXml(
      validInvoice({ faelligkeitsdatum: null }),
      validTenant(),
      validCustomer(),
    );
    expect(xml).not.toContain('<cbc:DueDate>');
  });

  it('BR-CO-25: erzeugt PaymentTerms/Note (BT-20) wenn kein Faelligkeitsdatum', () => {
    const xml = buildXRechnungXml(
      validInvoice({ faelligkeitsdatum: null }),
      validTenant(),
      validCustomer(),
    );
    expect(xml).not.toContain('<cbc:DueDate>');
    const note = xml.match(/<cac:PaymentTerms>\s*<cbc:Note>([^<]*)<\/cbc:Note>\s*<\/cac:PaymentTerms>/);
    expect(note).not.toBeNull();
    // BR-DE-18: Note darf nicht mit '#' beginnen (sonst Skonto-Regel).
    expect(note![1].startsWith('#')).toBe(false);
    // UBL-Sequence: PaymentMeans -> PaymentTerms -> TaxTotal.
    const iMeans = xml.indexOf('<cac:PaymentMeans>');
    const iTerms = xml.indexOf('<cac:PaymentTerms>');
    const iTax = xml.indexOf('<cac:TaxTotal>');
    expect(iMeans).toBeLessThan(iTerms);
    expect(iTerms).toBeLessThan(iTax);
    assertWellFormed(xml);
  });

  it('BR-CO-25: bei gesetztem Faelligkeitsdatum DueDate, kein PaymentTerms', () => {
    const xml = buildXRechnungXml(validInvoice(), validTenant(), validCustomer());
    expect(xml).toContain('<cbc:DueDate>2026-01-29</cbc:DueDate>');
    expect(xml).not.toContain('<cac:PaymentTerms>');
  });

  it('BR-CO-26: Steuernummer-only -> PartyIdentification (BT-29) im Verkaeufer', () => {
    const tenant = { ...validTenant(), settings: { ...validTenant().settings, ustId: '' } };
    const xml = buildXRechnungXml(validInvoice(), tenant, validCustomer());
    const seller = xml.match(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/)![0];
    expect(seller).toContain(
      '<cac:PartyIdentification><cbc:ID>12/345/67890</cbc:ID></cac:PartyIdentification>',
    );
    // BT-32 (FC) bleibt fuer BR-S-02 erhalten.
    expect(seller).toContain('<cbc:ID>FC</cbc:ID>');
    // UBL-Sequence im Party: EndpointID -> PartyIdentification -> PartyName.
    const iEnd = seller.indexOf('<cbc:EndpointID');
    const iId = seller.indexOf('<cac:PartyIdentification>');
    const iName = seller.indexOf('<cac:PartyName>');
    expect(iEnd).toBeLessThan(iId);
    expect(iId).toBeLessThan(iName);
    assertWellFormed(xml);
  });

  it('BR-CO-26: mit USt-IdNr -> BT-31 (VAT), kein PartyIdentification im Verkaeufer', () => {
    const xml = buildXRechnungXml(validInvoice(), validTenant(), validCustomer());
    const seller = xml.match(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/)![0];
    expect(seller).toContain('<cbc:CompanyID>DE123456789</cbc:CompanyID>');
    expect(seller).toContain('<cbc:ID>VAT</cbc:ID>');
    expect(seller).not.toContain('<cac:PartyIdentification>');
  });
});

describe('escapeXml', () => {
  it('escaped alle fuenf XML-Sonderzeichen', () => {
    expect(escapeXml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &apos;');
  });
  it('entfernt ungueltige Steuerzeichen', () => {
    expect(escapeXml('a\x00b\x08c')).toBe('abc');
  });
});

describe('collectMissingXRechnungFields (Pflichtdaten-Guard)', () => {
  it('leere Liste bei vollstaendigen Daten', () => {
    expect(collectMissingXRechnungFields(validInvoice(), validTenant(), validCustomer())).toEqual([]);
  });

  it('meldet fehlende Verkaeufer-Steuernummer UND USt-IdNr', () => {
    const tenant = { ...validTenant(), settings: { ...validTenant().settings, steuernummer: '', ustId: '' } };
    const missing = collectMissingXRechnungFields(validInvoice(), tenant, validCustomer());
    expect(missing.some((m) => /Steuernummer oder USt-IdNr/.test(m))).toBe(true);
  });

  it('meldet fehlende Kaeufer-Anschrift (PLZ/Ort)', () => {
    const customer = { ...validCustomer(), city: '', postalCode: '' };
    const missing = collectMissingXRechnungFields(validInvoice(), validTenant(), customer);
    expect(missing).toContain('Kunde: PLZ');
    expect(missing).toContain('Kunde: Ort');
  });

  it('meldet fehlende IBAN und fehlenden Betriebs-Kontakt', () => {
    const tenant = {
      ...validTenant(),
      phone: '',
      email: '',
      settings: { ...validTenant().settings, iban: '' },
    };
    const missing = collectMissingXRechnungFields(validInvoice(), tenant, validCustomer());
    expect(missing.some((m) => /IBAN/.test(m))).toBe(true);
    expect(missing.some((m) => /Telefon/.test(m))).toBe(true);
    expect(missing.some((m) => /E-Mail/.test(m))).toBe(true);
  });

  it('Entwurf ohne Nummer -> Rechnungsnummer fehlt', () => {
    const missing = collectMissingXRechnungFields(
      validInvoice({ nummer: null }),
      validTenant(),
      validCustomer(),
    );
    expect(missing.some((m) => /Rechnungsnummer/.test(m))).toBe(true);
  });
});

describe('buildXRechnungXml Guard (422)', () => {
  it('wirft UnprocessableEntityException mit klarer Meldung bei fehlenden Pflichtdaten', () => {
    const customer = { ...validCustomer(), city: '', postalCode: '' };
    expect(() => buildXRechnungXml(validInvoice(), validTenant(), customer)).toThrow(
      UnprocessableEntityException,
    );
    try {
      buildXRechnungXml(validInvoice(), validTenant(), customer);
      fail('sollte werfen');
    } catch (e) {
      const resp = (e as UnprocessableEntityException).getResponse() as { message: string };
      expect(resp.message).toMatch(/fehlen Pflichtangaben/);
      expect(resp.message).toMatch(/Kunde: Ort/);
    }
  });

  it('wirft bei fehlendem Tenant (kein §14-Kontext -> nie ungueltiges XML)', () => {
    expect(() => buildXRechnungXml(validInvoice(), null, validCustomer())).toThrow(
      UnprocessableEntityException,
    );
  });
});
