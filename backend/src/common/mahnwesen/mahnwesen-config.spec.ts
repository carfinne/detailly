import { BadRequestException } from '@nestjs/common';
import {
  MAHNWESEN_DEFAULTS,
  assertMahnwesenValid,
  faelligeStufe,
  mergeMahnwesen,
  resolveMahnwesenConfig,
} from './mahnwesen-config';

describe('resolveMahnwesenConfig (defensives Lesen)', () => {
  it('undefined/null/Nicht-Objekt -> Defaults', () => {
    for (const raw of [undefined, null, 42, 'x', []]) {
      expect(resolveMahnwesenConfig(raw as unknown)).toEqual(MAHNWESEN_DEFAULTS);
    }
  });

  it('leeres Objekt -> Defaults', () => {
    expect(resolveMahnwesenConfig({})).toEqual(MAHNWESEN_DEFAULTS);
  });

  it('autoMahnen gilt nur bei exakt true als aktiv (fail-safe AUS)', () => {
    expect(resolveMahnwesenConfig({ autoMahnen: true }).autoMahnen).toBe(true);
    for (const v of ['true', 1, 'yes', {}, null]) {
      expect(resolveMahnwesenConfig({ autoMahnen: v }).autoMahnen).toBe(false);
    }
  });

  it('fehlende Fristen/Gebuehren -> je Feld Default', () => {
    const c = resolveMahnwesenConfig({ fristen: { mahnung1: 20 } });
    expect(c.fristen).toEqual({ erinnerung: 7, mahnung1: 20, mahnung2: 28 });
    expect(c.gebuehr).toEqual({ mahnung1: 0, mahnung2: 0 });
  });

  it('klammert Fristen (>=1, <=365) und normalisiert Gebuehren auf Cent', () => {
    const c = resolveMahnwesenConfig({
      fristen: { erinnerung: 0, mahnung1: -5, mahnung2: 10000 },
      gebuehr: { mahnung1: 5.005, mahnung2: -3 },
    });
    expect(c.fristen).toEqual({ erinnerung: 1, mahnung1: 1, mahnung2: 365 });
    expect(c.gebuehr.mahnung1).toBeCloseTo(5.01, 2);
    expect(c.gebuehr.mahnung2).toBe(0);
  });

  it('akzeptiert numerische Strings defensiv', () => {
    const c = resolveMahnwesenConfig({ fristen: { erinnerung: '7', mahnung1: '14', mahnung2: '28' } });
    expect(c.fristen).toEqual({ erinnerung: 7, mahnung1: 14, mahnung2: 28 });
  });
});

describe('mergeMahnwesen (Teil-Update)', () => {
  it('ueberlagert nur angegebene Felder, Rest bleibt', () => {
    const base = resolveMahnwesenConfig({});
    const merged = mergeMahnwesen(base, { autoMahnen: true, fristen: { mahnung2: 30 } });
    expect(merged.autoMahnen).toBe(true);
    expect(merged.fristen).toEqual({ erinnerung: 7, mahnung1: 14, mahnung2: 30 });
    expect(merged.gebuehr).toEqual({ mahnung1: 0, mahnung2: 0 });
  });

  it('leeres Patch aendert nichts', () => {
    const base = resolveMahnwesenConfig({ autoMahnen: true, fristen: { erinnerung: 3, mahnung1: 6, mahnung2: 9 } });
    expect(mergeMahnwesen(base, {})).toEqual(base);
  });
});

describe('assertMahnwesenValid (Schreib-Validierung)', () => {
  const cfg = (erinnerung: number, mahnung1: number, mahnung2: number, g1 = 0, g2 = 0) => ({
    autoMahnen: false,
    fristen: { erinnerung, mahnung1, mahnung2 },
    gebuehr: { mahnung1: g1, mahnung2: g2 },
  });

  it('aufsteigende gueltige Fristen -> ok', () => {
    expect(() => assertMahnwesenValid(cfg(7, 14, 28))).not.toThrow();
    expect(() => assertMahnwesenValid(cfg(1, 2, 3, 5, 10))).not.toThrow();
  });

  it('nicht aufsteigend -> BadRequest', () => {
    expect(() => assertMahnwesenValid(cfg(14, 7, 28))).toThrow(BadRequestException);
    expect(() => assertMahnwesenValid(cfg(7, 28, 14))).toThrow(BadRequestException);
  });

  it('gleiche Fristen (nicht streng steigend) -> BadRequest', () => {
    expect(() => assertMahnwesenValid(cfg(7, 7, 28))).toThrow(BadRequestException);
    expect(() => assertMahnwesenValid(cfg(7, 14, 14))).toThrow(BadRequestException);
  });

  it('Frist < 1 oder nicht ganzzahlig -> BadRequest', () => {
    expect(() => assertMahnwesenValid(cfg(0, 14, 28))).toThrow(BadRequestException);
    expect(() => assertMahnwesenValid(cfg(7.5, 14, 28))).toThrow(BadRequestException);
  });

  it('negative Gebuehr -> BadRequest', () => {
    expect(() => assertMahnwesenValid(cfg(7, 14, 28, -1, 0))).toThrow(BadRequestException);
  });
});

describe('faelligeStufe (Kern der Auto-Eskalation)', () => {
  const f = MAHNWESEN_DEFAULTS.fristen; // 7 / 14 / 28

  it.each([
    [0, 0],
    [6, 0],
    [7, 1],
    [13, 1],
    [14, 2],
    [27, 2],
    [28, 3],
    [100, 3],
  ])('tageUeberfaellig %p -> Stufe %p (Default-Fristen)', (tage, stufe) => {
    expect(faelligeStufe(tage, f)).toBe(stufe);
  });

  it('respektiert individuelle Fristen', () => {
    const custom = { erinnerung: 14, mahnung1: 28, mahnung2: 56 };
    expect(faelligeStufe(10, custom)).toBe(0);
    expect(faelligeStufe(14, custom)).toBe(1);
    expect(faelligeStufe(30, custom)).toBe(2);
    expect(faelligeStufe(60, custom)).toBe(3);
  });
});
