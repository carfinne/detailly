import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrderMaterialController } from './order-material.controller';
import { UserRole } from '../users/entities/user.entity';

/**
 * Nagelt fest: das LOESCHEN (bucht Bestand zurueck) ist nur der Leitung erlaubt –
 * erfassen + ansehen sind offen. Liest die echten @Roles-Metadaten der Methoden.
 */
function ctxFor(handler: any, role: string): any {
  return {
    getHandler: () => handler,
    getClass: () => OrderMaterialController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  };
}

describe('OrderMaterialController · RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = OrderMaterialController.prototype as any;

  it.each([UserRole.TECHNICIAN, UserRole.RECEPTIONIST])('remove ist fuer %s gesperrt', (role) => {
    expect(guard.canActivate(ctxFor(proto.remove, role))).toBe(false);
  });

  it.each([UserRole.MANAGER, UserRole.FRANCHISE_OWNER, UserRole.SUPER_ADMIN])(
    'remove ist fuer %s erlaubt',
    (role) => {
      expect(guard.canActivate(ctxFor(proto.remove, role))).toBe(true);
    },
  );

  it('erfassen (add) ist offen fuer jede Rolle', () => {
    expect(guard.canActivate(ctxFor(proto.add, UserRole.TECHNICIAN))).toBe(true);
  });

  it('ansehen (list) ist offen fuer jede Rolle', () => {
    expect(guard.canActivate(ctxFor(proto.list, UserRole.TECHNICIAN))).toBe(true);
  });
});
