import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { istMfaEinrichtungErzwungen } from './mfa-policy';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    // @Optional: bestehende Unit-Tests konstruieren die Strategie mit nur
    // (config, userRepo). In der App liefert die DI das Tenant-Repo aus dem
    // AuthModule (fuer die 2FA-Erzwingungs-Pruefung tenant.mfaPflicht).
    @Optional()
    @InjectRepository(Tenant)
    private readonly tenantRepository?: Repository<Tenant>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Kein unsicherer Fallback: JWT_SECRET muss in der Umgebung gesetzt sein.
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Das kurzlebige 2FA-Zwischentoken (Claim `mfa:true`) darf KEINE geschuetzte
    // Route oeffnen – es ist ausschliesslich fuer POST /auth/mfa/verify bestimmt.
    if (payload?.mfa === true) throw new UnauthorizedException();

    const user = await this.userRepository.findOne({
      where: { id: payload.sub, isActive: true },
    });
    if (!user) throw new UnauthorizedException();

    // JWT-Revocation via tokenVersion: ein Increment (Passwort-Reset,
    // 2FA-Aktivieren/-Deaktivieren, kuenftig "ueberall abmelden") entwertet ALLE
    // frueher ausgestellten Voll-JWTs sofort. Ein Alt-Token OHNE tv-Claim gilt als
    // tv=0 -> bleibt gueltig, solange tokenVersion 0 ist (kein Mass-Logout beim
    // Deploy; erst der erste Increment sperrt aus).
    const tokenTv = typeof payload.tv === 'number' ? payload.tv : 0;
    if ((user.tokenVersion ?? 0) !== tokenTv) {
      throw new UnauthorizedException();
    }

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

    // 2FA-Erzwingung (Pilot-Haertung): steht fuer diesen Nutzer eine 2FA-
    // Einrichtung aus (Plattform-Rolle ODER Tenant-mfaPflicht, und 2FA noch nicht
    // aktiv)? Der JwtAuthGuard sperrt daraufhin geschuetzte, nicht-ausgenommene
    // Endpunkte (403 MFA_SETUP_REQUIRED). Der Tenant-Lookup faellt nur an, solange
    // 2FA fehlt UND es keine Plattform-Rolle ist (danach kein Extra-Query mehr).
    const mfaSetupRequired = await istMfaEinrichtungErzwungen(
      { role: user.role, tenantId: user.tenantId, totpEnabled: user.totpEnabled },
      this.tenantRepository,
    );

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      // Marktplatz-Haendler-Bindung aus der DB (frisch, nicht aus dem Payload):
      // das Haendler-Portal scopet hierauf. Bei Nicht-Haendlern undefined.
      dealerId: user.dealerId ?? undefined,
      emailVerified: !!user.emailVerifiedAt,
      // Vom JwtAuthGuard ausgewertet (2FA-Erzwingung). Additiv -> unschaedlich
      // fuer alle Routen, die das Flag nicht lesen.
      mfaSetupRequired,
    };
  }
}
