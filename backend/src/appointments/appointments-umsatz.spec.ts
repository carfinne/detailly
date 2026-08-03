import { GUARDS_METADATA } from '@nestjs/common/constants';
import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Between, In, Not } from 'typeorm';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentStatus } from './entities/appointment.entity';
import { OrderStatus } from '../orders/entities/order.entity';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { REQUIRES_FEATURE_KEY } from '../common/decorators/requires-feature.decorator';
import { UserRole } from '../users/entities/user.entity';

/**
 * Umsatz-Aggregat fuer den Kalender-Chef-Layer (`GET /appointments/umsatz`):
 * - Aggregation: Auftrag mit mehreren Terminen zaehlt EINMAL (fruehester Termin);
 *   abgesagte Termine filtert die DB-Query (Not-Kriterium); Termin ohne Auftrag
 *   bzw. Auftrag ohne Betrag traegt 0 zur Summe bei, zaehlt aber als Auslastung.
 * - Tenant-Scope auf ALLEN drei Queries (Termine, Auftraege, Settings).
 * - Zeitraum-Validierung: von/bis Pflicht (YYYY-MM-DD), bis >= von, max 400 Tage.
 * - zielWoche kommt aus settings.kalender.umsatzZielWoche (geklammert; null ohne Ziel).
 * - Guards per Reflection (verschnitt-guard-Muster): Leitung-only + 'auswertungen'.
 */

function d(tag: string, stunde = 9): Date {
  const [j, m, t] = tag.split('-').map(Number);
  return new Date(j, m - 1, t, stunde);
}

function buildService(overrides?: {
  termine?: any[];
  orders?: any[];
  tenant?: any;
}) {
  const apptRepo = { find: jest.fn().mockResolvedValue(overrides?.termine ?? []) };
  const orderRepo = { find: jest.fn().mockResolvedValue(overrides?.orders ?? []) };
  const tenantRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue(overrides?.tenant ?? { id: 't1', settings: {} }),
  };
  const empty = {} as any;
  const svc = new AppointmentsService(
    apptRepo as any,
    orderRepo as any,
    empty,
    empty,
    empty,
    empty,
    empty, // DataSource (vom Aggregat nicht genutzt)
    tenantRepo as any,
  );
  return { svc, apptRepo, orderRepo, tenantRepo };
}

describe('AppointmentsService.umsatzProTag – Aggregation', () => {
  it('Auftrag mit 2 Terminen: Betrag EINMAL am fruehesten Tag; anzahl zaehlt beide; Termin ohne Auftrag = 0 EUR', async () => {
    const { svc } = buildService({
      termine: [
        { id: 'a1', orderId: 'o1', start: d('2026-07-06') },
        { id: 'a2', orderId: 'o1', start: d('2026-07-08') },
        { id: 'a3', orderId: null, start: d('2026-07-08', 14) },
      ],
      // pg liefert decimal als String -> Number()-Cast im Service.
      orders: [{ id: 'o1', gesamtpreis: '250.50' }],
    });
    const res = await svc.umsatzProTag('t1', '2026-07-06', '2026-07-12');

    expect(res.tage).toHaveLength(7); // jeder Tag des Zeitraums, 0-gefuellt
    const tag = (datum: string) => res.tage.find((t) => t.datum === datum)!;
    expect(tag('2026-07-06')).toEqual({ datum: '2026-07-06', summe: 250.5, anzahl: 1 });
    // Zweittermin desselben Auftrags: zaehlt als Auslastung, NICHT nochmal als Umsatz.
    expect(tag('2026-07-08')).toEqual({ datum: '2026-07-08', summe: 0, anzahl: 2 });
    expect(tag('2026-07-07')).toEqual({ datum: '2026-07-07', summe: 0, anzahl: 0 });
    expect(res.gesamt).toBe(250.5);
    expect(res.von).toBe('2026-07-06');
    expect(res.bis).toBe('2026-07-12');
  });

  it('Auftrag ohne Betrag (gesamtpreis null) zaehlt 0', async () => {
    const { svc } = buildService({
      termine: [{ id: 'a1', orderId: 'o1', start: d('2026-07-06') }],
      orders: [{ id: 'o1', gesamtpreis: null }],
    });
    const res = await svc.umsatzProTag('t1', '2026-07-06', '2026-07-06');
    expect(res.tage[0]).toEqual({ datum: '2026-07-06', summe: 0, anzahl: 1 });
    expect(res.gesamt).toBe(0);
  });

  it('abgesagte Termine zaehlen nicht: DB-Query filtert mit Not(abgesagt) + Between + tenantId', async () => {
    const { svc, apptRepo } = buildService();
    await svc.umsatzProTag('t1', '2026-07-06', '2026-07-12');
    expect(apptRepo.find).toHaveBeenCalledWith({
      where: {
        tenantId: 't1',
        start: Between(d('2026-07-06', 0), new Date(2026, 6, 12, 23, 59, 59, 999)),
        status: Not(AppointmentStatus.ABGESAGT),
      },
      select: ['id', 'orderId', 'start'],
      order: { start: 'ASC' },
    });
  });

  it('Tenant-Scope: Auftrags- und Settings-Query sind auf den Tenant gefiltert', async () => {
    const { svc, orderRepo, tenantRepo } = buildService({
      termine: [{ id: 'a1', orderId: 'o1', start: d('2026-07-06') }],
      orders: [{ id: 'o1', gesamtpreis: '10' }],
    });
    await svc.umsatzProTag('t1', '2026-07-06', '2026-07-06');
    expect(orderRepo.find).toHaveBeenCalledWith({
      where: { tenantId: 't1', id: In(['o1']), status: Not(OrderStatus.STORNIERT) },
      select: ['id', 'gesamtpreis'],
    });
    expect(tenantRepo.findOne).toHaveBeenCalledWith({
      where: { id: 't1' },
      select: ['id', 'settings'],
    });
  });

  // Finding #2: ein stornierter Auftrag (Termin nicht mit abgesagt) darf NICHT in
  // den Umsatz einfliessen -> die Auftrags-Query schliesst STORNIERT serverseitig aus.
  it('stornierter Auftrag fliesst NICHT in den Umsatz: Auftrags-Query schliesst STORNIERT aus', async () => {
    const { svc, orderRepo } = buildService({
      termine: [{ id: 'a1', orderId: 'o1', start: d('2026-07-06') }],
      orders: [{ id: 'o1', gesamtpreis: '100' }],
    });
    await svc.umsatzProTag('t1', '2026-07-06', '2026-07-06');
    expect(orderRepo.find).toHaveBeenCalledWith({
      where: { tenantId: 't1', id: In(['o1']), status: Not(OrderStatus.STORNIERT) },
      select: ['id', 'gesamtpreis'],
    });
  });

  it('ohne Termine mit Auftrag wird die Auftrags-Query gar nicht gestellt', async () => {
    const { svc, orderRepo } = buildService({
      termine: [{ id: 'a1', orderId: null, start: d('2026-07-06') }],
    });
    const res = await svc.umsatzProTag('t1', '2026-07-06', '2026-07-06');
    expect(orderRepo.find).not.toHaveBeenCalled();
    expect(res.tage[0].anzahl).toBe(1);
  });

  describe('Zeitraum-Validierung (400)', () => {
    const { svc } = buildService();
    it.each([
      ['von fehlt', undefined, '2026-07-12'],
      ['bis fehlt', '2026-07-06', undefined],
      ['kein YYYY-MM-DD', '06.07.2026', '2026-07-12'],
      ['ISO mit Zeitanteil', '2026-07-06T00:00:00Z', '2026-07-12'],
      ['Kalender-Rollover (31. Februar)', '2026-02-31', '2026-03-12'],
      ['bis vor von', '2026-07-12', '2026-07-06'],
    ])('%s -> BadRequest', async (_name, von, bis) => {
      await expect(svc.umsatzProTag('t1', von as any, bis as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('401 Tage -> BadRequest, exakt 400 Tage sind erlaubt', async () => {
      await expect(svc.umsatzProTag('t1', '2025-01-01', '2026-02-05')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      const res = await svc.umsatzProTag('t1', '2025-01-01', '2026-02-04');
      expect(res.tage).toHaveLength(400);
    });
  });

  describe('zielWoche (settings.kalender.umsatzZielWoche)', () => {
    it('liefert das gespeicherte Wochenziel mit', async () => {
      const { svc } = buildService({
        tenant: { id: 't1', settings: { kalender: { umsatzZielWoche: 5000 } } },
      });
      const res = await svc.umsatzProTag('t1', '2026-07-06', '2026-07-12');
      expect(res.zielWoche).toBe(5000);
    });

    it('ohne Ziel/Junk -> null; Werte werden geklammert (2 Mio -> 1 Mio)', async () => {
      const ohne = buildService({ tenant: { id: 't1', settings: {} } });
      expect((await ohne.svc.umsatzProTag('t1', '2026-07-06', '2026-07-06')).zielWoche).toBeNull();

      const junk = buildService({
        tenant: { id: 't1', settings: { kalender: { umsatzZielWoche: 'abc' } } },
      });
      expect((await junk.svc.umsatzProTag('t1', '2026-07-06', '2026-07-06')).zielWoche).toBeNull();

      const zuGross = buildService({
        tenant: { id: 't1', settings: { kalender: { umsatzZielWoche: 2_000_000 } } },
      });
      expect((await zuGross.svc.umsatzProTag('t1', '2026-07-06', '2026-07-06')).zielWoche).toBe(
        1_000_000,
      );
    });
  });
});

/**
 * Guard-Verdrahtung (Reflection, kein Nest-Bootstrap; Muster verschnitt-guard.spec):
 * - `GET umsatz` = Leitung-only + @RequiresFeature('auswertungen') (Feature-403
 *   fuer Starter setzt der bereits getestete PlanFeatureGuard durch).
 * - Bestandsrouten bleiben OHNE Feature-Gate (Termine = KERN in allen Tarifen).
 * - Deklarations-Reihenfolge: 'umsatz' MUSS vor dem Catch-all ':id' stehen.
 */
describe('AppointmentsController · Guards (GET umsatz)', () => {
  const proto = AppointmentsController.prototype as any;

  function ctxFor(handler: any, role: string): any {
    return {
      getHandler: () => handler,
      getClass: () => AppointmentsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    };
  }

  it('haengt am PlanFeatureGuard (Guard-Kette Jwt -> Subscription -> PlanFeature -> Roles)', () => {
    const classGuards: unknown[] =
      Reflect.getMetadata(GUARDS_METADATA, AppointmentsController) ?? [];
    expect(classGuards).toContain(PlanFeatureGuard);
  });

  it('umsatz traegt @RequiresFeature("auswertungen") (Feature-403 fuer Starter)', () => {
    expect(Reflect.getMetadata(REQUIRES_FEATURE_KEY, proto.umsatz)).toBe('auswertungen');
  });

  it('Bestandsrouten und Klasse tragen KEIN Feature-Gate (Termine = KERN)', () => {
    expect(Reflect.getMetadata(REQUIRES_FEATURE_KEY, AppointmentsController)).toBeUndefined();
    for (const handler of [proto.findRange, proto.findOne, proto.create, proto.update]) {
      expect(Reflect.getMetadata(REQUIRES_FEATURE_KEY, handler)).toBeUndefined();
    }
  });

  describe('RolesGuard: umsatz ist Leitung-only', () => {
    const guard = new RolesGuard(new Reflector());
    it.each([UserRole.TECHNICIAN, UserRole.RECEPTIONIST])('403 fuer %s', (role) => {
      expect(guard.canActivate(ctxFor(proto.umsatz, role))).toBe(false);
    });
    it.each([UserRole.MANAGER, UserRole.OWNER])('erlaubt fuer %s', (role) => {
      expect(guard.canActivate(ctxFor(proto.umsatz, role))).toBe(true);
    });
  });

  it('Route "umsatz" ist VOR dem Catch-all ":id" deklariert (sonst frisst :id den Pfad)', () => {
    const methoden = Object.getOwnPropertyNames(proto);
    expect(methoden.indexOf('umsatz')).toBeGreaterThan(-1);
    expect(methoden.indexOf('umsatz')).toBeLessThan(methoden.indexOf('findOne'));
  });
});
