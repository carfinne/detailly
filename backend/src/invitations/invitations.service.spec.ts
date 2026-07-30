import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { FindOperator } from 'typeorm';
import { InvitationsService } from './invitations.service';
import { UserRole } from '../users/entities/user.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Sicherheits-Kern der Mitarbeiter-Einladung, repo-gemockt (kein Nest-Boot, keine
 * DB). Deckt die geforderten Eigenschaften ab:
 *  - Token nur als SHA-256-Hash gespeichert (nie Klartext),
 *  - Einloesen legt Nutzer mit der EINGELADENEN Rolle an (Body-Rolle ignoriert),
 *  - Single-Use (zweites Einloesen scheitert), abgelaufen/zurueckgezogen scheitert,
 *  - Mitarbeiter-Limit greift BEIM EINLADEN UND BEIM EINLOESEN,
 *  - fremde E-Mail / anderer Tenant sauber behandelt,
 *  - tenant-Isolation + nicht-verratende Fehlermeldungen.
 */
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** Matcht ein Feld gegen eine where-Bedingung inkl. TypeORM-FindOperator (IsNull/MoreThan/Not). */
function matchField(fieldVal: unknown, cond: unknown): boolean {
  if (cond instanceof FindOperator) {
    const type = (cond as FindOperator<unknown>).type as string;
    const val = (cond as FindOperator<unknown>).value;
    if (type === 'isNull') return fieldVal == null;
    if (type === 'moreThan') {
      return fieldVal != null && new Date(fieldVal as string).getTime() > new Date(val as string).getTime();
    }
    if (type === 'not') return !matchField(fieldVal, val);
    return false;
  }
  return fieldVal === cond;
}

function rowMatches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.keys(where).every((k) => matchField(row[k], where[k]));
}

const MAX_UNLIMITED = null as number | null;

function makeService(opts: { activeUsers?: number; maxUsers?: number | null } = {}) {
  const activeUsers = opts.activeUsers ?? 1;
  const maxUsers = opts.maxUsers === undefined ? MAX_UNLIMITED : opts.maxUsers;

  const invites: Record<string, unknown>[] = [];
  const users = new Map<string, Record<string, unknown>>();
  let seq = 0;

  const invRepo = {
    create: jest.fn((data: Record<string, unknown>) => ({ ...data })),
    save: jest.fn(async (rec: Record<string, unknown>) => {
      if (!rec.id) {
        rec.id = `inv-${++seq}`;
        rec.createdAt = rec.createdAt ?? new Date();
        if (rec.usedAt === undefined) rec.usedAt = null;
        invites.push(rec);
      } else {
        const idx = invites.findIndex((i) => i.id === rec.id);
        if (idx >= 0) invites[idx] = rec;
        else invites.push(rec);
      }
      return rec;
    }),
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const m = invites.find((i) => rowMatches(i, where));
      return m ? { ...m } : null;
    }),
    find: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
      invites.filter((i) => rowMatches(i, where)).map((i) => ({ ...i })),
    ),
    count: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
      invites.filter((i) => rowMatches(i, where)).length,
    ),
    delete: jest.fn(async (where: Record<string, unknown>) => {
      for (let i = invites.length - 1; i >= 0; i--) {
        if (rowMatches(invites[i], where)) invites.splice(i, 1);
      }
      return { affected: 1 };
    }),
    update: jest.fn(async (where: Record<string, unknown>, patch: Record<string, unknown>) => {
      let affected = 0;
      for (const i of invites) {
        if (rowMatches(i, where)) {
          Object.assign(i, patch);
          affected += 1;
        }
      }
      return { affected };
    }),
  };

  const userRepo = {
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      for (const u of users.values()) {
        if (Object.keys(where).every((k) => u[k] === (where as Record<string, unknown>)[k])) return u;
      }
      return null;
    }),
    create: jest.fn((data: Record<string, unknown>) => ({ ...data })),
    save: jest.fn(async (rec: Record<string, unknown>) => {
      // Globale E-Mail-Unique-Constraint nachbilden (Cross-Tenant-Kollision).
      for (const u of users.values()) {
        if (u.email === rec.email) throw new Error('UNIQUE constraint failed: users.email');
      }
      rec.id = rec.id ?? `u-${++seq}`;
      users.set(rec.id as string, rec);
      return rec;
    }),
  };

  const tenantRepo = {
    findOne: jest.fn(async () => ({ id: 't1', name: 'Musterwerkstatt' })),
  };

  // assertLimit: wirft PLAN_LIMIT_REACHED, wenn current >= maxUsers (maxUsers==null -> unbegrenzt).
  const assertLimit = jest.fn(async (current: number) => {
    if (maxUsers != null && current >= maxUsers) {
      throw new ForbiddenException({ code: 'PLAN_LIMIT_REACHED', max: maxUsers, current });
    }
  });

  const employees = {
    withSeatGuard: jest.fn(
      async (
        _tenantId: string,
        fn: (ctx: { aktiveBetriebsUser: number; assertLimit: (c: number) => Promise<void> }) => Promise<unknown>,
      ) => fn({ aktiveBetriebsUser: activeUsers, assertLimit }),
    ),
  };

  const mail = { send: jest.fn(async () => undefined) };
  const audit = { log: jest.fn(async () => undefined) };
  const auth = {
    buildAuthResult: jest.fn((u: Record<string, unknown>) => ({
      accessToken: 'jwt-token',
      user: { id: u.id, role: u.role, tenantId: u.tenantId },
    })),
  };
  const config = { get: jest.fn(() => 'http://localhost:3000') };

  const svc = new InvitationsService(
    invRepo as never,
    userRepo as never,
    tenantRepo as never,
    employees as never,
    mail as never,
    audit as never,
    auth as never,
    config as never,
  );
  return { svc, invites, users, invRepo, userRepo, mail, audit, auth, assertLimit };
}

const owner: AuthUser = { id: 'owner1', email: 'owner@b.de', role: UserRole.OWNER, tenantId: 't1' } as AuthUser;

const rawTokenFromMail = (mail: { send: jest.Mock }): string => {
  const text = (mail.send.mock.calls[0]?.[0]?.text ?? '') as string;
  return text.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? '';
};

const inviteDto = (over: Record<string, unknown> = {}) => ({
  email: 'neu@b.de',
  firstName: 'Neu',
  lastName: 'Mitarbeiter',
  role: UserRole.TECHNICIAN,
  ...over,
});

describe('InvitationsService · Einladen (Leitung)', () => {
  it('speichert NUR den Token-Hash (nie Klartext) und versendet einen Link', async () => {
    const { svc, invites, mail } = makeService({ activeUsers: 1, maxUsers: 5 });
    await svc.invite(owner, inviteDto({ email: 'NEU@B.de' }));

    expect(invites).toHaveLength(1);
    expect(invites[0].email).toBe('neu@b.de'); // normalisiert (lowercase/trim)
    expect(invites[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(mail.send).toHaveBeenCalledTimes(1);
    const raw = rawTokenFromMail(mail);
    expect(raw.length).toBeGreaterThan(20);
    expect(invites[0].tokenHash).toBe(sha256(raw));
    expect(invites[0].tokenHash).not.toBe(raw); // kein Klartext in der "DB"
    // Kein Klartext-Token in irgendeinem gespeicherten Feld.
    expect(JSON.stringify(invites[0])).not.toContain(raw);
  });

  it('Limit greift BEIM EINLADEN: aktive Nutzer + offene Einladungen >= maxUsers -> 403, nichts gespeichert', async () => {
    // maxUsers=2, 1 aktiver Nutzer + 1 offene Einladung (andere Adresse) = 2 -> voll.
    const { svc, invites } = makeService({ activeUsers: 1, maxUsers: 2 });
    invites.push({
      id: 'inv-existing',
      tenantId: 't1',
      email: 'schon@b.de',
      status: 'offen',
      usedAt: null,
      expiresAt: new Date(Date.now() + 3600e3),
      createdAt: new Date(),
    });

    await expect(svc.invite(owner, inviteDto())).rejects.toBeInstanceOf(ForbiddenException);
    expect(invites).toHaveLength(1); // nichts Neues angelegt
  });

  it('offene Einladung derselben Adresse wird ersetzt (keine Token-Ansammlung)', async () => {
    const { svc, invites, mail } = makeService({ activeUsers: 1, maxUsers: 10 });
    invites.push({
      id: 'inv-old',
      tenantId: 't1',
      email: 'neu@b.de',
      status: 'offen',
      usedAt: null,
      tokenHash: sha256('altes-token-1234567890'),
      expiresAt: new Date(Date.now() + 3600e3),
      createdAt: new Date(),
    });

    await svc.invite(owner, inviteDto({ email: 'neu@b.de' }));

    // Genau EINE Einladung fuer neu@b.de (alte ersetzt), mit frischem Token.
    const fuerAdresse = invites.filter((i) => i.email === 'neu@b.de');
    expect(fuerAdresse).toHaveLength(1);
    expect(fuerAdresse[0].tokenHash).toBe(sha256(rawTokenFromMail(mail)));
    expect(fuerAdresse[0].id).not.toBe('inv-old');
  });

  it('bereits existierender Nutzer (GLOBAL, auch anderer Tenant) -> Conflict, keine Einladung', async () => {
    const { svc, invites, users } = makeService({ activeUsers: 1, maxUsers: 10 });
    users.set('fremd', { id: 'fremd', email: 'neu@b.de', tenantId: 't999' }); // anderer Tenant

    await expect(svc.invite(owner, inviteDto({ email: 'neu@b.de' }))).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(invites).toHaveLength(0);
  });

  it('Rang-Wache: MANAGER darf keinen OWNER einladen (keine Hochstufung)', async () => {
    const { svc, invites } = makeService({ maxUsers: 10 });
    const manager: AuthUser = { id: 'm1', role: UserRole.MANAGER, tenantId: 't1' } as AuthUser;
    await expect(svc.invite(manager, inviteDto({ role: UserRole.OWNER }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(invites).toHaveLength(0);
  });

  it('Ebenen-Trennung: keine Plattform-Rolle ueber die Einladung', async () => {
    const { svc } = makeService({ maxUsers: 10 });
    await expect(
      svc.invite(owner, inviteDto({ role: 'platform_admin' as UserRole })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('InvitationsService · Einloesen (oeffentlich)', () => {
  /** Legt eine gueltige offene Einladung an und liefert das Roh-Token. */
  function seedInvite(
    invites: Record<string, unknown>[],
    over: Record<string, unknown> = {},
  ): string {
    const raw = 'roh-token-' + crypto.randomBytes(8).toString('hex');
    invites.push({
      id: over.id ?? 'inv-1',
      tenantId: 't1',
      email: 'neu@b.de',
      firstName: 'Neu',
      lastName: 'Mitarbeiter',
      role: UserRole.TECHNICIAN,
      tokenHash: sha256(raw),
      status: 'offen',
      usedAt: null,
      expiresAt: new Date(Date.now() + 3600e3),
      createdAt: new Date(),
      ...over,
    });
    return raw;
  }

  it('gueltiges Token -> Nutzer mit EINGELADENER Rolle; Body-Rolle wird IGNORIERT (Escalation-Schutz)', async () => {
    const { svc, invites, users, auth } = makeService({ activeUsers: 1, maxUsers: 5 });
    const raw = seedInvite(invites, { role: UserRole.TECHNICIAN });

    // Angreifer schmuggelt role=owner + tenantId in den Body.
    const res = await svc.accept(raw, {
      token: raw,
      password: 'MeinGutesPasswort1',
      role: 'owner',
      tenantId: 't-fremd',
    } as never);

    const angelegt = [...users.values()][0];
    expect(angelegt.role).toBe(UserRole.TECHNICIAN); // NICHT owner
    expect(angelegt.tenantId).toBe('t1'); // aus der Einladung, nicht aus dem Body
    expect(angelegt.emailVerifiedAt).toBeInstanceOf(Date);
    expect((angelegt.passwordHash as string).startsWith('$2')).toBe(true); // bcrypt
    // Auto-Login-Antwort
    expect(res).toHaveProperty('accessToken');
    expect(auth.buildAuthResult).toHaveBeenCalledTimes(1);
  });

  it('Single-Use: zweites Einloesen desselben Tokens scheitert generisch', async () => {
    const { svc, invites } = makeService({ activeUsers: 1, maxUsers: 5 });
    const raw = seedInvite(invites);

    await svc.accept(raw, { token: raw, password: 'MeinGutesPasswort1' } as never);
    await expect(
      svc.accept(raw, { token: raw, password: 'ZweitesPasswort12' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('abgelaufenes Token -> generisch 400, kein Nutzer', async () => {
    const { svc, invites, users } = makeService({ maxUsers: 5 });
    const raw = seedInvite(invites, { expiresAt: new Date(Date.now() - 1000) });
    await expect(svc.accept(raw, { token: raw, password: 'MeinGutesPasswort1' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(users.size).toBe(0);
  });

  it('zurueckgezogenes Token -> generisch 400 (Link tot)', async () => {
    const { svc, invites } = makeService({ maxUsers: 5 });
    const raw = seedInvite(invites, { status: 'zurueckgezogen', usedAt: new Date() });
    await expect(svc.accept(raw, { token: raw, password: 'MeinGutesPasswort1' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('unbekanntes Token -> generisch 400 (kein Orakel)', async () => {
    const { svc } = makeService({ maxUsers: 5 });
    await expect(
      svc.accept('gibt-es-nicht-xxxxxxxx', { token: 'gibt-es-nicht-xxxxxxxx', password: 'MeinGutesPasswort1' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Limit greift BEIM EINLOESEN: aktive Nutzer >= maxUsers -> 403, kein Nutzer, Token NICHT verbraucht', async () => {
    const { svc, invites, users } = makeService({ activeUsers: 3, maxUsers: 3 });
    const raw = seedInvite(invites);

    await expect(svc.accept(raw, { token: raw, password: 'MeinGutesPasswort1' } as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(users.size).toBe(0);
    // Token unverbraucht -> spaeteres Einloesen nach Platzfreigabe bleibt moeglich.
    expect(invites[0].usedAt).toBeNull();
    expect(invites[0].status).toBe('offen');
  });

  it('E-Mail zwischenzeitlich anderweitig vergeben -> generisch 400, Token NICHT verbraucht', async () => {
    const { svc, invites, users } = makeService({ activeUsers: 1, maxUsers: 5 });
    const raw = seedInvite(invites);
    users.set('fremd', { id: 'fremd', email: 'neu@b.de', tenantId: 't999' });

    await expect(svc.accept(raw, { token: raw, password: 'MeinGutesPasswort1' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(invites[0].usedAt).toBeNull();
  });

  it('lookup: gueltig -> Betrieb + Rolle; ungueltig -> generisch 400 (nicht verratend)', async () => {
    const { svc, invites } = makeService({ maxUsers: 5 });
    const raw = seedInvite(invites);
    const info = await svc.lookup(raw);
    expect(info.betrieb).toBe('Musterwerkstatt');
    expect(info.rolle).toBe(UserRole.TECHNICIAN);
    expect(info.email).toBe('neu@b.de');

    await expect(svc.lookup('unbekannt-xxxxxxxx')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('InvitationsService · Verwaltung + Tenant-Isolation', () => {
  function seedOpen(invites: Record<string, unknown>[], over: Record<string, unknown> = {}) {
    invites.push({
      id: over.id ?? 'inv-1',
      tenantId: 't1',
      email: 'neu@b.de',
      firstName: 'Neu',
      lastName: 'M',
      role: UserRole.TECHNICIAN,
      tokenHash: sha256('roh-verwaltung-1234'),
      status: 'offen',
      usedAt: null,
      expiresAt: new Date(Date.now() + 3600e3),
      createdAt: new Date(),
      ...over,
    });
  }

  it('list: liefert NUR offene Einladungen des eigenen Tenants (Isolation)', async () => {
    const { svc, invites } = makeService();
    seedOpen(invites, { id: 'a', tenantId: 't1', email: 'a@b.de' });
    seedOpen(invites, { id: 'b', tenantId: 't2', email: 'b@b.de' }); // fremder Tenant
    seedOpen(invites, { id: 'c', tenantId: 't1', email: 'c@b.de', status: 'eingeloest' }); // nicht offen

    const rows = await svc.list('t1');
    expect(rows.map((r) => r.email).sort()).toEqual(['a@b.de']);
  });

  it('withdraw: fremder Tenant -> NotFound (keine Cross-Tenant-Manipulation)', async () => {
    const { svc, invites } = makeService();
    seedOpen(invites, { id: 'x', tenantId: 't2' }); // gehoert t2
    await expect(svc.withdraw(owner, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('withdraw: setzt Status zurueckgezogen + usedAt -> danach Einloesen tot', async () => {
    const { svc, invites } = makeService({ maxUsers: 5 });
    seedOpen(invites, { id: 'w', tenantId: 't1' });
    await svc.withdraw(owner, 'w');
    expect(invites[0].status).toBe('zurueckgezogen');
    expect(invites[0].usedAt).toBeTruthy();
    await expect(svc.accept('roh-verwaltung-1234', { token: 'roh-verwaltung-1234', password: 'MeinGutesPasswort1' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('resend: erneuert das Token (alter Link tot) und verlaengert den Ablauf', async () => {
    const { svc, invites, mail } = makeService();
    seedOpen(invites, { id: 'r', tenantId: 't1' });
    const alterHash = invites[0].tokenHash;
    await svc.resend(owner, 'r');
    expect(invites[0].tokenHash).not.toBe(alterHash);
    expect(invites[0].tokenHash).toBe(sha256(rawTokenFromMail(mail)));
    // Alter Roh-Token loest nicht mehr ein.
    await expect(svc.lookup('roh-verwaltung-1234')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resend: nur offene Einladungen (eingeloeste -> 400)', async () => {
    const { svc, invites } = makeService();
    seedOpen(invites, { id: 'done', tenantId: 't1', status: 'eingeloest', usedAt: new Date() });
    await expect(svc.resend(owner, 'done')).rejects.toBeInstanceOf(BadRequestException);
  });
});
