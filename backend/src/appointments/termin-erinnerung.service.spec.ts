import { TerminErinnerungService } from './termin-erinnerung.service';
import { AppointmentStatus } from './entities/appointment.entity';
import { CustomerType } from '../customers/entities/customer.entity';

/**
 * Unit-Tests fuer die automatische Termin-Erinnerung (Feature 1 Kundenkommunikation).
 * MailService + Repos gemockt (kein SMTP, keine DB). Kernaussagen:
 *  - Gate greift: nur Betriebe mit terminErinnerungAktiv werden bearbeitet
 *  - Doppelversand-Schutz: konditionaler Claim VOR Versand; verlorener Claim -> keine Mail
 *  - kein Versand ohne Kunden-E-Mail; kein Claim ohne E-Mail
 *  - strikte Tenant-Isolation (jede Query traegt tenantId)
 *  - Versandfehler brechen den Lauf nicht (at-most-once, Claim bleibt)
 */

const NOW = new Date('2026-07-14T09:00:00.000Z');

function makeAppt(over: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    tenantId: 't1',
    customerId: 'c1',
    vehicleId: null,
    titel: 'Aufbereitung',
    start: new Date('2026-07-15T08:00:00.000Z'),
    status: AppointmentStatus.BESTAETIGT,
    erinnerungGesendetAm: null,
    ...over,
  };
}

function makeService(opts: {
  tenants?: any[];
  appts?: any[];
  customer?: any;
  claimAffected?: number;
  mailSend?: jest.Mock;
} = {}) {
  const tenants = opts.tenants ?? [
    { id: 't1', name: 'Muster GmbH', email: 'info@muster.de', settings: { kundenkommunikation: { terminErinnerungAktiv: true, stundenVorlauf: 24 } } },
  ];
  const appointmentRepo: any = {
    find: jest.fn().mockResolvedValue(opts.appts ?? [makeAppt()]),
    update: jest.fn().mockResolvedValue({ affected: opts.claimAffected ?? 1 }),
  };
  const customerRepo: any = {
    findOne: jest.fn().mockResolvedValue(
      opts.customer !== undefined
        ? opts.customer
        : { id: 'c1', tenantId: 't1', type: CustomerType.PRIVATE, firstName: 'Max', lastName: 'Muster', email: 'kunde@example.de' },
    ),
  };
  const vehicleRepo: any = { findOne: jest.fn().mockResolvedValue(null) };
  const tenantRepo: any = { find: jest.fn().mockResolvedValue(tenants) };
  const mail: any = { send: opts.mailSend ?? jest.fn().mockResolvedValue(undefined) };

  const svc = new TerminErinnerungService(appointmentRepo, customerRepo, vehicleRepo, tenantRepo, mail);
  return { svc, appointmentRepo, customerRepo, vehicleRepo, tenantRepo, mail };
}

describe('TerminErinnerungService.runOnce', () => {
  it('aktiver Betrieb + Termin im Fenster + Kunde mit E-Mail -> genau EINE Erinnerung', async () => {
    const { svc, mail, appointmentRepo } = makeService();

    const res = await svc.runOnce(NOW);

    expect(res).toEqual({ tenants: 1, geprueft: 1, erinnert: 1, fehler: 0 });
    expect(mail.send).toHaveBeenCalledTimes(1);
    const opts = mail.send.mock.calls[0][0];
    expect(opts.to).toBe('kunde@example.de');
    expect(opts.replyTo).toBe('info@muster.de');
    expect(opts.tenantId).toBe('t1');
    expect(opts.subject).toContain('Muster GmbH');
    // Claim VOR Versand: erinnerungGesendetAm konditional auf IS NULL gesetzt.
    expect(appointmentRepo.update).toHaveBeenCalledTimes(1);
    const [krit, patch] = appointmentRepo.update.mock.calls[0];
    expect(krit).toMatchObject({ id: 'a1', tenantId: 't1' });
    expect(krit.erinnerungGesendetAm).toBeDefined(); // IsNull()-Bedingung
    expect(patch.erinnerungGesendetAm).toBe(NOW);
  });

  it('Gate AUS (terminErinnerungAktiv=false) -> keine Query, keine Mail', async () => {
    const { svc, mail, appointmentRepo } = makeService({
      tenants: [{ id: 't1', name: 'X', email: null, settings: { kundenkommunikation: { terminErinnerungAktiv: false } } }],
    });

    const res = await svc.runOnce(NOW);

    expect(res.tenants).toBe(0);
    expect(appointmentRepo.find).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('Betrieb ohne kundenkommunikation-Block (Altbestand) -> Default AUS, keine Mail', async () => {
    const { svc, mail } = makeService({ tenants: [{ id: 't1', name: 'X', email: null, settings: {} }] });
    const res = await svc.runOnce(NOW);
    expect(res.tenants).toBe(0);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('Doppelversand-Schutz: verlorener Claim (affected=0) -> KEINE Mail', async () => {
    const { svc, mail, appointmentRepo } = makeService({ claimAffected: 0 });

    const res = await svc.runOnce(NOW);

    expect(appointmentRepo.update).toHaveBeenCalledTimes(1);
    expect(mail.send).not.toHaveBeenCalled();
    expect(res.erinnert).toBe(0);
  });

  it('Kunde ohne E-Mail -> KEINE Mail, KEIN Claim', async () => {
    const { svc, mail, appointmentRepo } = makeService({
      customer: { id: 'c1', tenantId: 't1', type: CustomerType.PRIVATE, firstName: 'Max', email: null },
    });

    const res = await svc.runOnce(NOW);

    expect(mail.send).not.toHaveBeenCalled();
    expect(appointmentRepo.update).not.toHaveBeenCalled(); // ohne E-Mail wird nie geclaimt
    expect(res.erinnert).toBe(0);
  });

  it('Tenant-Isolation: Termin- und Kunden-Query tragen die tenantId', async () => {
    const { svc, appointmentRepo, customerRepo } = makeService();

    await svc.runOnce(NOW);

    expect(appointmentRepo.find.mock.calls[0][0].where.tenantId).toBe('t1');
    expect(customerRepo.findOne.mock.calls[0][0].where).toMatchObject({ id: 'c1', tenantId: 't1' });
  });

  it('mail.send wirft -> runOnce wirft NICHT (fehler gezaehlt, Claim bleibt = at-most-once)', async () => {
    const mailSend = jest.fn().mockRejectedValue(new Error('SMTP down'));
    const { svc, appointmentRepo } = makeService({ mailSend });

    const res = await svc.runOnce(NOW);

    expect(res.fehler).toBe(1);
    expect(res.erinnert).toBe(0);
    // Claim wurde gesetzt und wird NICHT zurueckgerollt -> kein zweiter Versuch.
    expect(appointmentRepo.update).toHaveBeenCalledTimes(1);
  });

  it('mehrere Betriebe: nur der aktive wird bearbeitet (Isolation der Konfiguration)', async () => {
    const { svc, mail } = makeService({
      tenants: [
        { id: 't1', name: 'Aktiv', email: 'a@a.de', settings: { kundenkommunikation: { terminErinnerungAktiv: true } } },
        { id: 't2', name: 'Inaktiv', email: 'b@b.de', settings: { kundenkommunikation: { terminErinnerungAktiv: false } } },
      ],
    });

    const res = await svc.runOnce(NOW);

    expect(res.tenants).toBe(1);
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].tenantId).toBe('t1');
  });
});
