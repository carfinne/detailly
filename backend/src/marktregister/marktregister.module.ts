import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarktBeobachtung } from './entities/markt-beobachtung.entity';
import { MarktregisterService } from './marktregister.service';
import { MarktregisterController } from './marktregister.controller';
import { AuditModule } from '../audit/audit.module';

/**
 * Marktrecherche-Register (Plattform-intern). Eigene Tabelle (markt_beobachtungen,
 * NICHT mandantenscoped). AuditModule liefert den AuditService fuer die
 * Rechenschaft je Mutation.
 */
@Module({
  imports: [TypeOrmModule.forFeature([MarktBeobachtung]), AuditModule],
  controllers: [MarktregisterController],
  providers: [MarktregisterService],
})
export class MarktregisterModule {}
