import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Tenant } from '../tenants/entities/tenant.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { PublicMembersController } from './public-members.controller';
import { PublicMembersService } from './public-members.service';
import { BetriebPageService } from './betrieb-page.service';
import { OrtsPageService } from './orts-page.service';

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
  // (/betrieb/<slug>) + Sitemap; OrtsPageService die Orts-/Kategorieseiten
  // (/betriebe/<gewerk>/<citySlug>/) + Orts-Sitemap. main.ts holt beide per
  // app.get() als duenne Adapter.
  providers: [PublicMembersService, BetriebPageService, OrtsPageService],
  exports: [BetriebPageService, OrtsPageService],
})
export class PublicMembersModule {}
