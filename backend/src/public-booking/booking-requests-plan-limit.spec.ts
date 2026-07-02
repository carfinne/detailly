import { ForbiddenException } from '@nestjs/common';
import { BookingRequestsService } from './booking-requests.service';
import { BookingRequestStatus } from './entities/booking-request.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests fuer das Tarif-Limit maxCustomers beim Annehmen von Online-Anfragen
 * (T-002, adversarial): Ohne diesen Check waere das Kunden-Limit ueber
 * `accept()` (legt einen Kunden in der Transaktion an) umgehbar. Bei
 * erreichtem Limit darf auch KEIN Termin entstehen (Transaktion startet nicht);
 * `kundeAnlegen=false` bleibt der dokumentierte Ausweg.
 */
describe('BookingRequestsService.accept - Tarif-Limit maxCustomers', () => {
  const user: AuthUser = { id: 'u1', email: 'a@b.de', role: 'owner', tenantId: 't1' } as AuthUser;

  const reqEntity = {
    id: 'br1',
    tenantId: 't1',
    name: 'Max Muster',
    email: 'max@example.de',
    phone: null,
    serviceName: null,
    fahrzeug: null,
    wunschtermin: null,
    nachricht: null,
    status: BookingRequestStatus.ANGENOMMEN,
    reference: 'REF-1',
    createdAt: new Date('2026-07-01T09:00:00.000Z'),
  };

  const makeSvc = (opts: { customerCount: number; assertLimit: jest.Mock }) => {
    // count fuer den Customer-Pfad, findOne fuer den Tenant-Lookup der
    // (fire-and-forget) Terminbestaetigungs-Mail – ein Mock deckt beide Repos ab.
    const customerRepo = {
      count: jest.fn().mockResolvedValue(opts.customerCount),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const dataSource = {
      getRepository: jest.fn().mockReturnValue(customerRepo),
      transaction: jest.fn().mockResolvedValue({
        appointment: { id: 'a1' },
        request: reqEntity,
        customerId: undefined,
      }),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const mail = { send: jest.fn().mockResolvedValue(undefined) };
    const svc = new BookingRequestsService(
      {} as any, // BookingRequest-Repo (in accept ungenutzt, alles laeuft ueber den Manager)
      dataSource as any,
      audit as any,
      { assertLimit: opts.assertLimit } as any,
      mail as any,
      { get: jest.fn() } as any, // ConfigService (nur fuer den Track-Link der Mail)
    );
    return { svc, dataSource, customerRepo };
  };

  it('prueft das Limit tenant-scoped VOR der Transaktion (Hinweis nennt kundeAnlegen=false)', async () => {
    const assertLimit = jest.fn().mockResolvedValue(undefined);
    const { svc, customerRepo } = makeSvc({ customerCount: 10, assertLimit });

    await svc.accept(user, 'br1', {} as any);

    expect(customerRepo.count).toHaveBeenCalledWith({
      where: { tenantId: 't1', isActive: true },
    });
    expect(assertLimit).toHaveBeenCalledWith(
      't1',
      'maxCustomers',
      10,
      expect.stringContaining('kundeAnlegen=false'),
    );
  });

  it('Limit erreicht -> 403 propagiert und die Transaktion startet NICHT (kein Termin, kein Kunde)', async () => {
    const assertLimit = jest.fn().mockRejectedValue(
      new ForbiddenException({
        code: 'PLAN_LIMIT_REACHED',
        limit: 'maxCustomers',
        max: 500,
        current: 500,
      }),
    );
    const { svc, dataSource } = makeSvc({ customerCount: 500, assertLimit });

    await expect(svc.accept(user, 'br1', {} as any)).rejects.toThrow(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('kundeAnlegen=false -> KEINE Limit-Pruefung (Ausweg), Annahme laeuft durch', async () => {
    const assertLimit = jest.fn();
    const { svc, dataSource, customerRepo } = makeSvc({ customerCount: 500, assertLimit });

    const result = await svc.accept(user, 'br1', { kundeAnlegen: false } as any);

    expect(assertLimit).not.toHaveBeenCalled();
    expect(customerRepo.count).not.toHaveBeenCalled();
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(result.appointment).toEqual({ id: 'a1' });
    expect(result.request.reference).toBe('REF-1');
  });
});
