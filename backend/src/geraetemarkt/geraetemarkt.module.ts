import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeraeteInserat } from './entities/geraete-inserat.entity';
import { GeraeteInseratBild } from './entities/geraete-inserat-bild.entity';
import { GeraeteInseratMeldung } from './entities/geraete-inserat-meldung.entity';
import { GeraetemarktService } from './geraetemarkt.service';
import { GeraetemarktController } from './geraetemarkt.controller';
import { AuditModule } from '../audit/audit.module';

/**
 * Geraete-Gebrauchtmarkt (PR1 – Fundament: Entities + tenant-scoped CRUD +
 * cross-tenant Browse/Detail). Bild-Upload (PR2) und Melde-Logik (PR3) folgen;
 * ihre Entities sind hier bereits registriert (forFeature) fuer die additive
 * Schema-Basis.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([GeraeteInserat, GeraeteInseratBild, GeraeteInseratMeldung]),
    AuditModule,
  ],
  controllers: [GeraetemarktController],
  providers: [GeraetemarktService],
})
export class GeraetemarktModule {}
