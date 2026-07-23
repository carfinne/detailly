import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard';
import { MarktregisterController } from './marktregister.controller';
import { UserRole } from '../users/entities/user.entity';

/**
 * Ebenen-Trennung des Marktrecherche-Registers. Getestet wird der RolesGuard
 * direkt gegen die (dekorierten) Controller-Handler (Muster wie platform-cockpit-
 * roles.spec.ts) – DB-frei. Das Register ist STRIKT nur fuer PLATFORM_ADMIN:
 * Tenant-Rollen UND die anderen Plattform-Rollen (Analyst/Support) werden auf
 * ALLEN Routen abgewiesen (403).
 */
describe('MarktregisterController · RolesGuard (nur PLATFORM_ADMIN)', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = MarktregisterController.prototype as any;
  const ctxFor = (handler: any, role?: string): any => ({
    getHandler: () => handler,
    getClass: () => MarktregisterController,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  });

  const ALL: Array<[string, any]> = [
    ['list', proto.list],
    ['create', proto.create],
    ['update', proto.update],
    ['setStatus', proto.setStatus],
    ['setPrioritaet', proto.setPrioritaet],
    ['remove', proto.remove],
  ];

  const TENANT_ROLLEN = [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.TECHNICIAN,
    UserRole.RECEPTIONIST,
  ];

  it.each(TENANT_ROLLEN)('Tenant-Rolle %s -> 403 auf ALLEN Register-Routen', (role) => {
    for (const [, handler] of ALL) {
      expect(guard.canActivate(ctxFor(handler, role))).toBe(false);
    }
  });

  it.each([UserRole.PLATFORM_ANALYST, UserRole.PLATFORM_SUPPORT])(
    'Andere Plattform-Rolle %s -> 403 (nur Admin darf)',
    (role) => {
      for (const [, handler] of ALL) {
        expect(guard.canActivate(ctxFor(handler, role))).toBe(false);
      }
    },
  );

  it('Ohne Benutzer (kein JWT) -> verweigert', () => {
    for (const [, handler] of ALL) {
      expect(guard.canActivate(ctxFor(handler, undefined))).toBe(false);
    }
  });

  it('Platform-Admin darf alle Register-Routen', () => {
    for (const [, handler] of ALL) {
      expect(guard.canActivate(ctxFor(handler, UserRole.PLATFORM_ADMIN))).toBe(true);
    }
  });
});
