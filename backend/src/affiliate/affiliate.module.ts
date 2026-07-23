import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralCode } from './entities/referral-code.entity';
import { Referral } from './entities/referral.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AffiliateService } from './affiliate.service';
import { AffiliateController } from './affiliate.controller';
import { PlatformAffiliateController } from './platform-affiliate.controller';
import { AuditModule } from '../audit/audit.module';

/**
 * Empfehlungs-/Affiliate-Programm (Wachstumskanal): eigener Code je Betrieb,
 * Zuordnung bei der Registrierung, Belohnungs-Anwartschaft beim Wechsel eines
 * geworbenen Betriebs auf „zahlend" sowie die read-only Betreiber-Sicht.
 *
 * Exportiert `AffiliateService`, damit TenantsModule (Zuordnung bei der
 * Registrierung) und SubscriptionsModule (Belohnung beim Statuswechsel) ihn
 * nutzen koennen. Importiert bewusst WEDER Tenants- noch SubscriptionsModule
 * (Einbahn-Abhaengigkeit -> keine Zyklen). Tenant-Repo nur fuer Betriebsnamen.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ReferralCode, Referral, Tenant]), AuditModule],
  controllers: [AffiliateController, PlatformAffiliateController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
