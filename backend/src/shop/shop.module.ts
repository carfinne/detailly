import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { Rental } from './entities/rental.entity';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, StockMovement, PurchaseOrder, PurchaseOrderItem, Rental]),
    AuditModule,
  ],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
