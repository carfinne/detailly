import { BadRequestException, ConflictException } from '@nestjs/common';
import { BookingRequestsService } from './booking-requests.service';
import { BookingRequest, BookingRequestStatus } from './entities/booking-request.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Doppelbuchungs-Schutz + Mitarbeiter-Zuweisung beim Annehmen einer Online-Anfrage
 * (Kalender 2.0). Der Konfliktcheck laeuft in DERSELBEN Transaktion wie der
 * Status-Flip und die Termin-Anlage; die Mitarbeiter-Referenz wird tenant-scoped
 * VOR der Transaktion validiert. Reine Mocks (kein Nest-Bootstrap, keine DB).
 */

const USER: AuthUser = { id: 'u1', email: 'op@betrieb.de', role: 'owner', tenantId: 't1' } as AuthUser;
const START = new Date('2026-07-10T09:00:00.000Z');
const ENDE = new Date('2026-07-10T10:00:00.000Z');
const DTO = { start: START.toISOString(), ende: ENDE.toISOString() };

const KONF = {
  id: 'k1',
  titel: 'Bestehender Termin',
  start: new Date('2026-07-10T09:30:00.000Z'),
  ende: new Date('2026-07-10T10:30:00.000Z'),
  assignedUserId: 'emp1',
};

/** Anfrage ohne Kunden-E-Mail (die Terminbestaetigung wird so uebersprungen). */
function makeReq(over: Partial<BookingRequest> = {}): any {
  return {
    id: 'br1',
    tenantId: 't1',
    name: 'Max Muster',
    email: null,
    phone: null,
    serviceItemId: null,
    serviceName: null,
    fahrzeug: null,
    wunschtermin: null,
    nachricht: null,
    status: BookingRequestStatus.NEU,
    reference: 'AF-ABCDEF123456',
    createdAt: new Date('2026-07-01T09:00:00.000Z'),
    ...over,
  };
}

const flush = () => new Promise((r) => setImmediate(r));

function makeManager(opts: { req: any; konflikte?: any[]; kalender?: Record<string, unknown> }) {
  const saved: { entity: any; data: any }[] = [];
  let seq = 0;
  const qb: any = {};
  for (const method of ['where', 'andWhere', 'orderBy', 'take']) qb[method] = jest.fn(() => qb);
  qb.getMany = jest.fn(async () => opts.konflikte ?? []);
  const manager: any = {
    findOne: jest.fn(async (entity: any) => {
      if (entity === BookingRequest) return opts.req;
      if (entity?.name === 'Tenant') {
        return { id: 't1', settings: opts.kalender ? { kalender: opts.kalender } : {} };
      }
      return null;
    }),
    update: jest.fn(async (_e: any, criteria: any, patch: any) => {
      const r = opts.req;
      if (r && criteria.id === r.id && criteria.tenantId === r.tenantId && criteria.status === r.status) {
        Object.assign(r, patch);
        return { affected: 1 };
      }
      return { affected: 0 };
    }),
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((entity: any, data: any) => ({ __entity: entity, ...data })),
    save: jest.fn(async (obj: any) => {
      if (!obj.id) obj.id = `${(obj.__entity?.name ?? 'X').toLowerCase()}-${++seq}`;
      saved.push({ entity: obj.__entity, data: obj });
      return obj;
    }),
    getRepository: jest.fn(() => ({ count: jest.fn().mockResolvedValue(0) })),
  };
  return { manager, saved, qb };
}

function makeSvc(opts: { req: any; konflikte?: any[]; kalender?: Record<string, unknown>; userRow?: any }) {
  const { manager, saved, qb } = makeManager(opts);
  // Mitarbeiter-Referenzpruefung vor der Transaktion (tenant-scoped).
  const userRepo = {
    findOne: jest.fn(async () => (opts.userRow === undefined ? { id: 'emp1', tenantId: 't1' } : opts.userRow)),
  };
  const customerRepo = { count: jest.fn().mockResolvedValue(0) };
  const dataSource = {
    getRepository: jest.fn().mockImplementation((entity: any) => {
      if (entity?.name === 'User') return userRepo;
      return customerRepo;
    }),
    transaction: jest.fn(async (cb: (m: any) => Promise<any>) => cb(manager)),
  };
  const svc = new BookingRequestsService(
    {} as any,
    dataSource as any,
    { log: jest.fn().mockResolvedValue(undefined) } as any,
    { assertLimit: jest.fn().mockResolvedValue(undefined) } as any,
    { send: jest.fn().mockResolvedValue(undefined) } as any,
    { get: jest.fn().mockReturnValue('https://app.detailly.de') } as any,
  );
  return { svc, manager, saved, dataSource, userRepo, qb };
}

const savedOf = (saved: { entity: any; data: any }[], entity: any) =>
  saved.filter((s) => s.entity === entity).map((s) => s.data);

describe('BookingRequestsService.accept – Doppelbuchungs-Schutz + Mitarbeiter-Zuweisung', () => {
  const BASE = { ...DTO, kundeAnlegen: false, auftragAnlegen: false };

  it('weist die Anfrage einem Mitarbeiter zu (kein Konflikt) -> Termin traegt assignedUserId', async () => {
    const { svc, saved, manager } = makeSvc({ req: makeReq(), konflikte: [] });
    await svc.accept(USER, 'br1', { ...BASE, assignedUserId: 'emp1' } as any);
    await flush();
    const [appt] = savedOf(saved, Appointment);
    expect(appt.assignedUserId).toBe('emp1');
    // Der Konfliktcheck ist gelaufen (Mitarbeiter gesetzt).
    expect(manager.createQueryBuilder).toHaveBeenCalled();
  });

  it('Kollision (warnen, unbestaetigt) -> 409, KEINE Writes (Termin/Flip rollen zurueck)', async () => {
    const { svc, manager, saved } = makeSvc({ req: makeReq(), konflikte: [KONF] });
    const err = await svc.accept(USER, 'br1', { ...BASE, assignedUserId: 'emp1' } as any).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err.getResponse() as any).code).toBe('APPOINTMENT_OVERLAP');
    expect(manager.save).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);
  });

  it('Kollision + konfliktBestaetigt=true (warnen) -> Termin wird angelegt', async () => {
    const { svc, saved } = makeSvc({ req: makeReq(), konflikte: [KONF] });
    await svc.accept(USER, 'br1', { ...BASE, assignedUserId: 'emp1', konfliktBestaetigt: true } as any);
    await flush();
    const [appt] = savedOf(saved, Appointment);
    expect(appt.assignedUserId).toBe('emp1');
  });

  it('blockieren ignoriert konfliktBestaetigt -> immer 409', async () => {
    const { svc } = makeSvc({
      req: makeReq(),
      konflikte: [KONF],
      kalender: { konfliktverhalten: 'blockieren' },
    });
    await expect(
      svc.accept(USER, 'br1', { ...BASE, assignedUserId: 'emp1', konfliktBestaetigt: true } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('Fremd-Tenant-Mitarbeiter -> 400, Transaktion startet NICHT', async () => {
    const { svc, dataSource } = makeSvc({ req: makeReq(), userRow: null });
    await expect(
      svc.accept(USER, 'br1', { ...BASE, assignedUserId: 'fremd' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('ohne assignedUserId: kein Konfliktcheck (rueckwaertskompatibel)', async () => {
    const { svc, saved, manager } = makeSvc({ req: makeReq(), konflikte: [KONF] });
    await svc.accept(USER, 'br1', { ...BASE } as any);
    await flush();
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    const [appt] = savedOf(saved, Appointment);
    expect(appt.assignedUserId).toBeUndefined();
  });
});
