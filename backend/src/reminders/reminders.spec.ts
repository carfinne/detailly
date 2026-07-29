import { RemindersService } from './reminders.service';
import { UserRole } from '../users/entities/user.entity';

function qb(count: number) {
  const o: any = {};
  for (const m of ['where', 'andWhere']) o[m] = () => o;
  o.getCount = jest.fn().mockResolvedValue(count);
  return o;
}

function makeService(
  counts: { inv?: number; appt?: number; prod?: number; angebote?: number; feedback?: number } = {},
  opts: { withFeedbackRepo?: boolean } = {},
) {
  const invoiceRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(qb(counts.inv ?? 0)) };
  const apptRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(qb(counts.appt ?? 0)) };
  const productRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(qb(counts.prod ?? 0)) };
  const orderRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(qb(counts.angebote ?? 0)) };
  const feedbackRepo: any = { count: jest.fn().mockResolvedValue(counts.feedback ?? 0) };
  // Standard: OHNE Feedback-Repo (Abwaertskompatibilitaet der Alt-Konstruktion mit 4 Repos).
  const svc = opts.withFeedbackRepo
    ? new RemindersService(invoiceRepo, apptRepo, productRepo, orderRepo, feedbackRepo)
    : new RemindersService(invoiceRepo, apptRepo, productRepo, orderRepo);
  return { svc, orderRepo, feedbackRepo };
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
    // Ganz vorne (unshift) + im total enthalten (2 + 3).
    expect(res.items[0]).toMatchObject({ key: 'angebote', anzahl: 3, href: '/auftraege', severity: 'info' });
    expect(res.items[0].label).toBe('3 online angenommene Angebote');
    expect(res.total).toBe(5);
  });

  it('Empfang sieht ihn ebenfalls; Singular-Label bei genau 1', async () => {
    const { svc } = makeService({ angebote: 1 });
    const res = await svc.list('t1', UserRole.RECEPTIONIST);
    expect(res.items.find((i) => i.key === 'angebote')!.label).toBe('1 online angenommenes Angebot');
  });

  it('Techniker sieht den Hinweis NICHT (role-gate, kein Count-Query)', async () => {
    const { svc, orderRepo } = makeService({ angebote: 5 });
    const res = await svc.list('t1', UserRole.TECHNICIAN);
    expect(res.items.some((i) => i.key === 'angebote')).toBe(false);
    expect(orderRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('ohne Rolle (undefined) kein Angebots-Hinweis (Abwaertskompatibilitaet)', async () => {
    const { svc, orderRepo } = makeService({ angebote: 5 });
    const res = await svc.list('t1');
    expect(res.items.some((i) => i.key === 'angebote')).toBe(false);
    expect(orderRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe('RemindersService · neues Kunden-Feedback (Welle 2-C)', () => {
  it('Empfang/Leitung sieht ungelesenes Feedback; korrektes Singular/Plural', async () => {
    const eins = await makeService({ feedback: 1 }, { withFeedbackRepo: true }).svc.list('t1', UserRole.OWNER);
    expect(eins.items.find((i) => i.key === 'feedback')).toMatchObject({
      anzahl: 1, href: '/feedback', severity: 'info', label: '1 neues Kunden-Feedback',
    });
    const drei = await makeService({ feedback: 3 }, { withFeedbackRepo: true }).svc.list('t1', UserRole.MANAGER);
    expect(drei.items.find((i) => i.key === 'feedback')!.label).toBe('3 neue Kunden-Feedbacks');
  });

  it('Techniker sieht das Feedback NICHT (role-gate, kein Count-Query)', async () => {
    const { svc, feedbackRepo } = makeService({ feedback: 5 }, { withFeedbackRepo: true });
    const res = await svc.list('t1', UserRole.TECHNICIAN);
    expect(res.items.some((i) => i.key === 'feedback')).toBe(false);
    expect(feedbackRepo.count).not.toHaveBeenCalled();
  });

  it('ohne Feedback-Repo (Alt-Konstruktion) bleibt der Hinweis aus (Abwaertskompatibilitaet)', async () => {
    const { svc } = makeService({ feedback: 5 });
    const res = await svc.list('t1', UserRole.OWNER);
    expect(res.items.some((i) => i.key === 'feedback')).toBe(false);
  });
});
