import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataIncident } from './entities/data-incident.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { IncidentsService } from './incidents.service';
import { IncidentDetectionService } from './incident-detection.service';
import { IncidentsController } from './incidents.controller';

/**
 * Datenpannen-Register (Art. 33/34 DSGVO) + periodischer Erkennungs-Auswerter.
 * Braucht `AuditLog` als READ-Quelle der Signale (eigene forFeature-Registrierung
 * ist neben der des AuditModule zulaessig – TypeORM teilt die Verbindung).
 */
@Module({
  imports: [TypeOrmModule.forFeature([DataIncident, AuditLog])],
  controllers: [IncidentsController],
  providers: [IncidentsService, IncidentDetectionService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
