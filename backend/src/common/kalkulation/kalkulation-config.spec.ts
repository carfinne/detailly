import {
  KALKULATION_DEFAULTS,
  mergeKalkulation,
  resolveKalkulation,
} from './kalkulation-config';

describe('resolveKalkulation (defensives Lesen)', () => {
  it('undefined/null/Nicht-Objekt -> Defaults (60/130/25)', () => {
    for (const raw of [undefined, null, 42, 'x', []]) {
      expect(resolveKalkulation(raw as unknown)).toEqual(KALKULATION_DEFAULTS);
    }
  });

  it('leeres Objekt -> Defaults', () => {
    expect(resolveKalkulation({})).toEqual(KALKULATION_DEFAULTS);
  });

  it('fehlende Einzelfelder -> je Feld Default', () => {
    expect(resolveKalkulation({ folierungProQm: 75 })).toEqual({
      folierungProQm: 75,
      ppfProQm: 130,
      aufbereitungProQm: 25,
    });
  });

  it('klammert negative Werte auf 0 und normalisiert auf Cent', () => {
    const c = resolveKalkulation({ folierungProQm: -5, ppfProQm: 149.999, aufbereitungProQm: 30 });
    expect(c.folierungProQm).toBe(0);
    expect(c.ppfProQm).toBeCloseTo(150, 2);
    expect(c.aufbereitungProQm).toBe(30);
  });

  it('akzeptiert numerische Strings defensiv', () => {
    expect(resolveKalkulation({ folierungProQm: '80', ppfProQm: '140', aufbereitungProQm: '20' })).toEqual({
      folierungProQm: 80,
      ppfProQm: 140,
      aufbereitungProQm: 20,
    });
  });
});

describe('mergeKalkulation (Teil-Update)', () => {
  it('ueberlagert nur angegebene Felder, Rest bleibt', () => {
    const base = resolveKalkulation({});
    const merged = mergeKalkulation(base, { ppfProQm: 150 });
    expect(merged).toEqual({ folierungProQm: 60, ppfProQm: 150, aufbereitungProQm: 25 });
  });

  it('leeres Patch aendert nichts', () => {
    const base = resolveKalkulation({ folierungProQm: 70, ppfProQm: 140, aufbereitungProQm: 30 });
    expect(mergeKalkulation(base, {})).toEqual(base);
  });

  it('normalisiert die neuen Werte (Cent-Rundung, Klammerung)', () => {
    const base = resolveKalkulation({});
    expect(mergeKalkulation(base, { folierungProQm: 59.995 }).folierungProQm).toBeCloseTo(60, 2);
    expect(mergeKalkulation(base, { aufbereitungProQm: -3 }).aufbereitungProQm).toBe(0);
  });
});
