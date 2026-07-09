/**
 * Erzeugt aus dem ECHTEN XRechnung-Builder eine Beispiel-Datei fuer die
 * KoSIT-Validierung in der CI (siehe .github/workflows/xrechnung-kosit.yml).
 *
 * Der Builder ist eine reine Funktion (nur `@nestjs/common`, keine DB, kein
 * better-sqlite3) -> laedt aus `dist/` auch nach `npm ci --ignore-scripts`.
 * VOR dem Aufruf `npm run build` ausfuehren (erzeugt dist/).
 *
 * Fixture = vollstaendig konformer B2G-Fall (gueltige §14-Verkaeuferdaten,
 * Geschaeftskunde mit Leitweg-ID, stimmige Betraege). Absichtlich so gewaehlt,
 * dass BR-CO-25 (Faelligkeit), BR-CO-26 (USt-IdNr) und BR-DE-15 (Leitweg-ID)
 * erfuellt sind.
 */
const fs = require('fs');
const path = require('path');
const { buildXRechnungXml } = require('../dist/e-invoice/xrechnung.builder');

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

const xml = buildXRechnungXml(invoice, tenant, customer);
const out = path.join(__dirname, '..', 'sample.xrechnung.xml');
fs.writeFileSync(out, xml, 'utf8');
console.log(`Wrote ${out} (${xml.length} bytes)`);
