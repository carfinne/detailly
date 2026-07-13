import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

/** Passport-Strategie-Name des kurzlebigen 2FA-Zwischentokens. */
export const MFA_JWT_STRATEGY = 'mfa-jwt';

/**
 * Strategie fuer das kurzlebige `mfaPending`-Token aus Login-Stufe 1. Akzeptiert
 * AUSSCHLIESSLICH Tokens mit Claim `mfa:true` (das echte Voll-JWT traegt diesen
 * Claim NICHT und wird hier abgelehnt). Gibt nur die User-Id frei; der Service
 * laedt Secret/Recovery-Codes separat (select:false). Damit oeffnet dieses Token
 * ausschliesslich `POST /auth/mfa/verify` und keine geschuetzte Route.
 */
@Injectable()
export class MfaJwtStrategy extends PassportStrategy(Strategy, MFA_JWT_STRATEGY) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    if (payload?.mfa !== true) throw new UnauthorizedException();

    const user = await this.userRepository.findOne({
      where: { id: payload.sub, isActive: true },
    });
    // Das Zwischentoken ist nur sinnvoll, solange 2FA aktiv ist.
    if (!user || !user.totpEnabled) throw new UnauthorizedException();

    // Passwort-Wechsel im 2-min-Fenster entwertet auch das Zwischentoken.
    if (user.passwordChangedAt && typeof payload.iat === 'number') {
      const changedSec = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
      if (payload.iat < changedSec) throw new UnauthorizedException();
    }

    return { id: user.id, mfaPending: true };
  }
}
