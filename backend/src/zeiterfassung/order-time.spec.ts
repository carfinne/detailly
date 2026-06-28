import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderTimeService } from './order-time.service';

/**
 * Tests fuer die Auftragszeiten (Job-Costing). Schwerpunkt: Anti-Betrug
 * (Mitarbeiter bucht nur auf sich selbst), Mandantentrennung, Summen/Namen.
 */
function makeService(
  over: { rows?: any[]; found?: any; order?: any; user?: any; users?: any[] } = {},
) {
  const repo: any = {
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: 'ot1', ...x })),
    find: jest.fn().mockResolvedValue(over.rows ?? []),
    findOne: jest.fn().mockResolvedValue(over.found ?? null),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const orderRepo: any = {
    findOne: jest.fn().mockResolvedValue('order' in over ? over.order : { id: 'o1', tenantId: 't1' }),
  };
  const userRepo: any = {
    findOne: jest.fn().mockResolvedValue('user' in over ? over.user : { id: 'emp9', tenantId: 't1' }),
    find: jest.fn().mockResolvedValue(over.users ?? []),
  };
  const audit: any = { log: jest.fn() };
  const svc = new OrderTimeService(repo, orderRepo, userRepo, audit);
  return { svc, repo, orderRepo, userRepo };
}

const TECH: any = { id: 'tech1', tenantId: 't1', role: 'technician' };
const MGR: any = { id: 'mgr1', tenantId: 't1', role: 'manager' };

describe('OrderTimeService · erfassen (Anti-Betrug)', () => {
  it('Mitarbeiter bucht IMMER auf sich selbst – dto.userId wird ignoriert', async () => {
    const { svc, repo, userRepo } = makeService();
    await svc.create(TECH, { orderId: 'o1', datum: '2026-06-29', minuten: 120, userId: 'jemand-anderes' });
    const saved = repo.create.mock.calls[0][0];
    expect(saved.userId).toBe('tech1');
    expect(saved.erfasstVon).toBe('tech1');
    // Keine Mitarbeiter-Validierung noetig, da dto.userId fuer Nicht-Leitung ignoriert wird.
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it('Leitung darf fuer einen Mitarbeiter erfassen (validiert + erfasstVon = Leitung)', async () => {
    const { svc, repo, userRepo } = makeService({ user: { id: 'emp9', tenantId: 't1' } });
    await svc.create(MGR, { orderId: 'o1', datum: '2026-06-29', minuten: 60, userId: 'emp9' });
    const saved = repo.create.mock.calls[0][0];
    expect(saved.userId).toBe('emp9');
    expect(saved.erfasstVon).toBe('mgr1');
    expect(userRepo.findOne).toHaveBeenCalled();
  });

  it('Auftrag fremd/unbekannt -> BadRequest (Mandantentrennung)', async () => {
    const { svc } = makeService({ order: null });
    await expect(
      svc.create(TECH, { orderId: 'fremd', datum: '2026-06-29', minuten: 30 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OrderTimeService · auflisten', () => {
  it('summiert Minuten und loest Mitarbeiternamen auf, neueste zuerst', async () => {
    const rows = [
      { id: 'a', userId: 'u1', minuten: 180, datum: new Date('2026-06-29') },
      { id: 'b', userId: 'u2', minuten: 90, datum: new Date('2026-06-28') },
    ];
    const { svc } = makeService({
      rows,
      users: [
        { id: 'u1', firstName: 'Max', lastName: 'Muster' },
        { id: 'u2', firstName: 'Lisa', lastName: 'Klein' },
      ],
    });
    const res = await svc.listForOrder('t1', 'o1');
    expect(res.summeMinuten).toBe(270);
    expect(res.eintraege.find((e) => e.id === 'a')!.mitarbeiterName).toBe('Max Muster');
    expect(res.eintraege.find((e) => e.id === 'b')!.mitarbeiterName).toBe('Lisa Klein');
  });

  it('ohne orderId -> leer', async () => {
    const { svc, repo } = makeService();
    const res = await svc.listForOrder('t1', '');
    expect(res).toEqual({ eintraege: [], summeMinuten: 0 });
    expect(repo.find).not.toHaveBeenCalled();
  });
});

describe('OrderTimeService · aendern/loeschen (Leitung)', () => {
  it('update aendert Dauer + Notiz eines vorhandenen Eintrags', async () => {
    const found = { id: 'ot1', tenantId: 't1', userId: 'u1', minuten: 60, datum: new Date(), notiz: null };
    const { svc, repo } = makeService({ found });
    await svc.update(MGR, 'ot1', { minuten: 120, notiz: 'fertig' });
    const saved = repo.save.mock.calls[0][0];
    expect(saved.minuten).toBe(120);
    expect(saved.notiz).toBe('fertig');
  });

  it('update fuer unbekannten Eintrag -> 404', async () => {
    const { svc } = makeService({ found: null });
    await expect(svc.update(MGR, 'x', { minuten: 60 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove fuer unbekannten Eintrag -> 404', async () => {
    const { svc } = makeService({ found: null });
    await expect(svc.remove(MGR, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
