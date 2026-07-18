import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mailer/mail.service';

/**
 * Transaktionale Sicherheits-Alarm-Mail AN DEN BETREIBER (Sentinel Teil 2).
 *
 * Bewusste Ausnahme vom Review-before-send: ein Betreiber-Sicherheitsalarm (z. B.
 * automatische IP-Sperre wegen Massen-Login) darf sofort/automatisch raus – er
 * geht NIE an einen Endkunden, sondern nur an die konfigurierte Betreiber-Adresse.
 * Alles Richtung Endkunde bleibt weiterhin Review-pflichtig (nicht hier).
 *
 * Empfaenger = ENV `SECURITY_ALERT_EMAIL`. Ist sie NICHT gesetzt (oder kein SMTP
 * konfiguriert), wird sauber uebersprungen – nie ein Crash. Der Versand ist
 * best-effort (Fehler werden nur geloggt).
 */
@Injectable()
export class SecurityAlertService {
  private readonly logger = new Logger(SecurityAlertService.name);

  constructor(
    private readonly mail: MailService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  /** Aufgeloeste Betreiber-Empfaengeradresse (ENV SECURITY_ALERT_EMAIL) oder null. */
  private recipient(): string | null {
    const raw =
      this.config?.get<string>('SECURITY_ALERT_EMAIL') ?? process.env.SECURITY_ALERT_EMAIL;
    const to = (raw ?? '').trim();
    return to.length > 0 ? to : null;
  }

  /**
   * Verschickt einen Betreiber-Alarm. Kein tenantId -> Plattform-Default-SMTP
   * (kein betriebseigener Versand). Best-effort, wirft nie.
   */
  async notifyOperator(subject: string, text: string): Promise<void> {
    const to = this.recipient();
    if (!to) {
      this.logger.debug('SECURITY_ALERT_EMAIL nicht gesetzt – Betreiber-Alarm uebersprungen.');
      return;
    }
    try {
      await this.mail.send({ to, subject: `[Detailly Security] ${subject}`, text });
      this.logger.log(`Betreiber-Sicherheitsalarm versendet: "${subject}"`);
    } catch (err) {
      this.logger.warn(`Betreiber-Sicherheitsalarm fehlgeschlagen: ${(err as Error).message}`);
    }
  }

  /** Formatierter Alarm bei automatischer IP-Sperre (severity=critical). */
  async notifyAutoBlock(params: {
    ip: string;
    reason: string;
    count: number;
    windowMs: number;
    expiresAt: Date;
  }): Promise<void> {
    const minuten = Math.round(params.windowMs / 60000);
    const text =
      'Automatische IP-Sperre durch Sentinel (Anwendungs-Level-Abwehr).\n\n' +
      `IP:        ${params.ip}\n` +
      `Grund:     ${params.reason}\n` +
      `Ereignisse:${params.count} in den letzten ${minuten} min\n` +
      `Gesperrt bis: ${params.expiresAt.toISOString()}\n\n` +
      'Diese Nachricht geht ausschliesslich an den Betreiber (kein Endkunde). ' +
      'Die Sperre ist befristet und im Betreiber-Bereich unter "Sicherheit" einsehbar/aufhebbar.\n\n' +
      'Hinweis: Volumetrische L3/L4-DDoS-Angriffe kann Sentinel NICHT abwehren – ' +
      'dafuer sind WAF/CDN/Reverse-Proxy (Betreiber-Infrastruktur) zustaendig.';
    await this.notifyOperator(`Auto-IP-Sperre ${params.ip}`, text);
  }
}
