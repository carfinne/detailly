/**
 * Erzeugt aus dem ECHTEN XRechnung-Builder Beispiel-Dateien fuer die
 * KoSIT-Validierung in der CI (siehe .github/workflows/xrechnung-kosit.yml).
 *
 * Der Builder ist eine reine Funktion (nur `@nestjs/common` + reine Helfer, keine
 * DB, kein better-sqlite3) -> laedt aus `dist/` auch nach `npm ci --ignore-scripts`.
 * VOR dem Aufruf `npm run build` ausfuehren (erzeugt dist/).
 *
 * Es werden VIER Faelle erzeugt und alle validiert (alle muessen KoSIT-
 * AKZEPTABEL sein):
 *   1) sample.xrechnung.xml              – Regelbesteuerung 19 % (Kategorie S),
 *      vollstaendig konformer B2G-Fall (§14-Verkaeuferdaten, Geschaeftskunde mit
 *      Leitweg-ID, stimmige Betraege). Erfuellt BR-CO-25/26 und BR-DE-15.
 *   2) sample.xrechnung.kleinunternehmer.xml – §19-Kleinunternehmer (Kategorie E)
 *      mit 0 % und cbc:TaxExemptionReason (BR-E-10). Verkaeufer nur mit
 *      Steuernummer (kein USt-IdNr) -> exercised zusaetzlich BT-29
 *      (PartyIdentification, BR-CO-26).
 *   3) sample.xrechnung.storno.xml       – RECHNUNGSKORREKTUR / Vollstorno:
 *      InvoiceTypeCode 384 mit exakt NEGIERTEN Betraegen des Originals +
 *      cac:BillingReference (BG-3) auf die Ursprungsrechnung. Prueft den
 *      eigentlichen Kern dieses Pakets gegen den echten KoSIT-Validator:
 *      negative Summen (erlaubt bei 384) UND BR-27 (Einzelpreis >= 0, Vorzeichen
 *      in der Menge).
 *   4) sample.xrechnung.schlussrechnung.xml – SCHLUSSRECHNUNG MIT ANZAHLUNGSABZUG:
 *      NORMALE Handelsrechnung (Typ 380, KEIN korrekturVon) mit einer positiven
 *      Leistungs- und einer NEGATIVEN Anzahlungs-Position – exakt das, was
 *      InvoicesService bei einer Schlussrechnung erzeugt. Beweist, dass BR-27
 *      (Einzelpreis >= 0, Vorzeichen in der Menge) auch auf einer 380-Rechnung
 *      greift und der KoSIT-Validator die negative Zeile akzeptiert. Genau dieser
 *      Fall war zuvor ungetestet und erzeugte einen negativen cbc:PriceAmount.
 */
const fs = require('fs');
const path = require('path');
const { buildXRechnungXml } = require('../dist/e-invoice/xrechnung.builder');

// --- Fall 1: Regelbesteuerung 19 % (Kategorie S) -----------------------------
const tenant = {
  name: 'Detailly Musterbetrieb GmbH',
  street: 'Musterstrasse 12',
  city: 'Berlin',
  postalCode: '10115',
  country: 'DE',
  phone: '+49 30 1234567',
  email: 'rechnung@musterbetrieb.example',
  settings: {
    steuernummer: '29/123/45678',
    ustId: 'DE123456789',
    iban: 'DE02120300000000202051',
    bic: 'BYLADEM1001',
    bankname: 'Musterbank',
  },
};

const customer = {
  type: 'business',
  companyName: 'Behoerde Musterstadt',
  vatNumber: 'DE987654321',
  leitwegId: '04011000-1234512345-06',
  email: 'rechnungseingang@musterstadt.example',
  street: 'Rathausplatz 1',
  city: 'Musterstadt',
  postalCode: '90402',
  country: 'DE',
};

const invoice = {
  nummer: 'RE-2026-0001',
  art: 'rechnung',
  datum: '2026-07-01',
  faelligkeitsdatum: '2026-07-15',
  netto: 400,
  mwst: 76,
  brutto: 476,
  mwstSatz: 19,
  items: [
    { beschreibung: 'Fahrzeugaufbereitung Premium', menge: 1, einzelpreis: 400, gesamtpreis: 400 },
  ],
};

// --- Fall 2: §19-Kleinunternehmer 0 % (Kategorie E) --------------------------
// Nur Steuernummer (kein USt-IdNr) – typisch fuer Kleinunternehmer; erzwingt den
// BT-29-Pfad (PartyIdentification) UND die Kategorie E mit ExemptionReason.
const tenantKlein = {
  name: 'Glanzwerk Einzelunternehmen',
  street: 'Handwerkerweg 7',
  city: 'Leipzig',
  postalCode: '04109',
  country: 'DE',
  phone: '+49 341 7654321',
  email: 'buchhaltung@glanzwerk.example',
  settings: {
    steuernummer: '231/456/78901',
    iban: 'DE02120300000000202051',
    bic: 'BYLADEM1001',
    bankname: 'Sparkasse Leipzig',
    steuer: {
      kleinunternehmer: true,
      standardMwstSatz: 0,
      rechtsform: 'einzelunternehmen',
    },
  },
};

const customerKlein = {
  type: 'business',
  companyName: 'Behoerde Musterstadt',
  vatNumber: 'DE987654321',
  leitwegId: '04011000-1234512345-06',
  email: 'rechnungseingang@musterstadt.example',
  street: 'Rathausplatz 1',
  city: 'Musterstadt',
  postalCode: '90402',
  country: 'DE',
};

const invoiceKlein = {
  nummer: 'RE-2026-0002',
  art: 'rechnung',
  datum: '2026-07-02',
  faelligkeitsdatum: '2026-07-16',
  netto: 400,
  mwst: 0,
  brutto: 400,
  mwstSatz: 0,
  items: [
    { beschreibung: 'Fahrzeugaufbereitung Premium', menge: 1, einzelpreis: 400, gesamtpreis: 400 },
  ],
};

// --- Fall 3: Rechnungskorrektur / Vollstorno (InvoiceTypeCode 384) -----------
// Storno der Rechnung aus Fall 1 (RE-2026-0001): eigener Beleg, eigene Nummer,
// exakt negierte Betraege, Verweis (BG-3) auf das Original. Betraege werden – wie
// im echten Storno – bereits NEGIERT uebergeben (kein Neuberechnen). Der Builder
// dreht bei 384 nur das Vorzeichen der MENGE (BR-27: Einzelpreis >= 0). Kein
// Faelligkeitsdatum: ein Reversierungsbeleg ist sofort ausgeglichen.
const invoiceStorno = {
  nummer: 'RE-2026-0003',
  art: 'rechnung',
  datum: '2026-07-03',
  leistungsdatum: '2026-07-01',
  netto: -400,
  mwst: -76,
  brutto: -476,
  mwstSatz: 19,
  korrekturVon: { nummer: 'RE-2026-0001', datum: '2026-07-01' },
  items: [
    { beschreibung: 'Fahrzeugaufbereitung Premium', menge: 1, einzelpreis: -400, gesamtpreis: -400 },
  ],
};

// --- Fall 4: Schlussrechnung mit Anzahlungsabzug (Typ 380, NEGATIVE Position) --
// Normale Handelsrechnung (KEIN Storno, KEIN korrekturVon) mit einer bereits
// bezahlten Anzahlung als negativer Position – 1:1 die Struktur, die
// InvoicesService.createFromOrder fuer eine Schlussrechnung anlegt (menge 1,
// einzelpreis = -netto, gesamtpreis = -netto). Netto 400 - 150 = 250 (positiv,
// wie vom Abzug-Guard erzwungen); 19 % -> 47,50; brutto 297,50. Der Builder gibt
// die negative Zeile BR-27-konform aus (PriceAmount 150,00, Menge -1).
const invoiceSchluss = {
  nummer: 'RE-2026-0004',
  art: 'rechnung',
  datum: '2026-07-04',
  faelligkeitsdatum: '2026-07-18',
  netto: 250,
  mwst: 47.5,
  brutto: 297.5,
  mwstSatz: 19,
  items: [
    { beschreibung: 'Fahrzeugaufbereitung Premium', menge: 1, einzelpreis: 400, gesamtpreis: 400 },
    {
      beschreibung: 'Anzahlung RE-2026-0009 (bereits bezahlt)',
      menge: 1,
      einzelpreis: -150,
      gesamtpreis: -150,
    },
  ],
};

const faelle = [
  { datei: 'sample.xrechnung.xml', invoice, tenant, customer },
  {
    datei: 'sample.xrechnung.kleinunternehmer.xml',
    invoice: invoiceKlein,
    tenant: tenantKlein,
    customer: customerKlein,
  },
  { datei: 'sample.xrechnung.storno.xml', invoice: invoiceStorno, tenant, customer },
  { datei: 'sample.xrechnung.schlussrechnung.xml', invoice: invoiceSchluss, tenant, customer },
];

for (const f of faelle) {
  const xml = buildXRechnungXml(f.invoice, f.tenant, f.customer);
  const out = path.join(__dirname, '..', f.datei);
  fs.writeFileSync(out, xml, 'utf8');
  console.log(`Wrote ${out} (${xml.length} bytes)`);
}
