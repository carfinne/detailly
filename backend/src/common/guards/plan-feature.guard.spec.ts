import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanFeatureGuard } from './plan-feature.guard';
import { RequiresFeature } from '../decorators/requires-feature.decorator';
import { UserRole } from '../../users/entities/user.entity';

/**
 * Tests fuer das deklarative Tarif-Feature-Gate (T-002). Der Reflector ist ECHT
 * (liest die Metadata der dekorierten Testklassen), nur der SubscriptionsService
 * ist gemockt – dessen Wurf-Logik testet plan-enforcement.spec.ts.
 */

@RequiresFeature('shop')
class GatedController {
  handler() {}
}

class UngatedController {
  handler() {}
}

// Methoden-Metadata muss Klassen-Metadata ueberschreiben (getAllAndOverride).
@RequiresFeature('shop')
class MixedController {
  @RequiresFeature('audit')
  special() {}
}

describe('PlanFeatureGuard', () => {
  const reflector = new Reflector();

  const ctx = (cls: any, handler: any, user: any): ExecutionContext =>
    ({
      getClass: () => cls,
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const tenantUser = { id: 'u1', tenantId: 't1', role: UserRole.OWNER };

  let assertFeature: jest.Mock;
  let guard: PlanFeatureGuard;

  beforeEach(() => {
    assertFeature = jest.fn().mockResolvedValue(undefined);
    guard = new PlanFeatureGuard(reflector, { assertFeature } as any);
  });

  it('ohne @RequiresFeature-Metadata -> durchlassen, kein Service-Aufruf', async () => {
    const c = new UngatedController();
    await expect(guard.canActivate(ctx(UngatedController, c.handler, tenantUser))).resolves.toBe(true);
    expect(assertFeature).not.toHaveBeenCalled();
  });

  it('platform_admin -> durchlassen ohne Tarif-Pruefung (betriebsuebergreifend)', async () => {
    const c = new GatedController();
    const admin = { id: 'p1', tenantId: 't1', role: UserRole.PLATFORM_ADMIN };
    await expect(guard.canActivate(ctx(GatedController, c.handler, admin))).resolves.toBe(true);
    expect(assertFeature).not.toHaveBeenCalled();
  });

  it('ohne user -> durchlassen (Auth entscheidet der JwtAuthGuard)', async () => {
    const c = new GatedController();
    await expect(guard.canActivate(ctx(GatedController, c.handler, undefined))).resolves.toBe(true);
    expect(assertFeature).not.toHaveBeenCalled();
  });

  it('user ohne tenantId (Plattform-Rolle) -> durchlassen', async () => {
    const c = new GatedController();
    const analyst = { id: 'p2', tenantId: null, role: UserRole.PLATFORM_ANALYST };
    await expect(guard.canActivate(ctx(GatedController, c.handler, analyst))).resolves.toBe(true);
    expect(assertFeature).not.toHaveBeenCalled();
  });

  it('Klassen-Gate: prueft den Feature-Key des Controllers tenant-scoped', async () => {
    const c = new GatedController();
    await expect(guard.canActivate(ctx(GatedController, c.handler, tenantUser))).resolves.toBe(true);
    expect(assertFeature).toHaveBeenCalledWith('t1', 'shop');
  });

  it('Methoden-Gate ueberschreibt Klassen-Gate (getAllAndOverride)', async () => {
    const c = new MixedController();
    await guard.canActivate(ctx(MixedController, c.special, tenantUser));
    expect(assertFeature).toHaveBeenCalledWith('t1', 'audit');
  });

  it('Feature fehlt im Tarif -> 403 PLAN_FEATURE_MISSING propagiert (kein Verschlucken)', async () => {
    assertFeature.mockRejectedValue(
      new ForbiddenException({ code: 'PLAN_FEATURE_MISSING', feature: 'shop', message: 'x' }),
    );
    const c = new GatedController();
    await expect(
      guard.canActivate(ctx(GatedController, c.handler, tenantUser)),
    ).rejects.toThrow(ForbiddenException);
  });
});
