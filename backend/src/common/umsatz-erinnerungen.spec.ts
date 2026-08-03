import {
  nachsorgeDatumErlaubt,
  NACHSORGE_MONATE_MIN,
  NACHSORGE_MONATE_MAX,
} from './umsatz-erinnerungen';

/**
 * Finding #6: Die 1–60-Monats-Grenze fuer das Nachsorge-Datum existierte nur im
 * Browser. `nachsorgeDatumErlaubt` erzwingt sie serverseitig (mit kleiner Toleranz
 * fuer die Browser-Basisdatum-/Monatslaengen-Differenz).
 */
const NOW = new Date('2026-08-03T12:00:00');
function inMonaten(n: number): Date {
  const d = new Date(NOW);
  d.setMonth(d.getMonth() + n);
  return d;
}

describe('nachsorgeDatumErlaubt (Server-Grenze fuer die Nachsorge-Wiedervorlage)', () => {
  it('typischer Wert (12 Monate) ist erlaubt', () => {
    expect(nachsorgeDatumErlaubt(inMonaten(12), NOW)).toBe(true);
  });

  it('untere Grenze (MIN Monate) ist erlaubt', () => {
    expect(nachsorgeDatumErlaubt(inMonaten(NACHSORGE_MONATE_MIN), NOW)).toBe(true);
  });

  it('obere Grenze (MAX Monate) ist erlaubt', () => {
    expect(nachsorgeDatumErlaubt(inMonaten(NACHSORGE_MONATE_MAX), NOW)).toBe(true);
  });

  it('Datum in der Vergangenheit -> abgelehnt', () => {
    expect(nachsorgeDatumErlaubt(inMonaten(-3), NOW)).toBe(false);
  });

  it('heute (0 Monate, < MIN) -> abgelehnt', () => {
    expect(nachsorgeDatumErlaubt(new Date(NOW), NOW)).toBe(false);
  });

  it('deutlich ueber MAX (61 Monate) -> abgelehnt', () => {
    expect(nachsorgeDatumErlaubt(inMonaten(NACHSORGE_MONATE_MAX + 1), NOW)).toBe(false);
  });

  it('absurd weit in der Zukunft (Jahr 3000) -> abgelehnt', () => {
    expect(nachsorgeDatumErlaubt(new Date('3000-01-01T00:00:00'), NOW)).toBe(false);
  });

  it('ungueltiges Datum -> abgelehnt', () => {
    expect(nachsorgeDatumErlaubt(new Date('kein-datum'), NOW)).toBe(false);
  });
});
