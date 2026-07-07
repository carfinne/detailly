import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';

import { Tenant } from '../tenants/entities/tenant.entity';
import { MailConfig, formatFrom, resolveMailConfig } from '../common/mail/mail-config';

export interface MailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: { filename: string; content: Buffer }[];
  /**
   * Antwort-Adresse. Bei betriebseigenem Versand ist der Absender bereits der
   * Betrieb – replyTo faellt dann auf die betriebseigene From-Adresse zurueck,
   * wenn hier nichts gesetzt ist.
   */
  replyTo?: string;
  /**
   * Sendender Betrieb. Ist der Betrieb mit gueltiger `mailConfig` (enabled)
   * konfiguriert, geht die Mail ueber DESSEN SMTP unter DESSEN Absender raus –
   * sonst exakt das bisherige Verhalten (Plattform-Default). Fehlt der Wert,
   * wird IMMER der Plattform-Default genutzt (Account-/Plattform-Mails).
   */
  tenantId?: string;
}

/** Ergebnis der Transporter-Aufloesung fuer einen Betrieb (rein, testbar). */
export interface TenantTransport {
  options: nodemailer.TransportOptions;
  from: string;
  replyTo: string;
}

/**
 * Mail-Versand mit betriebseigenem Absender (feat/night-email).
 *
 * Zwei Wege:
 *  1. Plattform-Default (heutiges Verhalten): ohne SMTP_HOST kein Transport ->
 *     send() loggt nur (No-op-Stub, kein Crash). Absender = MAIL_FROM.
 *  2. Betriebseigen: hat der sendende Betrieb `mailConfig.enabled` + gueltige
 *     Werte, wird ein pro Tenant gecachter Transporter genutzt und `from` auf
 *     `fromName <fromEmail>` gesetzt. Antworten landen beim Betrieb.
 *
 * Robust: falsche/fehlende Betriebs-Daten fuehren nie zum Absturz des Aufrufers.
 * Strukturell unbrauchbare Konfig -> Fallback auf Plattform-Default. Echte
 * SMTP-/Auth-Fehler beim Versand werden hochgereicht (die Aufrufer versenden
 * Kunden-Mails ohnehin fire-and-forget in try/catch).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: nodemailer.Transporter;

  /** Pro Tenant gecachter Transporter + Fingerprint (Config-Aenderung -> Neubau). */
  private readonly tenantCache = new Map<
    string,
    { transporter: nodemailer.Transporter; fingerprint: string }
  >();

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
  ) {
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

  /**
   * Maskiert eine Empfaenger-Adresse fuers Logging (L2): erstes Zeichen des
   * Local-Parts sichtbar, Rest maskiert, Domain bleibt (z. B. m**@example.de).
   */
  static maskRecipient(to: string): string {
    if (!to) return '';
    const at = to.indexOf('@');
    if (at <= 0) return '***';
    const local = to.slice(0, at);
    const domain = to.slice(at);
    return `${local.slice(0, 1)}${'*'.repeat(Math.max(2, local.length - 1))}${domain}`;
  }

  /**
   * Maskiert das SMTP-Passwort fuer Antworten/Anzeige: gibt bei gesetztem Wert
   * NUR eine feste Bullet-Folge zurueck (weder Zeichen noch Laenge preisgeben),
   * bei leerem Wert einen leeren String. Analog zur Nicht-Preisgabe des
   * sevdeskApiToken – hier bewusst noch strikter (kein Rest sichtbar).
   */
  static maskPassword(pass?: string | null): string {
    return pass && pass.length > 0 ? '••••••••' : '';
  }

  /**
   * Baut aus einer Betriebs-Konfig die Transport-Optionen + Absender (rein,
   * ohne I/O – Kern der Transporter-Wahl, direkt testbar). Liefert `null`, wenn
   * der eigene Versand AUS ist oder die Konfig strukturell unbrauchbar ist
   * (kein Host/kein From) -> der Aufrufer faellt dann auf den Plattform-Default.
   */
  static buildTenantTransport(cfg: MailConfig, password?: string | null): TenantTransport | null {
    if (!cfg.enabled) return null;
    if (!cfg.host || !cfg.fromEmail) return null;
    const options: nodemailer.TransportOptions = {
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: password ?? '' } : undefined,
    } as nodemailer.TransportOptions;
    return { options, from: formatFrom(cfg), replyTo: cfg.fromEmail };
  }

  /** Uebersetzt SMTP-Fehler in eine knappe, sichere Klartext-Meldung (nie Secrets). */
  static describeSmtpError(e: unknown): string {
    const code = (e as { code?: string })?.code;
    switch (code) {
      case 'EAUTH':
        return 'Anmeldung am Mailserver fehlgeschlagen (Benutzer/Passwort prüfen).';
      case 'ECONNECTION':
      case 'ETIMEDOUT':
      case 'ESOCKET':
      case 'ECONNREFUSED':
        return 'Verbindung zum Mailserver fehlgeschlagen (Host/Port/Verschlüsselung prüfen).';
      case 'EENVELOPE':
        return 'Absender- oder Empfängeradresse wurde abgelehnt.';
      default:
        return 'Versand fehlgeschlagen. Bitte die SMTP-Daten prüfen.';
    }
  }

  /** Laedt das verschluesselte (select:false) SMTP-Passwort eines Betriebs. */
  async loadSmtpPassword(tenantId: string): Promise<string | null> {
    const row = await this.tenantRepo
      .createQueryBuilder('t')
      .addSelect('t.smtpPassword')
      .where('t.id = :id', { id: tenantId })
      .getOne();
    return row?.smtpPassword?.trim() || null;
  }

  /**
   * Laedt Betriebs-Mailkonfig (settings.mailConfig) + Passwort (select:false).
   * Beides in EINER Query. Gibt `null` zurueck, wenn der Betrieb nicht existiert.
   */
  private async loadTenantConfig(
    tenantId: string,
  ): Promise<{ cfg: MailConfig; password: string | null } | null> {
    const row = await this.tenantRepo
      .createQueryBuilder('t')
      .addSelect('t.smtpPassword')
      .where('t.id = :id', { id: tenantId })
      .getOne();
    if (!row) return null;
    const settings = (row.settings ?? {}) as Record<string, unknown>;
    return {
      cfg: resolveMailConfig(settings.mailConfig),
      password: row.smtpPassword?.trim() || null,
    };
  }

  /**
   * Loest den betriebseigenen Transporter auf (gecacht per Fingerprint). Liefert
   * `null` -> Aufrufer nutzt den Plattform-Default. Wirft NIE (Ladefehler ->
   * Warn-Log + Fallback), damit ein Konfig-/DB-Problem nie den Versand blockiert.
   */
  private async resolveTenantTransport(tenantId: string): Promise<TenantTransport & {
    transporter: nodemailer.Transporter;
  } | null> {
    let loaded: { cfg: MailConfig; password: string | null } | null;
    try {
      loaded = await this.loadTenantConfig(tenantId);
    } catch (e) {
      this.logger.warn(
        `Betriebs-Mailkonfig nicht ladbar (Fallback auf Plattform-Default): ${(e as Error).message}`,
      );
      return null;
    }
    if (!loaded) return null;
    const built = MailService.buildTenantTransport(loaded.cfg, loaded.password);
    if (!built) return null;

    const fingerprint = JSON.stringify(built.options);
    const cached = this.tenantCache.get(tenantId);
    if (cached && cached.fingerprint === fingerprint) {
      return { ...built, transporter: cached.transporter };
    }
    if (cached) {
      try {
        cached.transporter.close();
      } catch {
        /* best effort */
      }
    }
    const transporter = nodemailer.createTransport(built.options);
    this.tenantCache.set(tenantId, { transporter, fingerprint });
    return { ...built, transporter };
  }

  /** Verwirft den gecachten Transporter eines Betriebs (nach Konfig-Aenderung). */
  invalidateTenant(tenantId: string): void {
    const cached = this.tenantCache.get(tenantId);
    if (!cached) return;
    try {
      cached.transporter.close();
    } catch {
      /* best effort */
    }
    this.tenantCache.delete(tenantId);
  }

  async send(opts: MailOptions): Promise<void> {
    // 1. Betriebseigener Versand, wenn der sendende Betrieb konfiguriert ist.
    const tenant = opts.tenantId ? await this.resolveTenantTransport(opts.tenantId) : null;
    if (tenant) {
      await tenant.transporter.sendMail({
        from: tenant.from,
        to: opts.to,
        replyTo: opts.replyTo || tenant.replyTo,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        attachments: opts.attachments,
      });
      this.logger.log(
        `Mail (Betriebs-SMTP) versendet an ${MailService.maskRecipient(opts.to)} ("${opts.subject}")`,
      );
      return;
    }

    // 2. Plattform-Default (heutiges Verhalten). Ohne SMTP -> No-op-Stub.
    if (!this.transporter) {
      this.logger.debug(
        `SMTP nicht konfiguriert - Mail NICHT versendet (Stub). to=${MailService.maskRecipient(
          opts.to,
        )} subject="${opts.subject}"`,
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to: opts.to,
      replyTo: opts.replyTo,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: opts.attachments,
    });
    this.logger.log(
      `Mail versendet an ${MailService.maskRecipient(opts.to)} ("${opts.subject}")`,
    );
  }

  /**
   * Verschickt eine Test-Mail ueber die konfigurierten Betriebs-SMTP-Daten (an
   * die eigene From-Adresse) und meldet Erfolg/Fehler zurueck – NIE das Passwort.
   * Nutzt einen frischen Transporter (kein Cache), damit der Test exakt die
   * gespeicherten Daten spiegelt.
   */
  async sendTestMail(tenantId: string): Promise<{ ok: boolean; message: string }> {
    let loaded: { cfg: MailConfig; password: string | null } | null;
    try {
      loaded = await this.loadTenantConfig(tenantId);
    } catch {
      return { ok: false, message: 'Die Mail-Konfiguration konnte nicht geladen werden.' };
    }
    if (!loaded || !loaded.cfg.enabled) {
      return {
        ok: false,
        message: 'Kein eigener Mail-Versand aktiviert. Bitte SMTP-Daten hinterlegen und aktivieren.',
      };
    }
    const built = MailService.buildTenantTransport(loaded.cfg, loaded.password);
    if (!built) {
      return {
        ok: false,
        message: 'Die SMTP-Konfiguration ist unvollständig (Host und Absender prüfen).',
      };
    }
    const transporter = nodemailer.createTransport(built.options);
    try {
      await transporter.sendMail({
        from: built.from,
        to: loaded.cfg.fromEmail,
        replyTo: built.replyTo,
        subject: 'Detailly – Test-E-Mail (SMTP-Prüfung)',
        text:
          'Dies ist eine Test-E-Mail von Detailly.\n\n' +
          'Wenn Sie diese Nachricht erhalten, ist Ihr eigener Mail-Versand korrekt eingerichtet.',
      });
      this.logger.log(
        `Test-Mail (Betriebs-SMTP) versendet an ${MailService.maskRecipient(loaded.cfg.fromEmail)}`,
      );
      return { ok: true, message: `Test-E-Mail an ${loaded.cfg.fromEmail} versendet.` };
    } catch (e) {
      this.logger.warn(`Test-Mail fehlgeschlagen (tenant ${tenantId}): ${(e as Error).message}`);
      return { ok: false, message: MailService.describeSmtpError(e) };
    } finally {
      try {
        transporter.close();
      } catch {
        /* best effort */
      }
    }
  }
}
