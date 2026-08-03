import { readEInvoiceXml } from './xml-reader';

/**
 * Realistisches UBL-Beispiel (EN 16931, Invoice-2). Enthaelt BEWUSST auch eine
 * Kaeufer-Partei MIT eigener Anschrift, damit der Test beweist, dass der Reader
 * die Verkaeufer-Felder korrekt ankert (kein Buyer-Leak).
 */
const UBL_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>
  <cbc:ID>RE-2026-0042</cbc:ID>
  <cbc:IssueDate>2026-07-01</cbc:IssueDate>
  <cbc:DueDate>2026-07-15</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>04011000-12345-06</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Lieferant Muster GmbH</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Industriestr. 5</cbc:StreetName>
        <cbc:CityName>Musterstadt</cbc:CityName>
        <cbc:PostalZone>12345</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>DE123456789</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>151/815/08154</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>Lieferant Muster GmbH</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Detailly Betrieb</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Werkstattweg 1</cbc:StreetName>
        <cbc:CityName>Autohausen</cbc:CityName>
        <cbc:PostalZone>54321</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>DE02120300000000202051</cbc:ID>
      <cac:FinancialInstitutionBranch><cbc:ID>BYLADEM1001</cbc:ID></cac:FinancialInstitutionBranch>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">100.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">119.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">119.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</ubl:Invoice>`;

/** Realistisches CII-Beispiel (EN 16931, CrossIndustryInvoice, CII-Datumsformat 102). */
const CII_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocument>
    <ram:ID>ZF-2026-0007</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">20260701</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>04011000-12345-06</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>Grosshandel Beispiel AG</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>80331</ram:PostcodeCode>
          <ram:LineOne>Handelsplatz 9</ram:LineOne>
          <ram:CityName>Muenchen</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">DE987654321</ram:ID></ram:SpecifiedTaxRegistration>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">143/824/06315</ram:ID></ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>Detailly Betrieb</ram:Name>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime><udt:DateTimeString format="102">20260630</udt:DateTimeString></ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>DE21700519950000007229</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
        <ram:PayeeSpecifiedCreditorFinancialInstitution>
          <ram:BICID>GENODEF1M06</ram:BICID>
        </ram:PayeeSpecifiedCreditorFinancialInstitution>
      </ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime><udt:DateTimeString format="102">20260721</udt:DateTimeString></ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>200.00</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>200.00</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">38.00</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>238.00</ram:GrandTotalAmount>
        <ram:DuePayableAmount>238.00</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

/**
 * UBL-GUTSCHRIFT (CreditNote-2, Typ 381) – so schickt ein Lieferant eine
 * Korrektur/Gutschrift mit POSITIVEN Betraegen. Eigene Wurzel `CreditNote` und
 * `cbc:CreditNoteTypeCode` (statt Invoice/InvoiceTypeCode); Kopf-/Summen-Pfade
 * sind identisch zur Invoice. Beweist, dass der Eingang eine 381-Gutschrift liest.
 */
const UBL_CREDITNOTE_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<ubl:CreditNote xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>
  <cbc:ID>GS-2026-0009</cbc:ID>
  <cbc:IssueDate>2026-07-05</cbc:IssueDate>
  <cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>04011000-12345-06</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Zulieferer Gutschrift GmbH</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Rueckweg 3</cbc:StreetName>
        <cbc:CityName>Bremen</cbc:CityName>
        <cbc:PostalZone>28195</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>DE222333444</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>Zulieferer Gutschrift GmbH</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Detailly Betrieb</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>DE21700519950000007229</cbc:ID>
      <cac:FinancialInstitutionBranch><cbc:ID>GENODEF1M06</cbc:ID></cac:FinancialInstitutionBranch>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">9.50</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">50.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">9.50</cbc:TaxAmount>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">50.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">50.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">59.50</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">59.50</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</ubl:CreditNote>`;

/**
 * UBL-RECHNUNGSKORREKTUR (Invoice-2, Typ 384) mit NEGATIVEN Summen – exakt das,
 * was unser eigener Builder fuer einen Vollstorno erzeugt. Wurzel bleibt Invoice.
 */
const UBL_KORREKTUR_384_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>RE-2026-0003</cbc:ID>
  <cbc:IssueDate>2026-07-03</cbc:IssueDate>
  <cbc:InvoiceTypeCode>384</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>RE-2026-0003</cbc:BuyerReference>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>RE-2026-0001</cbc:ID>
      <cbc:IssueDate>2026-07-01</cbc:IssueDate>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyLegalEntity><cbc:RegistrationName>Lieferant Muster GmbH</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">-19.00</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="EUR">-100.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">-119.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">-119.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</ubl:Invoice>`;

export { UBL_SAMPLE, CII_SAMPLE, UBL_CREDITNOTE_SAMPLE, UBL_KORREKTUR_384_SAMPLE };

describe('readEInvoiceXml – UBL', () => {
  const f = readEInvoiceXml(UBL_SAMPLE);

  it('erkennt die UBL-Syntax', () => expect(f.syntax).toBe('ubl'));
  it('liest Kopf-/Referenzfelder', () => {
    expect(f.rechnungsnummer).toBe('RE-2026-0042');
    expect(f.rechnungsdatum).toBe('2026-07-01');
    expect(f.faelligkeitsdatum).toBe('2026-07-15');
    expect(f.rechnungstyp).toBe('380');
    expect(f.waehrung).toBe('EUR');
    expect(f.leitwegId).toBe('04011000-12345-06');
  });
  it('liest den VERKAEUFER (nicht den Kaeufer) inkl. Anschrift/Steuer-IDs', () => {
    expect(f.verkaeuferName).toBe('Lieferant Muster GmbH');
    expect(f.verkaeuferAnschrift).toBe('Industriestr. 5, 12345 Musterstadt, DE');
    expect(f.verkaeuferUstId).toBe('DE123456789');
    expect(f.verkaeuferSteuernummer).toBe('151/815/08154');
  });
  it('liest Summen + Zahlungsdaten', () => {
    expect(f.nettoBetrag).toBe(100);
    expect(f.mwstBetrag).toBe(19);
    expect(f.bruttoBetrag).toBe(119);
    expect(f.zahlbetrag).toBe(119);
    expect(f.iban).toBe('DE02120300000000202051');
    expect(f.bic).toBe('BYLADEM1001');
  });
});

describe('readEInvoiceXml – CII', () => {
  const f = readEInvoiceXml(CII_SAMPLE);

  it('erkennt die CII-Syntax', () => expect(f.syntax).toBe('cii'));
  it('liest Kopf-/Referenzfelder inkl. CII-Datumsformat 102', () => {
    expect(f.rechnungsnummer).toBe('ZF-2026-0007');
    expect(f.rechnungsdatum).toBe('2026-07-01');
    expect(f.faelligkeitsdatum).toBe('2026-07-21');
    expect(f.leistungsdatum).toBe('2026-06-30');
    expect(f.waehrung).toBe('EUR');
    expect(f.leitwegId).toBe('04011000-12345-06');
  });
  it('liest den VERKAEUFER (nicht den Kaeufer)', () => {
    expect(f.verkaeuferName).toBe('Grosshandel Beispiel AG');
    expect(f.verkaeuferAnschrift).toBe('Handelsplatz 9, 80331 Muenchen, DE');
    expect(f.verkaeuferUstId).toBe('DE987654321');
    expect(f.verkaeuferSteuernummer).toBe('143/824/06315');
  });
  it('liest Summen + Zahlungsdaten', () => {
    expect(f.nettoBetrag).toBe(200);
    expect(f.mwstBetrag).toBe(38);
    expect(f.bruttoBetrag).toBe(238);
    expect(f.zahlbetrag).toBe(238);
    expect(f.iban).toBe('DE21700519950000007229');
    expect(f.bic).toBe('GENODEF1M06');
  });
});

describe('readEInvoiceXml – Korrekturbelege (Eingang von Lieferanten)', () => {
  it('UBL-Gutschrift (Wurzel CreditNote, Typ 381) wird als UBL gelesen (kein "unbekannt")', () => {
    const f = readEInvoiceXml(UBL_CREDITNOTE_SAMPLE);
    expect(f.syntax).toBe('ubl');
    expect(f.rechnungsnummer).toBe('GS-2026-0009');
    // Typ-Code kommt bei der Gutschrift aus CreditNoteTypeCode.
    expect(f.rechnungstyp).toBe('381');
    expect(f.verkaeuferName).toBe('Zulieferer Gutschrift GmbH');
    expect(f.verkaeuferUstId).toBe('DE222333444');
    expect(f.nettoBetrag).toBe(50);
    expect(f.mwstBetrag).toBe(9.5);
    expect(f.bruttoBetrag).toBe(59.5);
    expect(f.zahlbetrag).toBe(59.5);
    expect(f.iban).toBe('DE21700519950000007229');
    expect(f.bic).toBe('GENODEF1M06');
  });

  it('UBL-Rechnungskorrektur (Wurzel Invoice, Typ 384, negative Summen) wird gelesen', () => {
    const f = readEInvoiceXml(UBL_KORREKTUR_384_SAMPLE);
    expect(f.syntax).toBe('ubl');
    expect(f.rechnungstyp).toBe('384');
    expect(f.verkaeuferName).toBe('Lieferant Muster GmbH');
    // Negative Summen werden korrekt (mit Vorzeichen) ausgelesen.
    expect(f.nettoBetrag).toBe(-100);
    expect(f.mwstBetrag).toBe(-19);
    expect(f.bruttoBetrag).toBe(-119);
    expect(f.zahlbetrag).toBe(-119);
  });
});

describe('readEInvoiceXml – Fehlertoleranz & Sicherheit', () => {
  it('kein verwertbares XML / kein bekanntes Wurzelelement -> unbekannt (nie werfend)', () => {
    expect(readEInvoiceXml('<cbc:ID>fragment ohne wurzel').syntax).toBe('unbekannt');
    expect(readEInvoiceXml('das ist gar kein xml').syntax).toBe('unbekannt');
    expect(readEInvoiceXml('').syntax).toBe('unbekannt');
  });

  it('unbekanntes Wurzelelement (weder Invoice/CreditNote noch CrossIndustryInvoice) -> unbekannt', () => {
    expect(readEInvoiceXml('<Bestellung><ID>1</ID></Bestellung>').syntax).toBe('unbekannt');
  });

  it('tolerant: abgeschnittenes, aber gewurzeltes UBL bleibt UBL (Kernfelder best effort)', () => {
    const f = readEInvoiceXml('<ubl:Invoice><cbc:ID>RE-1</cbc:ID>');
    expect(f.syntax).toBe('ubl');
    expect(f.rechnungsnummer).toBe('RE-1');
    expect(f.bruttoBetrag).toBeUndefined(); // -> Service leitet TEILWEISE/NICHT_LESBAR ab
  });

  it('loest KEINE externen/internen Entities auf (XXE-sicher)', () => {
    const xxe = `<?xml version="1.0"?>
<!DOCTYPE ubl:Invoice [ <!ENTITY xxe "GEHEIM"> ]>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>&xxe;</cbc:ID>
</ubl:Invoice>`;
    const f = readEInvoiceXml(xxe);
    expect(f.syntax).toBe('ubl'); // DOCTYPE crasht den Parser nicht
    expect(f.rechnungsnummer).not.toBe('GEHEIM'); // Entity NICHT expandiert
  });

  it('teilweises XML: Format erkannt, aber Kernfelder fehlen', () => {
    const f = readEInvoiceXml(
      `<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"><rsm:ExchangedDocument><ram:ID xmlns:ram="x">NUR-NR</ram:ID></rsm:ExchangedDocument></rsm:CrossIndustryInvoice>`,
    );
    expect(f.syntax).toBe('cii');
    expect(f.rechnungsnummer).toBe('NUR-NR');
    expect(f.bruttoBetrag).toBeUndefined();
  });

  it('DoS-Haertung: 1-MB-Attribut-Lauf ohne "=" haengt NICHT (kein O(L²)-Backtracking)', () => {
    // Vor dem Fix fror die greedy Attribut-Regex den Event-Loop ein
    // (40k -> ~9 s, 200k -> Timeout). Jetzt linear + Laengen-Kappung.
    const xml =
      '<ubl:Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" ' +
      'a'.repeat(1_000_000) +
      '></ubl:Invoice>';
    const t0 = Date.now();
    const f = readEInvoiceXml(xml);
    const dt = Date.now() - t0;
    expect(dt).toBeLessThan(200); // < 200 ms statt Sekunden
    expect(f.syntax).toBeDefined(); // kein Crash; tolerant (ubl-Wurzel erkannt)
    expect(f.bruttoBetrag).toBeUndefined(); // keine Kernfelder -> Service: nicht_lesbar
  });

  it('DoS-Haertung: viele winzige <!>-Tokens haengen NICHT (zweiter O(n²)-Pfad)', () => {
    // Vor dem Fix scannte im <!>-Zweig `indexOf('[')` je Token bis EOF
    // (1,2 MB -> 19 s). Jetzt token-lokale '['-Suche + MAX_NODES-Zaehlung.
    const payload = '<!>'.repeat(400_000); // ~1,2 MB reine <!>-Tokens
    const t0 = Date.now();
    const f = readEInvoiceXml(payload);
    const dt = Date.now() - t0;
    expect(dt).toBeLessThan(150); // < 150 ms statt ~19 s
    expect(f.syntax).toBe('unbekannt'); // kein Wurzelelement -> tolerant
  });

  it('DoS-Haertung: legitime DOCTYPE-/Kommentar-/CDATA-Faelle bleiben tolerant', () => {
    // Der O(n)-Umbau des <!>-Zweigs darf gueltige Sonderkonstrukte nicht brechen.
    const xml = `<?xml version="1.0"?>
<!-- Kommentar mit > und ] Zeichen -->
<!DOCTYPE ubl:Invoice [ <!ENTITY x "y"> ]>
<ubl:Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID><![CDATA[RE-42]]></cbc:ID>
</ubl:Invoice>`;
    const f = readEInvoiceXml(xml);
    expect(f.syntax).toBe('ubl');
    expect(f.rechnungsnummer).toBe('RE-42'); // CDATA-Inhalt korrekt gelesen
  });

  it('DoS-Haertung: schemeID wird bei NORMALEN Tags weiterhin gelesen (Kappung trifft Legit nie)', () => {
    // Beweist, dass die Attribut-Kappung echte, kleine Attribute nicht bricht:
    // die USt-IdNr/Steuernr-Unterscheidung haengt an schemeID.
    const f = readEInvoiceXml(
      `<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="x">
        <rsm:SupplyChainTradeTransaction><ram:ApplicableHeaderTradeAgreement><ram:SellerTradeParty>
          <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">DE111222333</ram:ID></ram:SpecifiedTaxRegistration>
        </ram:SellerTradeParty></ram:ApplicableHeaderTradeAgreement></rsm:SupplyChainTradeTransaction>
      </rsm:CrossIndustryInvoice>`,
    );
    expect(f.verkaeuferUstId).toBe('DE111222333');
  });
});
