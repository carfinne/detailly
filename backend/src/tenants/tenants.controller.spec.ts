import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantsController } from './tenants.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { REQUIRES_FEATURE_KEY } from '../common/decorators/requires-feature.decorator';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { planSeedBySlug } from '../subscriptions/plan-catalog';
import { PLAN_FEATURE_MISSING } from '../subscriptions/plan-entitlements';
import { UserRole } from '../users/entities/user.entity';

/**
 * Guard-Verdrahtung des rollen-offenen Kalkulations-Endpoints. Die
 * Schadenserfassung (auch Techniker/Empfang) muss die EUR/qm-Saetze lesen
 * koennen -> `GET /tenants/me/kalkulation` haengt NICHT am RolesGuard (im
 * Gegensatz zum owner-only `GET /tenants/me`). Ab V3 (2026-07-12) ist der READ
 * zusaetzlich tarif-gegatet (`@RequiresFeature('kalkulation')` + PlanFeatureGuard):
 * `kalkulation` steckt in Basic/Pro, nicht in Starter. Reflection- + Gate-Test
 * ohne Nest-Bootstrap.
 */
describe('TenantsController – Guard-Verdrahtung me/kalkulation', () => {
  const guardsOf = (handler: (...args: any[]) => unknown): unknown[] =>
    Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];

  it('me/kalkulation haengt am JwtAuthGuard + PlanFeatureGuard, aber NICHT am RolesGuard', () => {
    const g = guardsOf(TenantsController.prototype.getKalkulation);
    expect(g).toContain(JwtAuthGuard);
    expect(g).toContain(PlanFeatureGuard);
    expect(g).not.toContain(RolesGuard);
  });

  it('me/kalkulation deklariert das Tarif-Feature `kalkulation` (V3-Gate)', () => {
    const feature = Reflect.getMetadata(
      REQUIRES_FEATURE_KEY,
      TenantsController.prototype.getKalkulation,
    );
    expect(feature).toBe('kalkulation');
  });

  it('me/branding bleibt rollen-offen UND ungegatet (kein Feature-Gate, Referenz)', () => {
    const g = guardsOf(TenantsController.prototype.getBranding);
    expect(g).toContain(JwtAuthGuard);
    expect(g).not.toContain(PlanFeatureGuard);
    expect(g).not.toContain(RolesGuard);
    expect(
      Reflect.getMetadata(REQUIRES_FEATURE_KEY, TenantsController.prototype.getBranding),
    ).toBeUndefined();
  });

  it('owner-only me bleibt hinter RolesGuard (Kontrast, nicht veraendert)', () => {
    expect(guardsOf(TenantsController.prototype.getOwn)).toContain(RolesGuard);
  });
});

/**
 * Gate-VERHALTEN von `GET /tenants/me/kalkulation`: der ECHTE PlanFeatureGuard
 * liest die reale `@RequiresFeature('kalkulation')`-Metadata des Handlers und
 * fragt einen ECHTEN SubscriptionsService (nur die Repos gemockt, keine DB) ab.
 * So ist bewiesen, dass genau dieser Endpoint fuer Starter sperrt, fuer Basic
 * durchlaesst und Bestand (features==null) durchlaesst.
 */
describe('Gate-Verhalten GET /tenants/me/kalkulation (RequiresFeature kalkulation)', () => {
  const reflector = new Reflector();

  const makeGuard = (plan: { name: string; features: string[] | null } | null): PlanFeatureGuard => {
    const subRepo = {
      findOne: jest.fn().mockResolvedValue(
        plan === null ? null : { tenantId: 't1', planId: 'p1', status: SubscriptionStatus.ACTIVE },
      ),
    };
    const planRepo = {
      findOne: jest.fn().mockResolvedValue(plan ? { id: 'p1', ...plan, limits: null } : null),
    };
    const service = new SubscriptionsService(
      planRepo as any,
      subRepo as any,
      {} as any,
      { log: jest.fn().mockResolvedValue(undefined) } as any,
    );
    return new PlanFeatureGuard(reflector, service);
  };

  // Kontext, der den ECHTEN Handler/Class von getKalkulation liefert -> der Guard
  // liest die reale Metadata (kein hartkodierter Feature-Key im Test).
  const ctx = (user: any): ExecutionContext =>
    ({
      getClass: () => TenantsController,
      getHandler: () => TenantsController.prototype.getKalkulation,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  // Rollen-offen: ein Techniker (kein Owner) muss durch, wenn der Tarif passt.
  const user = { id: 'u1', tenantId: 't1', role: UserRole.TECHNICIAN };

  it('Starter-Features -> 403 PLAN_FEATURE_MISSING (kalkulation fehlt)', async () => {
    const guard = makeGuard({ name: 'Starter', features: [...planSeedBySlug('starter').features] });
    const err = await guard.canActivate(ctx(user)).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    const body = err.getResponse() as Record<string, unknown>;
    expect(body.code).toBe(PLAN_FEATURE_MISSING);
    expect(body.feature).toBe('kalkulation');
  });

  it('Basic-Features -> 200 (Guard laesst durch)', async () => {
    const guard = makeGuard({ name: 'Basic', features: [...planSeedBySlug('basic').features] });
    await expect(guard.canActivate(ctx(user))).resolves.toBe(true);
  });

  it('features == null (Bestand/Pilot ohne gepflegten Tarif) -> 200 (Vollzugriff)', async () => {
    const guard = makeGuard({ name: 'X', features: null });
    await expect(guard.canActivate(ctx(user))).resolves.toBe(true);
  });
});
