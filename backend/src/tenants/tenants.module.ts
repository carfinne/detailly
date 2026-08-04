import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Tenant } from './entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { SecurityModule } from '../security/security.module';
import { PublicMembersModule } from '../public-members/public-members.module';

/**
 * Mandanten-Onboarding (SaaS-Kern): oeffentliche Selbst-Registrierung neuer
 * Betriebe. Importiert AuthModule (Passwort-Hashing + Token-Ausstellung) und
 * AuditModule; MailService ist global verfuegbar. SecurityModule liefert den
 * SecurityEventService fuer die Honeypot-Protokollierung der Registrierung.
 *
 * PublicMembersModule liefert BetriebPageService/OrtsPageService (exportiert), damit
 * TenantsService die Seiten-Caches nach einer Auftritts-/Kontaktdaten-Aenderung
 * sofort leeren kann. Die Kante ist einseitig (PublicMembersModule importiert
 * TenantsModule NICHT) -> kein Zyklus, kein forwardRef noetig.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, User, Subscription]),
    AuthModule,
    AuditModule,
    AffiliateModule,
    SecurityModule,
    PublicMembersModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
