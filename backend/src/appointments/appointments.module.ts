import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { Order } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';

@Module({
  imports: [
    // Order/Customer/Vehicle/User/Location nur fuer die tenant-Validierung der verknuepften FKs.
    TypeOrmModule.forFeature([Appointment, Order, Customer, Vehicle, User, Location]),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
