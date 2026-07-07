import { ShopService } from './shop.service';
import { PurchaseOrderStatus } from './entities/purchase-order.entity';

/**
 * AP-P1: Opt-in-Paginierung der Shop-Listen (Produkte, Lagerbewegungen,
 * Bestellungen). Ohne page/limit weiterhin ein (gedeckeltes) Array; MIT page/limit
 * eine paginierte Antwort {data,total,page,limit}. NaN/negative Werte werden ueber
 * clampPageQuery sauber geklammert. Alle Abfragen bleiben tenant-scoped.
 */
function makeService() {
  const productRepo = {
    find: jest.fn(async () => [{ id: 'p1' }]),
    findAndCount: jest.fn(async () => [[{ id: 'p1' }], 42]),
  };
  const movementRepo = {
    find: jest.fn(async () => [{ id: 'm1' }]),
    findAndCount: jest.fn(async () => [[{ id: 'm1' }], 7]),
  };
  const poRepo = {
    find: jest.fn(async () => [{ id: 'po1' }]),
    findAndCount: jest.fn(async () => [[{ id: 'po1' }], 5]),
  };
  const svc = new ShopService(
    productRepo as any,
    movementRepo as any,
    poRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any, // dataSource (von #115 ergaenzt; Paginierungs-Pfade nutzen ihn nicht)
  );
  return { svc, productRepo, movementRepo, poRepo };
}

describe('ShopService · findProducts (AP-P1)', () => {
  it('ohne page/limit: liefert ABWAERTSKOMPATIBEL ein Array (find, kein findAndCount)', async () => {
    const { svc, productRepo } = makeService();
    const res = await svc.findProducts('T1');
    expect(Array.isArray(res)).toBe(true);
    expect(productRepo.find).toHaveBeenCalledTimes(1);
    expect(productRepo.findAndCount).not.toHaveBeenCalled();
    // tenant-scoped + nur aktive per Default.
    expect(productRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'T1', aktiv: true } }),
    );
  });

  it('mit page/limit: liefert {data,total,page,limit} (findAndCount, korrektes skip/take)', async () => {
    const { svc, productRepo } = makeService();
    const res = await svc.findProducts('T1', { page: 3, limit: 20 });
    expect(res).toEqual({ data: [{ id: 'p1' }], total: 42, page: 3, limit: 20 });
    expect(productRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'T1', aktiv: true }, skip: 40, take: 20 }),
    );
  });

  it('klammert NaN/negative Parameter (page NaN -> 1, limit negativ -> 1)', async () => {
    const { svc, productRepo } = makeService();
    const res = await svc.findProducts('T1', { page: NaN, limit: -5 });
    expect(res).toMatchObject({ page: 1, limit: 1 });
    expect(productRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 1 }),
    );
  });

  it('includeInactive laesst den aktiv-Filter weg', async () => {
    const { svc, productRepo } = makeService();
    await svc.findProducts('T1', { includeInactive: true, page: 1, limit: 10 });
    expect(productRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'T1' } }),
    );
  });
});

describe('ShopService · findMovements (AP-P1)', () => {
  it('ohne page/limit: Array (find)', async () => {
    const { svc, movementRepo } = makeService();
    const res = await svc.findMovements('T1', { productId: 'p9' });
    expect(Array.isArray(res)).toBe(true);
    expect(movementRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'T1', productId: 'p9' } }),
    );
    expect(movementRepo.findAndCount).not.toHaveBeenCalled();
  });

  it('mit page/limit: paginiert + tenant-/produkt-scoped', async () => {
    const { svc, movementRepo } = makeService();
    const res = await svc.findMovements('T1', { productId: 'p9', page: 2, limit: 25 });
    expect(res).toEqual({ data: [{ id: 'm1' }], total: 7, page: 2, limit: 25 });
    expect(movementRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'T1', productId: 'p9' }, skip: 25, take: 25 }),
    );
  });
});

describe('ShopService · findPurchaseOrders (AP-P1)', () => {
  it('ohne page/limit: Array (find) mit items-Relation', async () => {
    const { svc, poRepo } = makeService();
    const res = await svc.findPurchaseOrders('T1', { status: PurchaseOrderStatus.ENTWURF });
    expect(Array.isArray(res)).toBe(true);
    expect(poRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'T1', status: PurchaseOrderStatus.ENTWURF },
        relations: ['items'],
      }),
    );
    expect(poRepo.findAndCount).not.toHaveBeenCalled();
  });

  it('mit page/limit: paginiert, behaelt items-Relation + tenant-scope', async () => {
    const { svc, poRepo } = makeService();
    const res = await svc.findPurchaseOrders('T1', { page: 1, limit: 50 });
    expect(res).toEqual({ data: [{ id: 'po1' }], total: 5, page: 1, limit: 50 });
    expect(poRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'T1' }, relations: ['items'], skip: 0, take: 50 }),
    );
  });
});
