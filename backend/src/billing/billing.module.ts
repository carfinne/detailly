import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from '../subscriptions/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AuditModule } from '../audit/audit.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { StripeWebhookController } from './stripe-webhook.controller';

/**
 * Stripe-Self-Service-Billing. SubscriptionsService ist global verfuegbar
 * (SubscriptionsModule ist @Global) -> kein Import noetig.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Plan, Subscription, Tenant]), AuditModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService],
})
export class BillingModule {}
