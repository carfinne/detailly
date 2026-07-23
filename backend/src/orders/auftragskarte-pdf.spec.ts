import { buildAuftragskarteDocDef, leistungsCheckliste, terminText } from './auftragskarte-pdf';
import { createRobotoPrinter, renderPdf } from '../common/pdf/pdf-printer';

/**
 * Auftragskarte (Werkstatt-Laufzettel). Content-Checks ueber die reine
 * Build-Funktion (JSON-Stringify-Snapshot wie die uebrigen PDF-Tests) plus ein
 * echter Render-Durchlauf, der einen nicht-leeren PDF-Buffer belegt.
 */
const order: any = {
  auftragsnummer: 'AU-2026-0042',
  serviceType: 'folierung',
  geplanterStart: new Date(Date.UTC(2026, 6, 1)),
  geplantesEnde: new Date(Date.UTC(2026, 6, 3)),
  items: [
    { beschreibung: 'Teilfolierung Dach', typ: 'leistung' },
    { beschreibung: 'Scheibentönung', typ: 'leistung' },
    { beschreibung: 'Folie 3M 2080', typ: 'material' },
  ],
};
const customer: any = { type: 'private', firstName: 'Max', lastName: 'Muster', phone: '0151 12345' };
const vehicle: any = { make: 'BMW', model: 'M3', licensePlate: 'B-XY-123' };
const tenant: any = { name: 'Glanzwerk GmbH', street: 'Werkweg 1', postalCode: '10115', city: 'Berlin', phone: '030 111' };

describe('buildAuftragskarteDocDef', () => {
  it('enthaelt Auftragsnr., Kunde+Telefon, Fahrzeug/Kennzeichen, Termin und die Leistungs-Checkliste', () => {
    const json = JSON.stringify(buildAuftragskarteDocDef(order, customer, vehicle, tenant));
    expect(json).toContain('Auftragskarte');
    expect(json).toContain('AU-2026-0042');
    expect(json).toContain('Max Muster');
    expect(json).toContain('0151 12345');
    expect(json).toContain('B-XY-123');
    expect(json).toContain('BMW M3');
    expect(json).toContain('Folierung'); // Leistungsart-Label
    expect(json).toContain('Teilfolierung Dach');
    expect(json).toContain('Scheibentönung');
    expect(json).toContain('Bearbeiter / Kürzel');
    // Nur Leistungspositionen als Checkliste – Material NICHT.
    expect(json).not.toContain('Folie 3M 2080');
  });

  it('leistungsCheckliste filtert Material heraus, terminText baut die Spanne', () => {
    expect(leistungsCheckliste(order)).toEqual(['Teilfolierung Dach', 'Scheibentönung']);
    expect(terminText(order)).toBe('01.07.2026 – 03.07.2026');
    expect(terminText({ auftragsnummer: 'x' })).toBe('–');
  });

  it('ohne gebuchte Leistungen: leere Ankreuf-Zeilen (Checkboxen vorhanden)', () => {
    const json = JSON.stringify(buildAuftragskarteDocDef({ ...order, items: [] }, customer, vehicle, tenant));
    // Ankreuz-Kaestchen werden als canvas-rect gezeichnet.
    expect(json).toContain('"type":"rect"');
  });

  it('rendert einen nicht-leeren PDF-Buffer', async () => {
    const buffer = await renderPdf(createRobotoPrinter(), buildAuftragskarteDocDef(order, customer, vehicle, tenant));
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
