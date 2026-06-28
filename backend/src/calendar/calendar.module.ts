import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { PublicCalendarController } from './public-calendar.controller';

/** Kalender-Abo (iCal-Feed) der Termine fuer Apple/Google Kalender. */
@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Appointment])],
  controllers: [CalendarController, PublicCalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
