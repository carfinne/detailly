import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleIntake } from './entities/vehicle-intake.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { IntakeService } from './intake.service';
import { IntakeController } from './intake.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    // Customer/Vehicle/Order nur fuer die tenant-Validierung verknuepfter FKs noetig.
    TypeOrmModule.forFeature([VehicleIntake, Customer, Vehicle, Order]),
    AuditModule,
  ],
  controllers: [IntakeController],
  providers: [IntakeService],
  exports: [IntakeService],
})
export class IntakeModule {}
