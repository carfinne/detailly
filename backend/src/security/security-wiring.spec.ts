import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { SecurityModule } from './security.module';
import { LoginGuardService } from './login-guard.service';
import { SecurityEventService } from './security-event.service';
import { SecurityEvent } from './entities/security-event.entity';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { PasswordResetToken } from '../auth/entities/password-reset-token.entity';
import { MailService } from '../mailer/mail.service';
import { AuditService } from '../audit/audit.service';

/**
 * FIX 4 (Fail-Open-Absicherung): Guard + Event-Log sind aus Rueckwaerts-Kompat
 * @Optional() injiziert. Ohne Test wuerde ein kaputtes Modul-Wiring den Guard
 * STILL zum No-Op machen (fail-open). Diese Tests schlagen dann fehl:
 *  1) statisch: AuthModule MUSS SecurityModule importieren.
 *  2) gebootet: im DI-Container sind AuthService.loginGuard UND .securityEvents
 *     tatsaechlich gesetzt (nicht undefined).
 */
describe('Sentinel-Wiring – Guard/Event-Log sind real verdrahtet (kein Fail-Open)', () => {
  it('AuthModule importiert SecurityModule (statische Metadaten)', () => {
    const imports = (Reflect.getMetadata('imports', AuthModule) as unknown[]) ?? [];
    expect(imports).toContain(SecurityModule);
  });

  it('gebooteter AuthService hat loginGuard UND securityEvents (defined, kein No-Op)', async () => {
    // DB-frei: Repositories werden gemockt (kein TypeOrm.forRoot / kein nativer
    // Treiber). LoginGuardService/SecurityEventService werden ECHT instanziiert.
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        LoginGuardService,
        SecurityEventService,
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Tenant), useValue: {} },
        { provide: getRepositoryToken(PasswordResetToken), useValue: {} },
        { provide: getRepositoryToken(SecurityEvent), useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: MailService, useValue: {} },
        { provide: AuditService, useValue: { log: async () => undefined } },
      ],
    }).compile();

    const auth = moduleRef.get(AuthService);
    expect((auth as unknown as { loginGuard?: unknown }).loginGuard).toBeInstanceOf(
      LoginGuardService,
    );
    expect((auth as unknown as { securityEvents?: unknown }).securityEvents).toBeInstanceOf(
      SecurityEventService,
    );
  });
});
