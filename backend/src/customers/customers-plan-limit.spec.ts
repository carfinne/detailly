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
