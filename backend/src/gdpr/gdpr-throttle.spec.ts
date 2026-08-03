import { GdprController } from './gdpr.controller';

/**
 * Paket 3 – enge Drossel auf den teuersten Vorgang der App (DSGVO-Export laedt UND
 * entschluesselt ALLE Daten eines Kunden). Geprueft ueber die von @nestjs/throttler
 * gesetzte Reflect-Metadata (kein Nest-Bootstrap; Muster: public-calendar-throttle.spec).
 *
 * Metadata-Schema: `THROTTLER:LIMIT<name>` / `THROTTLER:TTL<name>`.
 * Export: `default` = 5/min UND `gdprHour` = 30/Stunde.
 */
describe('GdprController – Drossel-Verdrahtung (Paket 3)', () => {
  const exportHandler = GdprController.prototype.export;

  it('Export: sehr eng auf 5 Requests/Minute begrenzt (statt global 600)', () => {
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', exportHandler)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', exportHandler)).toBe(60000);
  });

  it('Export: zusaetzliches Stundenlimit von 30/Stunde (Massen-Exfiltration blocken)', () => {
    expect(Reflect.getMetadata('THROTTLER:LIMITgdprHour', exportHandler)).toBe(30);
    expect(Reflect.getMetadata('THROTTLER:TTLgdprHour', exportHandler)).toBe(3600000);
  });

  it('Klassen-Baseline: 15/min fuer die uebrigen DSGVO-Endpunkte (Vorschau/Loeschen)', () => {
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', GdprController)).toBe(15);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', GdprController)).toBe(60000);
  });

  it('normale Nutzung bleibt moeglich: das Limit ist endlich, aber deutlich ueber dem menschlichen Bedarf (ein paar Exporte/Jahr)', () => {
    const proMin = Reflect.getMetadata('THROTTLER:LIMITdefault', exportHandler);
    const proStunde = Reflect.getMetadata('THROTTLER:LIMITgdprHour', exportHandler);
    expect(proMin).toBeGreaterThan(0);
    expect(proMin).toBeLessThan(600); // enger als global
    expect(proStunde).toBeGreaterThanOrEqual(proMin);
  });
});
