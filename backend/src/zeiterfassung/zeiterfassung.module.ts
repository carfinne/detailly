import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeEntry } from './entities/time-entry.entity';
import { OrderTime } from './entities/order-time.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { Order } from '../orders/entities/order.entity';
import { ZeiterfassungService } from './zeiterfassung.service';
import { OrderTimeService } from './order-time.service';
import { ZeiterfassungController } from './zeiterfassung.controller';
import { OrderTimeController } from './order-time.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  // Order zusaetzlich fuer die tenant-Validierung der gebuchten Auftragszeiten.
  imports: [TypeOrmModule.forFeature([TimeEntry, OrderTime, User, Location, Order]), AuditModule],
  controllers: [ZeiterfassungController, OrderTimeController],
  providers: [ZeiterfassungService, OrderTimeService],
})
export class ZeiterfassungModule {}
