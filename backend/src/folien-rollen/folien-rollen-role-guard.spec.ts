import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard';
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
});
