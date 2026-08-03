import { FindOperator } from 'typeorm';
import { LoginAttemptStore } from './login-attempt.store';
import { LoginAttempt } from './entities/login-attempt.entity';
import { LOGIN_GUARD } from './security.constants';

/**
 * Tests der neustart-festen Persistenz (login_attempts). Wie die uebrigen
 * Backend-Suiten (kassenbuch/login-bruteforce) bootet dies bewusst KEINE echte DB
 * (better-sqlite3/pg werden nie geladen), sondern ein SEMANTIK-TREUES In-Memory-
 * Fake-Repo, das genau die vom Store genutzten TypeORM-Methoden nachbildet –
 * inklusive der Unique-Constraint (scope,keyHash), des ATOMAREN increment/decrement
 * und der FindOperatoren MoreThan/LessThanOrEqual (fuer Purge/Hydration). Das reale
 * Postgres-Schema pruefen zusaetzlich der Migrations-CI-Lauf + die Baseline.
 */
const MIN = 60 * 1000;

type Row = LoginAttempt;

function opMatch(cond: FindOperator<unknown>, value: unknown): boolean {
  const cv = cond.value as unknown;
  const asMs = (x: unknown) => (x instanceof Date ? x.getTime() : (x as number));
  switch (cond.type) {
    case 'moreThan':
      return asMs(value) > asMs(cv);
    case 'lessThan':
      return asMs(value) < asMs(cv);
    case 'lessThanOrEqual':
      return asMs(value) <= asMs(cv);
    case 'moreThanOrEqual':
      return asMs(value) >= asMs(cv);
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

/**
 * Minimales, treues LoginAttempt-Repository ueber einem Array. Modelliert die
 * Unique-Constraint (scope,keyHash) beim insert und atomare increment/decrement.
 */
class FakeRepo {
  rows: Row[] = [];
  private seq = 0;

  async findOne({ where }: { where: Record<string, unknown> }): Promise<Row | null> {
    return this.rows.find((r) => whereMatch(r, where)) ?? null;
  }

  async insert(partial: Partial<Row>): Promise<void> {
    const dup = this.rows.find(
      (r) => r.scope === partial.scope && r.keyHash === partial.keyHash,
    );
    if (dup) {
      // Treiber-treue Meldung -> isUniqueViolation() erkennt sie -> withUniqueRetry.
      throw new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: login_attempts.scope, login_attempts.keyHash');
    }
    this.rows.push({
      id: `row-${this.seq++}`,
      attempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      ...partial,
    } as Row);
  }

  async update(where: Record<string, unknown>, patch: Partial<Row>): Promise<void> {
    for (const r of this.rows.filter((x) => whereMatch(x, where))) Object.assign(r, patch);
  }

  async increment(where: Record<string, unknown>, col: keyof Row, by: number): Promise<void> {
    for (const r of this.rows.filter((x) => whereMatch(x, where))) {
      (r as unknown as Record<string, number>)[col as string] += by;
    }
  }

  async decrement(where: Record<string, unknown>, col: keyof Row, by: number): Promise<void> {
    for (const r of this.rows.filter((x) => whereMatch(x, where))) {
      (r as unknown as Record<string, number>)[col as string] -= by;
    }
  }

  async delete(where: Record<string, unknown>): Promise<{ affected: number }> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !whereMatch(r, where));
    return { affected: before - this.rows.length };
  }

  async find({
    where,
    order,
    take,
  }: {
    where: Record<string, unknown>;
    order?: Record<string, 'ASC' | 'DESC'>;
    take?: number;
  }): Promise<Row[]> {
    let out = this.rows.filter((r) => whereMatch(r, where));
    if (order) {
      const [field, dir] = Object.entries(order)[0];
      out = [...out].sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[field];
        const bv = (b as unknown as Record<string, unknown>)[field];
        const am = av instanceof Date ? av.getTime() : (av as number);
        const bm = bv instanceof Date ? bv.getTime() : (bv as number);
        return dir === 'DESC' ? bm - am : am - bm;
      });
    }
    return typeof take === 'number' ? out.slice(0, take) : out;
  }
}

function makeStore() {
  const repo = new FakeRepo();
  const store = new LoginAttemptStore(repo as never);
  return { repo, store };
}

function attemptsOf(repo: FakeRepo, scope: string, keyHash: string): number {
  return repo.rows.find((r) => r.scope === scope && r.keyHash === keyHash)?.attempts ?? 0;
}

describe('LoginAttemptStore – atomares Hochzaehlen & Erst-Insert-Wettlauf', () => {
  it('zwei GLEICHZEITIGE Erst-Fehlversuche zaehlen auf 2, nicht auf 1 (kein doppeltes "1")', async () => {
    const { repo, store } = makeStore();
    // Beide starten, bevor einer den Insert committet -> beide sehen "keine Zeile".
    // Der Unique-Constraint laesst nur EINEN Insert zu; der Verlierer wird per
    // withUniqueRetry zum atomaren Increment -> Endstand 2 (nicht 1).
    await Promise.all([
      store.persistFailure('account', 'k-race', 1000),
      store.persistFailure('account', 'k-race', 1000),
    ]);
    expect(repo.rows.filter((r) => r.keyHash === 'k-race')).toHaveLength(1);
    expect(attemptsOf(repo, 'account', 'k-race')).toBe(2);
  });

  it('fuenf Fehlversuche in Folge zaehlen auf 5 und setzen die 1-min-Konto-Sperre', async () => {
    const { repo, store } = makeStore();
    for (let i = 0; i < 5; i++) await store.persistFailure('account', 'k5', 2000);
    expect(attemptsOf(repo, 'account', 'k5')).toBe(5);
    const row = repo.rows.find((r) => r.keyHash === 'k5')!;
    expect(row.lockedUntil).toEqual(new Date(2000 + 1 * MIN));
  });

  it('viele parallele Fehlversuche derselben IP summieren sich exakt (atomar)', async () => {
    const { repo, store } = makeStore();
    await Promise.all(
      Array.from({ length: 20 }, () => store.persistFailure('ip', 'k-ip', 3000)),
    );
    expect(attemptsOf(repo, 'ip', 'k-ip')).toBe(20);
  });

  it('Inaktivitaet laenger als das Fenster setzt den Zaehler zurueck (auf 1)', async () => {
    const { repo, store } = makeStore();
    for (let i = 0; i < 4; i++) await store.persistFailure('account', 'kw', 1_000_000);
    expect(attemptsOf(repo, 'account', 'kw')).toBe(4);
    await store.persistFailure('account', 'kw', 1_000_000 + LOGIN_GUARD.windowMs + 1);
    expect(attemptsOf(repo, 'account', 'kw')).toBe(1);
  });
});

describe('LoginAttemptStore – Erfolg (Reset/Dekrement)', () => {
  it('Erfolg loescht den Konto-Zaehler', async () => {
    const { repo, store } = makeStore();
    for (let i = 0; i < 3; i++) await store.persistFailure('account', 'ka', 5000);
    await store.registerSuccessAccount('ka');
    expect(repo.rows.find((r) => r.keyHash === 'ka')).toBeUndefined();
  });

  it('Erfolg dekrementiert den IP-Zaehler um 1 (nicht auf 0) und loescht bei 0', async () => {
    const { repo, store } = makeStore();
    for (let i = 0; i < 3; i++) await store.persistFailure('ip', 'kb', 5000);
    await store.registerSuccessIp('kb');
    expect(attemptsOf(repo, 'ip', 'kb')).toBe(2);
    await store.registerSuccessIp('kb');
    await store.registerSuccessIp('kb'); // 2 -> 1 -> 0 -> geloescht
    expect(repo.rows.find((r) => r.keyHash === 'kb')).toBeUndefined();
  });
});

describe('LoginAttemptStore – Aufraeumen & Hydration', () => {
  it('purgeExpired loescht abgelaufene, behaelt noch relevante Zaehler', async () => {
    const { repo, store } = makeStore();
    await store.persistFailure('account', 'alt', 0); // expiresAt = windowMs
    await store.persistFailure('account', 'neu', LOGIN_GUARD.windowMs); // spaeter
    // Zeitpunkt zwischen beiden Ablaeufen: "alt" ist abgelaufen, "neu" noch nicht.
    const now = LOGIN_GUARD.windowMs + 1;
    const geloescht = await store.purgeExpired(now);
    expect(geloescht).toBe(1);
    expect(repo.rows.map((r) => r.keyHash)).toEqual(['neu']);
  });

  it('loadActive liefert nur nicht-abgelaufene Zeilen (fuer die Start-Hydration)', async () => {
    const { store } = makeStore();
    await store.persistFailure('ip', 'a', 0);
    await store.persistFailure('ip', 'b', LOGIN_GUARD.windowMs);
    const rows = await store.loadActive(LOGIN_GUARD.windowMs + 1);
    expect(rows.map((r) => r.keyHash)).toEqual(['b']);
  });
});
