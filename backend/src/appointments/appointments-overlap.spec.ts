import { ConflictException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import {
  assertKeinTerminKonflikt,
  findeTerminKonflikte,
} from '../common/kalender/appointment-overlap';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Doppelbuchungs-Schutz (Kalender 2.0): der Overlap-Check greift in create/update/
 * patchTime. Getestet werden der reine SQL-Aufbau (Scope/Tenant/Self-Ausschluss)
 * sowie das Verhalten warnen/blockieren + konfliktBestaetigt am Service. Reine
 * Mocks (kein Nest-Bootstrap, keine DB): der Transaktions-Manager fuehrt den
 * Callback wirklich aus, der QueryBuilder liefert die konfigurierten Konflikte.
 */

const USER: AuthUser = { id: 'u1', email: 'op@betrieb.de', role: 'owner', tenantId: 't1' } as AuthUser;
const START = '2026-07-01T10:00:00.000Z';
const ENDE = '2026-07-01T11:00:00.000Z';
const EMP = 'u-emp';

const KONF = {
  id: 'k1',
  titel: 'Bestehender Termin',
  start: new Date('2026-07-01T10:30:00.000Z'),
  ende: new Date('2026-07-01T11:30:00.000Z'),
  assignedUserId: EMP,
} as Appointment;

// ---------------------------------------------------------------------------
// Reiner SQL-/Scope-Aufbau von findeTerminKonflikte
// ---------------------------------------------------------------------------

function makeManager(rows: any[] = []) {
  const calls: { m: string; a: any[] }[] = [];
  const qb: any = {};
  for (const method of ['where', 'andWhere', 'orderBy', 'take']) {
    qb[method] = jest.fn((...a: any[]) => {
      calls.push({ m: method, a });
      return qb;
    });
  }
  qb.getMany = jest.fn(async () => rows);
  const m: any = { createQueryBuilder: jest.fn(() => qb) };
  const params = () => Object.assign({}, ...calls.map((c) => c.a[1]).filter(Boolean));
  return { m, qb, calls, params };
}

describe('findeTerminKonflikte (Scope + SQL-Aufbau)', () => {
  const start = new Date(START);
  const ende = new Date(ENDE);

  it('ohne Mitarbeiter und ohne aktiven Standort-Check -> KEIN Query, leere Liste', async () => {
    const { m } = makeManager();
    const res = await findeTerminKonflikte(m, 't1', { start, ende }, false);
    expect(res).toEqual([]);
    expect(m.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('abgesagter neuer Termin -> KEIN Query (blockt nicht)', async () => {
    const { m } = makeManager();
    const res = await findeTerminKonflikte(
      m,
      't1',
      { start, ende, assignedUserId: EMP, status: AppointmentStatus.ABGESAGT },
      false,
    );
    expect(res).toEqual([]);
    expect(m.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('mit Mitarbeiter: tenant-scoped, abgesagt-Ausschluss, Overlap-Bedingung, Mitarbeiter-Filter', async () => {
    const { m, calls, params } = makeManager([]);
    await findeTerminKonflikte(m, 't1', { start, ende, assignedUserId: EMP }, false);
    expect(m.createQueryBuilder).toHaveBeenCalledWith(Appointment, 'a');
    const whereCall = calls.find((c) => c.m === 'where');
    expect(whereCall?.a).toEqual(['a.tenantId = :tenantId', { tenantId: 't1' }]);
    const p = params();
    expect(p.tenantId).toBe('t1');
    expect(p.abgesagt).toBe(AppointmentStatus.ABGESAGT);
    expect(p.neuEnde).toBe(ende);
    expect(p.neuStart).toBe(start);
    expect(p.konfUser).toBe(EMP);
    // ohne id -> keine Self-Ausschluss-Bedingung
    expect(p.selfId).toBeUndefined();
  });

  it('bei gesetzter id wird der Termin selbst ausgeschlossen (update/patchTime)', async () => {
    const { m, params } = makeManager([]);
    await findeTerminKonflikte(m, 't1', { id: 'self', start, ende, assignedUserId: EMP }, false);
    expect(params().selfId).toBe('self');
  });

  it('Standort-Check nur wenn aktiv UND locationId gesetzt (auch ohne Mitarbeiter)', async () => {
    const { m, params } = makeManager([]);
    await findeTerminKonflikte(m, 't1', { start, ende, locationId: 'loc1' }, true);
    expect(m.createQueryBuilder).toHaveBeenCalled();
    expect(params().konfStandort).toBe('loc1');
  });

  it('Standort-Check inaktiv -> locationId allein loest KEINEN Query aus', async () => {
    const { m } = makeManager([]);
    const res = await findeTerminKonflikte(m, 't1', { start, ende, locationId: 'loc1' }, false);
    expect(res).toEqual([]);
    expect(m.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe('assertKeinTerminKonflikt (warnen/blockieren-Gate)', () => {
  const start = new Date(START);
  const ende = new Date(ENDE);
  const scope = { start, ende, assignedUserId: EMP };

  it('keine Konflikte -> kein Wurf', async () => {
    const { m } = makeManager([]);
    await expect(
      assertKeinTerminKonflikt(m, 't1', scope, { konfliktverhalten: 'warnen', standortKonflikt: false }, undefined),
    ).resolves.toBeUndefined();
  });

  it('warnen + Konflikt ohne Bestaetigung -> 409 mit strukturiertem Payload (max 5, nur eigene Daten)', async () => {
    const { m } = makeManager([KONF]);
    const err = await assertKeinTerminKonflikt(
      m,
      't1',
      scope,
      { konfliktverhalten: 'warnen', standortKonflikt: false },
      undefined,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toEqual({
      code: 'APPOINTMENT_OVERLAP',
      konflikte: [{ id: 'k1', titel: 'Bestehender Termin', start: KONF.start, ende: KONF.ende, assignedUserId: EMP }],
    });
  });

  it('warnen + konfliktBestaetigt=true -> kein Wurf (bestaetigte Warnung)', async () => {
    const { m } = makeManager([KONF]);
    await expect(
      assertKeinTerminKonflikt(m, 't1', scope, { konfliktverhalten: 'warnen', standortKonflikt: false }, true),
    ).resolves.toBeUndefined();
  });

  it('blockieren ignoriert konfliktBestaetigt -> immer 409', async () => {
    const { m } = makeManager([KONF]);
    await expect(
      assertKeinTerminKonflikt(m, 't1', scope, { konfliktverhalten: 'blockieren', standortKonflikt: false }, true),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

// ---------------------------------------------------------------------------
// Service-Verhalten: create/patchTime loesen den Overlap-Check aus
// ---------------------------------------------------------------------------

function makeSvc(opts: { konflikte?: any[]; kalender?: Record<string, unknown> } = {}) {
  const saved: any[] = [];
  const konflikte = opts.konflikte ?? [];
  const makeQb = () => {
    const qb: any = {};
    for (const method of ['where', 'andWhere', 'orderBy', 'take']) qb[method] = jest.fn(() => qb);
    qb.getMany = jest.fn(async () => konflikte);
    return qb;
  };
  const manager: any = {
    // Tenant-Settings-Read (resolveKalender liest settings.kalender)
    findOne: jest.fn(async () => ({ id: 't1', settings: opts.kalender ? { kalender: opts.kalender } : {} })),
    createQueryBuilder: jest.fn(() => makeQb()),
    create: jest.fn((_e: any, data: any) => ({ ...data })),
    save: jest.fn(async (obj: any) => {
      saved.push(obj);
      return { id: 'a-new', ...obj };
    }),
  };
  const dataSource: any = { transaction: jest.fn(async (cb: (m: any) => Promise<any>) => cb(manager)) };
  // assertRefs: alle FK-Repos tenant-gruen halten.
  const refRepo: any = { findOne: jest.fn(async () => ({ id: 'x', tenantId: 't1' })) };
  // Bestehender Termin fuer patchTime (Mitarbeiter gesetzt -> Check greift).
  const apptRepo: any = {
    findOne: jest.fn(async () => ({
      id: 'a1',
      tenantId: 't1',
      start: new Date(START),
      ende: new Date(ENDE),
      assignedUserId: EMP,
      locationId: null,
      status: AppointmentStatus.GEPLANT,
    })),
  };
  const svc = new AppointmentsService(
    apptRepo,
    refRepo,
    refRepo,
    refRepo,
    refRepo,
    refRepo,
    dataSource,
  );
  return { svc, saved, manager };
}

describe('AppointmentsService – Overlap-Check (create/patchTime)', () => {
  it('create: Kollision (warnen, unbestaetigt) -> 409 mit Payload, kein Save', async () => {
    const { svc, saved } = makeSvc({ konflikte: [KONF] });
    const err = await svc
      .create(USER, { titel: 'Neu', start: START, ende: ENDE, assignedUserId: EMP } as any)
      .catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err.getResponse() as any).code).toBe('APPOINTMENT_OVERLAP');
    expect(saved).toHaveLength(0);
  });

  it('create: konfliktBestaetigt=true speichert bei warnen', async () => {
    const { svc, saved } = makeSvc({ konflikte: [KONF] });
    await svc.create(USER, {
      titel: 'Neu',
      start: START,
      ende: ENDE,
      assignedUserId: EMP,
      konfliktBestaetigt: true,
    } as any);
    expect(saved).toHaveLength(1);
    // Das transiente Flag wird NICHT mitgespeichert.
    expect(saved[0].konfliktBestaetigt).toBeUndefined();
  });

  it('create: blockieren ignoriert konfliktBestaetigt -> immer 409', async () => {
    const { svc, saved } = makeSvc({ konflikte: [KONF], kalender: { konfliktverhalten: 'blockieren' } });
    await expect(
      svc.create(USER, {
        titel: 'Neu',
        start: START,
        ende: ENDE,
        assignedUserId: EMP,
        konfliktBestaetigt: true,
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(saved).toHaveLength(0);
  });

  it('create: neuer Termin abgesagt -> KEIN Check, speichert trotz vorhandener Konflikte', async () => {
    const { svc, saved, manager } = makeSvc({ konflikte: [KONF] });
    await svc.create(USER, {
      titel: 'Neu',
      start: START,
      ende: ENDE,
      assignedUserId: EMP,
      status: AppointmentStatus.ABGESAGT,
    } as any);
    expect(saved).toHaveLength(1);
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('create: ohne assignedUserId kein Check (Termine ohne Mitarbeiter kollidieren nie)', async () => {
    const { svc, saved, manager } = makeSvc({ konflikte: [KONF] });
    await svc.create(USER, { titel: 'Neu', start: START, ende: ENDE } as any);
    expect(saved).toHaveLength(1);
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('patchTime: Kollision -> 409; mit konfliktBestaetigt speichert (Drag-Verschieben)', async () => {
    const konflikt = makeSvc({ konflikte: [KONF] });
    await expect(
      konflikt.svc.patchTime(USER, 'a1', { start: START, ende: ENDE } as any),
    ).rejects.toBeInstanceOf(ConflictException);

    const ok = makeSvc({ konflikte: [KONF] });
    await ok.svc.patchTime(USER, 'a1', { start: START, ende: ENDE, konfliktBestaetigt: true } as any);
    expect(ok.saved).toHaveLength(1);
  });
});
