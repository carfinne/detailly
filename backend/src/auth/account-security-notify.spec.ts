import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { JwtStrategy } from './jwt.strategy';
import { totp } from './totp';
import {
  buildAccountSecurityMail,
  buildEmailChangedMail,
  type AccountSecurityEvent,
} from './account-security-mails';

/**
 * Paket 1/2 – Sicherheits-Benachrichtigungen + „Auf allen Geraeten abmelden".
 *
 * Repo-gemockt (kein Nest-Boot, keine DB). Deckt die vom Auftrag geforderten
 * Eigenschaften ab:
 *  (a) Passwortwechsel loest GENAU EINE Benachrichtigung aus,
 *  (b) E-Mail-Aenderung benachrichtigt BEIDE Adressen,
 *  (c) fehlender/kaputter SMTP laesst den Vorgang trotzdem erfolgreich sein,
 *  (d) „ueberall abmelden" erhoeht tokenVersion und macht ein altes Token unbrauchbar,
 *  + 2FA-An/Aus loest je eine Benachrichtigung aus,
 *  + Mailtexte: kein Link (Anti-Phishing) + Pflicht-Standardsatz.
 */
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const isNullOp = (v: unknown) => typeof v === 'object' && v !== null && !(v instanceof Date);

function tokenMatches(t: any, where: any): boolean {
  if (where.id !== undefined && t.id !== where.id) return false;
  if (where.userId !== undefined && t.userId !== where.userId) return false;
  if (where.tokenHash !== undefined && t.tokenHash !== where.tokenHash) return false;
  if (where.usedAt !== undefined && isNullOp(where.usedAt) && t.usedAt != null) return false;
  return true;
}

function makeAuth(overrides: { mailReject?: boolean } = {}) {
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
    increment: jest.fn(async (where: any, prop: string, by: number) => {
      const u = users.get(where.id);
      if (u) u[prop] = (u[prop] ?? 0) + by;
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
    findOne: jest.fn(async ({ where }: any) => {
      const m = tokens.filter((t) => tokenMatches(t, where));
      return m[0] ? { ...m[0] } : null;
    }),
    update: jest.fn(async (where: any, patch: any) => {
      let affected = 0;
      for (const t of tokens) {
        if (tokenMatches(t, where)) {
          Object.assign(t, patch);
          affected += 1;
        }
      }
      return { affected };
    }),
    delete: jest.fn(async (where: any) => {
      for (let i = tokens.length - 1; i >= 0; i--) if (tokenMatches(tokens[i], where)) tokens.splice(i, 1);
      return { affected: 1 };
    }),
  };

  const jwt = { sign: jest.fn(() => 'jwt') };
  const config = { get: jest.fn(() => 'http://localhost:3000') };
  const mail = {
    send: jest.fn(async () => {
      if (overrides.mailReject) throw new Error('SMTP down');
      return undefined;
    }),
  };
  const audit = { log: jest.fn(async () => undefined) };
  const tenantRepo = { findOne: jest.fn(async () => null) };

  const svc = new AuthService(
    userRepo as any,
    tenantRepo as any,
    resetRepo as any,
    jwt as any,
    config as any,
    mail as any,
    audit as any,
  );
  return { svc, users, tokens, userRepo, resetRepo, mail, audit };
}

const addUser = (users: Map<string, any>, over: any = {}) =>
  users.set(over.id ?? 'u1', {
    id: 'u1',
    email: 'nutzer@example.com',
    isActive: true,
    firstName: 'Alex',
    tenantId: 't1',
    passwordHash: 'old',
    passwordChangedAt: null,
    tokenVersion: 0,
    ...over,
  });

function pushToken(tokens: any[], raw: string, userId = 'u1') {
  tokens.push({
    id: 't1',
    userId,
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + 60000),
    usedAt: null,
    createdAt: new Date(),
  });
}

describe('Paket 1 · Sicherheits-Benachrichtigung', () => {
  it('(a) Passwortwechsel (Reset = auch "Passwort aendern") loest GENAU EINE Benachrichtigung aus', async () => {
    const { svc, users, tokens, mail, audit } = makeAuth();
    addUser(users);
    pushToken(tokens, 'gueltiges-token-1234567890');

    await svc.confirmPasswordReset('gueltiges-token-1234567890', 'NeuesPass1');

    expect(mail.send).toHaveBeenCalledTimes(1);
    const call = (mail.send as jest.Mock).mock.calls[0][0];
    expect(call.to).toBe('nutzer@example.com');
    expect(call.subject).toMatch(/Passwort/i);
    // Kein Link in der Mail (Anti-Phishing).
    expect(call.text).not.toMatch(/https?:\/\//);
    // Zusaetzlich im Audit-Trail vermerkt.
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'security_passwort_geaendert', tenantId: 't1', userId: 'u1' }),
    );
  });

  it('(b) E-Mail-Aenderung benachrichtigt BEIDE Adressen (alt + neu)', () => {
    const { svc, mail } = makeAuth();
    svc.notifyEmailChanged({ id: 'u1', firstName: 'Alex', tenantId: 't1' }, 'alt@example.com', 'neu@example.com');

    expect(mail.send).toHaveBeenCalledTimes(2);
    const empfaenger = (mail.send as jest.Mock).mock.calls.map((c) => c[0].to).sort();
    expect(empfaenger).toEqual(['alt@example.com', 'neu@example.com']);
    for (const c of (mail.send as jest.Mock).mock.calls) {
      expect(c[0].text).not.toMatch(/https?:\/\//); // kein Link
    }
  });

  it('(c) fehlender/kaputter SMTP laesst den Passwortwechsel trotzdem erfolgreich sein', async () => {
    const { svc, users, tokens, userRepo } = makeAuth({ mailReject: true });
    addUser(users);
    pushToken(tokens, 'smtp-kaputt-token-123456');

    // Wirft NICHT, obwohl mail.send rejectet (fire-and-forget mit .catch).
    await expect(svc.confirmPasswordReset('smtp-kaputt-token-123456', 'NeuesPass1')).resolves.toBeUndefined();

    const u = users.get('u1');
    expect(u.passwordHash.startsWith('$2')).toBe(true); // Passwort real gesetzt
    expect(u.tokenVersion).toBe(1); // JWT-Revocation lief durch
    expect(userRepo.increment).toHaveBeenCalled();
  });

  it('kein Audit-Write ohne tenantId (TypeORM-0.3-Falle vermeiden)', () => {
    const { svc, audit } = makeAuth();
    svc.notifyAccountSecurityEvent(
      { id: 'u9', email: 'x@y.de', firstName: 'X', tenantId: null as any },
      'passwort_geaendert',
    );
    expect(audit.log).not.toHaveBeenCalled();
  });
});

describe('Paket 2 · Auf allen Geraeten abmelden', () => {
  it('(d) erhoeht tokenVersion und macht ein altes Token unbrauchbar', async () => {
    const { svc, users, userRepo, mail } = makeAuth();
    addUser(users, { tokenVersion: 4 });

    await svc.logoutEverywhere('u1');

    // tokenVersion +1 -> alle frueheren JWTs ungueltig.
    expect(users.get('u1').tokenVersion).toBe(5);
    // Auch dieses Ereignis benachrichtigt den Nutzer.
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect((mail.send as jest.Mock).mock.calls[0][0].subject).toMatch(/abgemeldet/i);

    // Die JwtStrategy lehnt ein VOR dem Increment ausgestelltes Token (tv=4) nun ab.
    const config = { getOrThrow: () => 'test-secret' } as any;
    const strat = new JwtStrategy(config, userRepo as any);
    await expect(strat.validate({ sub: 'u1', tv: 4, iat: 1000 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    // Ein frisches Token mit tv=5 waere weiterhin gueltig.
    await expect(strat.validate({ sub: 'u1', tv: 5, iat: 1000 })).resolves.toMatchObject({ id: 'u1' });
  });

  it('unbekannter/inaktiver Nutzer -> 401, kein Increment', async () => {
    const { svc, userRepo } = makeAuth();
    await expect(svc.logoutEverywhere('gibtsnicht')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userRepo.increment).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2FA-An/Aus -> Benachrichtigung (ueber den AuthService-Einhaengepunkt)
// ---------------------------------------------------------------------------
function makeMfa() {
  const store: Record<string, any> = {};
  const makeQb = () => {
    let idFilter: string | undefined;
    const qb: any = {
      addSelect: () => qb,
      where: (_c: string, p: any) => { idFilter = p.id; return qb; },
      andWhere: () => qb,
      setLock: () => qb,
      getOne: async () => {
        const u = idFilter ? store[idFilter] : null;
        return u && u.isActive ? u : null;
      },
    };
    return qb;
  };
  const userRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const u = store[where.id];
      if (!u) return null;
      if (where.isActive !== undefined && u.isActive !== where.isActive) return null;
      return u;
    }),
    update: jest.fn(async (id: string, patch: any) => { if (store[id]) Object.assign(store[id], patch); return { affected: 1 }; }),
    increment: jest.fn(async (where: any, prop: string, by: number) => {
      const u = store[where.id]; if (u) u[prop] = (u[prop] ?? 0) + by; return { affected: 1 };
    }),
    createQueryBuilder: jest.fn(() => makeQb()),
  };
  const authService = {
    buildAuthResult: jest.fn((u: any) => ({ accessToken: 'jwt', user: { id: u.id } })),
    notifyAccountSecurityEvent: jest.fn(),
  };
  const svc = new MfaService(userRepo as any, authService as any);
  return { svc, store, authService };
}

describe('Paket 1 · 2FA-Aenderung benachrichtigt', () => {
  it('2FA aktivieren -> notifyAccountSecurityEvent("mfa_aktiviert")', async () => {
    const { svc, store, authService } = makeMfa();
    const bcrypt = await import('bcryptjs');
    store['u1'] = {
      id: 'u1', email: 'max@example.com', firstName: 'Max', tenantId: 't1',
      isActive: true, totpEnabled: false, totpSecret: null, recoveryCodes: null,
      tokenVersion: 0, passwordHash: await bcrypt.hash('geheim123', 8),
    };
    const { secretBase32 } = await svc.setup('u1');
    await svc.aktivieren('u1', totp(secretBase32));
    expect(authService.notifyAccountSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1' }),
      'mfa_aktiviert',
    );
  });

  it('2FA deaktivieren (per Passwort) -> notifyAccountSecurityEvent("mfa_deaktiviert")', async () => {
    const { svc, store, authService } = makeMfa();
    const bcrypt = await import('bcryptjs');
    store['u1'] = {
      id: 'u1', email: 'max@example.com', firstName: 'Max', tenantId: 't1',
      isActive: true, totpEnabled: true, totpSecret: 'JBSWY3DPEHPK3PXP', recoveryCodes: [],
      tokenVersion: 1, passwordHash: await bcrypt.hash('geheim123', 8),
    };
    await svc.deaktivieren('u1', { passwort: 'geheim123' } as any);
    expect(authService.notifyAccountSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1' }),
      'mfa_deaktiviert',
    );
  });
});

// ---------------------------------------------------------------------------
// Reine Textbaustein-Pruefung (Anti-Phishing + Pflicht-Standardsatz)
// ---------------------------------------------------------------------------
describe('account-security-mails · Textbausteine', () => {
  const events: AccountSecurityEvent[] = [
    'passwort_geaendert', 'mfa_aktiviert', 'mfa_deaktiviert', 'ueberall_abgemeldet',
  ];
  it.each(events)('%s: kein Link + Standardsatz + Betreff', (event) => {
    const { subject, text } = buildAccountSecurityMail(event, { firstName: 'Alex', when: new Date('2026-08-03T09:05:00') });
    expect(subject.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/https?:\/\//); // Anti-Phishing: nie ein Link
    expect(text).toContain('Detailly fragt Sie NIE per E-Mail nach Ihrem Passwort');
    expect(text).toContain('Falls Sie das NICHT waren');
    expect(text).toContain('Alex');
  });

  it('E-Mail-Aenderung: alt-Variante nennt beide Adressen, kein Link', () => {
    const { text } = buildEmailChangedMail({
      firstName: 'Alex', when: new Date('2026-08-03T09:05:00'),
      altEmail: 'alt@x.de', neuEmail: 'neu@y.de', ziel: 'alt',
    });
    expect(text).toContain('alt@x.de');
    expect(text).toContain('neu@y.de');
    expect(text).not.toMatch(/https?:\/\//);
  });
});
