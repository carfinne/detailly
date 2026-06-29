import { RemindersService } from './reminders.service';

function qb(count: number) {
  const o: any = {};
  for (const m of ['where', 'andWhere']) o[m] = () => o;
  o.getCount = jest.fn().mockResolvedValue(count);
  return o;
}

function makeService(counts: { inv?: number; appt?: number; prod?: number } = {}) {
  const invoiceRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(qb(counts.inv ?? 0)) };
  const apptRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(qb(counts.appt ?? 0)) };
  const productRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(qb(counts.prod ?? 0)) };
  return new RemindersService(invoiceRepo, apptRepo, productRepo);
}

describe('RemindersService · list', () => {
  it('baut nur Items mit Anzahl > 0; total = Summe der Anzahlen', async () => {
    const svc = makeService({ inv: 3, appt: 0, prod: 1 });
    const res = await svc.list('t1');
    expect(res.total).toBe(4);
    expect(res.items.map((i) => i.key)).toEqual(['rechnungen', 'material']); // keine Termine (0)
    const rech = res.items.find((i) => i.key === 'rechnungen')!;
    expect(rech).toMatchObject({ anzahl: 3, href: '/rechnungen', severity: 'danger' });
    expect(rech.label).toBe('3 überfällige Rechnungen');
    const mat = res.items.find((i) => i.key === 'material')!;
    expect(mat).toMatchObject({ anzahl: 1, href: '/shop', severity: 'caution' });
  });

  it('alles 0 -> keine Items', async () => {
    const res = await makeService().list('t1');
    expect(res).toEqual({ total: 0, items: [] });
  });

  it('Singular-Label bei genau 1', async () => {
    const res = await makeService({ inv: 1, appt: 1 }).list('t1');
    expect(res.items.find((i) => i.key === 'rechnungen')!.label).toBe('1 überfällige Rechnung');
    expect(res.items.find((i) => i.key === 'termine')!.label).toBe('1 Termin heute');
  });
});
