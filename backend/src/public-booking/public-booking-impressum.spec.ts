import { PublicBookingService } from './public-booking.service';
import { TenantStatus } from '../tenants/entities/tenant.entity';

/**
 * Oeffentliches Tenant-Impressum (§ 5 DDG): PII-Grenze (Whitelist), Tenant-Scope
 * (unbekannt/inaktiv -> 404) und Best-effort-Ausgabe bei unvollstaendigen Daten.
 * Reine Unit-Tests mit gemockten Repositories (keine DB).
 */
function makeService() {
  const tenantRepo = { findOne: jest.fn() };
  const serviceRepo = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() };
  const bookingRepo = { count: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn(), findOne: jest.fn() };
  const appointmentRepo = { manager: { find: jest.fn() } };
  const mail = { send: jest.fn() };
  const svc = new PublicBookingService(
    tenantRepo as any,
    serviceRepo as any,
    bookingRepo as any,
    appointmentRepo as any,
    mail as any,
    { get: jest.fn() } as any,
  );
  return { svc, tenantRepo, bookingRepo };
}

/** Aktiver UG-Betrieb mit vollstaendigen Registerangaben – enthaelt bewusst auch
 *  Steuernummer + IBAN in den settings, die NIE im Impressum landen duerfen. */
const ugBetrieb = {
  id: 'TENANT-IMP-1',
  name: 'Glanz UG (haftungsbeschränkt)',
  email: 'kontakt@glanz.de',
  phone: '030 7654321',
  street: 'Politurstraße 7',
  city: 'Hamburg',
  postalCode: '20095',
  country: 'DE',
  logoUrl: null,
  status: TenantStatus.ACTIVE,
  settings: {
    ustId: 'DE987654321',
    steuernummer: '12/345/67890', // DARF NICHT im Impressum erscheinen
    iban: 'DE00123456780000000000', // DARF NICHT im Impressum erscheinen
    bic: 'GENODEF1XXX',
    steuer: {
      rechtsform: 'ug',
      registergericht: 'Amtsgericht Hamburg',
      registernummer: 'HRB 543210',
      vertretungsberechtigte: 'Erika Mustermann',
    },
    impressum: { berufshaftpflicht: 'Allianz, Berlin (DE)', aufsichtsbehoerde: '' },
  },
};

describe('PublicBookingService · Impressum (§ 5 DDG)', () => {
  it('liefert genau die veroeffentlichungspflichtigen Angaben (USt-IdNr. inklusive)', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue({ ...ugBetrieb });
    const res = await svc.getImpressum('glanz-ug');
    expect(res.firmenname).toBe('Glanz UG (haftungsbeschränkt)');
    expect(res.rechtsformLabel).toBe('UG (haftungsbeschränkt)');
    expect(res.anschrift).toEqual({ strasse: 'Politurstraße 7', plzOrt: '20095 Hamburg', land: 'Deutschland' });
    expect(res.vertretungLabel).toBe('Vertretungsberechtigte(r)');
    expect(res.vertretungsberechtigte).toBe('Erika Mustermann');
    expect(res.telefon).toBe('030 7654321');
    expect(res.email).toBe('kontakt@glanz.de'); // § 5 DDG: Pflicht, daher hier bewusst public
    expect(res.registergericht).toBe('Amtsgericht Hamburg');
    expect(res.registernummer).toBe('HRB 543210');
    expect(res.ustId).toBe('DE987654321');
    expect(res.berufshaftpflicht).toBe('Allianz, Berlin (DE)');
  });

  it('leakt NIE Steuernummer, IBAN, BIC oder interne IDs', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue({ ...ugBetrieb });
    const res = await svc.getImpressum('glanz-ug');
    const json = JSON.stringify(res);
    for (const verboten of ['12/345/67890', 'DE00123456780000000000', 'GENODEF1XXX', 'TENANT-IMP-1']) {
      expect(json).not.toContain(verboten);
    }
  });

  it('404 bei unbekanntem Betrieb', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(null);
    await expect(svc.getImpressum('gibtsnicht')).rejects.toThrow('Betrieb nicht gefunden');
  });

  it('404 bei inaktivem Betrieb (keine Status-Enumeration)', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue({ ...ugBetrieb, status: TenantStatus.INACTIVE });
    await expect(svc.getImpressum('glanz-ug')).rejects.toThrow('Betrieb nicht gefunden');
  });

  it('best-effort: unvollstaendiger Betrieb liefert Inhalt statt Fehler (Link muss erreichbar bleiben)', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue({
      id: 'T2',
      name: 'Neuer Betrieb',
      email: null,
      phone: null,
      street: null,
      city: null,
      postalCode: null,
      country: 'DE',
      logoUrl: null,
      status: TenantStatus.ACTIVE,
      settings: {},
    });
    const res = await svc.getImpressum('neu');
    expect(res.firmenname).toBe('Neuer Betrieb');
    expect(res.telefon).toBe('');
    expect(res.email).toBe('');
    // Default-Rechtsform (Einzelunternehmen) -> Inhaber-Label, kein Register.
    expect(res.vertretungLabel).toBe('Inhaber/in');
    expect(res.registergericht).toBe('');
  });
});

describe('PublicBookingService · Status liefert betriebSlug (fuer Impressum-Link)', () => {
  it('gibt den Slug PII-frei mit dem Status zurueck', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    bookingRepo.findOne.mockResolvedValue({
      id: 'b1',
      tenantId: 'TENANT-1',
      status: 'neu',
      serviceName: null,
      wunschtermin: null,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 0)),
    });
    tenantRepo.findOne.mockResolvedValue({ id: 'TENANT-1', name: 'Muster', slug: 'muster' });
    const res = await svc.statusByReference('AF-0123456789AB');
    expect(res.betrieb).toBe('Muster');
    expect(res.betriebSlug).toBe('muster');
  });
});
