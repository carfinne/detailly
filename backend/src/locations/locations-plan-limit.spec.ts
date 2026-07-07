import { ForbiddenException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests fuer das Tarif-Limit maxLocations im Create-Pfad (T-002).
 * SubscriptionsService gemockt; tenant-scoped Count VOR dem Speichern,
 * bei Wurf wird KEIN Standort angelegt.
 */
describe('LocationsService.create - Tarif-Limit maxLocations', () => {
  const user: AuthUser = { id: 'u1', email: 'a@b.de', role: 'owner', tenantId: 't1' } as AuthUser;
  const dto = { name: 'Filiale Nord' } as any;

  const makeSvc = (count: number, assertLimit: jest.Mock) => {
    const repo = {
      count: jest.fn().mockResolvedValue(count),
      create: jest.fn((l: any) => l),
      save: jest.fn(async (l: any) => ({ ...l, id: 'l-neu' })),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = new LocationsService(
      repo as any,
      {} as any, // orderRepo (in create ungenutzt)
      {} as any, // apptRepo
      {} as any, // invoiceRepo
      audit as any,
      { assertLimit } as any,
    );
    return { svc, repo };
  };

  it('zaehlt tenant-scoped nur AKTIVE Standorte und prueft das Limit mit diesem Count', async () => {
    const assertLimit = jest.fn().mockResolvedValue(undefined);
    const { svc, repo } = makeSvc(0, assertLimit);

    await svc.create(user, dto);

    expect(repo.count).toHaveBeenCalledWith({ where: { tenantId: 't1', isActive: true } });
    expect(assertLimit).toHaveBeenCalledWith('t1', 'maxLocations', 0);
    expect(repo.save).toHaveBeenCalled();
  });

  it('Limit erreicht (Starter: maxLocations 1) -> 403 propagiert, KEIN save', async () => {
    const assertLimit = jest.fn().mockRejectedValue(
      new ForbiddenException({
        code: 'PLAN_LIMIT_REACHED',
        limit: 'maxLocations',
        max: 1,
        current: 1,
      }),
    );
    const { svc, repo } = makeSvc(1, assertLimit);

    await expect(svc.create(user, dto)).rejects.toThrow(ForbiddenException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

/**
 * Reaktivierung (isActive false->true) = Anlage-Aequivalent: ohne diesen Check
 * liesse sich maxLocations per Deaktivieren/Reaktivieren umgehen.
 */
describe('LocationsService.update - Reaktivierung prueft Tarif-Limit', () => {
  const user: AuthUser = { id: 'u1', email: 'a@b.de', role: 'owner', tenantId: 't1' } as AuthUser;

  const makeUpdateSvc = (opts: {
    location: Record<string, unknown>;
    count?: number;
    assertLimit: jest.Mock;
  }) => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(opts.location),
      count: jest.fn().mockResolvedValue(opts.count ?? 0),
      save: jest.fn(async (l: any) => l),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = new LocationsService(
      repo as any,
      {} as any,
      {} as any,
      {} as any,
      audit as any,
      { assertLimit: opts.assertLimit } as any,
    );
    return { svc, repo };
  };

  it('Reaktivierung am Limit -> 403 propagiert, KEIN save', async () => {
    const assertLimit = jest.fn().mockRejectedValue(
      new ForbiddenException({ code: 'PLAN_LIMIT_REACHED', limit: 'maxLocations', max: 1, current: 1 }),
    );
    const { svc, repo } = makeUpdateSvc({
      location: { id: 'l1', tenantId: 't1', isActive: false },
      count: 1,
      assertLimit,
    });

    await expect(svc.update(user, 'l1', { isActive: true } as any)).rejects.toThrow(
      ForbiddenException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('Reaktivierung unter dem Limit -> ok, Count tenant-scoped wie in create()', async () => {
    const assertLimit = jest.fn().mockResolvedValue(undefined);
    const { svc, repo } = makeUpdateSvc({
      location: { id: 'l1', tenantId: 't1', isActive: false },
      count: 0,
      assertLimit,
    });

    const result = await svc.update(user, 'l1', { isActive: true } as any);

    expect(repo.count).toHaveBeenCalledWith({ where: { tenantId: 't1', isActive: true } });
    expect(assertLimit).toHaveBeenCalledWith('t1', 'maxLocations', 0);
    expect(result.isActive).toBe(true);
  });

  it('isActive true->true (unveraendert) -> KEIN Limit-Check', async () => {
    const assertLimit = jest.fn();
    const { svc, repo } = makeUpdateSvc({
      location: { id: 'l1', tenantId: 't1', isActive: true },
      assertLimit,
    });

    await svc.update(user, 'l1', { isActive: true, name: 'Neu' } as any);

    expect(assertLimit).not.toHaveBeenCalled();
    expect(repo.count).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
  });
});
