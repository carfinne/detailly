import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlatformGeraetemarktController } from './platform-geraetemarkt.controller';
import { UserRole } from '../users/entities/user.entity';

/**
 * Nagelt die Rollen-Politik der Betreiber-Moderation fest: Lesen (meldungen/
 * inserate) fuer ALLE Plattform-Rollen, Aktionen (moderateInserat/updateMeldung)
 * nur Platform-Admin + -Support (Analyst read-only). KEINE Betriebs-Rolle kommt
 * rein. Liest die echten @Roles-Metadaten (Klassen- UND Methoden-Ebene) via
 * RolesGuard.
 */
function ctxFor(handler: any, role: string): any {
  return {
    getHandler: () => handler,
    getClass: () => PlatformGeraetemarktController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  };
}

describe('PlatformGeraetemarktController · RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = PlatformGeraetemarktController.prototype as any;

  const ALLE = ['meldungen', 'inserate', 'moderateInserat', 'updateMeldung'];
  const AKTIONEN = ['moderateInserat', 'updateMeldung'];
  const LESEN = ['meldungen', 'inserate'];

  const BETRIEBS_ROLLEN = [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.TECHNICIAN,
    UserRole.RECEPTIONIST,
  ];

  it.each(ALLE)('%s ist fuer jede Betriebs-Rolle gesperrt (403)', (method) => {
    for (const role of BETRIEBS_ROLLEN) {
      expect(guard.canActivate(ctxFor(proto[method], role))).toBe(false);
    }
  });

  it.each(LESEN)('%s ist fuer alle Plattform-Rollen offen', (method) => {
    expect(guard.canActivate(ctxFor(proto[method], UserRole.PLATFORM_ADMIN))).toBe(true);
    expect(guard.canActivate(ctxFor(proto[method], UserRole.PLATFORM_SUPPORT))).toBe(true);
    expect(guard.canActivate(ctxFor(proto[method], UserRole.PLATFORM_ANALYST))).toBe(true);
  });

  it.each(AKTIONEN)('%s ist fuer Admin + Support erlaubt', (method) => {
    expect(guard.canActivate(ctxFor(proto[method], UserRole.PLATFORM_ADMIN))).toBe(true);
    expect(guard.canActivate(ctxFor(proto[method], UserRole.PLATFORM_SUPPORT))).toBe(true);
  });

  it.each(AKTIONEN)('%s ist fuer den (read-only) Analyst gesperrt (403)', (method) => {
    expect(guard.canActivate(ctxFor(proto[method], UserRole.PLATFORM_ANALYST))).toBe(false);
  });
});
