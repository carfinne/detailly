import { buildUebergabeprotokollDocDef, schadenZeile } from './uebergabeprotokoll-pdf';
import { createRobotoPrinter, renderPdf } from '../common/pdf/pdf-printer';

/**
 * Annahme-/Uebergabeprotokoll. Content-Checks ueber die reine Build-Funktion
 * (JSON-Stringify-Snapshot wie die uebrigen PDF-Tests) plus ein echter
 * Render-Durchlauf (nicht-leerer PDF-Buffer).
 */
const order: any = {
  auftragsnummer: 'AU-2026-0055',
  createdAt: new Date(Date.UTC(2026, 6, 5)),
};
const customer: any = { type: 'private', firstName: 'Erika', lastName: 'Beispiel', street: 'Musterweg 2', postalCode: '20095', city: 'Hamburg' };
const vehicle: any = { make: 'Audi', model: 'A4', licensePlate: 'HH-AB-42', vin: 'WAUZZZ123', color: 'Nardograu' };
const tenant: any = { name: 'Folienprofi', street: 'Werkweg 1', postalCode: '10115', city: 'Berlin', email: 'info@folienprofi.de' };

const annahme: any = {
  kmStand: 84250,
  tankstand: 60,
  schaeden: [
    { partLabel: 'Tür vorne links', art: 'kratzer', schweregrad: 'mittel', origin: 'vorschaden', ausmass: 'Streifer 20 cm' },
    { partLabel: 'Stoßfänger hinten', art: 'delle', schweregrad: 'leicht', origin: 'neu' },
  ],
};

describe('buildUebergabeprotokollDocDef', () => {
  it('enthaelt Titel, Fahrzeug, Km/Tank-Werte, Schadensliste, Haftungstext und beide Unterschriftslinien', () => {
    const json = JSON.stringify(buildUebergabeprotokollDocDef(order, customer, vehicle, tenant, annahme));
    expect(json).toContain('Annahme- / Übergabeprotokoll');
    expect(json).toContain('AU-2026-0055');
    expect(json).toContain('Audi A4');
    expect(json).toContain('HH-AB-42');
    expect(json).toContain('WAUZZZ123'); // FIN
    expect(json).toContain('84250 km');
    expect(json).toContain('60 %');
    expect(json).toContain('Tür vorne links – Kratzer (mittel, Vorschaden), Streifer 20 cm');
    expect(json).toContain('Stoßfänger hinten – Delle (leicht, Neu)');
    expect(json).toContain('gesetzlichen Bestimmungen'); // Haftungs-Standardtext
    expect(json).toContain('Unterschrift Kunde');
    expect(json).toContain('Unterschrift Betrieb');
  });

  it('ohne Annahme-Daten: leere Km/Tank-Zeilen + Hinweis, dass keine Schaeden hinterlegt sind', () => {
    const json = JSON.stringify(buildUebergabeprotokollDocDef(order, customer, vehicle, tenant, null));
    expect(json).toContain('_______________'); // Ausfuellzeile Km/Tank
    expect(json).toContain('Keine Schäden aus einer Annahme-Inspektion');
    // Trotzdem Haftungstext + Unterschriften vorhanden.
    expect(json).toContain('Unterschrift Kunde');
  });

  it('schadenZeile faellt robust auf partId/Fahrzeug + Rohwert zurueck', () => {
    expect(schadenZeile({ partId: 'tuer_vl', art: 'rost', schweregrad: 'schwer' })).toBe(
      'tuer_vl – Rost (schwer)',
    );
    expect(schadenZeile({})).toBe('Fahrzeug – Schaden');
  });

  it('rendert einen nicht-leeren PDF-Buffer', async () => {
    const buffer = await renderPdf(createRobotoPrinter(), buildUebergabeprotokollDocDef(order, customer, vehicle, tenant, annahme));
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
