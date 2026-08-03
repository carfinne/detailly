import { FindOperator } from 'typeorm';
import { LoginGuardService } from './login-guard.service';
import { LoginAttemptStore } from './login-attempt.store';
import { LoginAttempt } from './entities/login-attempt.entity';

/**
 * Integrationstests der NEUSTART-FESTEN Fehlversuchs-Sperre: LoginGuardService
 * (In-Memory-Cache) ueber dem echten LoginAttemptStore, dieser ueber einem
 * semantik-treuen In-Memory-Fake-Repo (Unique-Constraint scope,keyHash + atomare
 * increment/decrement + FindOperatoren) – konsistent zur DB-freien Test-Konvention
 * des Backends (better-sqlite3/pg werden nie geladen).
 *
 * Beweist die eigentlichen Fixe: (a) Zaehler/Sperre ueberleben einen simulierten
 * Neustart, (d) die Loopback-/XFF-Regel gilt unveraendert (und neustart-fest),
 * (e) die gespeicherte Konto-Kennung enthaelt keine Klartext-Mailadresse.
 */
const MIN = 60 * 1000;
type Row = LoginAttempt;

function opMatch(cond: FindOperator<unknown>, value: unknown): boolean {
  const cv = cond.value as unknown;
  const ms = (x: unknown) => (x instanceof Date ? x.getTime() : (x as number));
  switch (cond.type) {
    case 'moreThan':
      return ms(value) > ms(cv);
    case 'lessThanOrEqual':
      return ms(value) <= ms(cv);
    default:
      throw new Error(`FakeRepo: FindOperator ${cond.type} nicht modelliert`);
  }
}
function whereMatch(row: Row, where: Record<string, unknown>): boolean {
  return Object.keys(where).every((k) => {
    const cond = where[k];
    if (cond instanceof FindOperator) return opMatch(cond, (row as unknown as Record<string, unknown>)[k]);
    return (row as unknown as Record<string, unknown>)[k] === cond;
  });
}

class FakeRepo {
  rows: Row[] = [];
  private seq = 0;
  async findOne({ where }: { where: Record<string, unknown> }) {
    return this.rows.find((r) => whereMatch(r, where)) ?? null;
  }
  async insert(partial: Partial<Row>) {
    if (this.rows.some((r) => r.scope === partial.scope && r.keyHash === partial.keyHash)) {
      throw new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: login_attempts.scope, login_attempts.keyHash');
    }
    this.rows.push({ id: `r${this.seq++}`, attempts: 0, lockedUntil: null, createdAt: new Date(), ...partial } as Row);
  }
  async update(where: Record<string, unknown>, patch: Partial<Row>) {
    for (const r of this.rows.filter((x) => whereMatch(x, where))) Object.assign(r, patch);
  }
  async increment(where: Record<string, unknown>, col: string, by: number) {
    for (const r of this.rows.filter((x) => whereMatch(x, where))) (r as unknown as Record<string, number>)[col] += by;
  }
  async decrement(where: Record<string, unknown>, col: string, by: number) {
    for (const r of this.rows.filter((x) => whereMatch(x, where))) (r as unknown as Record<string, number>)[col] -= by;
  }
  async delete(where: Record<string, unknown>) {
    const n = this.rows.length;
    this.rows = this.rows.filter((r) => !whereMatch(r, where));
    return { affected: n - this.rows.length };
  }
  async find({ where, order, take }: { where: Record<string, unknown>; order?: Record<string, 'ASC' | 'DESC'>; take?: number }) {
    let out = this.rows.filter((r) => whereMatch(r, where));
    if (order) {
      const [f, dir] = Object.entries(order)[0];
      const ms = (x: unknown) => (x instanceof Date ? x.getTime() : (x as number));
      out = [...out].sort((a, b) => {
        const d = ms((a as never)[f]) - ms((b as never)[f]);
        return dir === 'DESC' ? -d : d;
      });
    }
    return typeof take === 'number' ? out.slice(0, take) : out;
  }
}

function makeStack() {
  const repo = new FakeRepo();
  const store = new LoginAttemptStore(repo as never);
  const guard = new LoginGuardService(store);
  return { repo, store, guard };
}

describe('Neustart-Festigkeit (a): Zaehler & Sperre ueberleben eine neue Instanz', () => {
  it('nach 4 Fehlversuchen sieht eine FRISCHE Instanz auf derselben DB den Stand 4 (nicht 0)', async () => {
    const repo = new FakeRepo();
    const now = 5000;
    const ip = '203.0.113.50';
    const email = 'opfer@example.com';

    // Instanz 1 sammelt 4 Fehlversuche -> noch NICHT gesperrt.
    const guard1 = new LoginGuardService(new LoginAttemptStore(repo as never));
    for (let i = 0; i < 4; i++) guard1.registerFailure(ip, email, { now });
    await guard1.whenPersisted();
    expect(guard1.isBlocked(ip, email, { now }).blocked).toBe(false);

    // "Neustart": neue Instanz, leere Maps -> Hydration aus derselben DB. `now`
    // wird injiziert (die Testuhr ist bewusst klein; in Prod = Date.now()).
    const guard2 = new LoginGuardService(new LoginAttemptStore(repo as never));
    await guard2.onModuleInit(now);

    // Der naechste Fehlversuch ist der 5. (nicht der 1.!) -> Schwelle erreicht.
    const r = guard2.registerFailure(ip, email, { now });
    expect(r.accountCount).toBe(5);
    expect(guard2.isBlocked(ip, email, { now }).blocked).toBe(true);
    await guard2.whenPersisted();
  });

  it('eine bereits gesetzte Sperre gilt nach dem Neustart sofort weiter', async () => {
    const repo = new FakeRepo();
    const now = 8000;
    const ip = '203.0.113.51';
    const email = 'ziel@firma.de';

    const g1 = new LoginGuardService(new LoginAttemptStore(repo as never));
    for (let i = 0; i < 5; i++) g1.registerFailure(ip, email, { now });
    await g1.whenPersisted();
    expect(g1.isBlocked(ip, email, { now }).blocked).toBe(true);

    const g2 = new LoginGuardService(new LoginAttemptStore(repo as never));
    await g2.onModuleInit(now);
    const b = g2.isBlocked(ip, email, { now });
    expect(b.blocked).toBe(true);
    expect(b.retryAfterSec).toBe(60); // 1-min-Konto-Sperre, aus der DB rekonstruiert
  });

  it('Erfolg raeumt den Konto-Zaehler auch dauerhaft (DB) ab', async () => {
    const { repo, guard } = makeStack();
    for (let i = 0; i < 3; i++) guard.registerFailure('192.0.2.9', 'u@v.de', { now: 100 });
    await guard.whenPersisted();
    guard.registerSuccess('192.0.2.9', 'u@v.de', { now: 100 });
    await guard.whenPersisted();
    expect(repo.rows.find((r) => r.scope === 'account')).toBeUndefined();
  });
});

describe('Datenschutz (e): keine Klartext-Mailadresse in der Persistenz', () => {
  it('speichert die Konto-Kennung nur als SHA-256-Hex', async () => {
    const { repo, guard } = makeStack();
    const email = 'geheim.klartext@example.com';
    guard.registerFailure('198.51.100.5', email, { now: 1000 });
    await guard.whenPersisted();

    expect(repo.rows.length).toBeGreaterThan(0);
    const dump = JSON.stringify(repo.rows);
    expect(dump).not.toContain('geheim.klartext');
    expect(dump).not.toContain(email);
    for (const r of repo.rows) expect(r.keyHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Loopback/XFF (d): Regel unveraendert – und neustart-fest', () => {
  it('echter Loopback-Socket wird nie gezaehlt und nie persistiert', async () => {
    const { repo, guard } = makeStack();
    for (let i = 0; i < 10; i++) {
      guard.registerFailure('127.0.0.1', 'x@y.de', { now: 0, socketIp: '127.0.0.1' });
    }
    await guard.whenPersisted();
    expect(repo.rows).toHaveLength(0);
    expect(guard.isBlocked('127.0.0.1', 'x@y.de', { now: 0, socketIp: '127.0.0.1' }).blocked).toBe(false);
  });

  it('gespooftes XFF=127.0.0.1 bei public Socket wird gezaehlt, gesperrt UND ueberlebt den Neustart', async () => {
    const { repo, store, guard } = makeStack();
    const ctx = { now: 0, socketIp: '203.0.113.99' };
    for (let i = 0; i < 5; i++) guard.registerFailure('127.0.0.1', 'opfer@x.de', ctx);
    await guard.whenPersisted();
    expect(guard.isBlocked('127.0.0.1', 'opfer@x.de', ctx).blocked).toBe(true);
    expect(repo.rows.length).toBeGreaterThan(0);

    // Neustart auf derselben DB -> der Bypass bleibt geschlossen.
    void store;
    const g2 = new LoginGuardService(new LoginAttemptStore(repo as never));
    await g2.onModuleInit(ctx.now);
    expect(g2.isBlocked('127.0.0.1', 'opfer@x.de', ctx).blocked).toBe(true);
    const b = g2.isBlocked('127.0.0.1', 'opfer@x.de', ctx);
    expect(b.retryAfterSec).toBe(60);
  });
});
