import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  // Customer ist nur fuer die tenant-Validierung der verknuepften customerId noetig.
  imports: [TypeOrmModule.forFeature([Vehicle, Order, Customer]), AuditModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
