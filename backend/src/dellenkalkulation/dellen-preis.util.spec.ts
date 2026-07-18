import {
  berechneGesamt,
  DEFAULT_DELLEN_PREISMATRIX,
  DellenPreismatrixWerte,
  einzelMarkerPreis,
  hagelPanelPreis,
  normalisiereMatrix,
  runde2,
} from './dellen-preis.util';

/**
 * Reine Preis-Engine der Dellenkalkulation (PDR). Sichert die geschaeftskritische
 * Rechnung ab: Einzelpreis = Basis * Kanten-/Alu-Faktor + Lackschaden-Aufschlag;
 * Gesamt = Summe der Einzelpreise (Einzel-Modus); Hagel-Staffel greift an den
 * Klassengrenzen korrekt. Keine DB/Nest – nur Zahlen.
 */
describe('dellen-preis.util', () => {
  const M: DellenPreismatrixWerte = {
    basispreise: { '1euro': 30, '2euro': 50, '5euro': 80, golfball: 120, groesser: 160 },
    kantenFaktor: 1.5,
    aluFaktor: 1.4,
    lackschadenAufschlag: 60,
    mindestpauschale: 0,
    anfahrtspauschale: 0,
    hagelStaffel: [
      { maxDellen: 5, pauschale: 250 },
      { maxDellen: 15, pauschale: 450 },
      { maxDellen: 30, pauschale: 700 },
      { maxDellen: null, pauschale: 1100 },
    ],
  };

  describe('einzelMarkerPreis', () => {
    it('reine Basis je Groessenklasse', () => {
      expect(einzelMarkerPreis(M, { groessenklasse: '1euro' })).toBe(30);
      expect(einzelMarkerPreis(M, { groessenklasse: 'golfball' })).toBe(120);
    });

    it('Kanten-Faktor multipliziert die Basis', () => {
      expect(einzelMarkerPreis(M, { groessenklasse: '2euro', kante: true })).toBe(75); // 50 * 1.5
    });

    it('Alu-Faktor multipliziert die Basis', () => {
      expect(einzelMarkerPreis(M, { groessenklasse: '5euro', alu: true })).toBe(112); // 80 * 1.4
    });

    it('Kante UND Alu multiplizieren beide, Lackschaden addiert obendrauf', () => {
      // 50 * 1.5 * 1.4 = 105 ; + 60 = 165
      expect(
        einzelMarkerPreis(M, { groessenklasse: '2euro', kante: true, alu: true, lackschaden: true }),
      ).toBe(165);
    });

    it('unbekannte/fehlende Groessenklasse -> 0 (kein NaN)', () => {
      expect(einzelMarkerPreis(M, {})).toBe(0);
      expect(einzelMarkerPreis(M, { groessenklasse: 'phantasie' as never })).toBe(0);
    });
  });

  describe('hagelPanelPreis – Staffel greift an Klassengrenzen', () => {
    it('0 Dellen -> 0', () => {
      expect(hagelPanelPreis(M, 0)).toBe(0);
      expect(hagelPanelPreis(M, null)).toBe(0);
    });
    it('untere Stufe (1..5)', () => {
      expect(hagelPanelPreis(M, 1)).toBe(250);
      expect(hagelPanelPreis(M, 5)).toBe(250);
    });
    it('Grenze 6 wechselt in die naechste Stufe', () => {
      expect(hagelPanelPreis(M, 6)).toBe(450);
      expect(hagelPanelPreis(M, 15)).toBe(450);
    });
    it('Grenze 16 / 30', () => {
      expect(hagelPanelPreis(M, 16)).toBe(700);
      expect(hagelPanelPreis(M, 30)).toBe(700);
    });
    it('oberste offene Stufe (>30)', () => {
      expect(hagelPanelPreis(M, 31)).toBe(1100);
      expect(hagelPanelPreis(M, 999)).toBe(1100);
    });
  });

  describe('berechneGesamt', () => {
    it('Einzel-Modus: Gesamt = Summe der Einzelpreise inkl. Faktoren', () => {
      const res = berechneGesamt(M, 'einzel', [
        { groessenklasse: '1euro' }, // 30
        { groessenklasse: '2euro', kante: true }, // 75
        { groessenklasse: '5euro', alu: true, lackschaden: true }, // 80*1.4=112 +60 = 172
      ]);
      expect(res.markerPreise).toEqual([30, 75, 172]);
      expect(res.gesamtpreis).toBe(277);
    });

    it('Hagel-Modus: Gesamt = Summe der Panel-Pauschalen', () => {
      const res = berechneGesamt(M, 'hagel', [
        { dellenAnzahl: 3 }, // 250
        { dellenAnzahl: 20 }, // 700
        { dellenAnzahl: 40 }, // 1100
      ]);
      expect(res.markerPreise).toEqual([250, 700, 1100]);
      expect(res.gesamtpreis).toBe(2050);
    });

    it('leere Marker-Liste -> Gesamt 0 (leerer Entwurf)', () => {
      expect(berechneGesamt(M, 'einzel', []).gesamtpreis).toBe(0);
    });

    it('Anfahrts- + Mindestpauschale werden angewandt', () => {
      const mit = { ...M, anfahrtspauschale: 25, mindestpauschale: 100 };
      // 1x 1euro (30) + Anfahrt 25 = 55 -> unter Mindest 100 -> 100
      expect(berechneGesamt(mit, 'einzel', [{ groessenklasse: '1euro' }]).gesamtpreis).toBe(100);
      // groesser (160) + 25 = 185 -> ueber Mindest -> 185
      expect(berechneGesamt(mit, 'einzel', [{ groessenklasse: 'groesser' }]).gesamtpreis).toBe(185);
    });
  });

  describe('normalisiereMatrix', () => {
    it('sortiert die Hagel-Staffel aufsteigend, null-Grenze zuletzt', () => {
      const chaos = normalisiereMatrix({
        ...M,
        hagelStaffel: [
          { maxDellen: null, pauschale: 1100 },
          { maxDellen: 30, pauschale: 700 },
          { maxDellen: 5, pauschale: 250 },
          { maxDellen: 15, pauschale: 450 },
        ],
      });
      expect(chaos.hagelStaffel.map((s) => s.maxDellen)).toEqual([5, 15, 30, null]);
    });

    it('erzwingt endliche, nicht-negative Zahlen (Faktor faellt neutral auf 1, Preis auf 0)', () => {
      const bad = normalisiereMatrix({
        ...M,
        kantenFaktor: -3,
        basispreise: { ...M.basispreise, '1euro': Number.NaN },
      });
      // Faktor-Fallback ist bewusst 1 (neutral), nicht 0 (das wuerde Preise nullen).
      expect(bad.kantenFaktor).toBe(1);
      expect(bad.basispreise['1euro']).toBe(0);
    });
  });

  it('Default-Matrix ist konsistent normalisierbar', () => {
    const n = normalisiereMatrix(DEFAULT_DELLEN_PREISMATRIX);
    expect(n.hagelStaffel[n.hagelStaffel.length - 1].maxDellen).toBeNull();
    expect(runde2(n.basispreise.groesser)).toBe(170);
  });
});
