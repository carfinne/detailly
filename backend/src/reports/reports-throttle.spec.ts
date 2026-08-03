import { ReportsController } from './reports.controller';

/**
 * Paket 3 – moderate Drossel auf die schwere Aggregat-Auswertung.
 * 30 Requests/Minute statt der globalen 600 (freies Zeitraum-Erkunden bleibt
 * moeglich, Skript-Haemmern der teuren Aggregate wird geblockt).
 */
describe('ReportsController – Auswertungs-Drossel (Paket 3)', () => {
  const handler = ReportsController.prototype.overview;

  it('overview: 30 Requests/Minute (endlich, aber alltagstauglich)', () => {
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(30);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60000);
  });

  it('deutlich enger als das globale Limit von 600/min', () => {
    const proMin = Reflect.getMetadata('THROTTLER:LIMITdefault', handler);
    expect(proMin).toBeGreaterThan(0);
    expect(proMin).toBeLessThan(600);
  });
});
