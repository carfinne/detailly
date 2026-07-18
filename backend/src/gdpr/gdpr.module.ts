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
import { DamageInspection } from '../inspection/entities/damage-inspection.entity';
import { DamageItem } from '../inspection/entities/damage-item.entity';
import { DamagePhoto } from '../inspection/entities/damage-photo.entity';
import { DamageItemPhoto } from '../inspection/entities/damage-item-photo.entity';
import { Rental } from '../shop/entities/rental.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

import { GdprService } from './gdpr.service';
import { GdprController } from './gdpr.controller';
import { DatenschutzController } from './datenschutz.controller';
import { DatenschutzCockpitService } from './datenschutz-cockpit.service';
import { DatenschutzRetentionService } from './datenschutz-retention.service';
import { TenantExportService } from './tenant-export.service';

/**
 * Eigenes DSGVO-Modul, damit der Kunden-Service nicht mit vielen Fremd-Repos
 * aufgeblaeht wird. Buendelt die PII-tragenden Repos (Art.15/17) + AuditService.
 *
 * Cockpit-/Retention-/Betriebsexport-Services arbeiten bewusst ueber die GLOBAL
 * verfuegbare DataSource (`getRepository(...)`) statt ueber viele injizierte
 * Repos – so bleibt `forFeature` schlank und der Betriebs-Gesamtexport kann alle
 * registrierten Entitaeten einsammeln, ohne sie hier einzeln zu deklarieren.
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
      DamageInspection,
      DamageItem,
      DamagePhoto,
      DamageItemPhoto,
      Rental,
      AuditLog,
    ]),
    AuditModule,
  ],
  controllers: [GdprController, DatenschutzController],
  providers: [
    GdprService,
    DatenschutzCockpitService,
    DatenschutzRetentionService,
    TenantExportService,
  ],
  exports: [GdprService],
})
export class GdprModule {}
