import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';
import { VehiclesService } from './vehicles.service';
import { VehiclesImportService } from './vehicles-import.service';
import { VehiclesController } from './vehicles.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  // Customer ist fuer die tenant-Validierung der verknuepften customerId und
  // die E-Mail-Zuordnung des CSV-Imports (T-007) noetig.
  imports: [TypeOrmModule.forFeature([Vehicle, Order, Customer]), AuditModule],
  controllers: [VehiclesController],
  providers: [VehiclesService, VehiclesImportService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
