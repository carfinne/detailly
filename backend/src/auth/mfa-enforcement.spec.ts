import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MFA_SETUP_EXEMPT_KEY } from '../common/decorators/mfa-setup-exempt.decorator';
import { MFA_SETUP_REQUIRED_CODE } from './mfa-policy';
import { UserRole } from '../users/entities/user.entity';

// ===========================================================================
// Pilot-Haertung: serverseitige 2FA-ERZWINGUNG.
// Zwei Ebenen: (1) die JwtStrategy markiert Nutzer, die 2FA einrichten MUESSEN,
// mit mfaSetupRequired=true; (2) der JwtAuthGuard sperrt daraufhin geschuetzte,
// nicht-ausgenommene Endpunkte mit 403 MFA_SETUP_REQUIRED.
// ===========================================================================

const config = { getOrThrow: () => 'test-secret' } as any;

/** User-Repo-Stub, der genau EINEN Nutzer liefert. */
function userRepoOf(user: any) {
  return { findOne: jest.fn(async () => user) } as any;
}

/** Tenant-Repo-Stub mit settings.mfaPflicht je nach Fixture. */
function tenantRepoOf(settings: Record<string, unknown> | null) {
  return { findOne: jest.fn(async () => (settings ? { id: 't1', settings } : { id: 't1', settings: {} })) } as any;
}

describe('JwtStrategy · 2FA-Erzwingungs-Flag (mfaSetupRequired)', () => {
  it('Plattform-Rolle OHNE 2FA -> mfaSetupRequired=true (auch ohne Tenant-Repo)', async () => {
    const strat = new JwtStrategy(
      config,
      userRepoOf({
        id: 'u1',
        email: 'ops@detailly.app',
        role: UserRole.PLATFORM_ADMIN,
        tenantId: null,
        isActive: true,
        tokenVersion: 0,
        totpEnabled: false,
      }),
    );
    const res: any = await strat.validate({ sub: 'u1', iat: 1000 });
    expect(res.mfaSetupRequired).toBe(true);
  });

  it('Plattform-Rolle MIT aktivem 2FA -> mfaSetupRequired=false', async () => {
    const strat = new JwtStrategy(
      config,
      userRepoOf({
        id: 'u1',
        role: UserRole.PLATFORM_SUPPORT,
        tenantId: null,
        isActive: true,
        tokenVersion: 0,
        totpEnabled: true,
      }),
    );
    const res: any = await strat.validate({ sub: 'u1', iat: 1000 });
    expect(res.mfaSetupRequired).toBe(false);
  });

  it('Betriebs-Rolle unter Tenant-mfaPflicht OHNE 2FA -> mfaSetupRequired=true', async () => {
    const strat = new JwtStrategy(
      config,
      userRepoOf({
        id: 'u2',
        role: UserRole.TECHNICIAN,
        tenantId: 't1',
        isActive: true,
        tokenVersion: 0,
        totpEnabled: false,
      }),
      tenantRepoOf({ mfaPflicht: '1' }),
    );
    const res: any = await strat.validate({ sub: 'u2', iat: 1000 });
    expect(res.mfaSetupRequired).toBe(true);
  });

  it('Betriebs-Rolle OHNE Tenant-Pflicht -> mfaSetupRequired=false', async () => {
    const strat = new JwtStrategy(
      config,
      userRepoOf({
        id: 'u2',
        role: UserRole.MANAGER,
        tenantId: 't1',
        isActive: true,
        tokenVersion: 0,
        totpEnabled: false,
      }),
      tenantRepoOf({}),
    );
    const res: any = await strat.validate({ sub: 'u2', iat: 1000 });
    expect(res.mfaSetupRequired).toBe(false);
  });

  it('Haendler (tenantId null, keine Plattform-Rolle) -> mfaSetupRequired=false', async () => {
    const strat = new JwtStrategy(
      config,
      userRepoOf({
        id: 'u3',
        role: UserRole.HAENDLER,
        tenantId: null,
        dealerId: 'd1',
        isActive: true,
        tokenVersion: 0,
        totpEnabled: false,
      }),
      tenantRepoOf(null),
    );
    const res: any = await strat.validate({ sub: 'u3', iat: 1000 });
    expect(res.mfaSetupRequired).toBe(false);
  });
});

describe('JwtAuthGuard · sperrt geschuetzte Endpunkte bis 2FA eingerichtet ist', () => {
  /** Baut einen ExecutionContext mit vorbelegtem req.user. */
  function ctx(user: any): ExecutionContext {
    const req = { user };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as any;
  }

  /** Reflector-Stub: liefert true, wenn der Endpunkt @MfaSetupExempt() traegt. */
  function reflectorOf(exempt: boolean) {
    return {
      getAllAndOverride: jest.fn((key: string) =>
        key === MFA_SETUP_EXEMPT_KEY ? exempt : undefined,
      ),
    } as any;
  }

  /**
   * Simuliert eine erfolgreiche JWT-Pruefung: die Passport-Basis (super) laesst
   * den Request durch und Passport haette req.user gesetzt. Wir testen die
   * DARAUF folgende 2FA-Erzwingungs-Logik.
   */
  function spyParentActivate() {
    return jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockResolvedValue(true);
  }

  afterEach(() => jest.restoreAllMocks());

  it('ANGRIFF: Nutzer OHNE 2FA (mfaSetupRequired) auf geschuetzter Route -> 403 MFA_SETUP_REQUIRED', async () => {
    spyParentActivate();
    const guard = new JwtAuthGuard(reflectorOf(false));
    const context = ctx({ id: 'u1', mfaSetupRequired: true });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    // Der maschinenlesbare Code steht im Response-Body (Frontend lenkt darauf).
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: MFA_SETUP_REQUIRED_CODE },
    });
  });

  it('Einrichtungs-Route (@MfaSetupExempt) bleibt fuer den pflichtigen Nutzer offen', async () => {
    spyParentActivate();
    const guard = new JwtAuthGuard(reflectorOf(true));
    const context = ctx({ id: 'u1', mfaSetupRequired: true });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('Nutzer MIT 2FA (bzw. ohne Pflicht) -> geschuetzte Route normal erreichbar', async () => {
    spyParentActivate();
    const guard = new JwtAuthGuard(reflectorOf(false));
    const context = ctx({ id: 'u1', mfaSetupRequired: false });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('Ungueltiges/fehlendes JWT -> Basis-Guard entscheidet, 2FA-Logik greift nicht', async () => {
    jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockResolvedValue(false);
    const guard = new JwtAuthGuard(reflectorOf(false));
    const context = ctx({ id: 'u1', mfaSetupRequired: true });
    await expect(guard.canActivate(context)).resolves.toBe(false);
  });
});
