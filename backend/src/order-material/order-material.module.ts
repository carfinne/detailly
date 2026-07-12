import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderMaterial } from './entities/order-material.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../shop/entities/product.entity';
import { FolienRolle } from '../folien-rollen/entities/folien-rolle.entity';
import { OrderMaterialService } from './order-material.service';
import { OrderMaterialController } from './order-material.controller';
import { VerschnittService } from './verschnitt.service';
import { VerschnittController } from './verschnitt.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([OrderMaterial, Order, Product, FolienRolle]), AuditModule],
  controllers: [OrderMaterialController, VerschnittController],
  providers: [OrderMaterialService, VerschnittService],
})
export class OrderMaterialModule {}
