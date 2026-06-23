import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    // Customer/Vehicle/User/Location nur fuer die tenant-Validierung verknuepfter FKs noetig.
    TypeOrmModule.forFeature([Order, OrderItem, Customer, Vehicle, User, Location]),
    AuditModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService, TypeOrmModule],
})
export class OrdersModule {}
