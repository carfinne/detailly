import { PlatformAnalyticsService } from './platform-analytics.service';

function qb(opts: { rawOne?: any; rawMany?: any }) {
  const o: any = {};
  for (const m of ['innerJoin', 'select', 'addSelect', 'where', 'andWhere', 'groupBy', 'orderBy', 'limit']) {
    o[m] = () => o;
  }
  o.getRawOne = jest.fn().mockResolvedValue(opts.rawOne);
  o.getRawMany = jest.fn().mockResolvedValue(opts.rawMany ?? []);
  return o;
}

function makeService(repos: any = {}) {
  const def = () => ({ count: jest.fn().mockResolvedValue(0), find: jest.fn().mockResolvedValue([]), createQueryBuilder: jest.fn() });
  const svc = new PlatformAnalyticsService(
    repos.tenant ?? def(),
    repos.sub ?? def(),
    repos.plan ?? def(),
    repos.order ?? def(),
    repos.invoice ?? def(),
  );
  return { svc };
}

describe('PlatformAnalyticsService', () => {
  it('aboUebersicht: Status-Zahlen, MRR (Summe Plan-Monatspreise aktiver Abos), Tarife', async () => {
    const sub: any = {
      count: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(({ active: 10, trial: 5, canceled: 2 } as any)[where.status] ?? 0),
      ),
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(qb({ rawOne: { mrr: '490' } }))
        .mockReturnValueOnce(qb({ rawMany: [{ name: 'Pro', anzahl: '6' }, { name: 'Starter', anzahl: '4' }] })),
    };
    const { svc } = makeService({ sub });
    const r = await svc.aboUebersicht();
    expect(r).toEqual({
      aktiv: 10, testphase: 5, gekuendigt: 2, mrr: 490,
      tarife: [{ name: 'Pro', anzahl: 6 }, { name: 'Starter', anzahl: 4 }],
    });
  });

  it('nutzung: Auftraege/Rechnungen gesamt + bezahlter Umsatz aller Betriebe', async () => {
    const order: any = { count: jest.fn().mockResolvedValue(1900), createQueryBuilder: jest.fn() };
    const invoice: any = { count: jest.fn().mockResolvedValue(1500), createQueryBuilder: jest.fn().mockReturnValue(qb({ rawOne: { summe: '412000' } })) };
    const { svc } = makeService({ order, invoice });
    const r = await svc.nutzung();
    expect(r).toEqual({ auftraege: 1900, rechnungen: 1500, umsatzGesamt: 412000 });
  });

  it('betriebsAktivitaet: Top-Betriebe + inaktive (kein Auftrag in 30 Tagen)', async () => {
    const order: any = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(qb({ rawMany: [{ tenantId: 't1', anzahl: '50' }] })) // Top
        .mockReturnValueOnce(qb({ rawMany: [{ tenantId: 't1' }] })), // aktiv (30 Tage)
    };
    const tenant: any = {
      find: jest.fn().mockResolvedValue([{ id: 't1', name: 'Muster GmbH' }, { id: 't2', name: 'Stiller Betrieb' }]),
    };
    const { svc } = makeService({ order, tenant });
    const r = await svc.betriebsAktivitaet();
    expect(r.topBetriebe).toEqual([{ name: 'Muster GmbH', auftraege: 50 }]);
    expect(r.inaktivAnzahl).toBe(1); // t2 hatte keinen Auftrag in 30 Tagen
    expect(r.inaktivBetriebe).toEqual([{ name: 'Stiller Betrieb' }]);
  });
});
