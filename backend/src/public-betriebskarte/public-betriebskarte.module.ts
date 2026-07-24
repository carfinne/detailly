import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Tenant } from '../tenants/entities/tenant.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { PublicBetriebskarteController } from './public-betriebskarte.controller';
import { PublicBetriebskarteService } from './public-betriebskarte.service';

/**
 * Oeffentliche Betriebskarte (Startseiten-Deutschlandkarte + „X Betriebe
 * bundesweit"-Zaehler).
 *
 * Eigenstaendiges Modul mit EINER oeffentlichen (ungegateten) Read-Oberflaeche.
 * Arbeitet bewusst NUR mit Tenant-/Subscription-Repository (keine internen
 * Service-Schichten), damit der oeffentliche Pfad nie versehentlich einen
 * authentifizierten Codepfad erreicht. Die Whitelist-Projektion liegt vollstaendig
 * im Service.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Subscription])],
  controllers: [PublicBetriebskarteController],
  providers: [PublicBetriebskarteService],
})
export class PublicBetriebskarteModule {}
