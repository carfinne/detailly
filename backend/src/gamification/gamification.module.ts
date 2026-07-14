import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Customer } from '../customers/entities/customer.entity';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';

/**
 * Erfolge/Gamification – reine Aggregation bestehender Daten (kein neues Table).
 * Repos werden nur wiederverwendet; alle Queries sind tenant-getrennt.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Order, Invoice, Customer, User, Tenant])],
  controllers: [GamificationController],
  providers: [GamificationService],
})
export class GamificationModule {}
