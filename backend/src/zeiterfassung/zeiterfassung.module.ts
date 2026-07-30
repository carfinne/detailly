import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeEntry } from './entities/time-entry.entity';
import { OrderTime } from './entities/order-time.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { ZeiterfassungService } from './zeiterfassung.service';
import { OrderTimeService } from './order-time.service';
import { ZeiterfassungController } from './zeiterfassung.controller';
import { OrderTimeController } from './order-time.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  // Order/OrderItem fuer Soll-Zeit + tenant-Validierung; Customer/Vehicle fuer die
  // Auftrags-Auswahl (Kunde/Kennzeichen) und die Soll/Ist-Uebersicht.
  imports: [
    TypeOrmModule.forFeature([TimeEntry, OrderTime, User, Location, Order, OrderItem, Customer, Vehicle]),
    AuditModule,
  ],
  controllers: [ZeiterfassungController, OrderTimeController],
  providers: [ZeiterfassungService, OrderTimeService],
})
export class ZeiterfassungModule {}
