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
import { InspectionPhotoController } from './inspection-photo.controller';
import { AuditModule } from '../audit/audit.module';

/**
 * Schadensmodul (2D-Annahme + 3D-Gutachten). Normales Modul wie `locations`
 * (kein @Global). Customer/Vehicle/Order nur fuer die tenant-Validierung
 * verknuepfter FKs eingebunden. Loeste das fruehere `intake`-Modul ab (P3-7).
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
  controllers: [InspectionController, InspectionPhotoController],
  providers: [InspectionService],
  exports: [InspectionService],
})
export class InspectionModule {}
