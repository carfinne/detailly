import { PublicBookingService } from './public-booking.service';
import { TenantStatus } from '../tenants/entities/tenant.entity';

/**
 * Sicherheitskritische Logik des OEFFENTLICHEN Buchungs-Surface:
 * Honeypot, GET-Whitelist (kein Leak interner IDs/E-Mail), tenantId immer
 * serverseitig, 404 statt Status-Enumeration, Pro-Betrieb-Cap, Pflicht-Kontakt.
 * Reine Unit-Tests mit gemockten Repositories (keine DB).
 */
function makeService() {
  const tenantRepo = { findOne: jest.fn() };
  const serviceRepo = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() };
  const bookingRepo = {
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: Record<string, unknown>) => ({ id: 'b1', ...x })),
    delete: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const svc = new PublicBookingService(
    tenantRepo as any,
    serviceRepo as any,
    bookingRepo as any,
    mail as any,
  );
  return { svc, tenantRepo, serviceRepo, bookingRepo, mail };
}

const aktiverBetrieb = {
  id: 'TENANT-1',
  name: 'Muster Aufbereitung',
  email: 'inhaber@muster.de',
  phone: '0123',
  street: 'Weg 1',
  city: 'Berlin',
  postalCode: '10115',
  country: 'DE',
  logoUrl: null,
  businessHours: null,
  status: TenantStatus.ACTIVE,
};

describe('PublicBookingService · Honeypot', () => {
  it('verwirft still bei gefuelltem Honeypot (keine DB-Schreibung, kein Tenant-Lookup)', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    const res = await svc.createAnfrage('muster', {
      name: 'Bot',
      email: 'bot@spam.test',
      website: 'http://spam',
    });
    expect(res.reference).toMatch(/^AF-/);
    expect(tenantRepo.findOne).not.toHaveBeenCalled();
    expect(bookingRepo.save).not.toHaveBeenCalled();
  });
});

describe('PublicBookingService · GET-Whitelist', () => {
  it('liefert KEINE interne id und KEINE Betriebs-E-Mail nach aussen', async () => {
    const { svc, tenantRepo, serviceRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue({ ...aktiverBetrieb });
    serviceRepo.find.mockResolvedValue([
      { id: 's1', name: 'Politur', beschreibung: null, kategorie: 'aufbereitung', basispreis: '99.00', einheit: 'pauschal' },
    ]);
    const res = await svc.getBetrieb('muster');
    const json = JSON.stringify(res);
    expect(res.betrieb.name).toBe('Muster Aufbereitung');
    expect((res.betrieb as unknown as Record<string, unknown>).id).toBeUndefined();
    expect(json).not.toContain('TENANT-1');
    expect(json).not.toContain('inhaber@muster.de');
    // Leistung wird als Zahl projiziert (nicht als decimal-String).
    expect(res.leistungen[0].basispreis).toBe(99);
  });
});

describe('PublicBookingService · Slug-Aufloesung', () => {
  it('404 bei unbekanntem Betrieb', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(null);
    await expect(svc.getBetrieb('gibtsnicht')).rejects.toThrow('Betrieb nicht gefunden');
  });

  it('404 bei inaktivem Betrieb (keine Status-Enumeration)', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue({ ...aktiverBetrieb, status: TenantStatus.INACTIVE });
    await expect(svc.getBetrieb('muster')).rejects.toThrow('Betrieb nicht gefunden');
  });
});

describe('PublicBookingService · Anfrage', () => {
  it('setzt tenantId IMMER serverseitig aus dem Slug-Betrieb', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue({ ...aktiverBetrieb });
    await svc.createAnfrage('muster', { name: 'Anna', email: 'anna@kunde.de' });
    expect(bookingRepo.save).toHaveBeenCalledTimes(1);
    const saved = bookingRepo.save.mock.calls[0][0];
    expect(saved.tenantId).toBe('TENANT-1');
    expect(saved.status).toBe('neu');
    expect(saved.reference).toMatch(/^AF-/);
  });

  it('lehnt ab, wenn weder E-Mail noch Telefon angegeben sind', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue({ ...aktiverBetrieb });
    await expect(svc.createAnfrage('muster', { name: 'Ohne Kontakt' })).rejects.toThrow(
      /E-Mail oder Telefon/,
    );
  });

  it('lehnt eine Leistung ab, die nicht zum Betrieb gehoert', async () => {
    const { svc, tenantRepo, serviceRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue({ ...aktiverBetrieb });
    serviceRepo.findOne.mockResolvedValue(null);
    await expect(
      svc.createAnfrage('muster', {
        name: 'Anna',
        email: 'anna@kunde.de',
        serviceItemId: '11111111-1111-1111-1111-111111111111',
      }),
    ).rejects.toThrow(/Leistung ist nicht verfügbar/);
  });

  it('429 bei Ueberschreiten des Pro-Betrieb-Stundenlimits', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue({ ...aktiverBetrieb });
    bookingRepo.count.mockResolvedValue(20);
    await expect(
      svc.createAnfrage('muster', { name: 'Anna', email: 'anna@kunde.de' }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('speichert die IP nur gehasht, nie im Klartext', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue({ ...aktiverBetrieb });
    await svc.createAnfrage('muster', { name: 'Anna', phone: '0151' }, '203.0.113.7');
    const saved = bookingRepo.save.mock.calls[0][0];
    expect(saved.sourceIpHash).toBeDefined();
    expect(saved.sourceIpHash).not.toContain('203.0.113.7');
    expect(saved.sourceIpHash).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('PublicBookingService · Status per Referenz', () => {
  const VALID = 'AF-0123456789AB';

  it.each(['', 'AF-XYZ', 'foo', 'AF-0123', 'AF-0123456789ABCD'])(
    'unplausible Referenz "%s" -> 404 ohne DB-Treffer',
    async (bad) => {
      const { svc, bookingRepo } = makeService();
      await expect(svc.statusByReference(bad)).rejects.toThrow('Anfrage nicht gefunden');
      expect(bookingRepo.findOne).not.toHaveBeenCalled();
    },
  );

  it('akzeptiert Kleinschreibung (normalisiert auf Grossbuchstaben)', async () => {
    const { svc, bookingRepo, tenantRepo } = makeService();
    bookingRepo.findOne.mockResolvedValue({
      id: 'b1', tenantId: 'TENANT-1', status: 'neu', serviceName: null, wunschtermin: null, createdAt: new Date(),
    });
    tenantRepo.findOne.mockResolvedValue({ id: 'TENANT-1', name: 'Muster' });
    await svc.statusByReference('af-0123456789ab');
    expect(bookingRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reference: VALID } }),
    );
  });

  it('unbekannte Referenz -> 404', async () => {
    const { svc } = makeService();
    await expect(svc.statusByReference(VALID)).rejects.toThrow('Anfrage nicht gefunden');
  });

  it('liefert Status + Betrieb, aber KEINE Kontaktdaten', async () => {
    const { svc, bookingRepo, tenantRepo } = makeService();
    bookingRepo.findOne.mockResolvedValue({
      id: 'b1',
      tenantId: 'TENANT-1',
      status: 'angenommen',
      serviceName: 'Politur',
      wunschtermin: new Date(Date.UTC(2026, 6, 1, 9, 0, 0)),
      createdAt: new Date(Date.UTC(2026, 5, 28, 12, 0, 0)),
      // Felder, die NICHT durchgereicht werden duerfen:
      name: 'Anna Beispiel',
      email: 'anna@kunde.de',
      phone: '0151',
      nachricht: 'geheim',
    });
    tenantRepo.findOne.mockResolvedValue({ id: 'TENANT-1', name: 'Muster Aufbereitung' });

    const res = await svc.statusByReference(VALID);
    expect(res.betrieb).toBe('Muster Aufbereitung');
    expect(res.status).toBe('angenommen');
    expect(res.leistung).toBe('Politur');
    expect(res.wunschtermin).toBe('2026-07-01T09:00:00.000Z');

    const json = JSON.stringify(res);
    for (const verboten of ['Anna Beispiel', 'anna@kunde.de', '0151', 'geheim', 'TENANT-1']) {
      expect(json).not.toContain(verboten);
    }
  });
});
