import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { SecurityEvent } from './entities/security-event.entity';
import { IntervalScheduler } from '../common/scheduler/interval-scheduler';
import {
  SECURITY_EVENT_PURGE_INTERVAL_MS_DEFAULT,
  SECURITY_EVENT_PURGE_INTERVAL_MS_MIN,
  SECURITY_EVENT_TTL_DAYS_DEFAULT,
  type SecurityEventSeverity,
  type SecurityEventType,
} from './security.constants';

/** Eingabe fuer ein Security-Event. `email` wird intern gehasht (nie gespeichert). */
export interface SecurityEventInput {
  type: SecurityEventType;
  severity?: SecurityEventSeverity;
  ip?: string | null;
  /** Klartext-E-Mail (wird intern zu emailHash; NIE persistiert). */
  email?: string | null;
  /** Bereits vorberechneter Hash (Alternative zu `email`). */
  emailHash?: string | null;
  userId?: string | null;
  tenantId?: string | null;
  details?: Record<string, unknown> | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Schreibt Sicherheits-Ereignisse (fire-and-forget, Muster audit.service) und
 * loescht sie nach Ablauf der Aufbewahrungsfrist automatisch (dependency-freier
 * IntervalScheduler, kein @nestjs/schedule).
 */
@Injectable()
export class SecurityEventService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SecurityEventService.name);
  private readonly purger: IntervalScheduler;

  constructor(
    @InjectRepository(SecurityEvent)
    private readonly repo: Repository<SecurityEvent>,
  ) {
    this.purger = new IntervalScheduler(
      'security-event-purge',
      async () => {
        await this.purgeExpired();
      },
      this.resolvePurgeIntervalMs(),
      this.logger,
    );
  }

  onModuleInit(): void {
    // Im Test-/CI-Kontext AUS (deterministische Tests, keine Timer); zusaetzlich
    // per SECURITY_EVENT_PURGE_DISABLED=1 abschaltbar (wie IncidentDetection).
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.SECURITY_EVENT_PURGE_DISABLED === '1'
    ) {
      return;
    }
    this.purger.start();
  }

  onModuleDestroy(): void {
    this.purger.stop();
  }

  /**
   * Protokolliert ein Security-Event. FIRE-AND-FORGET: darf den aufrufenden
   * Request (Login/MFA) NIE blockieren oder werfen. Der eigentliche DB-Write
   * laeuft ohne await; jeder Fehler (inkl. Fehler beim Aufbau der Entity) wird
   * gefangen und nur geloggt.
   */
  record(input: SecurityEventInput): void {
    try {
      const emailHash =
        input.emailHash ??
        (input.email ? this.hashEmail(input.email) : null);
      const entity = this.repo.create({
        type: input.type,
        severity: input.severity ?? 'info',
        ip: this.normalizeIp(input.ip),
        emailHash,
        userId: input.userId ?? null,
        tenantId: input.tenantId ?? null,
        details: input.details ?? null,
      });
      void this.repo
        .save(entity)
        .catch((err) =>
          this.logger.warn(`Security-Event fehlgeschlagen: ${(err as Error).message}`),
        );
    } catch (err) {
      // Selbst ein synchroner Fehler (z. B. create()) darf den Login nicht stoeren.
      this.logger.warn(`Security-Event verworfen: ${(err as Error).message}`);
    }
  }

  /** SHA-256-Hex der normalisierten E-Mail (nur der Hash wird je gespeichert). */
  private hashEmail(email: string): string {
    return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  }

  /** Leert IPv4-mapped-IPv6-Praefix; NULL bleibt NULL. */
  private normalizeIp(ip?: string | null): string | null {
    if (!ip) return null;
    const s = ip.trim();
    return s.startsWith('::ffff:') ? s.slice(7) : s;
  }

  /** Aufbewahrung in Tagen (ENV: SECURITY_EVENT_TTL_DAYS, min 1). */
  private resolveTtlDays(): number {
    const raw = Number(process.env.SECURITY_EVENT_TTL_DAYS);
    if (Number.isFinite(raw) && raw >= 1) return raw;
    return SECURITY_EVENT_TTL_DAYS_DEFAULT;
  }

  /** Purge-Intervall (ENV: SECURITY_EVENT_PURGE_INTERVAL_MS), Default 6h, min 1h. */
  private resolvePurgeIntervalMs(): number {
    const raw = Number(process.env.SECURITY_EVENT_PURGE_INTERVAL_MS);
    if (Number.isFinite(raw) && raw >= SECURITY_EVENT_PURGE_INTERVAL_MS_MIN) return raw;
    return SECURITY_EVENT_PURGE_INTERVAL_MS_DEFAULT;
  }

  /**
   * Loescht Events aelter als die Aufbewahrungsfrist (Datenminimierung, Art. 5
   * Abs. 1 lit. e DSGVO). Direkt aufrufbar (Tests/Ops); gibt die Anzahl
   * geloeschter Zeilen zurueck und faengt Fehler ab (der Timer-Lauf bricht nie).
   */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    try {
      const cutoff = new Date(now.getTime() - this.resolveTtlDays() * DAY_MS);
      const res = await this.repo.delete({ createdAt: LessThan(cutoff) });
      return res.affected ?? 0;
    } catch (err) {
      this.logger.warn(`Security-Event-Purge fehlgeschlagen: ${(err as Error).message}`);
      return 0;
    }
  }
}
