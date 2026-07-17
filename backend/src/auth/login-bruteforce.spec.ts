import { HttpException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { LoginGuardService } from '../security/login-guard.service';
import { UserRole } from '../users/entities/user.entity';
import { totp } from './totp';

/**
 * Angriffs-simulierende Tests der Fehlversuchs-Sperre (Sentinel Teil 1) auf
 * Service-Ebene mit dem ECHTEN LoginGuardService (in-memory) + Repo-Mocks. Der
 * Jest-Harness bootet bewusst keine DB (better-sqlite3 vs Node 24), daher
 * simulieren wir "den Login-Endpunkt wird geflutet" ueber wiederholte
 * AuthService.login()-Aufrufe.
 */
const CORRECT = 'korrekt-passwort';

function makeSut() {
  const users = new Map<string, Record<string, any>>();
  const userRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      for (const u of users.values()) {
        if (where.email !== undefined && u.email !== where.email) continue;
        if (where.id !== undefined && u.id !== where.id) continue;
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
  const tenantRepo = { findOne: jest.fn(async () => null) };
  const jwt = { sign: jest.fn(() => 'signed-jwt') };
  const config = { get: jest.fn(() => 'http://localhost:3000') };
  const mail = { send: jest.fn(async () => undefined) };
  const audit = { log: jest.fn(async () => undefined) };
  const guard = new LoginGuardService();
  const events: any[] = [];
  const securityEvents = { record: jest.fn((e: any) => events.push(e)) };

  const svc = new AuthService(
    userRepo as any,
    tenantRepo as any,
    {} as any,
    jwt as any,
    config as any,
    mail as any,
    audit as any,
    guard,
    securityEvents as any,
  );
  return { svc, users, guard, events, securityEvents };
}

async function addUser(users: Map<string, Record<string, any>>, over: Record<string, any> = {}) {
  const u = {
    id: 'u1',
    email: 'ziel@example.com',
    firstName: 'Z',
    lastName: 'X',
    role: UserRole.OWNER,
    tenantId: 't1',
    isActive: true,
    totpEnabled: false,
    tokenVersion: 0,
    passwordHash: await bcrypt.hash(CORRECT, 8),
    ...over,
  };
  users.set(u.id, u);
  return u;
}

/** Fuehrt einen Login aus und liefert den geworfenen Fehler (oder null bei Erfolg). */
async function loginError(svc: AuthService, pw: string, ip: string): Promise<any> {
  return svc.login('ziel@example.com', pw, ip).then(() => null, (e) => e);
}

describe('Login-Brute-Force (e2e-artig, echter Guard)', () => {
  it('6+ Fehl-Logins gegen dasselbe Konto/IP -> generische 429-Sperre', async () => {
    const { svc, users } = makeSut();
    await addUser(users);
    const ip = '203.0.113.200';

    // Fehlversuche 1..4: normale 401 (kein Lockout-Leak).
    for (let i = 0; i < 4; i++) {
      const err = await loginError(svc, 'falsch', ip);
      expect(err).toBeInstanceOf(UnauthorizedException);
    }
    // 5. Fehlversuch schaltet die Sperre scharf (er selbst ist noch eine 401).
    expect(await loginError(svc, 'falsch', ip)).toBeInstanceOf(UnauthorizedException);

    // 6. Versuch: jetzt gesperrt -> generische 429 (Too Many Requests).
    const gesperrt = await loginError(svc, 'falsch', ip);
    expect(gesperrt).toBeInstanceOf(HttpException);
    expect(gesperrt.getStatus()).toBe(429);

    // Selbst mit KORREKTEM Passwort bleibt die Sperre bestehen (kein Bypass) und
    // die Antwort ist identisch generisch (kein "Konto existiert"-Leak).
    const trotzKorrekt = await loginError(svc, CORRECT, ip);
    expect(trotzKorrekt).toBeInstanceOf(HttpException);
    expect(trotzKorrekt.getStatus()).toBe(429);
    expect(trotzKorrekt.message).toBe(gesperrt.message);
  });

  it('nach erfolgreichem Login ist der Zaehler zurueckgesetzt', async () => {
    const { svc, users } = makeSut();
    await addUser(users);
    const ip = '203.0.113.201';

    // 4 Fehlversuche (Schwelle 5 noch NICHT erreicht).
    for (let i = 0; i < 4; i++) await loginError(svc, 'falsch', ip);

    // Erfolgreicher Login -> Reset des Konto-Zaehlers.
    const ok = await svc.login('ziel@example.com', CORRECT, ip);
    expect((ok as any).accessToken).toBeDefined();

    // Danach sind erneut 4 Fehlversuche moeglich, OHNE dass gesperrt wird
    // (Zaehler stand nach dem Erfolg wieder bei 0).
    for (let i = 0; i < 4; i++) {
      const err = await loginError(svc, 'falsch', ip);
      expect(err).toBeInstanceOf(UnauthorizedException);
    }
  });

  it('Shared-IP: fuenf Konten von EINER IP je 4 Fehlversuche -> keine IP-Sperre', async () => {
    const { svc, users, guard } = makeSut();
    // Fuenf verschiedene Konten anlegen.
    for (let i = 0; i < 5; i++) {
      await addUser(users, { id: `u${i}`, email: `k${i}@firma.de` });
    }
    const ip = '192.0.2.50';
    // Je Konto 4 Fehlversuche (20 IP-Fehler gesamt), jedes Konto < 5.
    for (let i = 0; i < 5; i++) {
      for (let n = 0; n < 4; n++) {
        await svc.login(`k${i}@firma.de`, 'falsch', ip).catch(() => undefined);
      }
    }
    // Ein FRISCHES Konto auf derselben Buero-IP ist NICHT gesperrt
    // (20 IP-Fehler < 30 IP-Schwelle) -> kein kollektiver NAT-Lockout.
    expect(guard.isBlocked(ip, 'ganz-neu@firma.de').blocked).toBe(false);
  });

  it('ein Fehler im Security-Event-Log bricht den Login NICHT', async () => {
    const { users } = makeSut();
    await addUser(users);
    // Eigenes SUT mit einem Event-Log, das bei record() WIRFT.
    const userRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        for (const u of users.values()) {
          if (where.email !== undefined && u.email !== where.email) continue;
          if (where.id !== undefined && u.id !== where.id) continue;
          return u;
        }
        return null;
      }),
      update: jest.fn(async () => ({ affected: 1 })),
    };
    const throwingEvents = {
      record: jest.fn(() => {
        throw new Error('event-log kaputt');
      }),
    };
    const svc = new AuthService(
      userRepo as any,
      { findOne: jest.fn(async () => null) } as any,
      {} as any,
      { sign: jest.fn(() => 'jwt') } as any,
      { get: jest.fn(() => 'x') } as any,
      { send: jest.fn(async () => undefined) } as any,
      { log: jest.fn(async () => undefined) } as any,
      new LoginGuardService(),
      throwingEvents as any,
    );
    // Trotz werfendem Event-Log erhaelt der Angreifer die normale 401 (nicht den
    // internen Fehler) -> die Abwehr oeffnet keine neue Angriffsflaeche.
    const err = await loginError(svc, 'falsch', '203.0.113.9');
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(throwingEvents.record).toHaveBeenCalled();
  });

  it('Loopback (127.0.0.1) wird nie gesperrt – auch nach vielen Fehlversuchen', async () => {
    const { svc, users } = makeSut();
    await addUser(users);
    // 10 Fehlversuche ueber Loopback -> nie 429, immer 401.
    for (let i = 0; i < 10; i++) {
      const err = await loginError(svc, 'falsch', '127.0.0.1');
      expect(err).toBeInstanceOf(UnauthorizedException);
    }
  });
});

describe('2FA-Brute-Force (MfaService.verify, echter Guard)', () => {
  function makeMfaSut() {
    const secret = 'JBSWY3DPEHPK3PXP';
    const user: Record<string, any> = {
      id: 'u1',
      email: 'mfa@example.com',
      role: UserRole.OWNER,
      tenantId: 't1',
      isActive: true,
      totpEnabled: true,
      totpSecret: secret,
      recoveryCodes: [],
      tokenVersion: 0,
    };
    const makeQb = () => {
      const qb: any = {
        addSelect: () => qb,
        where: () => qb,
        andWhere: () => qb,
        setLock: () => qb,
        getOne: async () => user,
      };
      return qb;
    };
    const userRepo = {
      createQueryBuilder: jest.fn(() => makeQb()),
      update: jest.fn(async () => ({ affected: 1 })),
    };
    const guard = new LoginGuardService();
    const events: any[] = [];
    const securityEvents = { record: jest.fn((e: any) => events.push(e)) };
    const authService = new AuthService(
      {} as any,
      {} as any,
      {} as any,
      { sign: jest.fn(() => 'jwt') } as any,
      { get: jest.fn(() => 'x') } as any,
      { send: jest.fn(async () => undefined) } as any,
      { log: jest.fn(async () => undefined) } as any,
      guard,
      securityEvents as any,
    );
    const mfa = new MfaService(userRepo as any, authService);
    // Deterministisch falscher Code: gueltigen berechnen und +1 nehmen.
    const gueltig = totp(secret);
    const falsch = String((Number(gueltig) + 1) % 1_000_000).padStart(6, '0');
    return { mfa, guard, events, falsch, secret };
  }

  it('wiederholt falsche TOTP-Codes -> generische 429-Sperre', async () => {
    const { mfa, falsch } = makeMfaSut();
    const ip = '203.0.113.210';

    // 5 falsche Codes: die ersten sind 401, der 5. schaltet die Sperre scharf.
    for (let i = 0; i < 5; i++) {
      const err = await mfa.verify('u1', { code: falsch } as any, ip).then(() => null, (e) => e);
      expect(err).toBeInstanceOf(UnauthorizedException);
    }
    // Danach gesperrt -> 429 (2FA-Fehlversuche zaehlen auf DIESELBE Sperre).
    const gesperrt = await mfa.verify('u1', { code: falsch } as any, ip).then(() => null, (e) => e);
    expect(gesperrt).toBeInstanceOf(HttpException);
    expect(gesperrt.getStatus()).toBe(429);
  });

  it('emittiert mfa_fail-Events und bei Stufe 5 ein login_lockout-Event', async () => {
    const { mfa, events, falsch } = makeMfaSut();
    const ip = '203.0.113.211';
    for (let i = 0; i < 5; i++) {
      await mfa.verify('u1', { code: falsch } as any, ip).catch(() => undefined);
    }
    const typen = events.map((e) => e.type);
    expect(typen).toContain('mfa_fail');
    expect(typen).toContain('login_lockout');
    // Kein Klartext-Passwort/-Code in irgendeinem Event.
    expect(JSON.stringify(events)).not.toContain(falsch);
  });
});
