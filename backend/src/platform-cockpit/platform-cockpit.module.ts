import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Plan } from '../subscriptions/entities/plan.entity';
import { Order } from '../orders/entities/order.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { SupportTicket } from '../support/entities/support-ticket.entity';
import { MarketplaceDealer } from '../marketplace/entities/marketplace-dealer.entity';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PlatformCockpitService } from './platform-cockpit.service';
import { PlatformCockpitController } from './platform-cockpit.controller';

/**
 * Betreiber-Cockpit (Plattform-intern). Registriert die benoetigten
 * Bestandsentitaeten zum Lesen/Aggregieren. AuditModule liefert den AuditService
 * fuer die DSGVO-Protokollierung, AuthModule den AuthService fuer die Betreiber-
 * ausgeloeste Passwort-Reset-Aktion. Die Pilot-/Trial-Schreibaktionen delegieren
 * an den (global bereitgestellten) SubscriptionsService. Keine eigene Tabelle.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      User,
      Subscription,
      Plan,
      Order,
      Invoice,
      AuditLog,
      SupportTicket,
      MarketplaceDealer,
    ]),
    AuditModule,
    AuthModule,
  ],
  controllers: [PlatformCockpitController],
  providers: [PlatformCockpitService],
})
export class PlatformCockpitModule {}
