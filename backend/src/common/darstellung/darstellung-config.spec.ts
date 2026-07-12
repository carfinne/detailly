import {
  DARSTELLUNG_DEFAULTS,
  mergeDarstellung,
  resolveDarstellung,
} from './darstellung-config';

describe('resolveDarstellung (defensives Lesen)', () => {
  it('undefined/null/Nicht-Objekt -> Defaults (montag/24h/7–19)', () => {
    for (const raw of [undefined, null, 42, 'x', []]) {
      expect(resolveDarstellung(raw as unknown)).toEqual(DARSTELLUNG_DEFAULTS);
    }
  });

  it('nur gueltige Enum-Werte werden uebernommen', () => {
    expect(resolveDarstellung({ wochenstart: 'sonntag' }).wochenstart).toBe('sonntag');
    expect(resolveDarstellung({ wochenstart: 'freitag' }).wochenstart).toBe('montag');
    expect(resolveDarstellung({ zeitformat: '12h' }).zeitformat).toBe('12h');
    expect(resolveDarstellung({ zeitformat: '13h' }).zeitformat).toBe('24h');
  });

  it('klammert Start-/Endstunde in ihre Bereiche', () => {
    expect(resolveDarstellung({ kalenderStartStunde: -3 }).kalenderStartStunde).toBe(0);
    expect(resolveDarstellung({ kalenderStartStunde: 30 }).kalenderStartStunde).toBe(23);
    expect(resolveDarstellung({ kalenderEndStunde: 99 }).kalenderEndStunde).toBe(24);
    expect(resolveDarstellung({ kalenderStartStunde: '6' }).kalenderStartStunde).toBe(6);
  });

  it('erzwingt Endstunde > Startstunde (sonst Start + 1)', () => {
    const c = resolveDarstellung({ kalenderStartStunde: 20, kalenderEndStunde: 19 });
    expect(c.kalenderStartStunde).toBe(20);
    expect(c.kalenderEndStunde).toBe(21);
    // Start 23 -> End auf 24 gedeckelt
    const d = resolveDarstellung({ kalenderStartStunde: 23, kalenderEndStunde: 1 });
    expect(d.kalenderEndStunde).toBe(24);
  });
});

describe('mergeDarstellung (Teil-Update)', () => {
  it('ueberlagert nur angegebene Felder, Rest bleibt', () => {
    const base = resolveDarstellung({});
    const merged = mergeDarstellung(base, { zeitformat: '12h' });
    expect(merged.zeitformat).toBe('12h');
    expect(merged.wochenstart).toBe('montag');
    expect(merged.kalenderStartStunde).toBe(7);
    expect(merged.kalenderEndStunde).toBe(19);
  });

  it('leeres Patch aendert nichts', () => {
    const base = resolveDarstellung({ kalenderStartStunde: 6, kalenderEndStunde: 22 });
    expect(mergeDarstellung(base, {})).toEqual(base);
  });

  it('erzwingt die Stunden-Invariante auch nach Teil-Update', () => {
    const base = resolveDarstellung({ kalenderStartStunde: 7, kalenderEndStunde: 19 });
    // nur die Startstunde hinter das bestehende Ende schieben -> Ende zieht nach
    const merged = mergeDarstellung(base, { kalenderStartStunde: 22 });
    expect(merged.kalenderStartStunde).toBe(22);
    expect(merged.kalenderEndStunde).toBe(23);
  });
});
