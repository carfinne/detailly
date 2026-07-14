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
import { TerminErinnerungService } from './termin-erinnerung.service';

@Module({
  imports: [
    // Order/Customer/Vehicle/User/Location nur fuer die tenant-Validierung der verknuepften FKs;
    // Tenant fuer das Wochen-Umsatzziel (settings.kalender.umsatzZielWoche) des Umsatz-Aggregats
    // sowie fuer den Termin-Erinnerungs-Job (settings.kundenkommunikation + Branding/Reply-To).
    TypeOrmModule.forFeature([Appointment, Order, Customer, Vehicle, User, Location, Tenant]),
  ],
  controllers: [AppointmentsController],
  // TerminErinnerungService: dependency-freier Scheduler (Feature 1 Kundenkommunikation),
  // MailService ist global. Kein Export noetig (laeuft eigenstaendig ueber den Timer).
  providers: [AppointmentsService, TerminErinnerungService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
