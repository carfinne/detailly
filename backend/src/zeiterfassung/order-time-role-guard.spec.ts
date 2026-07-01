import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrderTimeController } from './order-time.controller';
import { UserRole } from '../users/entities/user.entity';

/**
 * Nagelt die zentrale Anti-Betrugs-Garantie fest: Aendern/Loeschen von
 * Auftragszeiten ist NUR der Leitung erlaubt (RolesGuard liest die @Roles-
 * Metadaten der Controller-Methoden). Liest die ECHTEN Metadaten der Methoden –
 * faellt der @Roles-Decorator kuenftig weg, schlaegt dieser Test an.
 */
function ctxFor(handler: any, role: string): any {
  return {
    getHandler: () => handler,
    getClass: () => OrderTimeController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  };
}

describe('OrderTimeController · RolesGuard (nur Leitung aendert/loescht)', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = OrderTimeController.prototype as any;

  it.each([
    ['update', UserRole.TECHNICIAN],
    ['remove', UserRole.TECHNICIAN],
    ['update', UserRole.RECEPTIONIST],
    ['remove', UserRole.RECEPTIONIST],
  ])('%s ist fuer Rolle %s gesperrt', (method, role) => {
    expect(guard.canActivate(ctxFor(proto[method], role))).toBe(false);
  });

  it.each([
    ['update', UserRole.MANAGER],
    ['remove', UserRole.MANAGER],
    ['update', UserRole.OWNER],
    ['remove', UserRole.OWNER],
    ['update', UserRole.PLATFORM_ADMIN],
    ['remove', UserRole.PLATFORM_ADMIN],
  ])('%s ist fuer Rolle %s erlaubt', (method, role) => {
    expect(guard.canActivate(ctxFor(proto[method], role))).toBe(true);
  });

  it('erfassen (create) ist offen fuer jede Rolle – keine @Roles-Metadaten', () => {
    expect(guard.canActivate(ctxFor(proto.create, UserRole.TECHNICIAN))).toBe(true);
  });

  it('ansehen (list) ist offen fuer jede Rolle', () => {
    expect(guard.canActivate(ctxFor(proto.list, UserRole.TECHNICIAN))).toBe(true);
  });
});
