import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Tenant } from '../tenants/entities/tenant.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { PublicMembersController } from './public-members.controller';
import { PublicMembersService } from './public-members.service';

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
  providers: [PublicMembersService],
})
export class PublicMembersModule {}
