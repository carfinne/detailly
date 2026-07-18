import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlatformCockpitController } from './platform-cockpit.controller';
import { UserRole } from '../users/entities/user.entity';

/**
 * Ebenen-Trennung des Betreiber-Cockpits. Getestet wird der RolesGuard direkt
 * gegen die (dekorierten) Controller-Handler – so wie support.spec.ts. Damit ist
 * die @Roles-Konfiguration (Klasse + Method-Override) verifiziert, ohne eine DB
 * oder einen HTTP-Server zu booten (jest laeuft hier bewusst DB-frei).
 */
describe('PlatformCockpitController · RolesGuard (Ebenen-Trennung)', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = PlatformCockpitController.prototype as any;
  const ctxFor = (handler: any, role?: string): any => ({
    getHandler: () => handler,
    getClass: () => PlatformCockpitController,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  });

  // Lesen erlaubt fuer alle Plattform-Rollen.
  const SHARED: Array<[string, any]> = [
    ['listTenants', proto.listTenants],
    ['getTenant', proto.getTenant],
    ['locations', proto.locations],
    ['live', proto.live],
  ];
  // Nur Platform-Admin.
  const ADMIN_ONLY: Array<[string, any]> = [
    ['lookupUsers', proto.lookupUsers],
    ['audit', proto.audit],
  ];
  const ALL = [...SHARED, ...ADMIN_ONLY];

  const KUNDEN_ROLLEN = [UserRole.OWNER, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.RECEPTIONIST];

  it.each(KUNDEN_ROLLEN)('Kunden-Rolle %s -> 403 auf ALLEN Cockpit-Routen', (role) => {
    for (const [, handler] of ALL) {
      expect(guard.canActivate(ctxFor(handler, role))).toBe(false);
    }
  });

  it('Ohne Benutzer (kein JWT) -> verweigert', () => {
    for (const [, handler] of ALL) {
      expect(guard.canActivate(ctxFor(handler, undefined))).toBe(false);
    }
  });

  it.each([UserRole.PLATFORM_ANALYST, UserRole.PLATFORM_SUPPORT])(
    'Plattform-Rolle %s darf die geteilten Lese-Routen',
    (role) => {
      for (const [, handler] of SHARED) {
        expect(guard.canActivate(ctxFor(handler, role))).toBe(true);
      }
    },
  );

  it.each([UserRole.PLATFORM_ANALYST, UserRole.PLATFORM_SUPPORT])(
    'Plattform-Rolle %s darf NICHT an /platform/users und /platform/audit',
    (role) => {
      for (const [, handler] of ADMIN_ONLY) {
        expect(guard.canActivate(ctxFor(handler, role))).toBe(false);
      }
    },
  );

  it('Platform-Admin darf alles (auch users + audit)', () => {
    for (const [, handler] of ALL) {
      expect(guard.canActivate(ctxFor(handler, UserRole.PLATFORM_ADMIN))).toBe(true);
    }
  });
});
