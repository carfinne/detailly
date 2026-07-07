import { InvoicesService } from './invoices.service';

/**
 * Tests fuer die Zahlungsziel-Klammer (M2). Sie normalisiert Client- UND
 * Settings-Wert identisch auf 1..365; unplausible Werte (0, negativ, riesig,
 * nicht-numerisch) fallen bewusst auf null -> Aufrufer nutzt den 14-Tage-Standard.
 */

function makeSvc(): any {
  // clampZahlungsziel nutzt keine Abhaengigkeiten -> leere Mocks genuegen.
  return new InvoicesService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

describe('InvoicesService.clampZahlungsziel (M2)', () => {
  const svc = makeSvc();

  it.each([
    [1, 1],
    [14, 14],
    [365, 365],
    ['30', 30],
  ])('gueltiges Zahlungsziel %p -> %p', (input, expected) => {
    expect(svc.clampZahlungsziel(input)).toBe(expected);
  });

  it.each([[0], [-100000], [366], [1e15], [NaN], [undefined], [null], ['abc']])(
    'unplausibles Zahlungsziel %p -> null (Fallback auf Standard)',
    (input) => {
      expect(svc.clampZahlungsziel(input)).toBeNull();
    },
  );
});
