import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';
import { resolveMailConfig } from '../common/mail/mail-config';

/**
 * Tests fuer den betriebseigenen Mail-Versand (feat/night-email):
 *  - Transporter-Wahl: betriebseigen (mailConfig.enabled) vs. Plattform-Default
 *  - Absender = "fromName <fromEmail>" beim eigenen Versand
 *  - Passwort-Maskierung (nie Klartext, nie Laenge)
 *  - Tenant-Scope: Betrieb A nutzt nie den Transporter von Betrieb B
 *  - Test-Mail meldet Erfolg/Fehler sicher (nie das Passwort)
 *
 * nodemailer ist gemockt -> kein echter SMTP-Round-Trip.
 */
jest.mock('nodemailer');

const createTransportMock = nodemailer.createTransport as unknown as jest.Mock;

/** Erzeugt bei jedem createTransport-Aufruf einen frischen, identifizierbaren Transporter. */
function freshTransport() {
  return { sendMail: jest.fn().mockResolvedValue({ messageId: 'ok' }), close: jest.fn() };
}

/** Tenant-Repo-Mock: getOne liefert den Betrieb zur angefragten id (inkl. smtpPassword). */
function tenantRepoFor(map: Record<string, any>) {
  return {
    createQueryBuilder: jest.fn(() => {
      let id: string | undefined;
      const qb: any = {
        addSelect: () => qb,
        where: (_c: string, params: { id: string }) => {
          id = params.id;
          return qb;
        },
        getOne: async () => map[id ?? ''] ?? null,
      };
      return qb;
    }),
  };
}

const CONFIG_WITH_DEFAULT = {
  get: (k: string) =>
    ({ SMTP_HOST: 'default.smtp.de', SMTP_PORT: '587', MAIL_FROM: 'Detailly <no-reply@detailly.local>' } as any)[k],
};
const CONFIG_NO_DEFAULT = { get: () => undefined };

const BETRIEBS_MAILCONFIG = {
  enabled: true,
  host: 'smtp.muster.de',
  port: 587,
  secure: false,
  user: 'smtp-user',
  fromEmail: 'info@muster.de',
  fromName: 'Muster GmbH',
};

beforeEach(() => {
  createTransportMock.mockReset();
  createTransportMock.mockImplementation(() => freshTransport());
});

describe('MailService.buildTenantTransport (reine Transporter-Wahl)', () => {
  it('enabled + vollstaendig -> Optionen + Absender "Name <mail>"', () => {
    const built = MailService.buildTenantTransport(resolveMailConfig(BETRIEBS_MAILCONFIG), 'geheim');
    expect(built).not.toBeNull();
    expect(built!.options).toMatchObject({
      host: 'smtp.muster.de',
      port: 587,
      secure: false,
      auth: { user: 'smtp-user', pass: 'geheim' },
    });
    expect(built!.from).toBe('Muster GmbH <info@muster.de>');
    expect(built!.replyTo).toBe('info@muster.de');
  });

  it('deaktiviert -> null (Plattform-Default)', () => {
    const built = MailService.buildTenantTransport(
      resolveMailConfig({ ...BETRIEBS_MAILCONFIG, enabled: false }),
      'geheim',
    );
    expect(built).toBeNull();
  });

  it('aktiv aber ohne Host/From -> null (Fallback)', () => {
    expect(
      MailService.buildTenantTransport(resolveMailConfig({ enabled: true, fromEmail: 'a@b.de' }), null),
    ).toBeNull();
    expect(
      MailService.buildTenantTransport(resolveMailConfig({ enabled: true, host: 'smtp.x.de' }), null),
    ).toBeNull();
  });

  it('ohne SMTP-User -> keine auth-Angabe (Relay ohne Login)', () => {
    const built = MailService.buildTenantTransport(
      resolveMailConfig({ ...BETRIEBS_MAILCONFIG, user: '' }),
      null,
    );
    expect((built!.options as any).auth).toBeUndefined();
  });
});

describe('MailService.maskPassword', () => {
  it('gesetztes Passwort -> Maske ohne Klartext/Laenge', () => {
    const masked = MailService.maskPassword('super-geheim-123');
    expect(masked).not.toContain('super');
    expect(masked).not.toContain('123');
    expect(masked.length).toBeGreaterThan(0);
    // Laenge darf nicht die echte Passwortlaenge verraten.
    expect(masked.length).not.toBe('super-geheim-123'.length);
  });

  it('leer/undefined -> leerer String', () => {
    expect(MailService.maskPassword('')).toBe('');
    expect(MailService.maskPassword(null)).toBe('');
    expect(MailService.maskPassword(undefined)).toBe('');
  });
});

describe('MailService.send – Transporter-Wahl', () => {
  it('ohne tenantId -> Plattform-Default-Transporter + MAIL_FROM', async () => {
    const svc = new MailService(CONFIG_WITH_DEFAULT as any, tenantRepoFor({}) as any);
    // Konstruktor hat den Default-Transporter gebaut (erster createTransport-Aufruf).
    const defaultTransport = createTransportMock.mock.results[0].value;

    await svc.send({ to: 'kunde@example.de', subject: 'Hallo' });

    expect(defaultTransport.sendMail).toHaveBeenCalledTimes(1);
    expect(defaultTransport.sendMail.mock.calls[0][0].from).toBe('Detailly <no-reply@detailly.local>');
  });

  it('tenantId mit enabled mailConfig -> Betriebs-Transporter + eigener Absender', async () => {
    const repo = tenantRepoFor({
      t1: { id: 't1', settings: { mailConfig: BETRIEBS_MAILCONFIG }, smtpPassword: 'geheim' },
    });
    const svc = new MailService(CONFIG_NO_DEFAULT as any, repo as any);

    await svc.send({ to: 'kunde@example.de', subject: 'Ihre Rechnung', tenantId: 't1' });

    // Genau ein createTransport-Aufruf (kein Default, da SMTP_HOST fehlt) mit Betriebsdaten.
    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(createTransportMock.mock.calls[0][0]).toMatchObject({ host: 'smtp.muster.de' });
    const tenantTransport = createTransportMock.mock.results[0].value;
    expect(tenantTransport.sendMail).toHaveBeenCalledTimes(1);
    const sent = tenantTransport.sendMail.mock.calls[0][0];
    expect(sent.from).toBe('Muster GmbH <info@muster.de>');
    expect(sent.replyTo).toBe('info@muster.de');
    expect(sent.to).toBe('kunde@example.de');
  });

  it('tenantId aber mailConfig deaktiviert -> Fallback auf Plattform-Default', async () => {
    const repo = tenantRepoFor({
      t1: { id: 't1', settings: { mailConfig: { ...BETRIEBS_MAILCONFIG, enabled: false } }, smtpPassword: 'x' },
    });
    const svc = new MailService(CONFIG_WITH_DEFAULT as any, repo as any);
    const defaultTransport = createTransportMock.mock.results[0].value; // aus Konstruktor

    await svc.send({ to: 'kunde@example.de', subject: 'Status', tenantId: 't1' });

    // Kein neuer Transporter -> nur der Default aus dem Konstruktor hat gesendet.
    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(defaultTransport.sendMail).toHaveBeenCalledTimes(1);
    expect(defaultTransport.sendMail.mock.calls[0][0].from).toBe('Detailly <no-reply@detailly.local>');
  });

  it('Tenant-Scope: Betrieb A nutzt nie den Transporter von Betrieb B; Cache pro Tenant', async () => {
    const repo = tenantRepoFor({
      A: {
        id: 'A',
        settings: { mailConfig: { ...BETRIEBS_MAILCONFIG, host: 'smtp.a.de', fromEmail: 'a@a.de', fromName: 'A' } },
        smtpPassword: 'pa',
      },
      B: {
        id: 'B',
        settings: { mailConfig: { ...BETRIEBS_MAILCONFIG, host: 'smtp.b.de', fromEmail: 'b@b.de', fromName: 'B' } },
        smtpPassword: 'pb',
      },
    });
    const svc = new MailService(CONFIG_NO_DEFAULT as any, repo as any);

    await svc.send({ to: 'x@example.de', subject: '1', tenantId: 'A' });
    await svc.send({ to: 'x@example.de', subject: '2', tenantId: 'B' });
    await svc.send({ to: 'x@example.de', subject: '3', tenantId: 'A' }); // gecacht -> kein Neubau

    // A einmal gebaut (2. Send fuer A trifft den Cache), B einmal -> 2 createTransport-Aufrufe.
    expect(createTransportMock).toHaveBeenCalledTimes(2);
    const hosts = createTransportMock.mock.calls.map((c) => c[0].host);
    expect(hosts).toEqual(['smtp.a.de', 'smtp.b.de']);

    const transportA = createTransportMock.mock.results[0].value;
    const transportB = createTransportMock.mock.results[1].value;
    // A hat zweimal gesendet (Send 1 + 3), B genau einmal (Send 2).
    expect(transportA.sendMail).toHaveBeenCalledTimes(2);
    expect(transportB.sendMail).toHaveBeenCalledTimes(1);
    // Absender sauber getrennt.
    expect(transportA.sendMail.mock.calls[0][0].from).toBe('A <a@a.de>');
    expect(transportB.sendMail.mock.calls[0][0].from).toBe('B <b@b.de>');
  });
});

describe('MailService.sendTestMail', () => {
  it('nicht aktiviert -> ok:false, klare Meldung, KEIN Versuch', async () => {
    const repo = tenantRepoFor({
      t1: { id: 't1', settings: { mailConfig: { ...BETRIEBS_MAILCONFIG, enabled: false } }, smtpPassword: null },
    });
    const svc = new MailService(CONFIG_NO_DEFAULT as any, repo as any);

    const res = await svc.sendTestMail('t1');
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/aktiviert/i);
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it('aktiviert + Versand ok -> ok:true an eigene From-Adresse', async () => {
    const repo = tenantRepoFor({
      t1: { id: 't1', settings: { mailConfig: BETRIEBS_MAILCONFIG }, smtpPassword: 'geheim' },
    });
    const svc = new MailService(CONFIG_NO_DEFAULT as any, repo as any);

    const res = await svc.sendTestMail('t1');
    expect(res.ok).toBe(true);
    expect(res.message).toContain('info@muster.de');
    const transport = createTransportMock.mock.results[0].value;
    expect(transport.sendMail.mock.calls[0][0].to).toBe('info@muster.de');
    expect(transport.close).toHaveBeenCalled();
  });

  it('SMTP-Fehler -> ok:false, sichere Meldung ohne Passwort', async () => {
    createTransportMock.mockImplementationOnce(() => ({
      sendMail: jest.fn().mockRejectedValue(Object.assign(new Error('535 auth failed'), { code: 'EAUTH' })),
      close: jest.fn(),
    }));
    const repo = tenantRepoFor({
      t1: { id: 't1', settings: { mailConfig: BETRIEBS_MAILCONFIG }, smtpPassword: 'geheim' },
    });
    const svc = new MailService(CONFIG_NO_DEFAULT as any, repo as any);

    const res = await svc.sendTestMail('t1');
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/Anmeldung/i);
    expect(res.message).not.toContain('geheim');
  });
});
