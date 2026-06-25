import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface MailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: { filename: string; content: Buffer }[];
}

/**
 * Schlanker Mail-Versand-Provider nach Vorbild des SevdeskService:
 * ConfigService, ENV-Gate, No-op-Dev-Fallback per Logger.
 *
 * Ohne SMTP_HOST wird KEIN Transport erstellt -> send() loggt nur und versendet
 * nichts (kein Crash). So funktioniert die lokale Dev-Umgebung und ein
 * Prod-Boot ohne fertig konfiguriertes SMTP weiterhin.
 *
 * In diesem Batch nur Basis-Infrastruktur (andockbar). Helfer wie
 * sendPasswordReset / sendMahnung folgen in eigenen Tickets.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      const user = this.config.get<string>('SMTP_USER');
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(this.config.get<string>('SMTP_PORT') || '587', 10),
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: user
          ? { user, pass: this.config.get<string>('SMTP_PASS') }
          : undefined,
      });
    }
  }

  private get from(): string {
    return (
      this.config.get<string>('MAIL_FROM') ||
      'Detailly <no-reply@detailly.local>'
    );
  }

  async send(opts: MailOptions): Promise<void> {
    if (!this.transporter) {
      // Dev-Fallback exakt wie Sevdesk: kein Versand, kein Crash, nur loggen.
      this.logger.debug(
        `SMTP nicht konfiguriert - Mail NICHT versendet (Stub). to=${opts.to} subject="${opts.subject}"`,
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: opts.attachments,
    });
    this.logger.log(`Mail versendet an ${opts.to} ("${opts.subject}")`);
  }
}
