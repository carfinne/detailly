import { NotFoundException } from '@nestjs/common';
import { ProfitabilityService } from './profitability.service';

function makeService(over: any = {}) {
  const orderRepo: any = {
    findOne: jest.fn().mockResolvedValue(
      'order' in over ? over.order : { id: 'o1', tenantId: 't1', nettoSumme: '1600' },
    ),
  };
  const timeRepo: any = { find: jest.fn().mockResolvedValue(over.zeiten ?? []) };
  const materialRepo: any = { find: jest.fn().mockResolvedValue(over.material ?? []) };
  const userRepo: any = { find: jest.fn().mockResolvedValue(over.users ?? []) };
  const productRepo: any = { find: jest.fn().mockResolvedValue(over.products ?? []) };
  const svc = new ProfitabilityService(orderRepo, timeRepo, materialRepo, userRepo, productRepo);
  return { svc, userRepo, productRepo };
}

describe('ProfitabilityService · forOrder', () => {
  it('Marge = Netto - Lohn - Material (+ Prozent, + Deckungsbeitrag/Stunde)', async () => {
    const { svc } = makeService({
      zeiten: [{ userId: 'u1', minuten: 480 }], // 8 h
      material: [{ productId: 'p1', menge: '2' }],
      users: [{ id: 'u1', stundenlohn: 20 }], // 8 * 20 = 160
      products: [{ id: 'p1', einkaufspreis: 100 }], // 2 * 100 = 200
    });
    const r = await svc.forOrder('t1', 'o1');
    expect(r).toEqual({
      netto: 1600,
      lohnkosten: 160,
      materialkosten: 200,
      marge: 1240, // 1600 - 160 - 200
      margeProzent: 77.5, // 1240 / 1600
      gebuchteMinuten: 480,
      gebuchteStunden: 8,
      deckungsbeitragProStunde: 155, // 1240 / 8 h
      umsatzProStunde: 200, // 1600 / 8 h
    });
  });

  it('Deckungsbeitrag/Stunde rundet auf 2 Stellen (krumme Stunden)', async () => {
    const { svc } = makeService({
      order: { id: 'o1', tenantId: 't1', nettoSumme: '1000' },
      zeiten: [{ userId: 'u1', minuten: 90 }], // 1,5 h, kein Lohn hinterlegt
      users: [{ id: 'u1', stundenlohn: 0 }],
    });
    const r = await svc.forOrder('t1', 'o1');
    expect(r.gebuchteStunden).toBe(1.5);
    expect(r.marge).toBe(1000);
    expect(r.deckungsbeitragProStunde).toBe(666.67); // 1000 / 1,5 = 666,66…
    expect(r.umsatzProStunde).toBe(666.67);
  });

  it('0 gebuchte Stunden -> Deckungsbeitrag/Stunde null (keine Division durch Null)', async () => {
    const { svc, userRepo, productRepo } = makeService();
    const r = await svc.forOrder('t1', 'o1');
    expect(r.lohnkosten).toBe(0);
    expect(r.materialkosten).toBe(0);
    expect(r.marge).toBe(1600);
    expect(r.gebuchteMinuten).toBe(0);
    expect(r.gebuchteStunden).toBe(0);
    expect(r.deckungsbeitragProStunde).toBeNull();
    expect(r.umsatzProStunde).toBeNull();
    expect(userRepo.find).not.toHaveBeenCalled();
    expect(productRepo.find).not.toHaveBeenCalled();
  });

  it('Netto 0 -> margeProzent null (keine Division durch Null)', async () => {
    const { svc } = makeService({ order: { id: 'o1', tenantId: 't1', nettoSumme: '0' } });
    const r = await svc.forOrder('t1', 'o1');
    expect(r.margeProzent).toBeNull();
    expect(r.marge).toBe(0);
  });

  it('unbekannter Auftrag -> 404', async () => {
    const { svc } = makeService({ order: null });
    await expect(svc.forOrder('t1', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

// --- Betriebs-Durchschnitt (Monat) ------------------------------------------

/** Chainbarer QueryBuilder-Mock; zeichnet .where(...)-Parameter auf. */
function makeQb(result: { rawMany?: any[]; rawOne?: any }) {
  const state: { whereCalls: { sql: string; params: any }[] } = { whereCalls: [] };
  const qb: any = {
    innerJoin: jest.fn(() => qb),
    leftJoin: jest.fn(() => qb),
    select: jest.fn(() => qb),
    addSelect: jest.fn(() => qb),
    where: jest.fn((sql: string, params: any) => {
      state.whereCalls.push({ sql, params });
      return qb;
    }),
    groupBy: jest.fn(() => qb),
    getRawMany: jest.fn(async () => result.rawMany ?? []),
    getRawOne: jest.fn(async () => result.rawOne ?? null),
  };
  return { qb, state };
}

function makeUebersichtService(
  over: { zeitRows?: any[]; netto?: any; material?: any } = {},
) {
  const time = makeQb({ rawMany: over.zeitRows ?? [] });
  const order = makeQb({ rawOne: over.netto ?? { netto: '0' } });
  const material = makeQb({ rawOne: over.material ?? { material: '0' } });
  const timeRepo: any = { createQueryBuilder: jest.fn(() => time.qb) };
  const orderRepo: any = { createQueryBuilder: jest.fn(() => order.qb) };
  const materialRepo: any = { createQueryBuilder: jest.fn(() => material.qb) };
  const svc = new ProfitabilityService(orderRepo, timeRepo, materialRepo, {} as any, {} as any);
  return { svc, timeRepo, orderRepo, materialRepo, time, order, material };
}

describe('ProfitabilityService · betriebsUebersicht', () => {
  it('aggregiert ueber mehrere Auftraege -> Deckungsbeitrag/Stunde des Betriebs', async () => {
    const { svc } = makeUebersichtService({
      zeitRows: [
        { orderId: 'o1', minuten: '480', lohnGewichtet: '9600' }, // 8 h, 480*20
        { orderId: 'o2', minuten: '120', lohnGewichtet: '3600' }, // 2 h, 120*30
        { orderId: 'o3', minuten: '60', lohnGewichtet: '1500' }, //  1 h, 60*25
      ],
      netto: { netto: '3300' },
      material: { material: '400' },
    });
    const r = await svc.betriebsUebersicht('t1', '2026-08');
    // Stunden: 660 min -> 11 h; Lohn: 14700 / 60 = 245; Marge: 3300-245-400 = 2655
    expect(r.zeitraum).toBe('2026-08');
    expect(r.anzahlAuftraege).toBe(3);
    expect(r.netto).toBe(3300);
    expect(r.lohnkosten).toBe(245);
    expect(r.materialkosten).toBe(400);
    expect(r.marge).toBe(2655);
    expect(r.gebuchteStunden).toBe(11);
    expect(r.deckungsbeitragProStunde).toBe(241.36); // 2655 / 11
    expect(r.umsatzProStunde).toBe(300); // 3300 / 11
  });

  it('0 Auftraege mit Zeit -> null, keine Netto-/Material-Query', async () => {
    const { svc, orderRepo, materialRepo } = makeUebersichtService({ zeitRows: [] });
    const r = await svc.betriebsUebersicht('t1', '2026-08');
    expect(r.anzahlAuftraege).toBe(0);
    expect(r.netto).toBe(0);
    expect(r.marge).toBe(0);
    expect(r.gebuchteStunden).toBe(0);
    expect(r.deckungsbeitragProStunde).toBeNull();
    expect(r.umsatzProStunde).toBeNull();
    // Ohne qualifizierende Auftraege gar keine IN-()-Folgequery.
    expect(orderRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(materialRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('tenant-gescoped: tenantId in jeder Query, Folgequeries nur fuer die Auftrags-Ids', async () => {
    const { svc, time, order, material } = makeUebersichtService({
      zeitRows: [{ orderId: 'o1', minuten: '60', lohnGewichtet: '1200' }],
      netto: { netto: '500' },
      material: { material: '0' },
    });
    await svc.betriebsUebersicht('t9', '2026-08');
    expect(time.state.whereCalls[0].params.tenantId).toBe('t9');
    expect(order.state.whereCalls[0].params.tenantId).toBe('t9');
    expect(material.state.whereCalls[0].params.tenantId).toBe('t9');
    expect(order.state.whereCalls[0].params.ids).toEqual(['o1']);
    expect(material.state.whereCalls[0].params.ids).toEqual(['o1']);
  });

  it('kein N+1: konstante Query-Anzahl unabhaengig von der Auftrags-Anzahl', async () => {
    const { svc, timeRepo, orderRepo, materialRepo } = makeUebersichtService({
      zeitRows: [
        { orderId: 'o1', minuten: '60', lohnGewichtet: '0' },
        { orderId: 'o2', minuten: '60', lohnGewichtet: '0' },
        { orderId: 'o3', minuten: '60', lohnGewichtet: '0' },
        { orderId: 'o4', minuten: '60', lohnGewichtet: '0' },
        { orderId: 'o5', minuten: '60', lohnGewichtet: '0' },
      ],
      netto: { netto: '0' },
      material: { material: '0' },
    });
    await svc.betriebsUebersicht('t1', '2026-08');
    // 5 Auftraege, aber konstant 3 Queries: 1 Gruppen-Aggregat + Netto + Material.
    expect(timeRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(orderRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(materialRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('ungueltiger/leerer Zeitraum -> Fallback auf laufenden Berliner Monat', async () => {
    const { svc } = makeUebersichtService({ zeitRows: [] });
    const r = await svc.betriebsUebersicht('t1', 'quatsch');
    expect(r.zeitraum).toMatch(/^\d{4}-\d{2}$/);
  });
});
