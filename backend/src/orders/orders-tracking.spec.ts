import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

/**
 * Tests fuer die oeffentliche Auftrags-Verfolgung + Token-Erzeugung.
 * Reine Unit-Tests mit gemockten Repositories (kein DB-Zugriff).
 */
function makeService(over: { order?: any; vehicle?: any; tenant?: any } = {}) {
  const repo: any = {
    findOne: jest.fn().mockResolvedValue(over.order ?? null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const vehicleRepo: any = { findOne: jest.fn().mockResolvedValue(over.vehicle ?? null) };
  const tenantRepo: any = { findOne: jest.fn().mockResolvedValue(over.tenant ?? null) };
  const svc = new OrdersService(
    repo, // Order
    {} as any, // OrderItem
    {} as any, // Customer
    vehicleRepo, // Vehicle
    {} as any, // User
    {} as any, // Location
    tenantRepo, // Tenant
    {} as any, // audit
  );
  return { svc, repo, vehicleRepo, tenantRepo };
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
 * Regression: Der Tracking-Link darf NICHT verloren gehen, wenn der Auftrag
 * bearbeitet wird. Schutz beruht darauf, dass findOne() das Token (select:false)
 * NICHT laedt -> der an save() uebergebene Auftrag traegt kein freigabeToken ->
 * TypeORM laesst die Spalte unangetastet. Dieser Test nagelt genau das fest:
 * wuerde jemand das Token kuenftig mitladen/mitschreiben, schlaegt er an.
 */
describe('OrdersService · changeStatus bewahrt das Tracking-Token', () => {
  it('save() erhaelt einen Auftrag OHNE freigabeToken (kann den Link nicht ueberschreiben)', async () => {
    let saved: any;
    const repo: any = {
      // wie der reale findOne mit select:false: KEIN freigabeToken auf dem Objekt.
      findOne: jest.fn().mockResolvedValue({ id: 'o1', tenantId: 't1', status: 'in_arbeit', items: [] }),
      save: jest.fn().mockImplementation((e) => {
        saved = e;
        return Promise.resolve(e);
      }),
    };
    const audit: any = { log: jest.fn() };
    const svc = new OrdersService(
      repo, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, audit,
    );

    await svc.changeStatus(USER, 'o1', 'qualitaetskontrolle' as any);

    expect(repo.save).toHaveBeenCalledTimes(1);
    // Entscheidend: das gespeicherte Objekt traegt kein Token -> kein Ueberschreiben.
    expect(saved).not.toHaveProperty('freigabeToken');
  });
});
