import { DashboardService } from './dashboard.service';

/** Chainbarer QueryBuilder-Mock fuer getManyAndCount. */
function qb(rows: any[], count: number) {
  const o: any = {};
  for (const m of ['where', 'orderBy', 'take']) o[m] = () => o;
  o.getManyAndCount = jest.fn().mockResolvedValue([rows, count]);
  return o;
}

describe('DashboardService · niedrigerBestand', () => {
  it('liefert Anzahl gesamt + Top-Liste (knappste zuerst), Zahlen gecastet', async () => {
    const productRepo: any = {
      createQueryBuilder: jest.fn().mockReturnValue(
        qb([{ name: 'Folie X', bestand: '2', mindestbestand: '5', einheit: 'Rolle' }], 3),
      ),
    };
    const svc = new DashboardService(
      {} as any, {} as any, {} as any, {} as any, {} as any, productRepo,
    );
    const res = await svc.niedrigerBestand('t1');
    expect(res.anzahl).toBe(3);
    expect(res.produkte).toEqual([
      { name: 'Folie X', bestand: 2, mindestbestand: 5, einheit: 'Rolle' },
    ]);
  });
});
