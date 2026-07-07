import { BadRequestException } from '@nestjs/common';
import {
  MAIL_DEFAULTS,
  assertMailConfigValid,
  formatFrom,
  mergeMailConfig,
  resolveMailConfig,
} from './mail-config';

describe('mail-config (betriebseigener Absender)', () => {
  describe('resolveMailConfig (defensiver Lesepfad)', () => {
    it('leerer/ungueltiger Rohwert -> Defaults (Versand AUS)', () => {
      expect(resolveMailConfig(undefined)).toEqual(MAIL_DEFAULTS);
      expect(resolveMailConfig(null)).toEqual(MAIL_DEFAULTS);
      expect(resolveMailConfig('kaputt')).toEqual(MAIL_DEFAULTS);
    });

    it('enabled/secure nur bei exakt true aktiv (fail-safe)', () => {
      expect(resolveMailConfig({ enabled: 'true' }).enabled).toBe(false);
      expect(resolveMailConfig({ enabled: 1 }).enabled).toBe(false);
      expect(resolveMailConfig({ enabled: true }).enabled).toBe(true);
      expect(resolveMailConfig({ secure: true }).secure).toBe(true);
    });

    it('Port wird geklemmt/normalisiert, sonst Default 587', () => {
      expect(resolveMailConfig({ port: 465 }).port).toBe(465);
      expect(resolveMailConfig({ port: '25' }).port).toBe(25);
      expect(resolveMailConfig({ port: 0 }).port).toBe(1);
      expect(resolveMailConfig({ port: 999999 }).port).toBe(65535);
      expect(resolveMailConfig({ port: 'abc' }).port).toBe(587);
    });

    it('trimmt Strings und entfernt CR/LF (Header-Injection-Schutz)', () => {
      const cfg = resolveMailConfig({
        host: '  smtp.example.de  ',
        fromName: 'Muster\r\nBcc: evil@x.de',
        fromEmail: 'info@muster.de',
      });
      expect(cfg.host).toBe('smtp.example.de');
      expect(cfg.fromName).not.toContain('\n');
      expect(cfg.fromName).not.toContain('\r');
    });
  });

  describe('mergeMailConfig (Teil-Update)', () => {
    const base = resolveMailConfig({
      enabled: true,
      host: 'smtp.alt.de',
      port: 587,
      secure: false,
      user: 'u',
      fromEmail: 'a@alt.de',
      fromName: 'Alt',
    });

    it('nur uebergebene Felder aendern sich', () => {
      const merged = mergeMailConfig(base, { host: 'smtp.neu.de', secure: true });
      expect(merged.host).toBe('smtp.neu.de');
      expect(merged.secure).toBe(true);
      expect(merged.port).toBe(587); // unveraendert
      expect(merged.fromEmail).toBe('a@alt.de'); // unveraendert
    });

    it('enabled=false schaltet ab, Rest bleibt erhalten', () => {
      const merged = mergeMailConfig(base, { enabled: false });
      expect(merged.enabled).toBe(false);
      expect(merged.host).toBe('smtp.alt.de');
    });
  });

  describe('assertMailConfigValid (Schreibpfad)', () => {
    it('deaktiviert -> keine Anforderungen', () => {
      expect(() => assertMailConfigValid(resolveMailConfig({ enabled: false }))).not.toThrow();
    });

    it('aktiv ohne Host -> Fehler', () => {
      const cfg = resolveMailConfig({ enabled: true, fromEmail: 'a@b.de' });
      expect(() => assertMailConfigValid(cfg)).toThrow(BadRequestException);
    });

    it('aktiv mit ungueltiger From-Adresse -> Fehler', () => {
      const cfg = resolveMailConfig({ enabled: true, host: 'smtp.x.de', fromEmail: 'keine-mail' });
      expect(() => assertMailConfigValid(cfg)).toThrow(BadRequestException);
    });

    it('aktiv + vollstaendig -> ok', () => {
      const cfg = resolveMailConfig({
        enabled: true,
        host: 'smtp.x.de',
        port: 587,
        fromEmail: 'info@x.de',
      });
      expect(() => assertMailConfigValid(cfg)).not.toThrow();
    });
  });

  describe('formatFrom', () => {
    it('Name + Adresse -> "Name <mail>"', () => {
      expect(formatFrom(resolveMailConfig({ fromName: 'Muster GmbH', fromEmail: 'info@muster.de' }))).toBe(
        'Muster GmbH <info@muster.de>',
      );
    });

    it('ohne Name -> nur Adresse', () => {
      expect(formatFrom(resolveMailConfig({ fromEmail: 'info@muster.de' }))).toBe('info@muster.de');
    });

    it('ohne Adresse -> leer', () => {
      expect(formatFrom(resolveMailConfig({ fromName: 'X' }))).toBe('');
    });
  });
});
