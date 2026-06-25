import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Kein unsicherer Fallback: JWT_SECRET muss in der Umgebung gesetzt sein.
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub, isActive: true },
    });
    if (!user) throw new UnauthorizedException();

    // Session-Invalidierung bei Passwort-Aenderung: Tokens aus einer STRIKT
    // frueheren Sekunde als der letzte Passwort-Wechsel werden abgelehnt. Der
    // Sekunden-Vergleich (statt ms) verhindert Selbst-Aussperrung, falls ein
    // frisches Token in derselben Sekunde wie der Reset ausgestellt wurde.
    if (user.passwordChangedAt && typeof payload.iat === 'number') {
      const changedSec = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
      if (payload.iat < changedSec) {
        throw new UnauthorizedException();
      }
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      emailVerified: !!user.emailVerifiedAt,
    };
  }
}
