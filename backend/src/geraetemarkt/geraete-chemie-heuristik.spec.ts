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
});
