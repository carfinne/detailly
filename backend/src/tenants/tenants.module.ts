import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Tenant } from './entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

/**
 * Mandanten-Onboarding (SaaS-Kern): oeffentliche Selbst-Registrierung neuer
 * Betriebe. Importiert AuthModule (Passwort-Hashing + Token-Ausstellung) und
 * AuditModule; MailService ist global verfuegbar.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, User, Subscription]),
    AuthModule,
    AuditModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
