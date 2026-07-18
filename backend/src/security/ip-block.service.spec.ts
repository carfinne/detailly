import { IpBlockService } from './ip-block.service';
import type { IpBlock } from './entities/ip-block.entity';

/**
 * In-Memory-Repo-Mock fuer den IpBlockService. Deckt genau die genutzten Methoden
 * ab: find (mit where.active-Filter + select), findOne (by id), create, save,
 * count/update werden je Test gezielt gemockt.
 */
function makeStoreRepo() {
  const store: IpBlock[] = [];
  let seq = 0;
  const find = jest.fn(async ({ where }: any = {}) => {
    let rows = store;
    if (where && where.active !== undefined) rows = rows.filter((r) => r.active === where.active);
    return rows.map((r) => ({ ...r }));
  });
  const repo: any = {
    find,
    findOne: jest.fn(async ({ where }: any) => store.find((r) => r.id === where.id) ?? null),
    create: (x: any) => ({ ...x }),
    save: jest.fn(async (x: any) => {
      if (!x.id) {
        x.id = `b${++seq}`;
        store.push(x);
      } else {
        const i = store.findIndex((r) => r.id === x.id);
        if (i >= 0) store[i] = x;
      }
      return { ...x };
    }),
  };
  return { repo, store, find };
}

describe('IpBlockService – In-Memory-Cache (eine DB-Query pro Fenster)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('liest die aktiven Sperren hoechstens EINMAL pro Cache-Fenster', async () => {
    const { repo, find } = makeStoreRepo();
    const svc = new IpBlockService(repo);

    // Drei Pruefungen kurz hintereinander -> genau EINE DB-Query (Cache greift).
    await svc.isBlocked('203.0.113.1');
    await svc.isBlocked('203.0.113.1');
    await svc.isBlocked('198.51.100.9');
    expect(find).toHaveBeenCalledTimes(1);

    // Fenster ueberschreiten (Default 30s) -> naechste Pruefung liest erneut.
    const base = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(base + 31_000);
    await svc.isBlocked('203.0.113.1');
    expect(find).toHaveBeenCalledTimes(2);
  });

  it('block() wirkt sofort (Cache-Invalidierung), unblock() hebt auf', async () => {
    const { repo, find } = makeStoreRepo();
    const svc = new IpBlockService(repo);

    expect((await svc.isBlocked('203.0.113.50')).blocked).toBe(false);
    const block = await svc.block({
      ip: '203.0.113.50',
      reason: 'test',
      createdBy: 'system',
      expiresAt: new Date(Date.now() + 60_000),
    });
    // Trotz aktivem Cache-Fenster sofort gesperrt (block invalidiert den Cache).
    const res = await svc.isBlocked('203.0.113.50');
    expect(res.blocked).toBe(true);
    expect(res.retryAfterSec).toBeGreaterThan(0);

    await svc.unblock(block.id, 'admin-1');
    expect((await svc.isBlocked('203.0.113.50')).blocked).toBe(false);
    // find wurde nach jeder Mutation erneut aufgerufen (kein stale Treffer).
    expect(find.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('befristete Sperre laeuft INNERHALB des Cache-Fensters sekundengenau ab', async () => {
    const { repo } = makeStoreRepo();
    const svc = new IpBlockService(repo);
    const base = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(base);

    await svc.block({
      ip: '203.0.113.77',
      reason: 'kurz',
      createdBy: 'system',
      expiresAt: new Date(base + 5_000),
    });
    expect((await svc.isBlocked('203.0.113.77')).blocked).toBe(true);

    // 6s spaeter (noch im 30s-Cache-Fenster) -> Ablauf greift ohne Reload.
    jest.spyOn(Date, 'now').mockReturnValue(base + 6_000);
    expect((await svc.isBlocked('203.0.113.77')).blocked).toBe(false);
  });

  it('normalisiert die IP (::ffff:-Praefix) – gesperrt bleibt gesperrt', async () => {
    const { repo } = makeStoreRepo();
    const svc = new IpBlockService(repo);
    await svc.block({ ip: '203.0.113.9', reason: 'x', createdBy: 'system', expiresAt: new Date(Date.now() + 60_000) });
    expect((await svc.isBlocked('::ffff:203.0.113.9')).blocked).toBe(true);
  });

  it('fail-open: wirft die DB beim Cache-Laden, ist NICHTS gesperrt (Verfuegbarkeit)', async () => {
    const repo: any = { find: jest.fn(async () => { throw new Error('db weg'); }) };
    const svc = new IpBlockService(repo);
    expect((await svc.isBlocked('203.0.113.200')).blocked).toBe(false);
  });

  it('deactivateExpired() invalidiert den Cache und meldet die Anzahl', async () => {
    const update = jest.fn(async () => ({ affected: 2 }));
    const repo: any = { find: jest.fn(async () => []), update };
    const svc = new IpBlockService(repo);
    const n = await svc.deactivateExpired();
    expect(n).toBe(2);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
