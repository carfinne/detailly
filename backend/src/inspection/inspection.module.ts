import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DamageInspection } from './entities/damage-inspection.entity';
import { DamageItem } from './entities/damage-item.entity';
import { DamagePhoto } from './entities/damage-photo.entity';
import { DamageItemPhoto } from './entities/damage-item-photo.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { InspectionService } from './inspection.service';
import { InspectionController } from './inspection.controller';
import { AuditModule } from '../audit/audit.module';

/**
 * 3D-Schadensmodul (Phase 0). Normales Modul wie `locations`/`intake`
 * (kein @Global). Customer/Vehicle/Order nur fuer die tenant-Validierung
 * verknuepfter FKs eingebunden.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DamageInspection,
      DamageItem,
      DamagePhoto,
      DamageItemPhoto,
      Customer,
      Vehicle,
      Order,
    ]),
    AuditModule,
  ],
  controllers: [InspectionController],
  providers: [InspectionService],
  exports: [InspectionService],
})
export class InspectionModule {}
