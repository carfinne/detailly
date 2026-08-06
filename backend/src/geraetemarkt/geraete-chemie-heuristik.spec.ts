import { findeChemieTreffer } from './geraete-chemie-heuristik';

describe('findeChemieTreffer (weiche Chemie-Heuristik)', () => {
  it('erkennt klare Chemie/Verbrauchsstoffe an Stichworten', () => {
    expect(findeChemieTreffer('Keramikversiegelung', 'Neuwertige Lack-Versiegelung')).toContain(
      'versiegelung',
    );
    expect(findeChemieTreffer('Auto-Shampoo Konzentrat', '')).toContain('shampoo');
    expect(findeChemieTreffer('Politur-Set', 'Hochglanz Politur')).toContain('politur');
    expect(findeChemieTreffer('Entfetter', 'starker Entfetter')).toContain('entfetter');
  });

  it('erkennt Volumen-/Gebinde-Angaben (typisch fuer Chemie)', () => {
    expect(findeChemieTreffer('Reinigungsmittel', '500ml Flasche')).toContain('volumenangabe');
    expect(findeChemieTreffer('Konzentrat', '5 Liter Kanister')).toEqual(
      expect.arrayContaining(['liter', 'kanister', 'volumenangabe']),
    );
  });

  it('markiert NICHT bei legitimen Geraeten (keine False-Positive auf Geraetenamen)', () => {
    expect(findeChemieTreffer('Poliermaschine Rupes LHR21', 'wenig genutzt, top Zustand')).toEqual(
      [],
    );
    expect(findeChemieTreffer('Dampfreiniger Kärcher', 'Profi-Geraet, 2 Jahre alt')).toEqual([]);
    expect(findeChemieTreffer('Folier-Werkzeug Set', 'Rakel und Cutter')).toEqual([]);
    expect(findeChemieTreffer('Hebebuehne 2-Saeulen', 'gebraucht, funktioniert')).toEqual([]);
  });

  it('ist robust gegen leere Werte', () => {
    expect(findeChemieTreffer('', '')).toEqual([]);
    expect(findeChemieTreffer(undefined as any, undefined as any)).toEqual([]);
  });

  // Befund fuer die Nachbarschaftshilfe-Kategorie „Restmaterial" (Folie u. Ae.):
  // Folie ist HARMLOS und darf NICHT anschlagen; echte Chemie (Liter/Versiegelung)
  // muss weiter auffallen. „lfm"/„laufende Meter" ist die natuerliche Folien-Einheit
  // und darf die Liter-Heuristik NICHT ausloesen.
  it('Restmaterial FOLIE ist harmlos -> KEIN Chemie-Verdacht', () => {
    expect(findeChemieTreffer('12 lfm 3M Folie abzugeben', 'Rest von der Rolle, laufende Meter')).toEqual([]);
    expect(findeChemieTreffer('PPF-Reste', 'ca. 5 m Restfolie, transparent')).toEqual([]);
    expect(findeChemieTreffer('Restmaterial Wrapping-Folie', 'Farbe: schwarz matt')).toEqual([]);
  });

  it('als „Restmaterial" getarnte echte Chemie faellt weiter auf (Liter/Versiegelung/Kanister)', () => {
    expect(findeChemieTreffer('Restmaterial: Keramikversiegelung', '5 Liter Kanister, halb voll')).toEqual(
      expect.arrayContaining(['keramikversiegel', 'liter', 'kanister', 'volumenangabe']),
    );
  });
});
