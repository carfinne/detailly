import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { MfaJwtStrategy } from './mfa-jwt.strategy';
import { UserRole } from '../users/entities/user.entity';

function makeAuthService() {
  const store: Record<string, any> = {};
  const userRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const u = Object.values(store).find(
        (x: any) =>
          (where.email === undefined || x.email === where.email) &&
          (where.id === undefined || x.id === where.id) &&
          (where.isActive === undefined || x.isActive === where.isActive),
      );
      return u ?? null;
    }),
    update: jest.fn(async (id: string, patch: any) => {
      if (store[id]) Object.assign(store[id], patch);
      return { affected: 1 };
    }),
  };
  const tenants: Record<string, any> = {};
  const tenantRepo = {
    findOne: jest.fn(async ({ where }: any) => tenants[where.id] ?? null),
  };
  const jwt = { sign: jest.fn((payload: any, opts?: any) => `signed:${JSON.stringify({ payload, opts })}`) };
  const config = { get: jest.fn(() => 'http://localhost:3000') };
  const mail = { send: jest.fn(async () => undefined) };
  const svc = new AuthService(
    userRepo as any,
    tenantRepo as any,
    {} as any,
    jwt as any,
    config as any,
    mail as any,
  );
  return { svc, store, tenants, userRepo, jwt };
}

async function addUser(store: Record<string, any>, over: any = {}) {
  const u = {
    id: 'u1',
    email: 'max@example.com',
    firstName: 'Max',
    lastName: 'M',
    role: UserRole.OWNER,
    tenantId: 't1',
    isActive: true,
    totpEnabled: false,
    passwordHash: await bcrypt.hash('geheim123', 8),
    ...over,
  };
  store[u.id] = u;
  return u;
}

describe('AuthService · Login-Zweistufen-Flow', () => {
  it('liefert bei aktivem 2FA KEIN Voll-JWT, sondern mfaPending + Flag', async () => {
    const { svc, store, jwt, userRepo } = makeAuthService();
    await addUser(store, { totpEnabled: true });
    const res: any = await svc.login('max@example.com', 'geheim123');
    expect(res.mfaErforderlich).toBe(true);
    expect(typeof res.mfaToken).toBe('string');
    expect(res.accessToken).toBeUndefined();
    // mfaPending-Token traegt Claim mfa:true und laeuft in 2 min ab.
    const signCall = jwt.sign.mock.calls[0];
    expect(signCall[0]).toMatchObject({ sub: 'u1', mfa: true });
    expect(signCall[1]).toMatchObject({ expiresIn: '2m' });
    // KEIN lastLoginAt bei Stufe 1.
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('liefert ohne 2FA ein Voll-JWT und setzt lastLoginAt', async () => {
    const { svc, store, userRepo } = makeAuthService();
    await addUser(store, { totpEnabled: false, role: UserRole.OWNER });
    const res: any = await svc.login('max@example.com', 'geheim123');
    expect(res.accessToken).toBeDefined();
    expect(res.user.mfaEnabled).toBe(false);
    // Normaler Nutzer ohne Pflicht: user.mfaPflicht ist falsy -> keine Gate.
    expect(res.user.mfaPflicht).toBe(false);
    expect(userRepo.update).toHaveBeenCalledWith('u1', expect.objectContaining({ lastLoginAt: expect.any(Date) }));
  });

  it('setzt mfaSetupPflicht fuer Betriebs-Rolle unter Tenant-Pflicht', async () => {
    const { svc, store, tenants } = makeAuthService();
    await addUser(store, { role: UserRole.TECHNICIAN, tenantId: 't1' });
    tenants['t1'] = { id: 't1', settings: { mfaPflicht: '1' } };
    const res: any = await svc.login('max@example.com', 'geheim123');
    expect(res.mfaSetupPflicht).toBe(true);
    expect(res.mfaSetupEmpfohlen).toBeUndefined();
    // Kern des Gate-Fixes: mfaPflicht liegt AUCH im user-Objekt -> das Frontend
    // zeigt die MfaSetupGate sofort nach Login (ohne zweiten /auth/me-Roundtrip).
    expect(res.user.mfaPflicht).toBe(true);
  });

  it('erzwingt mfaSetupPflicht (hart) fuer Plattform-Rollen – unabhaengig vom Tenant', async () => {
    // Pilot-Haertung: Plattform-Personal MUSS 2FA einrichten (frueher nur
    // „empfohlen"/Banner). Der Login liefert daher mfaSetupPflicht, NICHT mehr
    // mfaSetupEmpfohlen. Die serverseitige Sperre uebernimmt der JwtAuthGuard.
    const { svc, store } = makeAuthService();
    await addUser(store, { role: UserRole.PLATFORM_ADMIN, tenantId: null });
    const res: any = await svc.login('max@example.com', 'geheim123');
    expect(res.mfaSetupPflicht).toBe(true);
    expect(res.mfaSetupEmpfohlen).toBeUndefined();
    // Plattform-Admin ohne 2FA: user.mfaPflicht=true -> Gate greift sofort (genau
    // die Zielgruppe, die vorher am Gate vorbei ins Dashboard lief).
    expect(res.user.mfaPflicht).toBe(true);
  });

  it('ohne Tenant-Pflicht keine Flags fuer Betriebs-Rollen', async () => {
    const { svc, store, tenants } = makeAuthService();
    await addUser(store, { role: UserRole.MANAGER, tenantId: 't1' });
    tenants['t1'] = { id: 't1', settings: {} };
    const res: any = await svc.login('max@example.com', 'geheim123');
    expect(res.mfaSetupPflicht).toBeUndefined();
    expect(res.mfaSetupEmpfohlen).toBeUndefined();
    expect(res.user.mfaPflicht).toBe(false);
  });
});

describe('JwtStrategy · mfaPending-Token ist an geschuetzten Routen wertlos', () => {
  const config = { getOrThrow: () => 'test-secret' } as any;

  it('weist ein Token mit Claim mfa:true ab', async () => {
    const strat = new JwtStrategy(config, { findOne: jest.fn() } as any);
    await expect(strat.validate({ sub: 'u1', mfa: true, iat: 1 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('JwtStrategy · JWT-Revocation via tokenVersion', () => {
  const config = { getOrThrow: () => 'test-secret' } as any;
  const stratFor = (tokenVersion: number) =>
    new JwtStrategy(config, {
      findOne: jest.fn(async () => ({
        id: 'u1',
        email: 'max@example.com',
        role: UserRole.OWNER,
        tenantId: 't1',
        isActive: true,
        tokenVersion,
      })),
    } as any);

  it('Alt-Token OHNE tv-Claim ist gueltig, solange tokenVersion 0 ist (kein Mass-Logout)', async () => {
    const strat = stratFor(0);
    await expect(strat.validate({ sub: 'u1', iat: 1000 })).resolves.toMatchObject({ id: 'u1' });
  });

  it('passender tv-Claim ist gueltig', async () => {
    const strat = stratFor(3);
    await expect(strat.validate({ sub: 'u1', tv: 3, iat: 1000 })).resolves.toMatchObject({
      id: 'u1',
    });
  });

  it('tv-Mismatch -> 401', async () => {
    const strat = stratFor(1);
    await expect(strat.validate({ sub: 'u1', tv: 0, iat: 1000 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('Alt-Token (tv=0/fehlt) nach Increment (tokenVersion>0) -> 401', async () => {
    const strat = stratFor(2);
    // Token wurde vor dem Increment ausgestellt: tv=1 (bzw. fehlend) < aktuell 2.
    await expect(strat.validate({ sub: 'u1', tv: 1, iat: 1000 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(strat.validate({ sub: 'u1', iat: 1000 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('MfaJwtStrategy · akzeptiert NUR das mfaPending-Token', () => {
  const config = { getOrThrow: () => 'test-secret' } as any;

  it('lehnt ein Voll-JWT (ohne mfa-Claim) ab', async () => {
    const strat = new MfaJwtStrategy(config, { findOne: jest.fn() } as any);
    await expect(strat.validate({ sub: 'u1', iat: 1 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lehnt ab, wenn der Nutzer kein aktives 2FA hat', async () => {
    const userRepo = { findOne: jest.fn(async () => ({ id: 'u1', totpEnabled: false })) };
    const strat = new MfaJwtStrategy(config, userRepo as any);
    await expect(strat.validate({ sub: 'u1', mfa: true, iat: 1 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('akzeptiert das mfaPending-Token bei aktivem 2FA', async () => {
    const userRepo = { findOne: jest.fn(async () => ({ id: 'u1', totpEnabled: true })) };
    const strat = new MfaJwtStrategy(config, userRepo as any);
    await expect(strat.validate({ sub: 'u1', mfa: true, iat: 1 })).resolves.toEqual({
      id: 'u1',
      mfaPending: true,
    });
  });
});
