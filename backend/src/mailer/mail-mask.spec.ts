import { MailService } from './mail.service';

/**
 * Tests fuer die Empfaenger-Maskierung im Logging (L2). Es darf sich keine
 * vollstaendige Endkunden-Adresse im Klartext in den Logs ansammeln.
 */
describe('MailService.maskRecipient (L2)', () => {
  it('zeigt nur das erste Zeichen des Local-Parts, Domain bleibt', () => {
    const masked = MailService.maskRecipient('max.mustermann@example.de');
    expect(masked.startsWith('m')).toBe(true);
    expect(masked.endsWith('@example.de')).toBe(true);
    expect(masked).not.toContain('max.mustermann');
    expect(masked).not.toContain('ax.mustermann');
  });

  it('maskiert auch kurze Local-Parts (mind. 2 Sterne)', () => {
    expect(MailService.maskRecipient('a@x.de')).toBe('a**@x.de');
  });

  it('gibt bei fehlendem/ungueltigem @ nichts preis', () => {
    expect(MailService.maskRecipient('keine-mail')).toBe('***');
    expect(MailService.maskRecipient('@nolocal.de')).toBe('***');
  });

  it('leerer Wert -> leerer String', () => {
    expect(MailService.maskRecipient('')).toBe('');
  });
});
