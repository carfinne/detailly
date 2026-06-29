import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderMaterial } from './entities/order-material.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../shop/entities/product.entity';
import { OrderMaterialService } from './order-material.service';
import { OrderMaterialController } from './order-material.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([OrderMaterial, Order, Product]), AuditModule],
  controllers: [OrderMaterialController],
  providers: [OrderMaterialService],
})
export class OrderMaterialModule {}
