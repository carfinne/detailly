import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';

import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { VehicleIntake } from '../intake/entities/vehicle-intake.entity';
import { DamageInspection } from '../inspection/entities/damage-inspection.entity';
import { DamageItem } from '../inspection/entities/damage-item.entity';
import { DamagePhoto } from '../inspection/entities/damage-photo.entity';
import { DamageItemPhoto } from '../inspection/entities/damage-item-photo.entity';
import { Rental } from '../shop/entities/rental.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

import { GdprService } from './gdpr.service';
import { GdprController } from './gdpr.controller';

/**
 * Eigenes DSGVO-Modul, damit der Kunden-Service nicht mit 14 Fremd-Repos
 * aufgeblaeht wird. Buendelt alle PII-tragenden Repos + AuditService. Die
 * DataSource (fuer Transaktionen) ist global via TypeOrmModule.forRoot
 * verfuegbar und wird im Service injiziert.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      Vehicle,
      Order,
      OrderItem,
      Invoice,
      InvoiceItem,
      Appointment,
      VehicleIntake,
      DamageInspection,
      DamageItem,
      DamagePhoto,
      DamageItemPhoto,
      Rental,
      AuditLog,
    ]),
    AuditModule,
  ],
  controllers: [GdprController],
  providers: [GdprService],
})
export class GdprModule {}
