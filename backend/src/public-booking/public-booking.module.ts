import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingRequest } from './entities/booking-request.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { ServiceItem } from '../services/entities/service-item.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Customer } from '../customers/entities/customer.entity';
import { PublicBookingController } from './public-booking.controller';
import { PublicBookingService } from './public-booking.service';
import { BookingRequestsController } from './booking-requests.controller';
import { BookingRequestsService } from './booking-requests.service';
import { BookingRetentionService } from './booking-retention.service';
import { AuditModule } from '../audit/audit.module';
import { SecurityModule } from '../security/security.module';

/**
 * Kundenportal / Online-Terminbuchung.
 *
 * Eigenstaendiges Modul mit zwei klar getrennten Oberflaechen:
 *  - PublicBookingController: OEFFENTLICH (ohne Auth) – Betriebsinfo + Anfrage.
 *  - BookingRequestsController: INTERN (auth + tenant-gescoped) – annehmen/ablehnen.
 *
 * Es importiert bewusst KEINE internen Service-Schichten (Customers/Appointments-
 * Service), sondern arbeitet nur mit den noetigen Repositories – so kann der
 * oeffentliche Pfad nie versehentlich einen authentifizierten Codepfad erreichen.
 * MailService ist global (kein Import noetig).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([BookingRequest, Tenant, ServiceItem, Appointment, Customer]),
    AuditModule,
    // SecurityModule (exportiert SecurityEventService): der oeffentliche
    // Anfrage-Endpunkt protokolliert Honeypot-Treffer als Sicherheits-Ereignis.
    SecurityModule,
  ],
  controllers: [PublicBookingController, BookingRequestsController],
  providers: [PublicBookingService, BookingRequestsService, BookingRetentionService],
})
export class PublicBookingModule {}
