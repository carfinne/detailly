import {
  BENACHRICHTIGUNGEN_DEFAULTS,
  BENACHRICHTIGUNG_KEYS,
  mergeBenachrichtigungen,
  resolveBenachrichtigungen,
} from './benachrichtigungen';

describe('resolveBenachrichtigungen', () => {
  it('fehlender/leerer Block -> ALLES an (kein Verhaltensbruch)', () => {
    expect(resolveBenachrichtigungen(undefined)).toEqual(BENACHRICHTIGUNGEN_DEFAULTS);
    expect(resolveBenachrichtigungen(null)).toEqual(BENACHRICHTIGUNGEN_DEFAULTS);
    expect(resolveBenachrichtigungen({})).toEqual(BENACHRICHTIGUNGEN_DEFAULTS);
    for (const k of BENACHRICHTIGUNG_KEYS) {
      expect(BENACHRICHTIGUNGEN_DEFAULTS[k]).toBe(true);
    }
  });

  it('nur explizites false schaltet ab; alles andere bleibt an', () => {
    expect(resolveBenachrichtigungen({ steuerTermine: false }).steuerTermine).toBe(false);
    // andere Kategorien unveraendert an
    expect(resolveBenachrichtigungen({ steuerTermine: false }).auslastung).toBe(true);
    // "wahrheitsartige" Nicht-false-Werte gelten als an
    expect(resolveBenachrichtigungen({ par19: 'nein' }).par19).toBe(true);
    expect(resolveBenachrichtigungen({ par19: 0 }).par19).toBe(true);
    expect(resolveBenachrichtigungen({ par19: true }).par19).toBe(true);
  });

  it('unbekannte Keys werden ignoriert (nur bekannte Kategorien im Ergebnis)', () => {
    const r = resolveBenachrichtigungen({ irgendwas: false });
    expect(Object.keys(r).sort()).toEqual([...BENACHRICHTIGUNG_KEYS].sort());
  });
});

describe('mergeBenachrichtigungen', () => {
  it('Teil-Update laesst nicht angegebene Kategorien unveraendert', () => {
    const base = resolveBenachrichtigungen({ materialKnapp: false });
    const merged = mergeBenachrichtigungen(base, { termineHeute: false });
    expect(merged.termineHeute).toBe(false);
    expect(merged.materialKnapp).toBe(false); // aus base erhalten
    expect(merged.rechnungenFaellig).toBe(true);
  });

  it('nur bool-Werte werden uebernommen', () => {
    const base = resolveBenachrichtigungen({});
    const merged = mergeBenachrichtigungen(base, { auslastung: 'x' as unknown as boolean });
    expect(merged.auslastung).toBe(true); // ungueltiger Wert ignoriert
  });

  it('Round-Trip: abschalten + wieder anschalten', () => {
    const base = resolveBenachrichtigungen({});
    const aus = mergeBenachrichtigungen(base, { par19: false });
    expect(aus.par19).toBe(false);
    const wiederAn = mergeBenachrichtigungen(aus, { par19: true });
    expect(wiederAn.par19).toBe(true);
  });
});
