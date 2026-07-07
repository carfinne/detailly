import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShopService } from './shop.service';
import { Product } from './entities/product.entity';
import { StockMovement, MovementType } from './entities/stock-movement.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests fuer die atomare Lagerbuchung (H1). Der Manager-Fake bildet die
 * DB-Semantik nach: additive/subtraktive UPDATEs veraendern einen gemeinsamen
 * Bestand direkt (kein JS-Read-Modify-Write), der ABGANG ist fail-closed
 * (konditionales UPDATE mit `bestand >= :menge`).
 */

const USER: AuthUser = { id: 'u1', email: 'op@betrieb.de', role: 'owner', tenantId: 't1' } as AuthUser;

function makeManager(initialBestand: number, opts: { failOnMovementSave?: boolean } = {}) {
  const product = { id: 'p1', tenantId: 't1', bestand: initialBestand };
  const saved: any[] = [];
  const manager: any = {
    findOne: jest.fn(async (entity: any, args: any) => {
      if (entity === Product && args?.where?.id === 'p1' && args?.where?.tenantId === 't1') {
        return { ...product };
      }
      return null;
    }),
    update: jest.fn(async (_entity: any, _criteria: any, patch: any) => {
      if (patch?.bestand !== undefined) product.bestand = patch.bestand;
      return { affected: 1 };
    }),
    createQueryBuilder: jest.fn(() => {
      const qb: any = { _op: null as null | 'add' | 'sub', _menge: 0, _guard: false };
      qb.update = jest.fn(() => qb);
      qb.set = jest.fn((obj: any) => {
        const sql = typeof obj.bestand === 'function' ? obj.bestand() : String(obj.bestand);
        qb._op = sql.includes('-') ? 'sub' : 'add';
        return qb;
      });
      qb.where = jest.fn((clause: string) => {
        qb._guard = clause.includes('bestand >= :menge');
        return qb;
      });
      qb.setParameter = jest.fn((k: string, v: number) => {
        if (k === 'menge') qb._menge = v;
        return qb;
      });
      qb.execute = jest.fn(async () => {
        if (qb._op === 'add') {
          product.bestand += qb._menge;
          return { affected: 1 };
        }
        if (product.bestand >= qb._menge) {
          product.bestand -= qb._menge;
          return { affected: 1 };
        }
        return { affected: 0 }; // fail-closed: nicht genug Bestand
      });
      return qb;
    }),
    create: jest.fn((entity: any, data: any) => ({ __entity: entity, ...data })),
    save: jest.fn(async (obj: any) => {
      if (opts.failOnMovementSave && obj.__entity === StockMovement) throw new Error('DB kaputt');
      if (!obj.id) obj.id = 'mv1';
      saved.push(obj);
      return obj;
    }),
  };
  return { manager, product, saved };
}

function makeSvc(initialBestand: number, opts: { failOnMovementSave?: boolean } = {}) {
  const { manager, product, saved } = makeManager(initialBestand, opts);
  const dataSource = {
    transaction: jest.fn(async (cb: (m: any) => Promise<any>) => cb(manager)),
  };
  const productRepo = {};
  const svc = new ShopService(
    productRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { log: jest.fn() } as any,
    dataSource as any,
  );
  return { svc, manager, product, saved, dataSource };
}

describe('ShopService.recordMovement - atomare Lagerbuchung (H1)', () => {
  it('ZUGANG erhoeht den Bestand atomar und schreibt einen Beleg', async () => {
    const { svc, product, saved, manager } = makeSvc(10);

    const res = await svc.recordMovement(USER, 'p1', { typ: MovementType.ZUGANG, menge: 5 } as any);

    expect(product.bestand).toBe(15);
    expect(res.product?.bestand).toBe(15);
    const movements = saved.filter((s) => s.__entity === StockMovement);
    expect(movements).toHaveLength(1);
    // Atomar via UPDATE, nicht via productRepo.save eines JS-Werts.
    expect(manager.createQueryBuilder).toHaveBeenCalled();
  });

  it('ABGANG mit ausreichend Bestand bucht ab (fail-closed erfuellt)', async () => {
    const { svc, product, saved } = makeSvc(10);

    await svc.recordMovement(USER, 'p1', { typ: MovementType.ABGANG, menge: 3 } as any);

    expect(product.bestand).toBe(7);
    expect(saved.filter((s) => s.__entity === StockMovement)).toHaveLength(1);
  });

  it('ABGANG ueber Bestand -> BadRequest, KEIN Beleg, Bestand unveraendert', async () => {
    const { svc, product, saved } = makeSvc(10);

    await expect(
      svc.recordMovement(USER, 'p1', { typ: MovementType.ABGANG, menge: 15 } as any),
    ).rejects.toThrow(BadRequestException);

    expect(product.bestand).toBe(10); // kein Negativbestand
    expect(saved.filter((s) => s.__entity === StockMovement)).toHaveLength(0);
  });

  it('INVENTUR setzt den absoluten Bestand', async () => {
    const { svc, product } = makeSvc(10);

    await svc.recordMovement(USER, 'p1', { typ: MovementType.INVENTUR, menge: 4 } as any);

    expect(product.bestand).toBe(4);
  });

  it('unbekanntes/fremdes Produkt -> NotFound', async () => {
    const { svc } = makeSvc(10);

    await expect(
      svc.recordMovement(
        { ...USER, tenantId: 't2' } as AuthUser,
        'p1',
        { typ: MovementType.ZUGANG, menge: 1 } as any,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
