import { buildUebergabeDocDef } from './uebergabe-pdf';

/**
 * Welle 1 (F4): Uebergabe-/Garantiedokument. Reine Build-Funktion -> Test ohne
 * pdfmake-Printer. Wir pruefen, dass die fachlich relevanten Inhalte im DocDef stehen.
 */
describe('buildUebergabeDocDef (F4)', () => {
  const order: any = {
    auftragsnummer: 'AU-2026-0007',
    serviceType: 'folierung',
    bilderNachher: ['a.jpg', 'b.jpg'],
    leistungDetails: {
      folierung: {
        farbe: 'Satin Schwarz',
        hersteller: '3M',
        qm: 18,
        teilfolierung: false,
        garantieJahre: 5,
        pflegehinweis: 'In den ersten 48 Stunden nicht waschen.',
      },
    },
    items: [{ beschreibung: 'Vollfolierung Karosserie', typ: 'leistung' }],
  };
  const customer: any = { type: 'private', firstName: 'Max', lastName: 'Muster' };
  const vehicle: any = { make: 'BMW', model: 'M3', licensePlate: 'B-XY-123', vin: 'WBS123' };
  const tenant: any = { name: 'Glanzwerk GmbH', email: 'info@glanzwerk.de' };

  it('enthaelt Fahrzeug, Leistung, Garantiejahre, Pflegehinweis, Foto-Verweis und Unterschriftszeile', () => {
    const def = buildUebergabeDocDef(order, customer, vehicle, tenant);
    const json = JSON.stringify(def);

    expect(json).toContain('Übergabe- & Garantiedokument');
    expect(json).toContain('AU-2026-0007');
    expect(json).toContain('BMW M3');
    expect(json).toContain('B-XY-123');
    expect(json).toContain('Vollfolierung Karosserie');
    expect(json).toContain('5 Jahre'); // Garantie
    expect(json).toContain('In den ersten 48 Stunden nicht waschen.'); // Pflegehinweis
    expect(json).toContain('2 Nachher-Foto'); // Dokumentations-Verweis
    expect(json).toContain('Unterschrift Kunde');
  });

  it('ohne Fotos: Verweis nennt, dass keine hinterlegt sind', () => {
    const def = buildUebergabeDocDef({ ...order, bilderNachher: [] }, customer, vehicle, tenant);
    expect(JSON.stringify(def)).toContain('keine Nachher-Fotos');
  });
});
