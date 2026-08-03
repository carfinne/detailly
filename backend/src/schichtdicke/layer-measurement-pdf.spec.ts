import { buildLayerMeasurementDocDef } from './layer-measurement-pdf';
import { createRobotoPrinter, renderPdf } from '../common/pdf/pdf-printer';

/**
 * Schichtdicken-Messbericht (nach Umbau auf den gemeinsamen Theme-Baustein).
 * Weist die inhaltlichen Pflichtbestandteile im erzeugten Dokument nach – KEIN
 * blosser "PDF ist nicht leer"-Test – plus ein echter Render-Durchlauf.
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

const measurement: any = {
  anlass: 'vor_folierung',
  messgeraet: 'PosiTector 200',
  normProfileKey: 'serienlack_stahl',
  notiz: 'Fahrzeug wirkt unfallfrei.',
  createdAt: new Date(Date.UTC(2026, 6, 5)),
};
const auswertung: any[] = [
  { partId: 'dach', partLabel: 'Dach', statistik: { count: 12, minUm: 95, meanUm: 110, maxUm: 130 }, status: 'normal', auffaellig: false },
  { partId: 'tuer_vl', partLabel: 'Tür vorne links', statistik: { count: 8, minUm: 180, meanUm: 260, maxUm: 420 }, status: 'verdacht', auffaellig: true },
];
const customer: any = { type: 'private', firstName: 'Max', lastName: 'Muster', street: 'Weg 1', postalCode: '10115', city: 'Berlin' };
const vehicle: any = { make: 'Audi', model: 'A4', licensePlate: 'B-XY-1', vin: 'WAUZZZ123', color: 'Schwarz' };
const tenant: any = {
  name: 'Lackprofi GmbH',
  city: 'Berlin',
  settings: {
    rechnungFusstext: 'Danke für Ihren Auftrag.',
    steuer: { rechtsform: 'gmbh', registergericht: 'Amtsgericht Berlin', registernummer: 'HRB 9', vertretungsberechtigte: 'Anna Beispiel' },
  },
};

describe('buildLayerMeasurementDocDef · Pflichtbestandteile', () => {
  const text = volltext(buildLayerMeasurementDocDef(measurement, [], auswertung, customer, vehicle, tenant));

  it('Titel, Untertitel und Empfaenger', () => {
    expect(text).toContain('Schichtdicken-Messprotokoll');
    expect(text).toContain('Lackschichtdicke (µm) je Fahrzeugbereich');
    expect(text).toContain('Max Muster');
  });

  it('Fahrzeug (Marke/Kennzeichen/FIN)', () => {
    expect(text).toContain('Audi A4');
    expect(text).toContain('B-XY-1');
    expect(text).toContain('WAUZZZ123');
  });

  it('Messwert-Tabelle mit Bauteilen und Ø/Max-Werten', () => {
    expect(text).toContain('Messwerte je Bauteil');
    expect(text).toContain('Dach');
    expect(text).toContain('Tür vorne links');
    expect(text).toContain('110'); // Ø Dach
    expect(text).toContain('130'); // Max Dach
  });

  it('Auffaelligkeit + Notiz', () => {
    expect(text).toContain('Auffälligkeiten');
    expect(text).toContain('Tür vorne links: bis 420 µm');
    expect(text).toContain('Fahrzeug wirkt unfallfrei.');
  });

  it('Haftungs-Disclaimer inkl. Messgeraet + Normprofil (kein Gutachten)', () => {
    expect(text).toContain('Wichtiger Hinweis');
    expect(text).toContain('KEIN Sachverständigen-Gutachten');
    expect(text).toContain('PosiTector 200');
    expect(text).toContain('serienlack_stahl');
  });

  it('Fuss: Firmierung + freier Fusstext + dezenter Detailly-Hinweis, kein "undefined"', () => {
    expect(text).toContain('GmbH');
    expect(text).toContain('Sitz: Berlin');
    expect(text).toContain('Amtsgericht Berlin HRB 9');
    expect(text).toContain('Danke für Ihren Auftrag.');
    expect(text).toContain('Erstellt mit Detailly');
    expect(text).not.toContain('undefined');
  });

  it('rendert einen validen, nicht-leeren PDF-Buffer (%PDF)', async () => {
    const buffer = await renderPdf(
      createRobotoPrinter(),
      buildLayerMeasurementDocDef(measurement, [], auswertung, customer, vehicle, tenant),
    );
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });
});
