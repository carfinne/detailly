import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DellenKalkulation } from './entities/dellen-kalkulation.entity';
import { DellenMarker } from './entities/dellen-marker.entity';
import { DellenPreismatrix } from './entities/dellen-preismatrix.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { DellenkalkulationService } from './dellenkalkulation.service';
import { DellenkalkulationController } from './dellenkalkulation.controller';
import { AuditModule } from '../audit/audit.module';

/**
 * Dellenkalkulation (Smart Repair / PDR). Ab-Basic-Feature 'dellenkalkulation'
 * (Controller-Ebene). Customer/Vehicle nur fuer die tenant-Validierung
 * verknuepfter FKs. Der Preis wird rein regelbasiert aus der Tenant-Preismatrix
 * berechnet (kein KI, kein Fremd-Paket).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DellenKalkulation, DellenMarker, DellenPreismatrix, Customer, Vehicle]),
    AuditModule,
  ],
  controllers: [DellenkalkulationController],
  providers: [DellenkalkulationService],
  exports: [DellenkalkulationService],
})
export class DellenkalkulationModule {}
