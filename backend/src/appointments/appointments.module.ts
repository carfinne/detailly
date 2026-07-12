import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { Order } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';

@Module({
  imports: [
    // Order/Customer/Vehicle/User/Location nur fuer die tenant-Validierung der verknuepften FKs;
    // Tenant fuer das Wochen-Umsatzziel (settings.kalender.umsatzZielWoche) des Umsatz-Aggregats.
    TypeOrmModule.forFeature([Appointment, Order, Customer, Vehicle, User, Location, Tenant]),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
