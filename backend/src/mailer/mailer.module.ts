import { Module, Global } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Globales Mailer-Modul (Vorbild: SevdeskModule). MailService ist ueberall
 * injizierbar, ohne dass jedes Modul MailerModule importieren muss.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailerModule {}
