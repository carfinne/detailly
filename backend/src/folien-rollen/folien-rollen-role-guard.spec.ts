import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { REQUIRES_FEATURE_KEY } from '../common/decorators/requires-feature.decorator';
import { FolienRollenController } from './folien-rollen.controller';
import { UserRole } from '../users/entities/user.entity';

/**
 * Nagelt fest: das LOESCHEN einer Restrolle ist nur der Leitung erlaubt
 * (Schwund-Schutz; regulaeres Abschreiben laeuft ueber status=ENTSORGT).
 * Ansehen/Anlegen/Pflegen bleiben offen. Liest die echten @Roles-Metadaten.
 */
function ctxFor(handler: any, role: string): any {
  return {
    getHandler: () => handler,
    getClass: () => FolienRollenController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  };
}

describe('FolienRollenController · RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = FolienRollenController.prototype as any;

  it.each([UserRole.TECHNICIAN, UserRole.RECEPTIONIST])('remove ist fuer %s gesperrt', (role) => {
    expect(guard.canActivate(ctxFor(proto.remove, role))).toBe(false);
  });

  it.each([UserRole.MANAGER, UserRole.OWNER, UserRole.PLATFORM_ADMIN])(
    'remove ist fuer %s erlaubt',
    (role) => {
      expect(guard.canActivate(ctxFor(proto.remove, role))).toBe(true);
    },
  );

  it.each(['list', 'create', 'update'])('%s ist offen fuer jede Rolle', (method) => {
    expect(guard.canActivate(ctxFor(proto[method], UserRole.TECHNICIAN))).toBe(true);
  });

  describe('Tarif-Gate: à-la-carte Add-on "folierung_ppf"', () => {
    it('haengt am PlanFeatureGuard (Guard-Kette)', () => {
      const classGuards: unknown[] =
        Reflect.getMetadata(GUARDS_METADATA, FolienRollenController) ?? [];
      expect(classGuards).toContain(PlanFeatureGuard);
    });

    it('ganzer Controller hinter dem Add-on (Klassen-@RequiresFeature)', () => {
      expect(Reflect.getMetadata(REQUIRES_FEATURE_KEY, FolienRollenController)).toBe('folierung_ppf');
    });
  });
});
