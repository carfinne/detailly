import { BadRequestException } from '@nestjs/common';
import {
  MAIL_DEFAULTS,
  assertMailConfigValid,
  formatFrom,
  isPlausibleDomain,
  mergeMailConfig,
  normalizeDomain,
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

  describe('Domain + DKIM (Zustellbarkeit)', () => {
    it('resolveMailConfig liest Domain (normalisiert), DKIM + domainCheck', () => {
      const cfg = resolveMailConfig({
        domain: '  Muster.DE ',
        dkim: { selector: 'detailly', publicKey: 'PUBKEY==' },
        domainCheck: { verifiziert: true, geprueftAm: '2026-07-14T00:00:00.000Z', spf: 'gruen', dkim: 'gruen', mx: 'gelb' },
      });
      expect(cfg.domain).toBe('muster.de');
      expect(cfg.dkim).toEqual({ selector: 'detailly', publicKey: 'PUBKEY==' });
      expect(cfg.domainCheck.verifiziert).toBe(true);
      expect(cfg.domainCheck.dkim).toBe('gruen');
      expect(cfg.domainCheck.mx).toBe('gelb');
    });

    it('unbekannter Ampel-Status faellt auf ungeprueft zurueck', () => {
      const cfg = resolveMailConfig({ domainCheck: { spf: 'kaputt', dkim: 42 } });
      expect(cfg.domainCheck.spf).toBe('ungeprueft');
      expect(cfg.domainCheck.dkim).toBe('ungeprueft');
    });

    it('mergeMailConfig traegt dkim + domainCheck unveraendert aus base', () => {
      const base = resolveMailConfig({
        enabled: true,
        host: 'smtp.x.de',
        fromEmail: 'info@muster.de',
        domain: 'muster.de',
        dkim: { selector: 'detailly', publicKey: 'KEEP==' },
        domainCheck: { verifiziert: true, geprueftAm: 't', spf: 'gruen', dkim: 'gruen', mx: 'gruen' },
      });
      // Der PATCH kennt weder dkim noch domainCheck -> muessen erhalten bleiben.
      const merged = mergeMailConfig(base, { fromName: 'Neu' });
      expect(merged.dkim).toEqual({ selector: 'detailly', publicKey: 'KEEP==' });
      expect(merged.domainCheck.dkim).toBe('gruen');
      expect(merged.fromName).toBe('Neu');
    });

    it('mergeMailConfig aktualisiert die Domain (normalisiert)', () => {
      const base = resolveMailConfig({ domain: 'alt.de' });
      expect(mergeMailConfig(base, { domain: 'NEU.de' }).domain).toBe('neu.de');
    });

    it('Bestands-Config OHNE Domain: fromEmail auf beliebiger Domain bleibt gueltig (kein Bruch)', () => {
      const cfg = resolveMailConfig({
        enabled: true,
        host: 'smtp.provider.de',
        fromEmail: 'info@ganz-andere-domain.de',
      });
      expect(() => assertMailConfigValid(cfg)).not.toThrow();
    });

    it('mit Domain: fromEmail NICHT auf der Domain -> Fehler', () => {
      const cfg = resolveMailConfig({
        enabled: true,
        host: 'smtp.provider.de',
        fromEmail: 'info@fremd.de',
        domain: 'muster.de',
      });
      expect(() => assertMailConfigValid(cfg)).toThrow(BadRequestException);
    });

    it('mit Domain: fromEmail auf der Domain -> ok', () => {
      const cfg = resolveMailConfig({
        enabled: true,
        host: 'smtp.provider.de',
        fromEmail: 'info@muster.de',
        domain: 'muster.de',
      });
      expect(() => assertMailConfigValid(cfg)).not.toThrow();
    });

    it('ungueltiges Domain-Format -> Fehler (auch bei deaktiviertem Versand)', () => {
      const cfg = resolveMailConfig({ enabled: false, domain: 'keine domain mit leerzeichen' });
      expect(() => assertMailConfigValid(cfg)).toThrow(BadRequestException);
    });

    it('normalizeDomain/isPlausibleDomain', () => {
      expect(normalizeDomain('  @Muster.DE. ')).toBe('muster.de');
      expect(isPlausibleDomain('dein-betrieb.de')).toBe(true);
      expect(isPlausibleDomain('sub.dein-betrieb.co.uk')).toBe(true);
      expect(isPlausibleDomain('ohnepunkt')).toBe(false);
      expect(isPlausibleDomain('mit leer.de')).toBe(false);
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
