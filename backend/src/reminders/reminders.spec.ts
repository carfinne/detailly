import { RemindersService } from './reminders.service';
import { UserRole } from '../users/entities/user.entity';

/** Einfacher QB-Mock mit fixem getCount (invoice/appt/product). */
function qb(count: number) {
  const o: any = {};
  for (const m of ['where', 'andWhere']) o[m] = () => o;
  o.getCount = jest.fn().mockResolvedValue(count);
  return o;
}

/**
 * Order-QB-Mock: die WHERE-Bedingung entscheidet, welcher Zaehler geliefert wird
 * (angebote vs. nachsorge) – der Rollen-Block ruft orderRepo.createQueryBuilder
 * ZWEIMAL auf (online angenommene Angebote + faellige Nachsorge).
 */
function orderQb(counts: { angebote?: number; nachsorge?: number }) {
  let cond = '';
  const o: any = {};
  o.where = (c: string) => {
    cond = c;
    return o;
  };
  o.andWhere = () => o;
  o.getCount = jest.fn().mockImplementation(() => {
    if (cond.includes('angebotOnlineAngenommenAm')) return Promise.resolve(counts.angebote ?? 0);
    if (cond.includes('nachsorgeErinnertAm')) return Promise.resolve(counts.nachsorge ?? 0);
    return Promise.resolve(0);
  });
  return o;
}

function makeService(
  counts: { inv?: number; appt?: number; prod?: number; angebote?: number; nachfass?: number; nachsorge?: number } = {},
) {
  const invoiceRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(qb(counts.inv ?? 0)) };
  const apptRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(qb(counts.appt ?? 0)) };
  const productRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(qb(counts.prod ?? 0)) };
  const orderRepo: any = {
    createQueryBuilder: jest.fn().mockImplementation(() => orderQb(counts)),
  };
  const invoices: any = { nachfassCount: jest.fn().mockResolvedValue(counts.nachfass ?? 0) };
  return {
    svc: new RemindersService(invoiceRepo, apptRepo, productRepo, orderRepo, invoices),
    orderRepo,
    invoices,
  };
}

describe('RemindersService · list', () => {
  it('baut nur Items mit Anzahl > 0; total = Summe der Anzahlen', async () => {
    const { svc } = makeService({ inv: 3, appt: 0, prod: 1 });
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
    const { svc } = makeService();
    const res = await svc.list('t1');
    expect(res).toEqual({ total: 0, items: [] });
  });

  it('Singular-Label bei genau 1', async () => {
    const { svc } = makeService({ inv: 1, appt: 1 });
    const res = await svc.list('t1');
    expect(res.items.find((i) => i.key === 'rechnungen')!.label).toBe('1 überfällige Rechnung');
    expect(res.items.find((i) => i.key === 'termine')!.label).toBe('1 Termin heute');
  });
});

describe('RemindersService · online angenommene Angebote (F3)', () => {
  it('Inhaber sieht den Hinweis ganz vorne + Umsatz-Zaehler', async () => {
    const { svc } = makeService({ inv: 2, angebote: 3 });
    const res = await svc.list('t1', UserRole.OWNER);
    expect(res.items[0]).toMatchObject({ key: 'angebote', anzahl: 3, href: '/auftraege', severity: 'info' });
    expect(res.items[0].label).toBe('3 online angenommene Angebote');
    expect(res.total).toBe(5);
  });

  it('Empfang sieht ihn ebenfalls; Singular-Label bei genau 1', async () => {
    const { svc } = makeService({ angebote: 1 });
    const res = await svc.list('t1', UserRole.RECEPTIONIST);
    expect(res.items.find((i) => i.key === 'angebote')!.label).toBe('1 online angenommenes Angebot');
  });

  it('Techniker sieht die Umsatz-Hinweise NICHT (role-gate, kein Count-Query)', async () => {
    const { svc, orderRepo, invoices } = makeService({ angebote: 5, nachfass: 5, nachsorge: 5 });
    const res = await svc.list('t1', UserRole.TECHNICIAN);
    expect(res.items.some((i) => i.key === 'angebote')).toBe(false);
    expect(res.items.some((i) => i.key === 'nachfass')).toBe(false);
    expect(res.items.some((i) => i.key === 'nachsorge')).toBe(false);
    expect(orderRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(invoices.nachfassCount).not.toHaveBeenCalled();
  });

  it('ohne Rolle (undefined) kein Umsatz-Hinweis (Abwaertskompatibilitaet)', async () => {
    const { svc, orderRepo, invoices } = makeService({ angebote: 5, nachfass: 5, nachsorge: 5 });
    const res = await svc.list('t1');
    expect(res.items.some((i) => i.key === 'angebote')).toBe(false);
    expect(orderRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(invoices.nachfassCount).not.toHaveBeenCalled();
  });
});

describe('RemindersService · Nachfassen + Nachsorge (Welle 2-B)', () => {
  it('Inhaber sieht Nachfass- und Nachsorge-Hinweise mit korrektem Link/Severity', async () => {
    const { svc, invoices } = makeService({ nachfass: 4, nachsorge: 2 });
    const res = await svc.list('t1', UserRole.OWNER);
    expect(invoices.nachfassCount).toHaveBeenCalledWith('t1', expect.any(Date));
    const nf = res.items.find((i) => i.key === 'nachfass')!;
    expect(nf).toMatchObject({ anzahl: 4, href: '/rechnungen?nachfass=1', severity: 'info' });
    expect(nf.label).toBe('4 Angebote nachfassen');
    const ns = res.items.find((i) => i.key === 'nachsorge')!;
    expect(ns).toMatchObject({ anzahl: 2, href: '/auftraege?nachsorge=1', severity: 'info' });
    expect(ns.label).toBe('2 Nachsorgen faellig');
    expect(res.total).toBe(6);
  });

  it('Singular-Labels bei genau 1', async () => {
    const { svc } = makeService({ nachfass: 1, nachsorge: 1 });
    const res = await svc.list('t1', UserRole.MANAGER);
    expect(res.items.find((i) => i.key === 'nachfass')!.label).toBe('1 Angebot nachfassen');
    expect(res.items.find((i) => i.key === 'nachsorge')!.label).toBe('1 Nachsorge faellig');
  });

  it('0 -> keine Nachfass-/Nachsorge-Items (nur Anzahl>0)', async () => {
    const { svc } = makeService({ nachfass: 0, nachsorge: 0 });
    const res = await svc.list('t1', UserRole.OWNER);
    expect(res.items.some((i) => i.key === 'nachfass')).toBe(false);
    expect(res.items.some((i) => i.key === 'nachsorge')).toBe(false);
  });
});
