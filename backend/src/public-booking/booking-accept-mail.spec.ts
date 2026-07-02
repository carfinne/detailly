import { BookingRequestsService } from './booking-requests.service';
import { BookingRequestStatus } from './entities/booking-request.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests fuer die Terminbestaetigung an den Endkunden beim Annehmen einer
 * Online-Anfrage (T-003). MailService gemockt (kein SMTP). Kernaussagen:
 *  - Mail mit Termin/Referenz/Betrieb an req.email (replyTo = Betrieb)
 *  - kein Versand ohne E-Mail oder bei Opt-out-Flag
 *  - Mail-Probleme blockieren die Annahme NIE
 * Bewusst OHNE Track-Link: beim Annehmen entsteht kein Auftrag (kommt mit P3-3).
 */

const USER: AuthUser = { id: 'u1', email: 'op@betrieb.de', role: 'owner', tenantId: 't1' } as AuthUser;

/** Laesst fire-and-forget-Promises (void ...) auslaufen. */
const flush = () => new Promise((r) => setImmediate(r));

// Festes UTC-Datum: formatDatumZeit rendert FEST in Europe/Berlin (Juli = MESZ,
// UTC+2) -> 07:00Z ist deterministisch "09:00 Uhr", egal in welcher TZ die Tests laufen.
const TERMIN_START = new Date('2026-07-10T07:00:00.000Z');

function makeSvc(over: { reqEmail?: string | null; tenant?: any; mailSend?: jest.Mock } = {}) {
  const reqEntity = {
    id: 'br1',
    tenantId: 't1',
    name: 'Max Muster',
    email: over.reqEmail !== undefined ? over.reqEmail : 'max@example.de',
    phone: null,
    serviceName: 'Keramikversiegelung',
    fahrzeug: 'VW Golf',
    wunschtermin: null,
    nachricht: null,
    status: BookingRequestStatus.ANGENOMMEN,
    reference: 'AF-ABCDEF123456',
    createdAt: new Date('2026-07-01T09:00:00.000Z'),
  };
  const tenantRepo = {
    findOne: jest.fn().mockResolvedValue(
      over.tenant !== undefined
        ? over.tenant
        : { id: 't1', name: 'Muster GmbH', email: 'info@muster.de', settings: {} },
    ),
  };
  const customerRepo = { count: jest.fn().mockResolvedValue(0) };
  const dataSource = {
    // accept() holt das Customer-Repo (Limit-Zaehlung), die Mail das Tenant-Repo.
    getRepository: jest.fn().mockImplementation((entity: any) =>
      entity?.name === 'Tenant' ? tenantRepo : customerRepo,
    ),
    transaction: jest.fn().mockResolvedValue({
      appointment: { id: 'a1', start: TERMIN_START },
      request: reqEntity,
      customerId: undefined,
    }),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const mail = { send: over.mailSend ?? jest.fn().mockResolvedValue(undefined) };
  const svc = new BookingRequestsService(
    {} as any,
    dataSource as any,
    audit as any,
    { assertLimit: jest.fn().mockResolvedValue(undefined) } as any,
    mail as any,
  );
  return { svc, mail, tenantRepo, reqEntity };
}

describe('BookingRequestsService.accept - Terminbestaetigung an den Endkunden', () => {
  it('versendet Termin + Referenz + Betrieb an req.email (replyTo = Betrieb)', async () => {
    const { svc, mail } = makeSvc();

    await svc.accept(USER, 'br1', {} as any);
    await flush();

    expect(mail.send).toHaveBeenCalledTimes(1);
    const opts = mail.send.mock.calls[0][0];
    expect(opts.to).toBe('max@example.de');
    expect(opts.replyTo).toBe('info@muster.de');
    expect(opts.subject).toBe('Terminbestätigung von Muster GmbH');
    expect(opts.text).toContain('Termin: 10.07.2026, 09:00 Uhr');
    expect(opts.text).toContain('AF-ABCDEF123456');
    expect(opts.text).toContain('Leistung: Keramikversiegelung');
    expect(opts.text).toContain('Muster GmbH');
    // Kein Track-Link: beim Annehmen existiert kein Auftrag/freigabeToken.
    expect(opts.text).not.toContain('/track');
  });

  it('Anfrage ohne E-Mail -> KEINE Mail, Annahme bleibt erfolgreich', async () => {
    const { svc, mail } = makeSvc({ reqEmail: null });

    const result = await svc.accept(USER, 'br1', {} as any);
    await flush();

    expect(result.appointment).toEqual({ id: 'a1', start: TERMIN_START });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('mail.send wirft -> accept wirft NICHT', async () => {
    const mailSend = jest.fn().mockRejectedValue(new Error('SMTP down'));
    const { svc } = makeSvc({ mailSend });

    const result = await svc.accept(USER, 'br1', {} as any);
    await flush();

    expect(result.request.reference).toBe('AF-ABCDEF123456');
  });

  it('Opt-out-Flag kundenmailTerminbestaetigung=\'0\' -> KEINE Mail', async () => {
    const { svc, mail } = makeSvc({
      tenant: {
        id: 't1',
        name: 'Muster GmbH',
        email: 'info@muster.de',
        settings: { kundenmailTerminbestaetigung: '0' },
      },
    });

    await svc.accept(USER, 'br1', {} as any);
    await flush();

    expect(mail.send).not.toHaveBeenCalled();
  });

  it('Betrieb ohne Namen/E-Mail -> Fallback-Absenderzeile, kein replyTo', async () => {
    const { svc, mail } = makeSvc({ tenant: null });

    await svc.accept(USER, 'br1', {} as any);
    await flush();

    expect(mail.send).toHaveBeenCalledTimes(1);
    const opts = mail.send.mock.calls[0][0];
    expect(opts.subject).toBe('Terminbestätigung von Ihr Aufbereitungsbetrieb');
    expect(opts.replyTo).toBeUndefined();
  });
});
