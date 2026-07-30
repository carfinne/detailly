import { OrderTimeService, computeSollMinuten } from './order-time.service';

/**
 * Nachkalkulation (Soll/Ist) der Auftragszeiten:
 * - Soll-Summe aus den Positionen bzw. Override am Auftrag,
 * - Abweichung (auch bei 0 Soll ohne Crash),
 * - tenant-korrekte Aggregat-Uebersicht (GROUP BY, kein N+1).
 */

/** Chainbarer QueryBuilder-Mock: alle Ketten-Methoden geben sich selbst zurueck. */
function qb(rawMany: any[] = [], many: any[] = []) {
  const b: any = {};
  for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'orderBy', 'limit', 'take']) {
    b[m] = jest.fn(() => b);
  }
  b.getRawMany = jest.fn().mockResolvedValue(rawMany);
  b.getMany = jest.fn().mockResolvedValue(many);
  return b;
}

function makeService(
  over: {
    rows?: any[];
    orderFindOne?: any;
    orderFind?: any[];
    users?: any[];
    customers?: any[];
    repoQbs?: any[];
    itemQb?: any;
  } = {},
) {
  const repoCqb = jest.fn();
  (over.repoQbs ?? []).forEach((b) => repoCqb.mockReturnValueOnce(b));
  const repo: any = {
    find: jest.fn().mockResolvedValue(over.rows ?? []),
    createQueryBuilder: repoCqb,
  };
  const orderRepo: any = {
    findOne: jest.fn().mockResolvedValue(over.orderFindOne ?? null),
    find: jest.fn().mockResolvedValue(over.orderFind ?? []),
  };
  const orderItemRepo: any = {
    createQueryBuilder: jest.fn(() => over.itemQb ?? qb([])),
  };
  const userRepo: any = { find: jest.fn().mockResolvedValue(over.users ?? []) };
  const customerRepo: any = { find: jest.fn().mockResolvedValue(over.customers ?? []) };
  const vehicleRepo: any = { find: jest.fn().mockResolvedValue([]) };
  const audit: any = { log: jest.fn() };
  const svc = new OrderTimeService(
    repo,
    orderRepo,
    orderItemRepo,
    userRepo,
    customerRepo,
    vehicleRepo,
    audit,
  );
  return { svc, repo, orderRepo, orderItemRepo, userRepo, customerRepo };
}

const TECH: any = { id: 'tech1', tenantId: 't1', role: 'technician' };
const MGR: any = { id: 'mgr1', tenantId: 't1', role: 'manager' };

describe('computeSollMinuten (reine Soll-Berechnung)', () => {
  it('summiert die Positions-Dauern, wenn kein Override gesetzt ist', () => {
    expect(
      computeSollMinuten({
        geplanteDauerMinuten: null,
        items: [{ geplanteDauerMinuten: 120 }, { geplanteDauerMinuten: 60 }, { geplanteDauerMinuten: null }],
      }),
    ).toBe(180);
  });

  it('Override am Auftrag gewinnt gegen die Positions-Summe', () => {
    expect(
      computeSollMinuten({
        geplanteDauerMinuten: 200,
        items: [{ geplanteDauerMinuten: 120 }, { geplanteDauerMinuten: 60 }],
      }),
    ).toBe(200);
  });

  it('Override 0 gewinnt ebenfalls (bewusst kein Soll)', () => {
    expect(computeSollMinuten({ geplanteDauerMinuten: 0, items: [{ geplanteDauerMinuten: 120 }] })).toBe(0);
  });

  it('kein Soll, keine Positionen -> 0 (kein Crash)', () => {
    expect(computeSollMinuten({})).toBe(0);
    expect(computeSollMinuten({ geplanteDauerMinuten: null, items: [] })).toBe(0);
  });
});

describe('OrderTimeService.listForOrder · Soll/Ist', () => {
  it('liefert Soll aus Positionen und die Abweichung (Ist - Soll)', async () => {
    const { svc } = makeService({
      rows: [{ id: 'a', userId: 'u1', minuten: 90, datum: new Date('2026-06-29') }],
      orderFindOne: {
        id: 'o1',
        tenantId: 't1',
        geplanteDauerMinuten: null,
        items: [{ geplanteDauerMinuten: 120 }, { geplanteDauerMinuten: 60 }],
      },
    });
    const res = await svc.listForOrder(TECH, 'o1');
    expect(res.summeMinuten).toBe(90);
    expect(res.sollMinuten).toBe(180);
    expect(res.abweichungMinuten).toBe(-90); // unter Plan
  });

  it('Override am Auftrag schlaegt die Positions-Summe', async () => {
    const { svc } = makeService({
      rows: [{ id: 'a', userId: 'u1', minuten: 300, datum: new Date('2026-06-29') }],
      orderFindOne: {
        id: 'o1',
        tenantId: 't1',
        geplanteDauerMinuten: 120,
        items: [{ geplanteDauerMinuten: 999 }],
      },
    });
    const res = await svc.listForOrder(MGR, 'o1');
    expect(res.sollMinuten).toBe(120);
    expect(res.abweichungMinuten).toBe(180); // ueber Plan
  });

  it('kein Soll (0) -> Abweichung = Ist, keine Division/kein Crash', async () => {
    const { svc } = makeService({
      rows: [{ id: 'a', userId: 'u1', minuten: 45, datum: new Date('2026-06-29') }],
      orderFindOne: { id: 'o1', tenantId: 't1', geplanteDauerMinuten: null, items: [] },
    });
    const res = await svc.listForOrder(TECH, 'o1');
    expect(res.sollMinuten).toBe(0);
    expect(res.abweichungMinuten).toBe(45);
  });
});

describe('OrderTimeService.uebersicht · Aggregat (tenant-scoped)', () => {
  it('aggregiert Soll/Ist je Auftrag + Stunden je Mitarbeiter, tenant-gefiltert', async () => {
    const bookedQb = qb([
      { orderId: 'o1', gebucht: '120' },
      { orderId: 'o2', gebucht: '300' },
    ]);
    const perUserQb = qb([{ userId: 'u1', gebucht: '420' }]);
    const itemQb = qb([{ orderId: 'o2', soll: '180' }]);
    const { svc } = makeService({
      repoQbs: [bookedQb, perUserQb],
      itemQb,
      orderFind: [
        { id: 'o1', auftragsnummer: 'AU-1', customerId: 'c1', status: 'in_arbeit', geplanteDauerMinuten: 60 },
        { id: 'o2', auftragsnummer: 'AU-2', customerId: 'c1', status: 'in_arbeit', geplanteDauerMinuten: null },
      ],
      customers: [{ id: 'c1', firstName: 'Max', lastName: 'Muster', companyName: null }],
      users: [{ id: 'u1', firstName: 'Lisa', lastName: 'Klein' }],
    });

    const res = await svc.uebersicht(MGR, {});

    // Tenant-Filter auf der Buchungs-Aggregation.
    expect(bookedQb.where).toHaveBeenCalledWith('ot.tenantId = :tenantId', { tenantId: 't1' });

    // Am staerksten ueber Plan zuerst: o2 (Abw. +120) vor o1 (Abw. +60).
    expect(res.auftraege.map((a) => a.orderId)).toEqual(['o2', 'o1']);
    const o1 = res.auftraege.find((a) => a.orderId === 'o1')!;
    const o2 = res.auftraege.find((a) => a.orderId === 'o2')!;
    expect(o1.sollMinuten).toBe(60); // Override
    expect(o1.gebuchtMinuten).toBe(120);
    expect(o1.abweichungMinuten).toBe(60);
    expect(o2.sollMinuten).toBe(180); // aus Positionen
    expect(o2.abweichungMinuten).toBe(120);
    expect(o1.kundeName).toBe('Max Muster');

    expect(res.summeGebuchtMinuten).toBe(420);
    expect(res.proMitarbeiter).toEqual([{ userId: 'u1', name: 'Lisa Klein', gebuchtMinuten: 420 }]);
  });

  it('Nicht-Leitung wird hart auf die eigenen Buchungen eingeschraenkt', async () => {
    const bookedQb = qb([]);
    const perUserQb = qb([]);
    const { svc } = makeService({ repoQbs: [bookedQb, perUserQb] });
    await svc.uebersicht(TECH, { userId: 'jemand-anderes' });
    // userId aus dem Query wird ignoriert; es zaehlt der eigene Nutzer.
    expect(bookedQb.andWhere).toHaveBeenCalledWith('ot.userId = :userFilter', { userFilter: 'tech1' });
  });

  it('leerer Zeitraum -> leere Uebersicht (kein Auftrags-Load)', async () => {
    const bookedQb = qb([]);
    const perUserQb = qb([]);
    const { svc, orderRepo } = makeService({ repoQbs: [bookedQb, perUserQb] });
    const res = await svc.uebersicht(MGR, {});
    expect(res).toEqual({ auftraege: [], proMitarbeiter: [], summeGebuchtMinuten: 0 });
    expect(orderRepo.find).not.toHaveBeenCalled();
  });
});
