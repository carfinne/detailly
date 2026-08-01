import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Tenant } from '../tenants/entities/tenant.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { PublicMembersController } from './public-members.controller';
import { PublicMembersService } from './public-members.service';
import { BetriebPageService } from './betrieb-page.service';

/**
 * Oeffentliches Mitglieder-Verzeichnis (Startseiten-Social-Proof).
 *
 * Eigenstaendiges Modul mit EINER oeffentlichen (ungegateten) Read-Oberflaeche.
 * Arbeitet bewusst NUR mit dem Tenant-Repository (keine internen Service-Schichten),
 * damit der oeffentliche Pfad nie versehentlich einen authentifizierten Codepfad
 * erreicht. Die Whitelist-Projektion liegt vollstaendig im Service.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Subscription])],
  controllers: [PublicMembersController],
  // BetriebPageService orchestriert die serverseitig gerenderten Einzelseiten
  // (/betrieb/<slug>) + Sitemap; main.ts holt ihn per app.get() als duennen Adapter.
  providers: [PublicMembersService, BetriebPageService],
  exports: [BetriebPageService],
})
export class PublicMembersModule {}
