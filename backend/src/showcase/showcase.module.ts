import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShowcaseItem } from './entities/showcase-item.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { ShowcaseService } from './showcase.service';
import { ShowcaseController } from './showcase.controller';
import { PublicShowcaseController } from './public-showcase.controller';
import { AuditModule } from '../audit/audit.module';

/**
 * Oeffentliches Schaufenster (Vorher/Nachher-Referenzen). Betreiber-CRUD hinter
 * dem Tarif-Feature 'schaufenster' (ab Basic, Controller-Ebene) + oeffentliche,
 * token-scoped Auslieferung ohne Auth. Tenant nur fuer die Slug-Aufloesung +
 * Logo der oeffentlichen Galerie. SubscriptionsService (Feature-Gate der
 * Public-Routen) und die Guards kommen aus dem globalen SubscriptionsModule.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ShowcaseItem, Tenant]), AuditModule],
  controllers: [ShowcaseController, PublicShowcaseController],
  providers: [ShowcaseService],
  exports: [ShowcaseService],
})
export class ShowcaseModule {}
