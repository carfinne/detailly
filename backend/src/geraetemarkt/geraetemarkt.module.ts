import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeraeteInserat } from './entities/geraete-inserat.entity';
import { GeraeteInseratBild } from './entities/geraete-inserat-bild.entity';
import { GeraeteInseratMeldung } from './entities/geraete-inserat-meldung.entity';
import { GeraetemarktService } from './geraetemarkt.service';
import { GeraeteInseratUploadService } from './geraete-inserat-upload.service';
import { GeraetemarktController } from './geraetemarkt.controller';
import { AuditModule } from '../audit/audit.module';

/**
 * Geraete-Gebrauchtmarkt: Entities + tenant-scoped CRUD + cross-tenant
 * Browse/Detail (PR1) sowie gehaerteter Bild-Upload je Inserat (PR2). Die
 * Melde-Logik (PR3) folgt; ihre Entity ist hier bereits registriert (forFeature)
 * fuer die additive Schema-Basis.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([GeraeteInserat, GeraeteInseratBild, GeraeteInseratMeldung]),
    AuditModule,
  ],
  controllers: [GeraetemarktController],
  providers: [GeraetemarktService, GeraeteInseratUploadService],
})
export class GeraetemarktModule {}
