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
