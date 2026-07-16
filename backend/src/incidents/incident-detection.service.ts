import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { IntervalScheduler } from '../common/scheduler/interval-scheduler';
import { IncidentsService } from './incidents.service';
import {
  DETECTION,
  EXPORT_ACTIONS,
  FORBIDDEN_ACTION,
  LOGIN_FAILED_ACTION,
  TENANT_EXPORT_ACTION,
  type IncidentSignalTyp,
} from './incident.constants';

interface TenantCount {
  tenantId: string;
  cnt: number;
}

/**
 * Periodischer Auswerter der Erkennungssignale (Teil A). Liest AUSSCHLIESSLICH
 * den bestehenden Audit-Stream (kein Hot-Path-Hook) und legt bei Schwellwert-
 * Ueberschreitung einen Auto-Vorfall an (mit De-Duplizierung je tenant+signal).
 *
 * Laeuft wie die Retention-Jobs ueber den dependency-freien IntervalScheduler
 * (kein @nestjs/schedule). Im Test-/CI-Kontext AUS; zusaetzlich per
 * DATENPANNE_DETECTION_DISABLED=1 abschaltbar. Es wird NICHTS verschickt –
 * der erzeugte Vorfall ist ein Register-Eintrag zur menschlichen Pruefung.
 */
@Injectable()
export class IncidentDetectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IncidentDetectionService.name);
  private readonly scheduler: IntervalScheduler;

  constructor(
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    private readonly incidents: IncidentsService,
  ) {
    this.scheduler = new IntervalScheduler(
      'datenpanne-detection',
      async () => {
        await this.runDetection();
      },
      this.resolveIntervalMs(),
      this.logger,
    );
  }

  onModuleInit(): void {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.DATENPANNE_DETECTION_DISABLED === '1'
    ) {
      return;
    }
    this.scheduler.start();
  }

  onModuleDestroy(): void {
    this.scheduler.stop();
  }

  /** Intervall aus ENV (DATENPANNE_DETECTION_INTERVAL_MS), Default 15min, min 60s. */
  private resolveIntervalMs(): number {
    const raw = Number(process.env.DATENPANNE_DETECTION_INTERVAL_MS);
    if (Number.isFinite(raw) && raw >= DETECTION.intervalMsMin) return raw;
    return DETECTION.intervalMsDefault;
  }

  /**
   * Fuehrt alle drei Signal-Auswertungen aus. Direkt aufrufbar (Tests/Ops); `now`
   * injizierbar. Faengt Fehler ab und gibt die Anzahl NEU angelegter Vorfaelle
   * zurueck (der Timer-Lauf darf nie brechen).
   */
  async runDetection(now: Date = new Date()): Promise<number> {
    try {
      let neu = 0;
      neu += await this.checkExportSpike(now);
      neu += await this.checkLoginBruteforce(now);
      neu += await this.checkForbiddenSpike(now);
      return neu;
    } catch (err) {
      this.logger.warn(`Erkennungslauf fehlgeschlagen: ${(err as Error).message}`);
      return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Signal 1 – Export-Spike (> 10 Exporte/Std ODER > 3 Voll-Exporte/Std)
  // ---------------------------------------------------------------------------
  private async checkExportSpike(now: Date): Promise<number> {
    const since = new Date(now.getTime() - DETECTION.export.windowMs);
    const gesamt = await this.countByTenant([...EXPORT_ACTIONS], since);
    const voll = await this.countByTenant([TENANT_EXPORT_ACTION], since);
    const vollMap = new Map(voll.map((v) => [v.tenantId, v.cnt]));

    let neu = 0;
    for (const row of gesamt) {
      const vollCnt = vollMap.get(row.tenantId) ?? 0;
      const ueber = row.cnt > DETECTION.export.schwelle;
      const ueberVoll = vollCnt > DETECTION.export.vollSchwelle;
      if (!ueber && !ueberVoll) continue;
      // Die dokumentierte Zahl muss der Ausloesegrund sein: beim Voll-Export-Trigger
      // der Voll-Export-Count (vollCnt), sonst der Gesamt-Count (row.cnt).
      const beobachtet = ueberVoll ? vollCnt : row.cnt;
      const detail = ueberVoll
        ? `${vollCnt} Gesamtdaten-Exporte in der letzten Stunde`
        : `${row.cnt} Datenexporte in der letzten Stunde`;
      neu += await this.raise(row.tenantId, 'export_spike', beobachtet, detail, now);
    }
    return neu;
  }

  // ---------------------------------------------------------------------------
  // Signal 2 – Login-Brute-Force (Schwelle s. DETECTION.login; einzel-IP-fest)
  // ---------------------------------------------------------------------------
  private async checkLoginBruteforce(now: Date): Promise<number> {
    const since = new Date(now.getTime() - DETECTION.login.windowMs);
    const rows = await this.countByTenant([LOGIN_FAILED_ACTION], since);
    let neu = 0;
    for (const row of rows) {
      if (row.cnt < DETECTION.login.schwelle) continue;
      neu += await this.raise(
        row.tenantId,
        'login_bruteforce',
        row.cnt,
        `${row.cnt} fehlgeschlagene Anmeldungen in 15 Minuten`,
        now,
      );
    }
    return neu;
  }

  // ---------------------------------------------------------------------------
  // Signal 3 – Rollen-403-Haeufung (>= 15/Std). Nur `forbidden_access` (echte
  // Rollen-Verweigerung); Abo-/Tarif-403 zaehlen bewusst NICHT (Fehlalarm-Schutz).
  // ---------------------------------------------------------------------------
  private async checkForbiddenSpike(now: Date): Promise<number> {
    const since = new Date(now.getTime() - DETECTION.forbidden.windowMs);
    const rows = await this.countByTenant([FORBIDDEN_ACTION], since);
    let neu = 0;
    for (const row of rows) {
      if (row.cnt < DETECTION.forbidden.schwelle) continue;
      neu += await this.raise(
        row.tenantId,
        'forbidden_spike',
        row.cnt,
        `${row.cnt} unberechtigte Zugriffsversuche (403) in der letzten Stunde`,
        now,
      );
    }
    return neu;
  }

  // ---------------------------------------------------------------------------
  // Helfer
  // ---------------------------------------------------------------------------

  /** Zaehlt Audit-Eintraege der genannten Actions je (nicht-leerem) tenantId ab `since`. */
  private async countByTenant(actions: string[], since: Date): Promise<TenantCount[]> {
    const raw = await this.auditRepo
      .createQueryBuilder('a')
      .select('a.tenantId', 'tenantId')
      .addSelect('COUNT(*)', 'cnt')
      .where('a.action IN (:...actions)', { actions })
      .andWhere('a.createdAt > :since', { since })
      .andWhere('a.tenantId IS NOT NULL')
      .groupBy('a.tenantId')
      .getRawMany<{ tenantId: string; cnt: string | number }>();
    return raw
      .filter((r) => r.tenantId)
      .map((r) => ({ tenantId: r.tenantId, cnt: Number(r.cnt) }));
  }

  private async raise(
    tenantId: string,
    signalTyp: IncidentSignalTyp,
    beobachtet: number,
    detail: string,
    now: Date,
  ): Promise<number> {
    const { created } = await this.incidents.upsertAutoIncident({
      tenantId,
      signalTyp,
      beobachtet,
      detail,
      now,
    });
    return created ? 1 : 0;
  }
}
