import { ReportsService } from './reports.service';

/** Chainbarer QueryBuilder-Mock: alle Chain-Methoden geben sich selbst zurueck. */
function makeQb(rawOne?: any, rawMany?: any) {
  const qb: any = {};
  for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'orderBy', 'limit', 'innerJoin']) {
    qb[m] = () => qb;
  }
  qb.getRawOne = jest.fn().mockResolvedValue(rawOne);
  qb.getRawMany = jest.fn().mockResolvedValue(rawMany ?? []);
  return qb;
}

describe('ReportsService · overview', () => {
  it('aggregiert Volumen/Umsatz, Schnitt, Leistungsart und Top-Kunden (mit Namen)', async () => {
    const orderRepo: any = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(makeQb({ summe: '1000', anzahl: '4' })) // Auftrag-Aggregat
        .mockReturnValueOnce(
          makeQb(undefined, [
            { serviceType: 'folierung', summe: '700', anzahl: '2' },
            { serviceType: 'aufbereitung', summe: '300', anzahl: '2' },
          ]),
        ) // nach Leistungsart
        .mockReturnValueOnce(
          makeQb(undefined, [
            { customerId: 'c1', summe: '600', anzahl: '2' },
            { customerId: 'c2', summe: '400', anzahl: '2' },
          ]),
        ), // Top-Kunden
    };
    const invoiceRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(makeQb({ summe: '850' })) };
    const customerRepo: any = {
      find: jest.fn().mockResolvedValue([
        { id: 'c1', type: 'private', firstName: 'Max', lastName: 'Muster' },
        { id: 'c2', type: 'business', companyName: 'ACME GmbH' },
      ]),
    };

    const svc = new ReportsService(orderRepo, invoiceRepo, customerRepo);
    const res = await svc.overview('t1', '2026-01-01', '2026-12-31');

    expect(res.auftragsvolumen).toBe(1000);
    expect(res.anzahlAuftraege).toBe(4);
    expect(res.schnittAuftragswert).toBe(250); // 1000 / 4
    expect(res.umsatzBezahlt).toBe(850);
    expect(res.nachLeistungsart).toEqual([
      { serviceType: 'folierung', summe: 700, anzahl: 2 },
      { serviceType: 'aufbereitung', summe: 300, anzahl: 2 },
    ]);
    expect(res.topKunden).toEqual([
      { name: 'Max Muster', summe: 600, anzahl: 2 },
      { name: 'ACME GmbH', summe: 400, anzahl: 2 },
    ]);
  });

  it('ohne Auftraege: Schnitt = 0 (keine Division durch Null), keine Kunden-Abfrage', async () => {
    const orderRepo: any = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(makeQb({ summe: '0', anzahl: '0' }))
        .mockReturnValueOnce(makeQb(undefined, []))
        .mockReturnValueOnce(makeQb(undefined, [])),
    };
    const invoiceRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(makeQb({ summe: '0' })) };
    const customerRepo: any = { find: jest.fn() };

    const svc = new ReportsService(orderRepo, invoiceRepo, customerRepo);
    const res = await svc.overview('t1');

    expect(res.anzahlAuftraege).toBe(0);
    expect(res.schnittAuftragswert).toBe(0);
    expect(res.topKunden).toEqual([]);
    expect(customerRepo.find).not.toHaveBeenCalled();
  });
});
