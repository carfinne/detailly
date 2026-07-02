import { OrdersService } from './orders.service';
import { OrderStatus } from './entities/order.entity';
import { CustomerType } from '../customers/entities/customer.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests fuer die automatische Status-Mail an Endkunden (T-003).
 * Reine Unit-Tests, MailService gemockt (kein SMTP). Kernaussagen:
 *  - kuratierte Status (bestaetigt / in_arbeit nur aus bestaetigt / fertig)
 *  - Track-Link mit (ggf. frisch erzeugtem) freigabeToken in der Mail
 *  - Mail-Probleme blockieren den Statuswechsel NIE
 *  - kein Versand ohne Kunden-E-Mail oder bei Opt-out-Flag
 */

const USER: AuthUser = { id: 'u1', email: 'op@betrieb.de', role: 'owner', tenantId: 't1' } as AuthUser;
const TOKEN = 'a'.repeat(48);

/** Laesst fire-and-forget-Promises (void ...) auslaufen. */
const flush = () => new Promise((r) => setImmediate(r));

function makeService(over: {
  status?: OrderStatus;
  tokenRow?: any;
  tenant?: any;
  customer?: any;
  vehicle?: any;
  mailSend?: jest.Mock;
} = {}) {
  const order: any = {
    id: 'o1',
    tenantId: 't1',
    customerId: 'c1',
    vehicleId: null,
    auftragsnummer: 'AU-2026-0001',
    status: over.status ?? OrderStatus.QUALITAETSKONTROLLE,
    geplanterStart: null,
    geplantesEnde: null,
    items: [],
  };
  const repo: any = {
    // changeStatus laedt via relations, ensureTrackingToken via select-Projektion.
    findOne: jest.fn().mockImplementation((opts: any) =>
      Promise.resolve(
        opts?.relations ? order : (over.tokenRow ?? { id: 'o1', freigabeToken: TOKEN }),
      ),
    ),
    save: jest.fn().mockImplementation(async (o: any) => o),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const customerRepo: any = {
    findOne: jest.fn().mockResolvedValue(
      over.customer !== undefined
        ? over.customer
        : {
            id: 'c1',
            type: CustomerType.PRIVATE,
            firstName: 'Max',
            lastName: 'Muster',
            email: 'kunde@example.de',
          },
    ),
  };
  const vehicleRepo: any = { findOne: jest.fn().mockResolvedValue(over.vehicle ?? null) };
  const tenantRepo: any = {
    findOne: jest.fn().mockResolvedValue(
      over.tenant !== undefined
        ? over.tenant
        : { id: 't1', name: 'Muster GmbH', email: 'info@muster.de', settings: {} },
    ),
  };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const mail: any = { send: over.mailSend ?? jest.fn().mockResolvedValue(undefined) };
  const config: any = { get: jest.fn().mockReturnValue(undefined) }; // -> http://localhost:3000

  const svc = new OrdersService(
    repo,
    {} as any, // OrderItem
    customerRepo,
    vehicleRepo,
    {} as any, // User
    {} as any, // Location
    tenantRepo,
    audit,
    mail,
    config,
  );
  return { svc, repo, customerRepo, vehicleRepo, tenantRepo, mail, order };
}

describe('OrdersService.changeStatus - Status-Mail an Endkunden', () => {
  it('fertig -> Mail "abholbereit" mit Track-Link an die Kunden-Mail (replyTo = Betrieb)', async () => {
    const { svc, mail } = makeService({ status: OrderStatus.QUALITAETSKONTROLLE });

    await svc.changeStatus(USER, 'o1', OrderStatus.FERTIG);
    await flush();

    expect(mail.send).toHaveBeenCalledTimes(1);
    const opts = mail.send.mock.calls[0][0];
    expect(opts.to).toBe('kunde@example.de');
    expect(opts.replyTo).toBe('info@muster.de');
    expect(opts.subject).toContain('abholbereit');
    expect(opts.subject).toContain('Muster GmbH');
    expect(opts.text).toContain(`http://localhost:3000/track/?t=${TOKEN}`);
    expect(opts.text).toContain('AU-2026-0001');
    expect(opts.html).toContain(`/track/?t=${TOKEN}`);
  });

  it('bestaetigt -> Auftragsbestaetigung wird versendet', async () => {
    const { svc, mail } = makeService({ status: OrderStatus.KALKULIERT });

    await svc.changeStatus(USER, 'o1', OrderStatus.BESTAETIGT);
    await flush();

    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].subject).toContain('Auftragsbestätigung');
  });

  it('in_arbeit aus bestaetigt -> Mail; Ruecksprung aus Qualitaetskontrolle -> KEINE erneute Mail', async () => {
    const erste = makeService({ status: OrderStatus.BESTAETIGT });
    await erste.svc.changeStatus(USER, 'o1', OrderStatus.IN_ARBEIT);
    await flush();
    expect(erste.mail.send).toHaveBeenCalledTimes(1);
    expect(erste.mail.send.mock.calls[0][0].subject).toContain('in Arbeit');

    const rework = makeService({ status: OrderStatus.QUALITAETSKONTROLLE });
    await rework.svc.changeStatus(USER, 'o1', OrderStatus.IN_ARBEIT);
    await flush();
    expect(rework.mail.send).not.toHaveBeenCalled();
  });

  it.each([
    [OrderStatus.ANGEFRAGT, OrderStatus.KALKULIERT],
    [OrderStatus.IN_ARBEIT, OrderStatus.QUALITAETSKONTROLLE],
    [OrderStatus.FERTIG, OrderStatus.ABGERECHNET],
    [OrderStatus.BESTAETIGT, OrderStatus.STORNIERT],
  ])('nicht kuratierter Wechsel %s -> %s: KEINE Mail', async (von, nach) => {
    const { svc, mail } = makeService({ status: von });
    await svc.changeStatus(USER, 'o1', nach);
    await flush();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('gleicher Status (No-op) -> KEINE Mail', async () => {
    const { svc, mail } = makeService({ status: OrderStatus.FERTIG });
    await svc.changeStatus(USER, 'o1', OrderStatus.FERTIG);
    await flush();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('Kunde ohne E-Mail -> KEINE Mail, Statuswechsel bleibt erfolgreich', async () => {
    const { svc, mail } = makeService({
      status: OrderStatus.QUALITAETSKONTROLLE,
      customer: { id: 'c1', type: CustomerType.PRIVATE, firstName: 'Max', email: null },
    });

    const saved = await svc.changeStatus(USER, 'o1', OrderStatus.FERTIG);
    await flush();

    expect(saved.status).toBe(OrderStatus.FERTIG);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('mail.send wirft -> changeStatus wirft NICHT (Statuswechsel gespeichert)', async () => {
    const mailSend = jest.fn().mockRejectedValue(new Error('SMTP down'));
    const { svc, repo } = makeService({ status: OrderStatus.QUALITAETSKONTROLLE, mailSend });

    const saved = await svc.changeStatus(USER, 'o1', OrderStatus.FERTIG);
    await flush();

    expect(saved.status).toBe(OrderStatus.FERTIG);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('Opt-out-Flag kundenmailStatus=\'0\' -> KEINE Mail', async () => {
    const { svc, mail } = makeService({
      status: OrderStatus.QUALITAETSKONTROLLE,
      tenant: { id: 't1', name: 'Muster GmbH', email: 'info@muster.de', settings: { kundenmailStatus: '0' } },
    });

    await svc.changeStatus(USER, 'o1', OrderStatus.FERTIG);
    await flush();

    expect(mail.send).not.toHaveBeenCalled();
  });

  it('ohne vorhandenes Token wird eins erzeugt und in der Mail verlinkt', async () => {
    const { svc, repo, mail } = makeService({
      status: OrderStatus.QUALITAETSKONTROLLE,
      tokenRow: { id: 'o1', freigabeToken: null },
    });

    await svc.changeStatus(USER, 'o1', OrderStatus.FERTIG);
    await flush();

    // Token wurde tenant-gebunden persistiert ...
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'o1', tenantId: 't1' },
      { freigabeToken: expect.stringMatching(/^[a-f0-9]{48}$/) },
    );
    // ... und genau dieses Token steht im Link.
    const token = repo.update.mock.calls[0][1].freigabeToken;
    expect(mail.send.mock.calls[0][0].text).toContain(`/track/?t=${token}`);
  });

  it('Fahrzeug vorhanden -> Fahrzeugzeile in der Mail', async () => {
    const { svc, mail, order } = makeService({
      status: OrderStatus.QUALITAETSKONTROLLE,
      vehicle: { make: 'VW', model: 'Golf', variant: 'GTI', licensePlate: 'B-XY 123' },
    });
    order.vehicleId = 'v1';

    await svc.changeStatus(USER, 'o1', OrderStatus.FERTIG);
    await flush();

    expect(mail.send.mock.calls[0][0].text).toContain('Fahrzeug: VW Golf GTI (B-XY 123)');
  });
});
