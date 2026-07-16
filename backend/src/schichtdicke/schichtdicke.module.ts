import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LayerMeasurement } from './entities/layer-measurement.entity';
import { LayerMeasurementPoint } from './entities/layer-measurement-point.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { SchichtdickeService } from './schichtdicke.service';
import { SchichtdickeController } from './schichtdicke.controller';
import { SchichtdickePdfService } from './schichtdicke-pdf.service';
import { AuditModule } from '../audit/audit.module';

/**
 * Schichtdicken-Messprotokoll (Lackschichtdicke, µm). Pro-Add-on hinter dem
 * Tarif-Feature 'schichtdicke' (Controller-Ebene). Customer/Vehicle/Order/Tenant
 * nur fuer die tenant-Validierung verknuepfter FKs bzw. das PDF-Branding.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      LayerMeasurement,
      LayerMeasurementPoint,
      Customer,
      Vehicle,
      Order,
      Tenant,
    ]),
    AuditModule,
  ],
  controllers: [SchichtdickeController],
  providers: [SchichtdickeService, SchichtdickePdfService],
  exports: [SchichtdickeService],
})
export class SchichtdickeModule {}
