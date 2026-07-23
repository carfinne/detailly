import { ForbiddenException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { UserRole } from '../users/entities/user.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/**
 * Tests fuer das Tarif-Limit maxUsers im Create-Pfad (T-002). Der
 * SubscriptionsService ist gemockt (seine Wurf-Logik testet
 * plan-enforcement.spec.ts) – hier geht es darum, DASS der Pfad tenant-scoped
 * zaehlt, das Limit VOR dem Speichern prueft und bei Wurf nichts anlegt.
 */
describe('EmployeesService.create - Tarif-Limit maxUsers', () => {
  const actor: AuthUser = {
    id: 'actor',
    email: 'a@b.de',
    role: UserRole.OWNER,
    tenantId: 't1',
  } as AuthUser;

  const dto = {
    email: 'neu@b.de',
    password: '12345678',
    firstName: 'Neu',
    lastName: 'User',
    role: UserRole.TECHNICIAN,
  } as any;

  const makeSvc = (count: number, assertLimit: jest.Mock) => {
    const repo = {
      count: jest.fn().mockResolvedValue(count),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((u: any) => u),
      save: jest.fn(async (u: any) => ({ ...u, id: 'u-neu' })),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = new EmployeesService(repo as any, audit as any, { assertLimit } as any);
    return { svc, repo };
  };

  it('zaehlt tenant-scoped nur AKTIVE User und prueft das Limit mit diesem Count', async () => {
    const assertLimit = jest.fn().mockResolvedValue(undefined);
    const { svc, repo } = makeSvc(4, assertLimit);

    await svc.create(actor, dto);

    expect(repo.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId: 't1', isActive: true }),
    });
    expect(assertLimit).toHaveBeenCalledWith('t1', 'maxUsers', 4);
  });

  it('Plattform-Rollen sind vom Count ausgenommen (zaehlen nicht gegen das Kunden-Limit)', async () => {
    const assertLimit = jest.fn().mockResolvedValue(undefined);
    const { svc, repo } = makeSvc(4, assertLimit);

    await svc.create(actor, dto);

    // Die where-Bedingung enthaelt einen role-Filter (Not/In der Plattform-Rollen).
    const where = repo.count.mock.calls[0][0].where;
    expect(where.role).toBeDefined();
  });

  it('Limit erreicht -> 403 propagiert, KEIN save (nichts angelegt)', async () => {
    const assertLimit = jest.fn().mockRejectedValue(
      new ForbiddenException({ code: 'PLAN_LIMIT_REACHED', limit: 'maxUsers', max: 5, current: 5 }),
    );
    const { svc, repo } = makeSvc(5, assertLimit);

    await expect(svc.create(actor, dto)).rejects.toThrow(ForbiddenException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

/**
 * Reaktivierung (isActive false->true) = Anlage-Aequivalent: ohne diesen Check
 * liesse sich maxUsers per Deaktivieren/Reaktivieren umgehen.
 */
describe('EmployeesService.update - Reaktivierung prueft Tarif-Limit', () => {
  const actor: AuthUser = {
    id: 'actor',
    email: 'a@b.de',
    role: UserRole.OWNER,
    tenantId: 't1',
  } as AuthUser;

  const makeUpdateSvc = (opts: {
    target: Record<string, unknown>;
    count?: number;
    assertLimit: jest.Mock;
  }) => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(opts.target),
      count: jest.fn().mockResolvedValue(opts.count ?? 0),
      save: jest.fn(async (u: any) => u),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = new EmployeesService(repo as any, audit as any, {
      assertLimit: opts.assertLimit,
    } as any);
    return { svc, repo };
  };

  it('Reaktivierung am Limit -> 403 propagiert, KEIN save', async () => {
    const assertLimit = jest.fn().mockRejectedValue(
      new ForbiddenException({ code: 'PLAN_LIMIT_REACHED', limit: 'maxUsers', max: 5, current: 5 }),
    );
    const { svc, repo } = makeUpdateSvc({
      target: { id: 'u2', role: UserRole.TECHNICIAN, tenantId: 't1', isActive: false },
      count: 5,
      assertLimit,
    });

    await expect(svc.update(actor, 'u2', { isActive: true } as any)).rejects.toThrow(
      ForbiddenException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('Reaktivierung unter dem Limit -> ok, Count wie in create() (aktiv + ohne Plattform-Rollen)', async () => {
    const assertLimit = jest.fn().mockResolvedValue(undefined);
    const { svc, repo } = makeUpdateSvc({
      target: { id: 'u2', role: UserRole.TECHNICIAN, tenantId: 't1', isActive: false },
      count: 4,
      assertLimit,
    });

    await svc.update(actor, 'u2', { isActive: true } as any);

    expect(repo.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId: 't1', isActive: true }),
    });
    expect(repo.count.mock.calls[0][0].where.role).toBeDefined(); // Plattform-Rollen-Filter
    expect(assertLimit).toHaveBeenCalledWith('t1', 'maxUsers', 4);
    expect(repo.save).toHaveBeenCalled();
  });

  it('isActive true->true (unveraendert) -> KEIN Limit-Check', async () => {
    const assertLimit = jest.fn();
    const { svc, repo } = makeUpdateSvc({
      target: { id: 'u2', role: UserRole.TECHNICIAN, tenantId: 't1', isActive: true },
      assertLimit,
    });

    await svc.update(actor, 'u2', { isActive: true, firstName: 'Neu' } as any);

    expect(assertLimit).not.toHaveBeenCalled();
    expect(repo.count).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
  });
});

/**
 * Race-Sicherheit: Zwei gleichzeitige Anlagen am letzten freien Platz duerfen
 * das Limit nicht gemeinsam ueberschreiten. Der per-Betrieb serialisierte
 * Abschnitt (KeyedMutex) laesst nur EINE gewinnen; die zweite zaehlt erst nach
 * dem Speichern der ersten und sieht den vollen Count -> 403. `assertLimit` ist
 * hier BEWUSST realitaetsnah (wirft bei current >= max), `save` erhoeht den vom
 * Zaehler gelesenen Bestand.
 */
describe('EmployeesService.create - Race am Limit (serialisiert je Betrieb)', () => {
  const actor: AuthUser = { id: 'actor', role: UserRole.OWNER, tenantId: 't1' } as AuthUser;
  const dtoFor = (email: string) =>
    ({ email, password: '12345678', firstName: 'N', lastName: 'U', role: UserRole.TECHNICIAN }) as any;

  it('zwei parallele Anlagen am letzten Platz -> genau EINE gewinnt, Limit haelt', async () => {
    const MAX = 3;
    const bestand: unknown[] = [{}, {}]; // 2 aktive Betriebs-User -> genau 1 Platz frei
    const repo = {
      count: jest.fn(async () => bestand.length), // liest den AKTUELLEN Stand
      findOne: jest.fn(async () => null), // keine E-Mail-Kollision
      create: jest.fn((u: any) => u),
      save: jest.fn(async (u: any) => {
        await tick(1); // DB-Persistenz simulieren (Await-Punkt fuers Interleaving)
        const rec = { ...u, id: `u-${bestand.length}` };
        bestand.push(rec); // erhoeht den Count fuer die naechste Zaehlung
        return rec;
      }),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const assertLimit = jest.fn(async (_t: string, _k: string, current: number) => {
      if (current >= MAX) {
        throw new ForbiddenException({ code: 'PLAN_LIMIT_REACHED', max: MAX, current });
      }
    });
    const svc = new EmployeesService(repo as any, audit as any, { assertLimit } as any);

    const results = await Promise.allSettled([
      svc.create(actor, dtoFor('a@b.de')),
      svc.create(actor, dtoFor('c@b.de')),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ForbiddenException);
    // Genau EIN neuer User (2 -> 3), das Limit wurde nicht ueberschritten.
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(bestand.length).toBe(3);
  });
});

/**
 * getUsage: die EINE Kontingent-Quelle fuer die UX ("X von Y"). Muss dieselbe
 * Zaehlregel wie die Durchsetzung nutzen (aktiv, tenant-scoped, ohne Plattform-
 * Rollen) und das maxUsers-Limit des Tarifs durchreichen.
 */
describe('EmployeesService.getUsage', () => {
  it('liefert used + limit; zaehlt tenant-scoped, nur aktiv, ohne Plattform-Rollen', async () => {
    const repo = { count: jest.fn().mockResolvedValue(2) };
    const getLimit = jest.fn().mockResolvedValue(3);
    const svc = new EmployeesService(repo as any, { log: jest.fn() } as any, { getLimit } as any);

    const usage = await svc.getUsage('t1');

    expect(usage).toEqual({ used: 2, limit: 3 });
    expect(getLimit).toHaveBeenCalledWith('t1', 'maxUsers');
    const where = repo.count.mock.calls[0][0].where;
    expect(where).toEqual(expect.objectContaining({ tenantId: 't1', isActive: true }));
    expect(where.role).toBeDefined(); // Not(In(PLATTFORM_ROLLEN))
  });

  it('limit null (unbegrenzt / kein Tarif) wird unveraendert durchgereicht', async () => {
    const repo = { count: jest.fn().mockResolvedValue(7) };
    const svc = new EmployeesService(
      repo as any,
      { log: jest.fn() } as any,
      { getLimit: jest.fn().mockResolvedValue(null) } as any,
    );
    await expect(svc.getUsage('t1')).resolves.toEqual({ used: 7, limit: null });
  });
});
