import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MailService } from './mail.service';
import { Tenant } from '../tenants/entities/tenant.entity';

/**
 * Globales Mailer-Modul (Vorbild: SevdeskModule). MailService ist ueberall
 * injizierbar, ohne dass jedes Modul MailerModule importieren muss.
 *
 * Braucht das Tenant-Repository, um pro Betrieb die eigene SMTP-Konfig
 * (settings.mailConfig) + das verschluesselte Passwort (select:false) zu laden.
 * Registriert NUR das Repository (forFeature) – keine Abhaengigkeit zum
 * TenantsModule, daher kein Zyklus.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [MailService],
  exports: [MailService],
})
export class MailerModule {}
