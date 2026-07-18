import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { MfaJwtStrategy } from './mfa-jwt.strategy';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Tenant, PasswordResetToken]),
    // Sentinel Teil 1: liefert LoginGuardService + SecurityEventService fuer
    // AuthService/MfaService (aktive Fehlversuchs-Sperre + Security-Event-Log).
    SecurityModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // Kein unsicherer Fallback: JWT_SECRET muss in der Umgebung gesetzt sein.
        secret: configService.getOrThrow('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN', '7d') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, MfaService, JwtStrategy, MfaJwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
