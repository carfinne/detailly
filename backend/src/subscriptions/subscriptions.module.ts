import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { AuditModule } from '../audit/audit.module';

/**
 * @Global, damit der `SubscriptionGuard` (und sein Service) ohne erneuten Import
 * in jedem operativen Controller via `@UseGuards(...)` verwendet werden kann.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Plan, Subscription, Tenant]), AuditModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionGuard],
  exports: [SubscriptionsService, SubscriptionGuard],
})
export class SubscriptionsModule {}
