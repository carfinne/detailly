import {
  berechneKassenbestandNach,
  gegenTyp,
  round2,
  vorzeichen,
  wuerdeBestandNegativ,
} from './kassenbuch-rules';

/**
 * Reine GoBD-Rechenregeln (kein DB-Boot). Deckt die Saldo-Verkettung, den
 * Nicht-negativ-Schutz und die Storno-Gegenrichtung ab.
 */
describe('kassenbuch-rules', () => {
  describe('vorzeichen', () => {
    it('Einnahme erhoeht (+1), Ausgabe verringert (-1)', () => {
      expect(vorzeichen('einnahme')).toBe(1);
      expect(vorzeichen('ausgabe')).toBe(-1);
    });
  });

  describe('berechneKassenbestandNach', () => {
    it('schreibt den Saldo aus dem Vorgaenger fort (Einnahme addiert)', () => {
      expect(berechneKassenbestandNach(100, 'einnahme', 50)).toBe(150);
    });
    it('schreibt den Saldo aus dem Vorgaenger fort (Ausgabe subtrahiert)', () => {
      expect(berechneKassenbestandNach(100, 'ausgabe', 30)).toBe(70);
    });
    it('rundet kaufmaennisch auf Cent (kein Float-Drift)', () => {
      expect(berechneKassenbestandNach(0.1, 'einnahme', 0.2)).toBe(0.3);
    });

    it('Kette bleibt ueber viele Bewegungen exakt', () => {
      const bewegungen: Array<['einnahme' | 'ausgabe', number]> = [
        ['einnahme', 100],
        ['ausgabe', 30],
        ['einnahme', 50.55],
        ['ausgabe', 0.55],
      ];
      let saldo = 0;
      const verlauf = bewegungen.map(([typ, betrag]) => {
        saldo = berechneKassenbestandNach(saldo, typ, betrag);
        return saldo;
      });
      expect(verlauf).toEqual([100, 70, 120.55, 120]);
    });
  });

  describe('wuerdeBestandNegativ', () => {
    it('Ausgabe groesser als Bestand -> true', () => {
      expect(wuerdeBestandNegativ(20, 'ausgabe', 30)).toBe(true);
    });
    it('Ausgabe exakt gleich Bestand -> false (Kasse auf 0 erlaubt)', () => {
      expect(wuerdeBestandNegativ(30, 'ausgabe', 30)).toBe(false);
    });
    it('Einnahme kann nie negativ werden -> false', () => {
      expect(wuerdeBestandNegativ(0, 'einnahme', 999)).toBe(false);
    });
    it('toleriert halben Cent Float-Rundung', () => {
      expect(wuerdeBestandNegativ(30, 'ausgabe', 30.004)).toBe(false);
    });
  });

  describe('gegenTyp', () => {
    it('Einnahme <-> Ausgabe', () => {
      expect(gegenTyp('einnahme')).toBe('ausgabe');
      expect(gegenTyp('ausgabe')).toBe('einnahme');
    });
  });

  describe('round2', () => {
    it('rundet auf 2 Nachkommastellen', () => {
      expect(round2(1.256)).toBe(1.26);
      expect(round2(1.254)).toBe(1.25);
    });
  });
});
