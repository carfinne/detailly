import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityEvent } from './entities/security-event.entity';
import { IpBlock } from './entities/ip-block.entity';
import { IpBlockService } from './ip-block.service';
import { SecurityEventService } from './security-event.service';
import { AuditService } from '../audit/audit.service';
import {
  SECURITY_EVENT_SEVERITY,
  SECURITY_EVENT_TYPES,
  type IpBlockSeverity,
  type SecurityEventSeverity,
  type SecurityEventType,
} from './security.constants';
import { normalizeIp } from './ip-utils';

/** Filter fuer die Ereignis-Liste (alle optional). */
export interface EventQuery {
  type?: string;
  severity?: string;
  ip?: string;
  sinceMs?: number;
  limit?: number;
  offset?: number;
}

/** Kennzahlen fuer das Betreiber-Dashboard. */
export interface SecuritySummary {
  failLogins24h: number;
  scan4xx24h: number;
  autoBlocks24h: number;
  activeBlocks: number;
  topIps: { ip: string; count: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Lese-/Aktions-Fassade fuer den Betreiber-Bereich `platform/security/*`
 * (Sentinel Teil 2). Buendelt die plattformweiten Sicherheits-Ereignisse
 * (security_events) und die IP-Sperren (ip_blocks) fuer das Dashboard und
 * kapselt die auditierten Admin-Aktionen (manuelle Sperre/Entsperrung).
 */
@Injectable()
export class PlatformSecurityService {
  constructor(
    @InjectRepository(SecurityEvent) private readonly eventRepo: Repository<SecurityEvent>,
    private readonly ipBlocks: IpBlockService,
    private readonly events: SecurityEventService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Ereignisse (lesen)
  // ---------------------------------------------------------------------------

  /**
   * Paginierte Ereignis-Liste mit Filtern. Limit hart gedeckelt (1..200, wie
   * audit.service) – ein ungedeckeltes take laedt sonst die ganze Historie.
   * Datensparsam: die Entity traegt nur emailHash (nie Klartext).
   */
  async findEvents(q: EventQuery): Promise<{ data: SecurityEvent[]; total: number }> {
    const qb = this.eventRepo.createQueryBuilder('e');
    // Nur bekannte Enum-Werte zulassen (verhindert nutzloses Filtern/Injection-Fuzz).
    if (q.type && (SECURITY_EVENT_TYPES as readonly string[]).includes(q.type)) {
      qb.andWhere('e.type = :type', { type: q.type });
    }
    if (q.severity && (SECURITY_EVENT_SEVERITY as readonly string[]).includes(q.severity)) {
      qb.andWhere('e.severity = :severity', { severity: q.severity });
    }
    if (q.ip) {
      qb.andWhere('e.ip = :ip', { ip: normalizeIp(q.ip) });
    }
    if (q.sinceMs && Number.isFinite(q.sinceMs)) {
      qb.andWhere('e.createdAt > :since', { since: new Date(q.sinceMs) });
    }
    const take = Math.min(Math.max(1, q.limit ?? 50), 200);
    const skip = Math.max(0, q.offset ?? 0);
    qb.orderBy('e.createdAt', 'DESC').take(take).skip(skip);
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  // ---------------------------------------------------------------------------
  // Summary (Kacheln)
  // ---------------------------------------------------------------------------

  async summary(now: Date = new Date()): Promise<SecuritySummary> {
    const since = new Date(now.getTime() - DAY_MS);
    const [failLogins24h, scan4xx24h, autoBlocks24h, activeBlocks, topIps] = await Promise.all([
      this.countTypesSince(['login_fail', 'mfa_fail'], since),
      this.countTypesSince(['scan_4xx'], since),
      this.countTypesSince(['ip_block'], since),
      this.ipBlocks.countActive(now),
      this.topIpsSince(since, 5),
    ]);
    return { failLogins24h, scan4xx24h, autoBlocks24h, activeBlocks, topIps };
  }

  private async countTypesSince(types: SecurityEventType[], since: Date): Promise<number> {
    return this.eventRepo
      .createQueryBuilder('e')
      .where('e.type IN (:...types)', { types })
      .andWhere('e.createdAt > :since', { since })
      .getCount();
  }

  /** Top-IPs nach Ereigniszahl seit `since` (fuer die Summary-Kachel). */
  private async topIpsSince(since: Date, limit: number): Promise<{ ip: string; count: number }[]> {
    const raw = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.ip', 'ip')
      .addSelect('COUNT(*)', 'cnt')
      .where('e.createdAt > :since', { since })
      .andWhere('e.ip IS NOT NULL')
      .groupBy('e.ip')
      .orderBy('cnt', 'DESC')
      .limit(limit)
      .getRawMany<{ ip: string; cnt: string | number }>();
    return raw.filter((r) => r.ip).map((r) => ({ ip: r.ip, count: Number(r.cnt) }));
  }

  // ---------------------------------------------------------------------------
  // Sperren (lesen + auditierte Admin-Aktionen)
  // ---------------------------------------------------------------------------

  listBlocks(nurAktive = true): Promise<IpBlock[]> {
    return this.ipBlocks.list({ nurAktive });
  }

  /**
   * Manuelle Sperre durch einen PLATFORM_ADMIN. Auditiert doppelt:
   *  - AuditService (bestehender Trail; tenantId des Admins, sonst 'platform'),
   *  - Security-Event `ip_block` (manual=true) im plattformweiten Log.
   * `durationMs` optional -> mit TTL; ohne -> dauerhafte Sperre.
   */
  async manualBlock(params: {
    ip: string;
    reason: string;
    severity?: IpBlockSeverity;
    durationMs?: number | null;
    admin: { id: string; tenantId?: string | null };
  }): Promise<IpBlock> {
    const ip = normalizeIp(params.ip);
    const expiresAt =
      params.durationMs && params.durationMs > 0 ? new Date(Date.now() + params.durationMs) : null;
    const block = await this.ipBlocks.block({
      ip,
      reason: params.reason,
      severity: params.severity ?? 'warn',
      createdBy: params.admin.id,
      expiresAt,
    });

    this.events.record({
      type: 'ip_block',
      severity: (params.severity ?? 'warn') as SecurityEventSeverity,
      ip,
      userId: params.admin.id,
      details: {
        manual: true,
        reason: params.reason,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      },
    });
    void this.audit?.log({
      tenantId: params.admin.tenantId || 'platform',
      userId: params.admin.id,
      action: 'security_ip_block',
      entityType: 'IpBlock',
      entityId: block.id,
      payload: { ip, reason: params.reason, expiresAt: expiresAt?.toISOString() ?? null },
    });
    return block;
  }

  /**
   * Manuelle Entsperrung durch einen PLATFORM_ADMIN. Auditiert (AuditService +
   * Security-Event `ip_unblock`). Gibt die aufgehobene Sperre zurueck oder null,
   * wenn keine aktive Sperre mit der id existiert.
   */
  async manualUnblock(id: string, admin: { id: string; tenantId?: string | null }): Promise<IpBlock | null> {
    const block = await this.ipBlocks.unblock(id, admin.id);
    if (!block) return null;

    this.events.record({
      type: 'ip_unblock',
      severity: 'info',
      ip: block.ip,
      userId: admin.id,
      details: { manual: true },
    });
    void this.audit?.log({
      tenantId: admin.tenantId || 'platform',
      userId: admin.id,
      action: 'security_ip_unblock',
      entityType: 'IpBlock',
      entityId: block.id,
      payload: { ip: block.ip },
    });
    return block;
  }
}
