import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KassenbuchEintrag } from './entities/kassenbuch-eintrag.entity';
import { KassenbuchService } from './kassenbuch.service';
import { KassenbuchExportService } from './kassenbuch-export.service';
import { KassenbuchController } from './kassenbuch.controller';
import { AuditModule } from '../audit/audit.module';

/**
 * GoBD-Kassenbuch (Barzahlungen): tenant-scoped CRUD auf Entwuerfen,
 * Festschreibung (Unveraenderbarkeit), Storno-Gegenbuchung, Saldo-Auskunft und
 * GoBD-CSV-Export. KERN-Modul (kein Tarif-Gate). Eigenstaendige, FK-freie
 * Tabelle. AuditModule fuer die Nachvollziehbarkeit jeder Mutation.
 */
@Module({
  imports: [TypeOrmModule.forFeature([KassenbuchEintrag]), AuditModule],
  controllers: [KassenbuchController],
  providers: [KassenbuchService, KassenbuchExportService],
  exports: [KassenbuchService],
})
export class KassenbuchModule {}
