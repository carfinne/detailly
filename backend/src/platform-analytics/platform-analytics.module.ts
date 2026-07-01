import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Plan } from '../subscriptions/entities/plan.entity';
import { Order } from '../orders/entities/order.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { PlatformAnalyticsService } from './platform-analytics.service';
import { PlatformAnalyticsController } from './platform-analytics.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Subscription, Plan, Order, Invoice])],
  controllers: [PlatformAnalyticsController],
  providers: [PlatformAnalyticsService],
})
export class PlatformAnalyticsModule {}
