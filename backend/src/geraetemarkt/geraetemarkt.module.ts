import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeraeteInserat } from './entities/geraete-inserat.entity';
import { GeraeteInseratBild } from './entities/geraete-inserat-bild.entity';
import { GeraeteInseratMeldung } from './entities/geraete-inserat-meldung.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { GeraetemarktService } from './geraetemarkt.service';
import { GeraeteInseratUploadService } from './geraete-inserat-upload.service';
import { GeraeteMeldungService } from './geraete-meldung.service';
import { GeraeteModerationService } from './geraete-moderation.service';
import { GeraetemarktController } from './geraetemarkt.controller';
import { PlatformGeraetemarktController } from './platform-geraetemarkt.controller';
import { AuditModule } from '../audit/audit.module';

/**
 * Geraete-Gebrauchtmarkt: Entities + tenant-scoped CRUD + cross-tenant
 * Browse/Detail (PR1), gehaerteter Bild-Upload je Inserat (PR2) sowie
 * Kontakt-Reveal, Melde-Funktion, Chemie-Heuristik und Betreiber-Moderation
 * (PR3). Der Tenant-Repo-Zugriff dient ausschliesslich dem (auditierten)
 * Kontakt-Reveal aus den Verkaeufer-Stammdaten.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([GeraeteInserat, GeraeteInseratBild, GeraeteInseratMeldung, Tenant]),
    AuditModule,
  ],
  controllers: [GeraetemarktController, PlatformGeraetemarktController],
  providers: [
    GeraetemarktService,
    GeraeteInseratUploadService,
    GeraeteMeldungService,
    GeraeteModerationService,
  ],
})
export class GeraetemarktModule {}
