import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard';
import { GeraetemarktController } from './geraetemarkt.controller';
import { UserRole } from '../users/entities/user.entity';

/**
 * Nagelt die Rollen-Politik des Geraetemarkts fest: Mutationen (create/update/
 * updateStatus/remove) sind nur der Leitung (OWNER/MANAGER) erlaubt; Browse/
 * Detail/eigene Liste sind fuer jede eingeloggte Rolle offen. Liest die echten
 * @Roles-Metadaten via RolesGuard.
 */
function ctxFor(handler: any, role: string): any {
  return {
    getHandler: () => handler,
    getClass: () => GeraetemarktController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  };
}

describe('GeraetemarktController · RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = GeraetemarktController.prototype as any;

  const MUTATIONEN = ['create', 'update', 'updateStatus', 'remove', 'uploadBilder', 'deleteBild'];

  it.each(MUTATIONEN)('%s ist fuer technician gesperrt (403)', (method) => {
    expect(guard.canActivate(ctxFor(proto[method], UserRole.TECHNICIAN))).toBe(false);
  });

  it.each(MUTATIONEN)('%s ist fuer receptionist gesperrt (403)', (method) => {
    expect(guard.canActivate(ctxFor(proto[method], UserRole.RECEPTIONIST))).toBe(false);
  });

  it.each(MUTATIONEN)('%s ist fuer owner erlaubt', (method) => {
    expect(guard.canActivate(ctxFor(proto[method], UserRole.OWNER))).toBe(true);
  });

  it.each(MUTATIONEN)('%s ist fuer manager erlaubt', (method) => {
    expect(guard.canActivate(ctxFor(proto[method], UserRole.MANAGER))).toBe(true);
  });

  // Bilder hochladen/loeschen ist Leitungssache, das Streamen eines sichtbaren
  // Bildes ('bild') dagegen fuer jede eingeloggte Rolle offen (oeffentlicher Katalog).
  it.each(['browse', 'meine', 'detail', 'bild'])('%s ist offen fuer jede Rolle', (method) => {
    expect(guard.canActivate(ctxFor(proto[method], UserRole.TECHNICIAN))).toBe(true);
    expect(guard.canActivate(ctxFor(proto[method], UserRole.RECEPTIONIST))).toBe(true);
  });
});
