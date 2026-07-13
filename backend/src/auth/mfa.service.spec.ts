import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { MfaService } from './mfa.service';
import { totp, base32Decode } from './totp';

/**
 * Unit-Tests der MFA-Mechanik mit In-Memory-Repos (kein DB-Harness im Projekt).
 * Der TypeORM-Transformer (Verschluesselung) ist hier nicht aktiv – die Felder
 * liegen als Klartext im Store, was fuer die Logik-Pruefung ausreicht.
 */
function makeService() {
  const store: Record<string, any> = {};
  // QueryBuilder-Attrappe: liest den aktuellen (frischen) Store-Stand. setLock ist
  // ein No-op (Tests laufen als SQLite -> das echte pessimistic_write greift nur
  // auf Postgres).
  const makeQb = () => {
    let idFilter: string | undefined;
    const qb: any = {
      addSelect: () => qb,
      where: (_c: string, p: any) => {
        idFilter = p.id;
        return qb;
      },
      andWhere: () => qb,
      setLock: () => qb,
      getOne: async () => {
        const u = idFilter ? store[idFilter] : null;
        return u && u.isActive ? u : null;
      },
    };
    return qb;
  };
  const update = jest.fn(async (id: string, patch: any) => {
    if (store[id]) Object.assign(store[id], patch);
    return { affected: store[id] ? 1 : 0 };
  });
  // Atomarer Increment (SET prop = prop + by) – wie repo.increment().
  const increment = jest.fn(async (where: any, prop: string, by: number) => {
    const u = store[where.id];
    if (u) u[prop] = (u[prop] ?? 0) + by;
    return { affected: u ? 1 : 0 };
  });
  const managerRepo = { createQueryBuilder: jest.fn(() => makeQb()), update };
  // transaction() SERIALISIERT die Callbacks (Promise-Kette) – modelliert das
  // Verhalten in Produktion (Postgres-Zeilen-Lock bzw. globale SQLite-Schreib-
  // Serialisierung). So sieht ein spaeterer Verify garantiert den bereits
  // entfernten Code des frueheren (kein Lost-Update).
  let txChain: Promise<unknown> = Promise.resolve();
  const manager: any = {
    getRepository: jest.fn(() => managerRepo),
    transaction: jest.fn((fn: any) => {
      const run = txChain.then(() => fn(manager));
      txChain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    }),
  };
  const userRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const u = store[where.id];
      if (!u) return null;
      if (where.isActive !== undefined && u.isActive !== where.isActive) return null;
      return u;
    }),
    update,
    increment,
    createQueryBuilder: jest.fn(() => makeQb()),
    manager,
  };
  const authService = {
    buildAuthResult: jest.fn((u: any) => ({ accessToken: 'real-jwt', user: { id: u.id } })),
  };
  const svc = new MfaService(userRepo as any, authService as any);
  return { svc, store, userRepo, authService };
}

async function addUser(store: Record<string, any>, over: any = {}) {
  store['u1'] = {
    id: 'u1',
    email: 'max@example.com',
    isActive: true,
    totpEnabled: false,
    totpSecret: null,
    recoveryCodes: null,
    tokenVersion: 0,
    passwordHash: await bcrypt.hash('geheim123', 8),
    ...over,
  };
  return store['u1'];
}

describe('MfaService · Enrollment', () => {
  it('setup erzeugt ein 160-Bit-Secret und liefert eine otpauth-URL', async () => {
    const { svc, store } = makeService();
    await addUser(store);
    const res = await svc.setup('u1');
    expect(base32Decode(res.secretBase32).length).toBe(20);
    expect(res.otpauthUrl).toContain('otpauth://totp/Detailly:max%40example.com');
    // Secret gespeichert, aber noch NICHT aktiv.
    expect(store['u1'].totpSecret).toBe(res.secretBase32);
    expect(store['u1'].totpEnabled).toBe(false);
  });

  it('setup verweigert erneutes Einrichten bei bereits aktivem 2FA', async () => {
    const { svc, store } = makeService();
    await addUser(store, { totpEnabled: true, totpSecret: 'JBSWY3DPEHPK3PXP' });
    await expect(svc.setup('u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aktivieren mit korrektem Code aktiviert 2FA und liefert 10 Recovery-Codes', async () => {
    const { svc, store } = makeService();
    await addUser(store);
    const { secretBase32 } = await svc.setup('u1');
    const code = totp(secretBase32);
    const res = await svc.aktivieren('u1', code);
    expect(res.recoveryCodes).toHaveLength(10);
    expect(res.recoveryCodes[0]).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
    expect(store['u1'].totpEnabled).toBe(true);
    // Gespeichert werden NUR Hashes (nie Klartext).
    expect(store['u1'].recoveryCodes).toHaveLength(10);
    expect(store['u1'].recoveryCodes[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(store['u1'].recoveryCodes).not.toContain(res.recoveryCodes[0]);
    // Aktivieren entwertet bestehende Voll-JWTs via tokenVersion-Increment und
    // meldet dem Frontend die noetige Neuanmeldung. passwordChangedAt bleibt
    // unberuehrt (rein Passwort-Semantik).
    expect(store['u1'].tokenVersion).toBe(1);
    expect(store['u1'].passwordChangedAt).toBeUndefined();
    expect(res.neuAnmeldenErforderlich).toBe(true);
  });

  it('aktivieren mit falschem Code wirft 401 und aktiviert NICHT', async () => {
    const { svc, store } = makeService();
    await addUser(store);
    await svc.setup('u1');
    await expect(svc.aktivieren('u1', '000000')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(store['u1'].totpEnabled).toBe(false);
  });

  it('aktivieren ohne vorheriges Setup wirft 400', async () => {
    const { svc, store } = makeService();
    await addUser(store);
    await expect(svc.aktivieren('u1', '000000')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('MfaService · Login-Verify (2. Stufe)', () => {
  async function enrolled() {
    const ctx = makeService();
    await addUser(ctx.store);
    const { secretBase32 } = await ctx.svc.setup('u1');
    const { recoveryCodes } = await ctx.svc.aktivieren('u1', totp(secretBase32));
    return { ...ctx, secretBase32, recoveryCodes };
  }

  it('verify mit gueltigem TOTP-Code liefert das echte Voll-JWT + lastLoginAt', async () => {
    const { svc, store, secretBase32, authService } = await enrolled();
    const res = await svc.verify('u1', { code: totp(secretBase32) });
    expect(res).toEqual({ accessToken: 'real-jwt', user: { id: 'u1' } });
    expect(authService.buildAuthResult).toHaveBeenCalled();
    expect(store['u1'].lastLoginAt).toBeInstanceOf(Date);
  });

  it('verify mit falschem Code wirft 401', async () => {
    const { svc } = await enrolled();
    await expect(svc.verify('u1', { code: '000000' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('verify ohne Code und ohne Recovery-Code wirft 401', async () => {
    const { svc } = await enrolled();
    await expect(svc.verify('u1', {})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('Recovery-Code funktioniert genau EINMAL (single-use)', async () => {
    const { svc, store, recoveryCodes } = await enrolled();
    const code = recoveryCodes[0];
    const res = await svc.verify('u1', { recoveryCode: code });
    expect(res).toEqual({ accessToken: 'real-jwt', user: { id: 'u1' } });
    expect(store['u1'].recoveryCodes).toHaveLength(9);
    // Zweiter Versuch mit demselben Code -> 401.
    await expect(svc.verify('u1', { recoveryCode: code })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('Recovery-Code ist unabhaengig von Trennzeichen/Gross-Kleinschreibung', async () => {
    const { svc, recoveryCodes } = await enrolled();
    const noisy = recoveryCodes[1].replace('-', '').toUpperCase();
    await expect(svc.verify('u1', { recoveryCode: noisy })).resolves.toBeDefined();
  });

  it('zwei parallele Verifies mit VERSCHIEDENEN Codes ueberschreiben sich NICHT', async () => {
    const { svc, store, recoveryCodes } = await enrolled();
    const [a, b] = recoveryCodes;
    // Beide gleichzeitig einloesen. Ohne atomaren Verbrauch wuerde ein
    // read-modify-write eine der beiden Entfernungen ueberschreiben (Lost-Update).
    const res = await Promise.all([
      svc.verify('u1', { recoveryCode: a }),
      svc.verify('u1', { recoveryCode: b }),
    ]);
    expect(res).toHaveLength(2);
    // Beide Codes wurden verbraucht -> genau 8 verbleiben, keiner der beiden gilt noch.
    expect(store['u1'].recoveryCodes).toHaveLength(8);
    await expect(svc.verify('u1', { recoveryCode: a })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(svc.verify('u1', { recoveryCode: b })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('derselbe Code zweimal parallel -> nur EINMAL gueltig', async () => {
    const { svc, store, recoveryCodes } = await enrolled();
    const code = recoveryCodes[0];
    const results = await Promise.allSettled([
      svc.verify('u1', { recoveryCode: code }),
      svc.verify('u1', { recoveryCode: code }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const fail = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
    expect((fail[0] as PromiseRejectedResult).reason).toBeInstanceOf(UnauthorizedException);
    // Genau EIN Code verbraucht (nicht zwei) -> 9 verbleiben.
    expect(store['u1'].recoveryCodes).toHaveLength(9);
  });

  it('verify auf einem Konto ohne aktives 2FA wirft einheitlich 401 (kein Oracle)', async () => {
    const { svc, store } = makeService();
    await addUser(store, { totpEnabled: false, totpSecret: null });
    await expect(svc.verify('u1', { code: '123456' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('MfaService · Deaktivieren', () => {
  async function enrolled() {
    const ctx = makeService();
    await addUser(ctx.store);
    const { secretBase32 } = await ctx.svc.setup('u1');
    await ctx.svc.aktivieren('u1', totp(secretBase32));
    return { ...ctx, secretBase32 };
  }

  it('deaktivieren per Passwort loescht Secret, Recovery und Flag + entwertet Sessions', async () => {
    const { svc, store } = await enrolled();
    const tvVorher = store['u1'].tokenVersion;
    const res = await svc.deaktivieren('u1', { passwort: 'geheim123' });
    expect(res).toEqual({ success: true });
    expect(store['u1'].totpEnabled).toBe(false);
    expect(store['u1'].totpSecret).toBeNull();
    expect(store['u1'].recoveryCodes).toBeNull();
    // Sicherheitszustand geaendert -> tokenVersion inkrementiert (Sessions weg).
    expect(store['u1'].tokenVersion).toBe(tvVorher + 1);
  });

  it('deaktivieren per gueltigem TOTP-Code funktioniert', async () => {
    const { svc, store, secretBase32 } = await enrolled();
    await svc.deaktivieren('u1', { code: totp(secretBase32) });
    expect(store['u1'].totpEnabled).toBe(false);
  });

  it('deaktivieren mit falschem Passwort/Code wirft 401 und aendert nichts', async () => {
    const { svc, store } = await enrolled();
    await expect(svc.deaktivieren('u1', { passwort: 'falsch' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(svc.deaktivieren('u1', { code: '000000' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(store['u1'].totpEnabled).toBe(true);
    expect(store['u1'].totpSecret).not.toBeNull();
  });
});
