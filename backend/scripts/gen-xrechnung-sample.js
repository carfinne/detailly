/**
 * Erzeugt aus dem ECHTEN XRechnung-Builder Beispiel-Dateien fuer die
 * KoSIT-Validierung in der CI (siehe .github/workflows/xrechnung-kosit.yml).
 *
 * Der Builder ist eine reine Funktion (nur `@nestjs/common` + reine Helfer, keine
 * DB, kein better-sqlite3) -> laedt aus `dist/` auch nach `npm ci --ignore-scripts`.
 * VOR dem Aufruf `npm run build` ausfuehren (erzeugt dist/).
 *
 * Es werden DREI Faelle erzeugt und alle validiert (alle muessen KoSIT-
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

const faelle = [
  { datei: 'sample.xrechnung.xml', invoice, tenant, customer },
  {
    datei: 'sample.xrechnung.kleinunternehmer.xml',
    invoice: invoiceKlein,
    tenant: tenantKlein,
    customer: customerKlein,
  },
  { datei: 'sample.xrechnung.storno.xml', invoice: invoiceStorno, tenant, customer },
];

for (const f of faelle) {
  const xml = buildXRechnungXml(f.invoice, f.tenant, f.customer);
  const out = path.join(__dirname, '..', f.datei);
  fs.writeFileSync(out, xml, 'utf8');
  console.log(`Wrote ${out} (${xml.length} bytes)`);
}
