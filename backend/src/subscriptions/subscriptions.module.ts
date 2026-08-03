import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { AuditModule } from '../audit/audit.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { SupportModule } from '../support/support.module';

/**
 * @Global, damit `SubscriptionGuard`/`PlanFeatureGuard` (und ihr Service) ohne
 * erneuten Import in jedem operativen Controller via `@UseGuards(...)`
 * verwendet werden koennen.
 *
 * SupportModule ist importiert, damit die Selbstkuendigung eine als loesbar
 * markierte Kuendigung in den bestehenden Support-Kanal einspeisen kann. KEIN
 * Zyklus: SupportModule kennt die Subscriptions nicht.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Plan, Subscription, Tenant]),
    AuditModule,
    AffiliateModule,
    SupportModule,
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionGuard, PlanFeatureGuard],
  exports: [SubscriptionsService, SubscriptionGuard, PlanFeatureGuard],
})
export class SubscriptionsModule {}
