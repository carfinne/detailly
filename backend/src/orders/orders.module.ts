import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { DamageInspection } from '../inspection/entities/damage-inspection.entity';
import { DamageItem } from '../inspection/entities/damage-item.entity';
import { OrdersService } from './orders.service';
import { OrdersPdfService } from './orders-pdf.service';
import { NachsorgeWiedervorlageService } from './nachsorge-wiedervorlage.service';
import { OrdersController } from './orders.controller';
import { OrderPhotoController } from './order-photo.controller';
import { PublicTrackingController } from './public-tracking.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    // Customer/Vehicle/User/Location nur fuer die tenant-Validierung verknuepfter FKs noetig.
    // Tenant zusaetzlich fuer den Betriebsnamen in der oeffentlichen Tracking-Ansicht.
    // Invoice (nur Repo-Token, KEIN Modul-Import -> kein Zirkularimport) fuer die
    // GoBD-Loeschsperre in remove(): festgesetzte Rechnung blockt Auftrags-Loeschung.
    // DamageInspection/DamageItem (ebenfalls nur Repo-Token) fuer die Annahme-Schaeden
    // im Uebergabeprotokoll-PDF.
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Customer,
      Vehicle,
      User,
      Location,
      Tenant,
      Invoice,
      DamageInspection,
      DamageItem,
    ]),
    AuditModule,
  ],
  controllers: [OrdersController, OrderPhotoController, PublicTrackingController],
  // NachsorgeWiedervorlageService: dependency-freier Scheduler (Welle 2-B, Teil 2),
  // KEINE Mail-Abhaengigkeit (kein Auto-Versand). Kein Export noetig (laeuft
  // eigenstaendig ueber den Timer).
  providers: [OrdersService, OrdersPdfService, NachsorgeWiedervorlageService],
  exports: [OrdersService, TypeOrmModule],
})
export class OrdersModule {}
