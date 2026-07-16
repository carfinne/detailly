import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

/**
 * Tests fuer die oeffentliche Auftrags-Verfolgung + Token-Erzeugung.
 * Reine Unit-Tests mit gemockten Repositories (kein DB-Zugriff).
 */
function makeService(
  over: { order?: any; vehicle?: any; tenant?: any; feature?: boolean } = {},
) {
  const repo: any = {
    findOne: jest.fn().mockResolvedValue(over.order ?? null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const vehicleRepo: any = { findOne: jest.fn().mockResolvedValue(over.vehicle ?? null) };
  const tenantRepo: any = { findOne: jest.fn().mockResolvedValue(over.tenant ?? null) };
  // Tenant-Gate der oeffentlichen Erlebnis-Felder: Default AUS (Basis-Ticker).
  const subscriptions: any = {
    hasFeatureForTenant: jest.fn().mockResolvedValue(over.feature ?? false),
  };
  const svc = new OrdersService(
    repo, // Order
    {} as any, // OrderItem
    {} as any, // Customer
    vehicleRepo, // Vehicle
    {} as any, // User
    {} as any, // Location
    tenantRepo, // Tenant
    {} as any, // Invoice
    {} as any, // audit
    { send: jest.fn() } as any, // mail (hier ungenutzt)
    { get: jest.fn() } as any, // config
    subscriptions, // subscriptions (Feature-Gate)
  );
  return { svc, repo, vehicleRepo, tenantRepo, subscriptions };
}

const VALID_TOKEN = 'a'.repeat(48); // randomBytes(24).hex => 48 Hex-Zeichen
const USER: any = { id: 'u1', tenantId: 't1' };

describe('OrdersService · trackingByToken (oeffentlich)', () => {
  it.each(['', '   ', 'abc', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz', 'short', '../etc'])(
    'unplausibles Token "%s" -> 404 ohne DB-Treffer',
    async (bad) => {
      const { svc, repo } = makeService();
      await expect(svc.trackingByToken(bad)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.findOne).not.toHaveBeenCalled();
    },
  );

  it('unbekanntes (aber gueltig geformtes) Token -> 404', async () => {
    const { svc } = makeService({ order: null });
    await expect(svc.trackingByToken(VALID_TOKEN)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gueltiges Token -> nur unkritische Anzeigefelder', async () => {
    const { svc } = makeService({
      order: {
        id: 'o1',
        tenantId: 't1',
        auftragsnummer: 'AU-2026-0001',
        serviceType: 'folierung',
        status: 'in_arbeit',
        vehicleId: 'v1',
        geplanterStart: new Date(Date.UTC(2026, 5, 28, 8, 0, 0)),
        geplantesEnde: null,
        updatedAt: new Date(Date.UTC(2026, 5, 27, 10, 0, 0)),
      },
      vehicle: { make: 'VW', model: 'Golf', variant: 'GTI', licensePlate: 'B-XY 123' },
      tenant: { id: 't1', name: 'Muster GmbH' },
    });

    const view = await svc.trackingByToken(VALID_TOKEN);

    expect(view.betrieb).toBe('Muster GmbH');
    expect(view.auftragsnummer).toBe('AU-2026-0001');
    expect(view.serviceType).toBe('folierung');
    expect(view.status).toBe('in_arbeit');
    expect(view.fahrzeug).toBe('VW Golf GTI');
    expect(view.kennzeichen).toBe('B-XY 123');
    expect(view.geplanterStart).toBe('2026-06-28T08:00:00.000Z');
    expect(view.geplantesEnde).toBeNull();

    // KEINE sensiblen Felder durchreichen.
    for (const verboten of ['gesamtpreis', 'nettoSumme', 'internerHinweis', 'customerId', 'freigabeToken']) {
      expect(view as unknown as Record<string, unknown>).not.toHaveProperty(verboten);
    }
  });

  it('Auftrag ohne Fahrzeug -> fahrzeug/kennzeichen null', async () => {
    const { svc } = makeService({
      order: {
        id: 'o1', tenantId: 't1', auftragsnummer: 'AU-1', serviceType: 'aufbereitung',
        status: 'angefragt', vehicleId: null, geplanterStart: null, geplantesEnde: null,
        updatedAt: new Date(),
      },
      tenant: { id: 't1', name: 'Werkstatt' },
    });
    const view = await svc.trackingByToken(VALID_TOKEN);
    expect(view.fahrzeug).toBeNull();
    expect(view.kennzeichen).toBeNull();
  });
});

describe('OrdersService · trackingByToken · Pro-Branding (Feature-Gate)', () => {
  const baseOrder = {
    id: 'o1', tenantId: 't1', auftragsnummer: 'AU-1', serviceType: 'folierung',
    status: 'fertig', vehicleId: null, geplanterStart: null, geplantesEnde: null,
    updatedAt: new Date(),
  };

  it('OHNE Feature -> Basis-Ticker ohne Branding/Mappe-Felder', async () => {
    const { svc } = makeService({
      order: baseOrder,
      tenant: { id: 't1', name: 'Muster', logoUrl: 'https://x/logo.png', betriebstyp: 'folierung' },
      feature: false,
    });
    const view = await svc.trackingByToken(VALID_TOKEN);
    for (const feld of ['logo', 'akzent', 'mappeVerfuegbar']) {
      expect(view as unknown as Record<string, unknown>).not.toHaveProperty(feld);
    }
  });

  it('MIT Feature + Status fertig -> Logo, Akzent (Betriebstyp) und mappeVerfuegbar=true', async () => {
    const { svc } = makeService({
      order: baseOrder,
      tenant: { id: 't1', name: 'Muster', logoUrl: 'https://x/logo.png', betriebstyp: 'folierung' },
      feature: true,
    });
    const view = await svc.trackingByToken(VALID_TOKEN);
    expect(view.logo).toBe('https://x/logo.png');
    expect(view.akzent).toBe('#9B76FC'); // folierung
    expect(view.mappeVerfuegbar).toBe(true);
  });

  it('MIT Feature aber Status in_arbeit -> mappeVerfuegbar=false', async () => {
    const { svc } = makeService({
      order: { ...baseOrder, status: 'in_arbeit' },
      tenant: { id: 't1', name: 'Muster', betriebstyp: 'ppf' },
      feature: true,
    });
    const view = await svc.trackingByToken(VALID_TOKEN);
    expect(view.mappeVerfuegbar).toBe(false);
    expect(view.akzent).toBe('#3EBFB9'); // ppf
  });

  it('MIT Feature: eigene settings.akzentfarbe hat Vorrang, unsauberes Logo -> null', async () => {
    const { svc } = makeService({
      order: baseOrder,
      tenant: {
        id: 't1', name: 'Muster', logoUrl: 'javascript:alert(1)',
        betriebstyp: 'folierung', settings: { akzentfarbe: '#123abc' },
      },
      feature: true,
    });
    const view = await svc.trackingByToken(VALID_TOKEN);
    expect(view.akzent).toBe('#123abc');
    expect(view.logo).toBeNull();
  });
});

describe('OrdersService · Tracking-Token erzeugen', () => {
  it('vorhandenes Token wird zurueckgegeben (kein Neuschreiben)', async () => {
    const { svc, repo } = makeService({ order: { id: 'o1', freigabeToken: VALID_TOKEN } });
    const res = await svc.getOrCreateTrackingToken(USER, 'o1');
    expect(res.token).toBe(VALID_TOKEN);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('fehlendes Token wird erzeugt (48 Hex) und tenant-scoped gespeichert', async () => {
    const { svc, repo } = makeService({ order: { id: 'o1', freigabeToken: null } });
    const res = await svc.getOrCreateTrackingToken(USER, 'o1');
    expect(res.token).toMatch(/^[a-f0-9]{48}$/);
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'o1', tenantId: 't1' },
      { freigabeToken: res.token },
    );
  });

  it('unbekannter Auftrag -> 404', async () => {
    const { svc } = makeService({ order: null });
    await expect(svc.getOrCreateTrackingToken(USER, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('regenerate erzeugt neues Token und speichert es', async () => {
    const { svc, repo } = makeService({ order: { id: 'o1' } });
    const res = await svc.regenerateTrackingToken(USER, 'o1');
    expect(res.token).toMatch(/^[a-f0-9]{48}$/);
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'o1', tenantId: 't1' },
      { freigabeToken: res.token },
    );
  });

  it('regenerate fuer unbekannten Auftrag -> 404', async () => {
    const { svc } = makeService({ order: null });
    await expect(svc.regenerateTrackingToken(USER, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

/**
 * Regression: Der Tracking-Link darf NICHT verloren gehen, wenn der Status
 * wechselt. Der Statuswechsel schreibt seit dem Race-Fix per konditionalem
 * repo.update AUSSCHLIESSLICH die status-Spalte – freigabeToken kann dabei
 * strukturell nicht ueberschrieben werden. Dieser Test nagelt genau das fest:
 * wuerde jemand kuenftig wieder das ganze Objekt speichern oder das Token in
 * den Payload aufnehmen, schlaegt er an.
 */
describe('OrdersService · changeStatus bewahrt das Tracking-Token', () => {
  it('schreibt NUR die status-Spalte (statusgeschuetzt), nie freigabeToken', async () => {
    const repo: any = {
      // wie der reale findOne mit select:false: KEIN freigabeToken auf dem Objekt.
      findOne: jest.fn().mockResolvedValue({ id: 'o1', tenantId: 't1', status: 'in_arbeit', items: [] }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(), // darf fuer den Statuswechsel NICHT mehr genutzt werden
    };
    const audit: any = { log: jest.fn() };
    const svc = new OrdersService(
      repo, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any /* Invoice */, audit,
      { send: jest.fn() } as any, // mail (in_arbeit->qualitaetskontrolle ist nicht kuratiert)
      { get: jest.fn() } as any, // config
      {} as any, // subscriptions (hier ungenutzt)
    );

    await svc.changeStatus(USER, 'o1', 'qualitaetskontrolle' as any);

    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledTimes(1);
    const [kriterium, payload] = repo.update.mock.calls[0];
    // Konditional auf den alten Status -> paralleler identischer Wechsel wirkt nur einmal.
    expect(kriterium).toEqual({ id: 'o1', tenantId: 't1', status: 'in_arbeit' });
    // Entscheidend: Payload enthaelt NUR status -> kein Ueberschreiben des Tokens.
    expect(payload).toEqual({ status: 'qualitaetskontrolle' });
  });
});
