import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityEvent } from './entities/security-event.entity';
import { IpBlockService } from './ip-block.service';
import { SecurityEventService } from './security-event.service';
import { SecurityAlertService } from './security-alert.service';
import { LoginAttemptStore } from './login-attempt.store';
import { IntervalScheduler } from '../common/scheduler/interval-scheduler';
import {
  IP_BLOCK_REASON,
  resolveThreatConfig,
  type ThreatConfig,
} from './security.constants';

interface IpCount {
  ip: string;
  cnt: number;
}

/**
 * Periodischer Auswerter der Sicherheits-Ereignisse (Sentinel Teil 2). Liest den
 * bestehenden `security_events`-Strom (kein Hot-Path-Hook) und setzt bei
 * Ueberschreiten der ENV-konfigurierbaren Schwellen eine BEFRISTETE, automatische
 * IP-Sperre (createdBy='system', expiresAt = now + TTL).
 *
 * Zwei Signale je IP im Zeitfenster:
 *  - login_fail + mfa_fail  -> Credential-Attacke  (severity critical, Alarm-Mail)
 *  - scan_4xx (401/403/404) -> Scan/Probing        (severity warn)
 *
 * De-Duplizierung: eine IP mit bereits AKTIVER Sperre wird nicht erneut gesperrt
 * (kein Sekundentakt-Neusetzen). Laeuft wie die Retention-/Erkennungs-Jobs ueber
 * den dependency-freien IntervalScheduler (kein @nestjs/schedule). Im Test-/CI-
 * Kontext AUS; zusaetzlich per SENTINEL_THREAT_DISABLED=1 abschaltbar.
 */
@Injectable()
export class ThreatDetectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ThreatDetectionService.name);
  private readonly scheduler: IntervalScheduler;
  private readonly config: ThreatConfig;

  constructor(
    @InjectRepository(SecurityEvent) private readonly eventRepo: Repository<SecurityEvent>,
    private readonly blocks: IpBlockService,
    private readonly events: SecurityEventService,
    @Optional() private readonly alerts?: SecurityAlertService,
    // Sentinel Teil 1: an DIESEN bestehenden periodischen Lauf haengt sich das
    // Aufraeumen der abgelaufenen Login-Zaehler (kein zweiter Timer). @Optional +
    // ans Ende gestellt -> die positionsbasierte Test-Konstruktion bleibt gueltig.
    @Optional() private readonly loginAttempts?: LoginAttemptStore,
  ) {
    this.config = resolveThreatConfig();
    this.scheduler = new IntervalScheduler(
      'sentinel-threat-detection',
      async () => {
        await this.runDetection();
      },
      this.config.intervalMs,
      this.logger,
    );
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.SENTINEL_THREAT_DISABLED === '1') {
      return;
    }
    this.scheduler.start();
  }

  onModuleDestroy(): void {
    this.scheduler.stop();
  }

  /**
   * Fuehrt beide Signal-Auswertungen aus. Direkt aufrufbar (Tests/Ops); `now`
   * injizierbar. Faengt Fehler ab und gibt die Anzahl NEU gesetzter Sperren
   * zurueck (der Timer-Lauf darf nie brechen).
   */
  async runDetection(now: Date = new Date()): Promise<number> {
    try {
      let neu = 0;
      neu += await this.checkLoginFlood(now);
      neu += await this.checkScanFlood(now);
      // Sentinel Teil 1: abgelaufene Login-Fehlversuchs-Zaehler aufraeumen (haengt
      // an diesem Lauf statt an einem eigenen Timer). Eigene Fehlerabsicherung im
      // Store -> wirft nie; zaehlt NICHT in die zurueckgegebene Sperren-Anzahl.
      await this.loginAttempts?.purgeExpired(now.getTime());
      return neu;
    } catch (err) {
      this.logger.warn(`Sentinel-Erkennungslauf fehlgeschlagen: ${(err as Error).message}`);
      return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Signal 1 – Fehl-Login-/2FA-Flut je IP -> critical-Sperre + Betreiber-Alarm
  // ---------------------------------------------------------------------------
  private async checkLoginFlood(now: Date): Promise<number> {
    const since = new Date(now.getTime() - this.config.loginFail.windowMs);
    const rows = await this.countByIp(['login_fail', 'mfa_fail'], since);
    let neu = 0;
    for (const row of rows) {
      if (row.cnt < this.config.loginFail.schwelle) continue;
      neu += await this.autoBlock({
        ip: row.ip,
        count: row.cnt,
        windowMs: this.config.loginFail.windowMs,
        reason: IP_BLOCK_REASON.loginFlood,
        severity: 'critical',
        now,
        alert: true,
      });
    }
    return neu;
  }

  // ---------------------------------------------------------------------------
  // Signal 2 – 4xx-Scan-Serie je IP -> warn-Sperre
  // ---------------------------------------------------------------------------
  private async checkScanFlood(now: Date): Promise<number> {
    const since = new Date(now.getTime() - this.config.scan4xx.windowMs);
    const rows = await this.countByIp(['scan_4xx'], since);
    let neu = 0;
    for (const row of rows) {
      if (row.cnt < this.config.scan4xx.schwelle) continue;
      neu += await this.autoBlock({
        ip: row.ip,
        count: row.cnt,
        windowMs: this.config.scan4xx.windowMs,
        reason: IP_BLOCK_REASON.scanFlood,
        severity: 'warn',
        now,
        alert: false,
      });
    }
    return neu;
  }

  // ---------------------------------------------------------------------------
  // Helfer
  // ---------------------------------------------------------------------------

  /**
   * Setzt eine automatische, befristete Sperre – mit De-Dup (bereits aktive Sperre
   * -> nichts tun). Protokolliert ein `ip_block`-Security-Event und schickt bei
   * `alert` den transaktionalen Betreiber-Alarm. Gibt 1 zurueck, wenn NEU gesperrt.
   */
  private async autoBlock(params: {
    ip: string;
    count: number;
    windowMs: number;
    reason: string;
    severity: 'warn' | 'critical';
    now: Date;
    alert: boolean;
  }): Promise<number> {
    const nowMs = params.now.getTime();
    // De-Dup: bereits aktiv gesperrt -> nicht erneut sperren.
    if (await this.blocks.hasActiveBlock(params.ip, nowMs)) return 0;

    const expiresAt = new Date(nowMs + this.config.blockTtlMs);
    await this.blocks.block({
      ip: params.ip,
      reason: params.reason,
      severity: params.severity,
      createdBy: 'system',
      expiresAt,
    });

    // Sperr-Audit im Security-Event-Log (nicht-sensibler Kontext, keine PII/Body).
    this.events.record({
      type: 'ip_block',
      severity: params.severity,
      ip: params.ip,
      details: {
        auto: true,
        reason: params.reason,
        count: params.count,
        windowMs: params.windowMs,
        expiresAt: expiresAt.toISOString(),
      },
    });

    if (params.alert && this.alerts) {
      // Transaktionaler Betreiber-Alarm (kein Review-Gate) – best-effort.
      void this.alerts.notifyAutoBlock({
        ip: params.ip,
        reason: params.reason,
        count: params.count,
        windowMs: params.windowMs,
        expiresAt,
      });
    }
    this.logger.warn(
      `Auto-IP-Sperre: ${params.ip} (${params.reason}, ${params.count} Ereignisse) bis ${expiresAt.toISOString()}`,
    );
    return 1;
  }

  /** Zaehlt Events der genannten Typen je (nicht-leerer) IP ab `since`. */
  private async countByIp(types: string[], since: Date): Promise<IpCount[]> {
    const raw = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.ip', 'ip')
      .addSelect('COUNT(*)', 'cnt')
      .where('e.type IN (:...types)', { types })
      .andWhere('e.createdAt > :since', { since })
      .andWhere('e.ip IS NOT NULL')
      .groupBy('e.ip')
      .getRawMany<{ ip: string; cnt: string | number }>();
    return raw
      .filter((r) => r.ip)
      .map((r) => ({ ip: r.ip, cnt: Number(r.cnt) }));
  }
}
