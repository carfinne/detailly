import { InvoicesController } from './invoices.controller';

/**
 * Paket 3 – moderate Drossel auf die rechenintensive PDF-Erzeugung.
 * 60 Requests/Minute statt der globalen 600 (deckt Monatsabschluss-Stapel auch
 * mehrerer Mitarbeiter hinter EINER Buero-IP, blockt aber Skript-Haemmern).
 * Geprueft ueber die Throttler-Reflect-Metadata (kein Nest-Bootstrap).
 */
describe('InvoicesController – PDF-Drossel (Paket 3)', () => {
  const handler = InvoicesController.prototype.getPdf;

  it('PDF: 60 Requests/Minute (endlich, aber alltagstauglich)', () => {
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(60);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60000);
  });

  it('deutlich enger als das globale Limit, aber weit ueber dem Tagesbedarf (~50 Belege/Tag)', () => {
    const proMin = Reflect.getMetadata('THROTTLER:LIMITdefault', handler);
    expect(proMin).toBeGreaterThan(50); // ein Tagesstapel passt in ~1 Minute
    expect(proMin).toBeLessThan(600);
  });
});
