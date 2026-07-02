import { LocationsService } from './locations.service';

/**
 * Korrektheits-Regression fuer die auf DB-Aggregate (GROUP-BY) umgestellte
 * Standort-Auswertung. Die frueheren JS-Schleifen hatten drei Sonderfaelle beim
 * "Ohne Standort"-Bucket, die die SQL-Version exakt nachbilden muss:
 *  - Roh-Row mit locationId = null  -> "Ohne Standort"
 *  - locationId, die keinem AKTIVEN Standort entspricht (z. B. soft-geloescht)
 *    -> "Ohne Standort"
 *  - "Ohne Standort" wird nur angehaengt, wenn dort etwas > 0 ist.
 *
 * Reine Mock-Tests: die Repos liefern feste Roh-Rows (kein Nest-Bootstrap, keine DB).
 */
describe('LocationsService.auswertung – DB-Aggregat-Faltung', () => {
  const audit = { log: jest.fn() } as any;

  // Chainbarer QueryBuilder-Mock: alle Kettenmethoden geben sich selbst zurueck,
  // getRawMany() liefert die vorbereiteten Roh-Rows.
  const qb = (rows: any[]) => {
    const b: any = {};
    for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'leftJoin', 'innerJoin']) {
      b[m] = jest.fn(() => b);
    }
    b.getRawMany = jest.fn(async () => rows);
    return b;
  };

  const makeService = (opts: {
    standorte: any[];
    offene: any[];
    termine: any[];
    umsatz: any[];
  }) => {
    const locRepo: any = { find: jest.fn(async () => opts.standorte) };
    const orderRepo: any = { createQueryBuilder: jest.fn(() => qb(opts.offene)) };
    const apptRepo: any = { createQueryBuilder: jest.fn(() => qb(opts.termine)) };
    const invoiceRepo: any = { createQueryBuilder: jest.fn(() => qb(opts.umsatz)) };
    return new LocationsService(locRepo, orderRepo, apptRepo, invoiceRepo, audit);
  };

  it('faltet je Standort korrekt und buendelt null + geloeschte Standort-ID unter "Ohne Standort"', async () => {
    const svc = makeService({
      standorte: [
        { id: 'L1', name: 'Standort A' },
        { id: 'L2', name: 'Standort B' },
      ],
      // 'L3' existiert NICHT mehr in standorte (soft-geloescht) -> muss in OHNE fallen.
      offene: [
        { locationId: 'L1', anzahl: '3' },
        { locationId: 'L2', anzahl: '1' },
        { locationId: null, anzahl: '2' },
        { locationId: 'L3', anzahl: '5' },
      ],
      termine: [
        { locationId: 'L1', anzahl: '4' },
        { locationId: null, anzahl: '1' },
      ],
      umsatz: [
        { locationId: 'L1', umsatz: '100.50' },
        { locationId: 'L2', umsatz: '0' },
        { locationId: null, umsatz: '50.25' },
      ],
    });

    const res = await svc.auswertung('t1');

    const l1 = res.find((r) => r.locationId === 'L1');
    const l2 = res.find((r) => r.locationId === 'L2');
    const ohne = res.find((r) => r.locationId === null);

    expect(l1).toEqual({ locationId: 'L1', name: 'Standort A', umsatz: 100.5, offeneAuftraege: 3, termine: 4 });
    expect(l2).toEqual({ locationId: 'L2', name: 'Standort B', umsatz: 0, offeneAuftraege: 1, termine: 0 });
    // OHNE = null-Rows + geloeschte L3: offene 2+5=7, termine 1, umsatz 50.25.
    expect(ohne).toEqual({ locationId: null, name: 'Ohne Standort', umsatz: 50.25, offeneAuftraege: 7, termine: 1 });
    expect(res).toHaveLength(3);
  });

  it('haengt "Ohne Standort" NICHT an, wenn dort alles 0 ist', async () => {
    const svc = makeService({
      standorte: [{ id: 'L1', name: 'Standort A' }],
      offene: [{ locationId: 'L1', anzahl: '2' }],
      termine: [{ locationId: 'L1', anzahl: '1' }],
      umsatz: [{ locationId: 'L1', umsatz: '10' }],
    });

    const res = await svc.auswertung('t1');

    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({ locationId: 'L1', name: 'Standort A', umsatz: 10, offeneAuftraege: 2, termine: 1 });
    expect(res.some((r) => r.locationId === null)).toBe(false);
  });

  it('rundet Umsatz auf zwei Nachkommastellen und castet decimal-Strings', async () => {
    const svc = makeService({
      standorte: [{ id: 'L1', name: 'Standort A' }],
      offene: [],
      termine: [],
      // decimal kommt als String; mehrere Rows auf denselben Standort werden summiert.
      umsatz: [
        { locationId: 'L1', umsatz: '10.005' },
        { locationId: 'L1', umsatz: '0.005' },
      ],
    });

    const res = await svc.auswertung('t1');
    // 10.005 + 0.005 = 10.01 (gerundet), nicht String-Konkatenation.
    expect(res[0].umsatz).toBe(10.01);
    expect(res[0].offeneAuftraege).toBe(0);
  });
});
