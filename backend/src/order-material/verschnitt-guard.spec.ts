import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { VerschnittController } from './verschnitt.controller';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { REQUIRES_FEATURE_KEY } from '../common/decorators/requires-feature.decorator';
import { UserRole } from '../users/entities/user.entity';

/**
 * Guard-Verdrahtung der Verschnitt-KPI:
 * - Der ganze Controller ist Leitung-only (@Roles MANAGER/OWNER).
 * - Der ganze Controller haengt hinter dem à-la-carte Add-on `folierung_ppf`
 *   (Klassen-`@RequiresFeature`); der PlanFeatureGuard setzt das als 403
 *   PLAN_FEATURE_MISSING durch (Trial/Pilot offen).
 * - Beide Endpunkte (order/:id + aggregat) ERBEN das Klassen-Gate (kein eigenes
 *   Methoden-Gate) -> das Add-on gated die ganze Folierer-Verschnitt-Flaeche.
 * Reflection-Test ohne Nest-Bootstrap; faellt ein Gate kuenftig weg, schlaegt er an.
 */
function ctxFor(handler: any, role: string): any {
  return {
    getHandler: () => handler,
    getClass: () => VerschnittController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  };
}

describe('VerschnittController · Guards', () => {
  const proto = VerschnittController.prototype as any;

  it('haengt am PlanFeatureGuard (Guard-Kette)', () => {
    const classGuards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, VerschnittController) ?? [];
    expect(classGuards).toContain(PlanFeatureGuard);
  });

  it('ganzer Controller hinter dem Add-on "folierung_ppf" (Klassen-Gate)', () => {
    expect(Reflect.getMetadata(REQUIRES_FEATURE_KEY, VerschnittController)).toBe('folierung_ppf');
  });

  it('order/:id + aggregat erben das Klassen-Gate (kein eigenes Methoden-Gate)', () => {
    expect(Reflect.getMetadata(REQUIRES_FEATURE_KEY, proto.forOrder)).toBeUndefined();
    expect(Reflect.getMetadata(REQUIRES_FEATURE_KEY, proto.aggregat)).toBeUndefined();
  });

  describe('RolesGuard (Leitung-only, @Roles auf Klassen-Ebene)', () => {
    const guard = new RolesGuard(new Reflector());
    it.each([UserRole.TECHNICIAN, UserRole.RECEPTIONIST])('forOrder gesperrt fuer %s', (role) => {
      expect(guard.canActivate(ctxFor(proto.forOrder, role))).toBe(false);
    });
    it.each([UserRole.MANAGER, UserRole.OWNER])('aggregat erlaubt fuer %s', (role) => {
      expect(guard.canActivate(ctxFor(proto.aggregat, role))).toBe(true);
    });
  });
});
