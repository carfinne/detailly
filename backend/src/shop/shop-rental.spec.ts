import { BadRequestException, ConflictException } from '@nestjs/common';
import { ShopService } from './shop.service';
import { Rental } from './entities/rental.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests fuer createRental (H5): Zeitraum-Plausibilitaet (bis > von) und die
 * Doppelvermietungs-Sperre (Ueberschneidungspruefung + Insert in einer
 * Transaktion). Produkt-/Kunden-Referenzpruefung wird gruen gemockt.
 */

const USER: AuthUser = { id: 'u1', email: 'op@betrieb.de', role: 'owner', tenantId: 't1' } as AuthUser;

const DTO = {
  productId: 'p1',
  customerId: 'c1',
  von: '2026-07-01T09:00:00.000Z',
  bis: '2026-07-05T09:00:00.000Z',
};

function makeSvc(opts: { existingOverlap?: boolean } = {}) {
  // assertRefInTenant (Produkt + Kunde) gruen halten.
  const refRepo = { findOne: jest.fn(async () => ({ id: 'x', tenantId: 't1' })) };
  const saved: any[] = [];
  const manager: any = {
    findOne: jest.fn(async (entity: any) => {
      if (entity === Rental && opts.existingOverlap) return { id: 'r-existing', tenantId: 't1' };
      return null;
    }),
    create: jest.fn((entity: any, data: any) => ({ __entity: entity, ...data })),
    save: jest.fn(async (obj: any) => {
      saved.push(obj);
      return { id: 'r-new', ...obj };
    }),
  };
  const dataSource = { transaction: jest.fn(async (cb: (m: any) => Promise<any>) => cb(manager)) };
  const svc = new ShopService(
    refRepo as any, // productRepo
    {} as any, // movementRepo
    {} as any, // poRepo
    {} as any, // poItemRepo
    {} as any, // rentalRepo
    refRepo as any, // customerRepo
    { log: jest.fn() } as any,
    dataSource as any,
  );
  return { svc, manager, dataSource, saved };
}

describe('ShopService.createRental - Plausibilitaet + Doppelvermietung (H5)', () => {
  it('legt eine Vermietung an, wenn kein Zeitraum-Konflikt besteht', async () => {
    const { svc, manager, saved } = makeSvc({ existingOverlap: false });

    const res = await svc.createRental(USER, { ...DTO } as any);

    expect(res).toBeDefined();
    expect(saved).toHaveLength(1);
    // Ueberschneidungspruefung tenant- UND produkt-scoped.
    expect(manager.findOne).toHaveBeenCalledWith(
      Rental,
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't1', productId: 'p1' }),
      }),
    );
  });

  it('bis == von -> BadRequest, Transaktion startet NICHT', async () => {
    const { svc, dataSource } = makeSvc();

    await expect(svc.createRental(USER, { ...DTO, bis: DTO.von } as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('ueberlappende Vermietung desselben Produkts -> Conflict, kein Insert', async () => {
    const { svc, saved } = makeSvc({ existingOverlap: true });

    await expect(svc.createRental(USER, { ...DTO } as any)).rejects.toThrow(ConflictException);
    expect(saved).toHaveLength(0);
  });
});
