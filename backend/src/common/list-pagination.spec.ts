import { OrdersService } from '../orders/orders.service';
import { InvoicesService } from '../invoices/invoices.service';

/**
 * Tests fuer die abwaertskompatible Listen-Paginierung (Aufträge/Belege):
 * ohne page/limit bleibt das Array (Dropdowns/Kunden-Akte brechen nicht),
 * mit page/limit kommt {data,total,page,limit} (+counts bei Belegen).
 */
function makeQb() {
  const qb: any = {};
  for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'orderBy', 'skip', 'take', 'limit']) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getMany = jest.fn().mockResolvedValue([]);
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  qb.clone = jest.fn(() => qb);
  return qb;
}

function makeOrdersService(qb: any) {
  const repo: any = { createQueryBuilder: jest.fn(() => qb) };
  return new OrdersService(
    repo, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, { log: jest.fn() } as any,
  );
}

function makeInvoicesService(qb: any, customerQb?: any) {
  const repo: any = { createQueryBuilder: jest.fn(() => qb) };
  const customerRepo: any = { createQueryBuilder: jest.fn(() => customerQb ?? makeQb()) };
  return new InvoicesService(
    repo, {} as any, {} as any, customerRepo, {} as any,
    { log: jest.fn() } as any, {} as any, {} as any, {} as any, {} as any,
  );
}

describe('OrdersService · findAll Paginierung', () => {
  it('ohne page/limit: bisheriges Array (kein Abschneiden fuer Dropdowns)', async () => {
    const qb = makeQb();
    const res = await makeOrdersService(qb).findAll('t1', {});
    expect(Array.isArray(res)).toBe(true);
    expect(qb.getMany).toHaveBeenCalled();
    expect(qb.getManyAndCount).not.toHaveBeenCalled();
  });

  it('mit page/limit: {data,total,page,limit} + skip/take korrekt', async () => {
    const qb = makeQb();
    qb.getManyAndCount.mockResolvedValue([[{ id: 'o1' }], 120]);
    const res: any = await makeOrdersService(qb).findAll('t1', { page: 3, limit: 50 });
    expect(res).toEqual({ data: [{ id: 'o1' }], total: 120, page: 3, limit: 50 });
    expect(qb.skip).toHaveBeenCalledWith(100);
    expect(qb.take).toHaveBeenCalledWith(50);
  });

  it('limit wird auf 100 gedeckelt, page mindestens 1', async () => {
    const qb = makeQb();
    await makeOrdersService(qb).findAll('t1', { page: 0, limit: 9999 });
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(100);
  });
});

describe('InvoicesService · findAll Paginierung + Suche + Zaehler', () => {
  it('ohne page/limit: bisheriges Array', async () => {
    const qb = makeQb();
    const res = await makeInvoicesService(qb).findAll('t1', {});
    expect(Array.isArray(res)).toBe(true);
  });

  it('paginiert: Status-Zaehler aus GROUP BY (alle = Summe ueber alle Status)', async () => {
    const qb = makeQb();
    qb.getRawMany.mockResolvedValue([
      { status: 'offen', anzahl: '3' },
      { status: 'bezahlt', anzahl: '5' },
      { status: 'entwurf', anzahl: '2' },
    ]);
    qb.getManyAndCount.mockResolvedValue([[{ id: 'i1' }], 3]);
    const res: any = await makeInvoicesService(qb).findAll('t1', { page: 1, limit: 50 });
    expect(res.counts).toEqual({ alle: 10, offen: 3, bezahlt: 5 });
    expect(res.data).toEqual([{ id: 'i1' }]);
    expect(res.total).toBe(3);
  });

  it('Suche ohne Kunden-Treffer: nur Nummer-LIKE (kein leeres IN)', async () => {
    const qb = makeQb();
    const custQb = makeQb();
    custQb.getMany.mockResolvedValue([]); // keine Namens-Treffer
    await makeInvoicesService(qb, custQb).findAll('t1', { search: 'RE-2026', page: 1 });
    const klauseln = qb.andWhere.mock.calls.map((c: any[]) => String(c[0]));
    expect(klauseln.some((k: string) => k.includes('i.nummer') && !k.includes('IN'))).toBe(true);
  });

  it('Suche mit Kunden-Treffern: Nummer ODER customerId IN (...)', async () => {
    const qb = makeQb();
    const custQb = makeQb();
    custQb.getMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    await makeInvoicesService(qb, custQb).findAll('t1', { search: 'meier', page: 1 });
    const klauseln = qb.andWhere.mock.calls.map((c: any[]) => String(c[0]));
    expect(klauseln.some((k: string) => k.includes('i.customerId IN'))).toBe(true);
  });
});
