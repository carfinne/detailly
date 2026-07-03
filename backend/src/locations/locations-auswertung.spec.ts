import { LocationsService } from './locations.service';

/**
 * Tests fuer die Standort-Auswertung nach dem T-009-Umbau: Aggregation kommt
 * als GROUP-BY-Zeilen aus der DB (getRawMany) statt aus Volltabellen im
 * Speicher. Geprueft wird das Bucket-Mapping (bekannter Standort, unbekannte
 * locationId -> "Ohne Standort"), die Number()-Wandlung von String-Aggregaten
 * (Postgres) und die Rundung des Umsatzes.
 */
function makeQb(rawRows: unknown[]) {
  const qb: any = {};
  for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'leftJoin']) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getRawMany = jest.fn().mockResolvedValue(rawRows);
  return qb;
}

function makeService(opts: {
  standorte: Array<{ id: string; name: string }>;
  offene: unknown[];
  termine: unknown[];
  umsatz: unknown[];
}) {
  const repo: any = { find: jest.fn().mockResolvedValue(opts.standorte) };
  const orderRepo: any = { createQueryBuilder: jest.fn(() => makeQb(opts.offene)) };
  const apptRepo: any = { createQueryBuilder: jest.fn(() => makeQb(opts.termine)) };
  const invoiceRepo: any = { createQueryBuilder: jest.fn(() => makeQb(opts.umsatz)) };
  return new LocationsService(repo, orderRepo, apptRepo, invoiceRepo, {} as any, {} as any);
}

describe('LocationsService · auswertung (GROUP-BY-Aggregation)', () => {
  it('mappt Gruppenzeilen auf Standorte; String-Aggregate werden Zahlen', async () => {
    const service = makeService({
      standorte: [{ id: 'l1', name: 'Hauptsitz' }],
      offene: [{ locationId: 'l1', anzahl: '2' }],
      termine: [{ locationId: 'l1', anzahl: '3' }],
      umsatz: [{ locationId: 'l1', summe: '100.505' }],
    });
    const res = await service.auswertung('t1');
    expect(res).toEqual([
      { locationId: 'l1', name: 'Hauptsitz', umsatz: 100.51, offeneAuftraege: 2, termine: 3 },
    ]);
  });

  it('unbekannte/NULL-locationId -> Bucket "Ohne Standort" (nur wenn belegt)', async () => {
    const service = makeService({
      standorte: [{ id: 'l1', name: 'Hauptsitz' }],
      offene: [
        { locationId: null, anzahl: 1 },
        { locationId: 'geloescht', anzahl: 2 }, // soft-geloeschter Standort
      ],
      termine: [],
      umsatz: [{ locationId: null, summe: 50 }],
    });
    const res = await service.auswertung('t1');
    expect(res).toEqual([
      { locationId: 'l1', name: 'Hauptsitz', umsatz: 0, offeneAuftraege: 0, termine: 0 },
      { locationId: null, name: 'Ohne Standort', umsatz: 50, offeneAuftraege: 3, termine: 0 },
    ]);
  });

  it('leerer Betrieb: keine "Ohne Standort"-Zeile, Standorte mit Nullwerten', async () => {
    const service = makeService({
      standorte: [{ id: 'l1', name: 'Hauptsitz' }],
      offene: [],
      termine: [],
      umsatz: [],
    });
    const res = await service.auswertung('t1');
    expect(res).toEqual([
      { locationId: 'l1', name: 'Hauptsitz', umsatz: 0, offeneAuftraege: 0, termine: 0 },
    ]);
  });
});
