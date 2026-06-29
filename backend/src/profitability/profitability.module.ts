import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderTime } from '../zeiterfassung/entities/order-time.entity';
import { OrderMaterial } from '../order-material/entities/order-material.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../shop/entities/product.entity';
import { ProfitabilityService } from './profitability.service';
import { ProfitabilityController } from './profitability.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderTime, OrderMaterial, User, Product])],
  controllers: [ProfitabilityController],
  providers: [ProfitabilityService],
})
export class ProfitabilityModule {}
