import {
  normalisiere,
  signifikanteWoerter,
  berechneMedian,
  runde2,
} from './preisvorschlag.util';

describe('preisvorschlag.util – reine Helfer', () => {
  describe('berechneMedian', () => {
    it('0 Treffer -> 0', () => {
      expect(berechneMedian([])).toBe(0);
    });

    it('ungerade Trefferzahl -> mittleres Element', () => {
      expect(berechneMedian([10, 30, 20])).toBe(20);
      expect(berechneMedian([5])).toBe(5);
    });

    it('gerade Trefferzahl -> Mittel der beiden mittleren Elemente', () => {
      expect(berechneMedian([10, 20, 30, 40])).toBe(25);
      expect(berechneMedian([100, 120])).toBe(110);
    });

    it('sortiert intern und veraendert die Eingabe nicht', () => {
      const eingabe = [40, 10, 30, 20];
      expect(berechneMedian(eingabe)).toBe(25);
      expect(eingabe).toEqual([40, 10, 30, 20]);
    });

    it('kommt mit Duplikaten und Nachkommastellen zurecht', () => {
      expect(berechneMedian([99.5, 99.5, 150])).toBe(99.5);
      expect(runde2(berechneMedian([100, 105, 110, 120]))).toBe(107.5);
    });
  });

  describe('runde2', () => {
    it('rundet kaufmaennisch auf 2 Nachkommastellen', () => {
      expect(runde2(107.505)).toBe(107.51);
      expect(runde2(110)).toBe(110);
      expect(runde2(0.1 + 0.2)).toBe(0.3);
    });
  });

  describe('normalisiere', () => {
    it('klein, trimmt und reduziert Sonderzeichen/Mehrfach-Leerzeichen', () => {
      expect(normalisiere('  Lack-Politur   Stufe 2! ')).toBe('lack politur stufe 2');
    });
    it('behandelt Umlaute korrekt (Kleinschreibung)', () => {
      expect(normalisiere('Räderwäsche')).toBe('räderwäsche');
    });
    it('null/undefined/leer -> leerer String', () => {
      expect(normalisiere(null)).toBe('');
      expect(normalisiere(undefined)).toBe('');
      expect(normalisiere('   ')).toBe('');
    });
  });

  describe('signifikanteWoerter', () => {
    it('nimmt nur Woerter ab Laenge 3, dedupliziert', () => {
      expect(signifikanteWoerter('Keramik Keramik 9H Lack')).toEqual(['keramik', 'lack']);
    });
    it('begrenzt auf max. Anzahl', () => {
      const woerter = signifikanteWoerter('alpha beta gamma delta epsilon zeta eta', 3);
      expect(woerter).toEqual(['alpha', 'beta', 'gamma']);
    });
    it('Fallback auf die ganze Zeichenkette, wenn kein Wort >= 3 uebrig ist', () => {
      expect(signifikanteWoerter('öl')).toEqual(['öl']);
    });
    it('leere/zu kurze Eingabe -> []', () => {
      expect(signifikanteWoerter('')).toEqual([]);
      expect(signifikanteWoerter('a')).toEqual([]);
      expect(signifikanteWoerter('  ')).toEqual([]);
    });
  });
});
