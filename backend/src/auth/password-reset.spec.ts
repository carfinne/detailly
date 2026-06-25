import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';

/**
 * Sicherheits-Kern des Passwort-Resets, repo-gemockt (kein Nest-Boot, keine DB).
 * Deckt die nach dem Security-Audit gehaerteten Eigenschaften ab:
 * - enumeration-sicher (kein User -> kein Token/Mail; Cooldown statt Flut),
 * - Token nur als SHA-256-Hash gespeichert (nie Klartext),
 * - confirm lehnt unbekannt/benutzt/abgelaufen/inaktiv als 400 ab,
 * - Single-Use ATOMAR (paralleler confirm: nur einer gewinnt),
 * - gueltiges confirm setzt neues bcrypt-Passwort + passwordChangedAt.
 */
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** Erkennt den IsNull()-Operator im WHERE (einziger Operator, den der Code nutzt). */
const isNullOp = (v: unknown) => typeof v === 'object' && v !== null && !(v instanceof Date);

function rowMatches(t: any, where: any): boolean {
  if (where.id !== undefined && t.id !== where.id) return false;
  if (where.userId !== undefined && t.userId !== where.userId) return false;
  if (where.tokenHash !== undefined && t.tokenHash !== where.tokenHash) return false;
  if (where.usedAt !== undefined && isNullOp(where.usedAt) && t.usedAt != null) return false;
  return true;
}

function makeService() {
  const users = new Map<string, any>();
  const tokens: any[] = [];
  let seq = 0;

  const userRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      for (const u of users.values()) {
        if (where.email !== undefined && u.email !== where.email) continue;
        if (where.id !== undefined && u.id !== where.id) continue;
        if (where.isActive !== undefined && u.isActive !== where.isActive) continue;
        return u;
      }
      return null;
    }),
    update: jest.fn(async (id: string, patch: any) => {
      const u = users.get(id);
      if (u) Object.assign(u, patch);
      return { affected: u ? 1 : 0 };
    }),
  };

  const resetRepo = {
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn(async (rec: any) => {
      if (!rec.id) rec.id = `tok-${++seq}`;
      if (!rec.createdAt) rec.createdAt = new Date();
      if (rec.usedAt === undefined) rec.usedAt = null;
      tokens.push(rec);
      return rec;
    }),
    findOne: jest.fn(async ({ where, order }: any) => {
      let matches = tokens.filter((t) => rowMatches(t, where));
      if (order?.createdAt) {
        matches = matches.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      }
      // Kopie zurueckgeben (wie eine DB) -> die atomare Claim-Logik wird real getestet.
      return matches[0] ? { ...matches[0] } : null;
    }),
    update: jest.fn(async (where: any, patch: any) => {
      let affected = 0;
      for (const t of tokens) {
        if (rowMatches(t, where)) {
          Object.assign(t, patch);
          affected += 1;
        }
      }
      return { affected };
    }),
    delete: jest.fn(async (where: any) => {
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (rowMatches(tokens[i], where)) tokens.splice(i, 1);
      }
      return { affected: 1 };
    }),
  };

  const jwt = { sign: jest.fn(() => 'jwt') };
  const config = { get: jest.fn(() => 'http://localhost:3000') };
  const mail = { send: jest.fn(async () => undefined) };

  const svc = new AuthService(
    userRepo as any,
    resetRepo as any,
    jwt as any,
    config as any,
    mail as any,
  );
  return { svc, users, tokens, userRepo, resetRepo, mail };
}

const addUser = (users: Map<string, any>, over: any = {}) =>
  users.set(over.id ?? 'u1', {
    id: 'u1',
    email: 'a@b.de',
    isActive: true,
    firstName: 'A',
    passwordHash: 'old',
    passwordChangedAt: null,
    ...over,
  });

describe('AuthService · Passwort-Reset (gehaertet)', () => {
  it('request: unbekannte E-Mail -> kein Token, keine Mail (enumeration-sicher)', async () => {
    const { svc, tokens, mail } = makeService();
    await svc.requestPasswordReset('nobody@example.com');
    expect(tokens).toHaveLength(0);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('request: speichert NUR den Hash und versendet einen Link', async () => {
    const { svc, users, tokens, mail } = makeService();
    addUser(users);
    await svc.requestPasswordReset('A@B.de'); // Gross-/Kleinschreibung egal

    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(mail.send).toHaveBeenCalledTimes(1);
    const link = ((mail.send as jest.Mock).mock.calls[0]?.[0]?.text ?? '') as string;
    const raw = link.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? '';
    expect(raw.length).toBeGreaterThan(20);
    expect(tokens[0].tokenHash).toBe(sha256(raw));
    expect(tokens[0].tokenHash).not.toBe(raw);
  });

  it('request: Cooldown -> zweite Anfrage erzeugt nichts und entwertet das gueltige Token NICHT', async () => {
    const { svc, users, tokens, mail } = makeService();
    addUser(users);
    tokens.push({
      id: 'tok-x',
      userId: 'u1',
      tokenHash: sha256('vorhandenes-token-1234567890'),
      expiresAt: new Date(Date.now() + 3600e3),
      usedAt: null,
      createdAt: new Date(), // gerade eben -> innerhalb Cooldown
    });
    await svc.requestPasswordReset('a@b.de');
    expect(tokens).toHaveLength(1); // kein neues Token
    expect(tokens[0].usedAt).toBeNull(); // bestehendes bleibt gueltig
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('confirm: unbekanntes Token -> 400', async () => {
    const { svc } = makeService();
    await expect(
      svc.confirmPasswordReset('does-not-exist-xxxxxxxxxx', 'NeuesPass1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirm: abgelaufenes Token -> 400, Passwort unveraendert', async () => {
    const { svc, users, tokens } = makeService();
    addUser(users);
    tokens.push({ id: 't1', userId: 'u1', tokenHash: sha256('abgelaufen-token-123456'), expiresAt: new Date(Date.now() - 1000), usedAt: null, createdAt: new Date() });
    await expect(svc.confirmPasswordReset('abgelaufen-token-123456', 'NeuesPass1')).rejects.toBeInstanceOf(BadRequestException);
    expect(users.get('u1').passwordHash).toBe('old');
  });

  it('confirm: bereits benutztes Token -> 400', async () => {
    const { svc, users, tokens } = makeService();
    addUser(users);
    tokens.push({ id: 't1', userId: 'u1', tokenHash: sha256('benutzt-token-1234567890'), expiresAt: new Date(Date.now() + 1000), usedAt: new Date(), createdAt: new Date() });
    await expect(svc.confirmPasswordReset('benutzt-token-1234567890', 'NeuesPass1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirm: inaktiver/gesperrter Nutzer -> 400, Passwort unveraendert', async () => {
    const { svc, users, tokens } = makeService();
    addUser(users, { isActive: false });
    tokens.push({ id: 't1', userId: 'u1', tokenHash: sha256('gueltig-aber-inaktiv-12345'), expiresAt: new Date(Date.now() + 60000), usedAt: null, createdAt: new Date() });
    await expect(svc.confirmPasswordReset('gueltig-aber-inaktiv-12345', 'NeuesPass1')).rejects.toBeInstanceOf(BadRequestException);
    expect(users.get('u1').passwordHash).toBe('old');
  });

  it('confirm: gueltiges Token -> neues bcrypt-Passwort + passwordChangedAt + Token entwertet', async () => {
    const { svc, users, tokens } = makeService();
    addUser(users);
    tokens.push({ id: 't1', userId: 'u1', tokenHash: sha256('gueltiges-token-1234567890'), expiresAt: new Date(Date.now() + 60000), usedAt: null, createdAt: new Date() });

    await svc.confirmPasswordReset('gueltiges-token-1234567890', 'NeuesPass1');

    const u = users.get('u1');
    expect(u.passwordHash).not.toBe('old');
    expect(u.passwordHash.startsWith('$2')).toBe(true); // bcrypt
    expect(u.passwordChangedAt).toBeInstanceOf(Date); // entwertet bestehende JWTs
    expect(tokens[0].usedAt).toBeTruthy(); // single-use
  });

  it('confirm: zwei parallele Anfragen mit demselben Token -> genau einer gewinnt (atomar)', async () => {
    const { svc, users, tokens } = makeService();
    addUser(users);
    tokens.push({ id: 't1', userId: 'u1', tokenHash: sha256('parallel-token-1234567890'), expiresAt: new Date(Date.now() + 60000), usedAt: null, createdAt: new Date() });

    const ergebnisse = await Promise.allSettled([
      svc.confirmPasswordReset('parallel-token-1234567890', 'NeuesPassA1'),
      svc.confirmPasswordReset('parallel-token-1234567890', 'NeuesPassB1'),
    ]);
    const ok = ergebnisse.filter((r) => r.status === 'fulfilled');
    const fail = ergebnisse.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
    expect(tokens[0].usedAt).toBeTruthy();
  });
});
