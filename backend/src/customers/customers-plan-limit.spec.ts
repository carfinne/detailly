import { ForbiddenException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests fuer das Tarif-Limit maxCustomers im Create-Pfad (T-002).
 * SubscriptionsService gemockt; hier zaehlt: tenant-scoped Count VOR dem
 * Speichern, bei Wurf wird KEIN Kunde angelegt.
 */
describe('CustomersService.create - Tarif-Limit maxCustomers', () => {
  const user: AuthUser = { id: 'u1', email: 'a@b.de', role: 'owner', tenantId: 't1' } as AuthUser;
  const dto = { type: 'private', firstName: 'Lukas', lastName: 'Meyer' } as any;

  const makeSvc = (count: number, assertLimit: jest.Mock) => {
    const repo = {
      count: jest.fn().mockResolvedValue(count),
      create: jest.fn((c: any) => c),
      save: jest.fn(async (c: any) => ({ ...c, id: 'c-neu' })),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    // Kein sevDesk-Token -> der best-effort-Sync ist ein No-op.
    const sevdesk = { loadToken: jest.fn().mockResolvedValue(null) };
    const svc = new CustomersService(repo as any, audit as any, sevdesk as any, {
      assertLimit,
    } as any);
    return { svc, repo };
  };

  it('zaehlt tenant-scoped nur AKTIVE Kunden und prueft das Limit mit diesem Count', async () => {
    const assertLimit = jest.fn().mockResolvedValue(undefined);
    const { svc, repo } = makeSvc(499, assertLimit);

    await svc.create(user, dto);

    expect(repo.count).toHaveBeenCalledWith({ where: { tenantId: 't1', isActive: true } });
    expect(assertLimit).toHaveBeenCalledWith('t1', 'maxCustomers', 499);
    expect(repo.save).toHaveBeenCalled();
  });

  it('Limit erreicht -> 403 propagiert, KEIN save (kein Kunde angelegt)', async () => {
    const assertLimit = jest.fn().mockRejectedValue(
      new ForbiddenException({
        code: 'PLAN_LIMIT_REACHED',
        limit: 'maxCustomers',
        max: 500,
        current: 500,
      }),
    );
    const { svc, repo } = makeSvc(500, assertLimit);

    await expect(svc.create(user, dto)).rejects.toThrow(ForbiddenException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('Adversarial: Count ist auf den EIGENEN Betrieb beschraenkt (voller Tenant A sperrt B nicht)', async () => {
    const assertLimit = jest.fn().mockResolvedValue(undefined);
    const { svc, repo } = makeSvc(0, assertLimit);
    const userB = { ...user, tenantId: 't-B' } as AuthUser;

    await svc.create(userB, dto);

    expect(repo.count).toHaveBeenCalledWith({ where: { tenantId: 't-B', isActive: true } });
    expect(assertLimit).toHaveBeenCalledWith('t-B', 'maxCustomers', 0);
  });
});

/**
 * Reaktivierung (isActive false->true) = Anlage-Aequivalent: ohne diesen Check
 * liesse sich maxCustomers per Deaktivieren/Reaktivieren umgehen.
 */
describe('CustomersService.update - Reaktivierung prueft Tarif-Limit', () => {
  const user: AuthUser = { id: 'u1', email: 'a@b.de', role: 'owner', tenantId: 't1' } as AuthUser;

  const makeUpdateSvc = (opts: {
    customer: Record<string, unknown>;
    count?: number;
    assertLimit: jest.Mock;
  }) => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(opts.customer),
      count: jest.fn().mockResolvedValue(opts.count ?? 0),
      save: jest.fn(async (c: any) => c),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const sevdesk = { loadToken: jest.fn().mockResolvedValue(null) };
    const svc = new CustomersService(repo as any, audit as any, sevdesk as any, {
      assertLimit: opts.assertLimit,
    } as any);
    return { svc, repo };
  };

  it('Reaktivierung am Limit -> 403 propagiert, KEIN save', async () => {
    const assertLimit = jest.fn().mockRejectedValue(
      new ForbiddenException({ code: 'PLAN_LIMIT_REACHED', limit: 'maxCustomers', max: 500, current: 500 }),
    );
    const { svc, repo } = makeUpdateSvc({
      customer: { id: 'c1', tenantId: 't1', isActive: false },
      count: 500,
      assertLimit,
    });

    await expect(svc.update(user, 'c1', { isActive: true } as any)).rejects.toThrow(
      ForbiddenException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('Reaktivierung unter dem Limit -> ok, Count tenant-scoped wie in create()', async () => {
    const assertLimit = jest.fn().mockResolvedValue(undefined);
    const { svc, repo } = makeUpdateSvc({
      customer: { id: 'c1', tenantId: 't1', isActive: false },
      count: 499,
      assertLimit,
    });

    const result = await svc.update(user, 'c1', { isActive: true } as any);

    expect(repo.count).toHaveBeenCalledWith({ where: { tenantId: 't1', isActive: true } });
    expect(assertLimit).toHaveBeenCalledWith('t1', 'maxCustomers', 499);
    expect(result.isActive).toBe(true);
  });

  it('isActive true->true (unveraendert) -> KEIN Limit-Check', async () => {
    const assertLimit = jest.fn();
    const { svc, repo } = makeUpdateSvc({
      customer: { id: 'c1', tenantId: 't1', isActive: true },
      assertLimit,
    });

    await svc.update(user, 'c1', { isActive: true, firstName: 'Neu' } as any);

    expect(assertLimit).not.toHaveBeenCalled();
    expect(repo.count).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
  });
});

/**
 * Kontingent-Anzeige (getUsage) fuer die Kundenliste. `used` zaehlt AKTIVE Kunden
 * tenant-scoped – exakt die Zaehlregel der Durchsetzung; `limit` kommt aus dem
 * Tarif (null = unbegrenzt -> Anzeige aus).
 */
describe('CustomersService.getUsage - Kunden-Kontingent', () => {
  const makeSvc = (count: number, getLimit: jest.Mock) => {
    const repo = { count: jest.fn().mockResolvedValue(count) };
    const audit = { log: jest.fn() };
    const sevdesk = { loadToken: jest.fn() };
    const svc = new CustomersService(repo as any, audit as any, sevdesk as any, {
      getLimit,
    } as any);
    return { svc, repo };
  };

  it('used = aktive Kunden (tenant-scoped), limit = maxCustomers des Tarifs', async () => {
    const getLimit = jest.fn().mockResolvedValue(500);
    const { svc, repo } = makeSvc(428, getLimit);

    const res = await svc.getUsage('t1');

    expect(repo.count).toHaveBeenCalledWith({ where: { tenantId: 't1', isActive: true } });
    expect(getLimit).toHaveBeenCalledWith('t1', 'maxCustomers');
    expect(res).toEqual({ used: 428, limit: 500 });
  });

  it('unbegrenzter Tarif -> limit null (UI blendet die Anzeige aus)', async () => {
    const getLimit = jest.fn().mockResolvedValue(null);
    const { svc } = makeSvc(1200, getLimit);

    const res = await svc.getUsage('t1');

    expect(res).toEqual({ used: 1200, limit: null });
  });

  it('Count ist auf den EIGENEN Betrieb beschraenkt (tenant-scoped)', async () => {
    const getLimit = jest.fn().mockResolvedValue(500);
    const { svc, repo } = makeSvc(0, getLimit);

    await svc.getUsage('t-B');

    expect(repo.count).toHaveBeenCalledWith({ where: { tenantId: 't-B', isActive: true } });
  });
});
