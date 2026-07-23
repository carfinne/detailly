import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { MFA_SETUP_EXEMPT_KEY } from '../decorators/mfa-setup-exempt.decorator';
import {
  MFA_SETUP_REQUIRED_CODE,
  MFA_SETUP_REQUIRED_MESSAGE,
} from '../../auth/mfa-policy';

/**
 * Standard-JWT-Guard auf Basis der Passport-Strategie.
 *
 * Zusaetzlich (Pilot-Haertung): serverseitige 2FA-ERZWINGUNG. Nach erfolgreicher
 * JWT-Pruefung wird geprueft, ob der Nutzer 2FA einrichten MUSS (Plattform-Rolle
 * oder Tenant-`mfaPflicht`, siehe JwtStrategy -> req.user.mfaSetupRequired) und
 * das noch nicht getan hat. Falls ja, wird der Zugriff mit 403 + Code
 * `MFA_SETUP_REQUIRED` verweigert – AUSSER der Endpunkt ist per @MfaSetupExempt()
 * freigegeben (die wenigen Routen, die zum Einrichten noetig sind). So bleibt der
 * Login selbst intakt (der Nutzer bekommt sein Token), aber die geschuetzten
 * Endpunkte sind gesperrt, bis 2FA aktiv ist.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1) Normale JWT-Authentifizierung (wirft 401 bei ungueltigem/fehlendem Token).
    const activated = (await super.canActivate(context)) as boolean;
    if (!activated) return false;

    // 2) Ist dieser Endpunkt von der 2FA-Erzwingung ausgenommen? (Einrichtungs-
    //    Handshake + Profil). Dann durchlassen, egal ob 2FA fehlt.
    const exempt = this.reflector.getAllAndOverride<boolean>(MFA_SETUP_EXEMPT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (exempt) return true;

    // 3) Erzwingung: die JwtStrategy hat auf Basis von Rolle/Tenant/2FA-Status
    //    ermittelt, ob eine 2FA-Einrichtung aussteht. Falls ja -> 403 mit
    //    maschinenlesbarem Code (Frontend lenkt auf die Einrichtung).
    const req = context.switchToHttp().getRequest();
    if (req?.user?.mfaSetupRequired) {
      throw new ForbiddenException({
        code: MFA_SETUP_REQUIRED_CODE,
        message: MFA_SETUP_REQUIRED_MESSAGE,
      });
    }
    return true;
  }
}
