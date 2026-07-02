import { ForbiddenException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { UserRole } from '../users/entities/user.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

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
