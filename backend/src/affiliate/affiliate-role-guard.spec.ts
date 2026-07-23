import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard';
import { AffiliateController } from './affiliate.controller';
import { PlatformAffiliateController } from './platform-affiliate.controller';
import { UserRole } from '../users/entities/user.entity';

/**
 * Nagelt die Rollen-Politik des Empfehlungsprogramms fest:
 *  - Tenant-Sicht (/affiliate/me): NUR der Inhaber (OWNER); andere Betriebs-Rollen
 *    sind gesperrt. platform_admin wird generisch durchgelassen (Bypass).
 *  - Plattform-Sicht (/platform/referrals): alle Plattform-Rollen lesen; KEINE
 *    Betriebs-Rolle kommt rein.
 * Liest die echten @Roles-Metadaten via RolesGuard.
 */
function ctxFor(ctrl: any, handler: any, role: string): any {
  return {
    getHandler: () => handler,
    getClass: () => ctrl,
    switchToHttp: () => ({ getRequest: () => ({ user: { role, tenantId: 't1' } }) }),
  };
}

const guard = new RolesGuard(new Reflector());

const BETRIEBS_ROLLEN = [UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.RECEPTIONIST];
const PLATTFORM_ROLLEN = [UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_ANALYST, UserRole.PLATFORM_SUPPORT];

describe('AffiliateController · RolesGuard (Tenant-Sicht)', () => {
  const proto = AffiliateController.prototype as any;

  it('me ist fuer den Inhaber (OWNER) erlaubt', () => {
    expect(guard.canActivate(ctxFor(AffiliateController, proto.me, UserRole.OWNER))).toBe(true);
  });

  it('me ist fuer Manager/Techniker/Empfang gesperrt (403)', () => {
    for (const role of BETRIEBS_ROLLEN) {
      expect(guard.canActivate(ctxFor(AffiliateController, proto.me, role))).toBe(false);
    }
  });

  it('me ist fuer haendler gesperrt (403)', () => {
    expect(guard.canActivate(ctxFor(AffiliateController, proto.me, UserRole.HAENDLER))).toBe(false);
  });

  it('me laesst platform_admin per Bypass durch', () => {
    expect(guard.canActivate(ctxFor(AffiliateController, proto.me, UserRole.PLATFORM_ADMIN))).toBe(true);
  });
});

describe('PlatformAffiliateController · RolesGuard (Betreiber-Sicht)', () => {
  const proto = PlatformAffiliateController.prototype as any;

  it('list ist fuer alle Plattform-Rollen offen', () => {
    for (const role of PLATTFORM_ROLLEN) {
      expect(guard.canActivate(ctxFor(PlatformAffiliateController, proto.list, role))).toBe(true);
    }
  });

  it('list ist fuer jede Betriebs-Rolle (inkl. OWNER) gesperrt (403)', () => {
    for (const role of [UserRole.OWNER, ...BETRIEBS_ROLLEN]) {
      expect(guard.canActivate(ctxFor(PlatformAffiliateController, proto.list, role))).toBe(false);
    }
  });
});
