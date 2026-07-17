import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { IpBlock } from './entities/ip-block.entity';
import { IntervalScheduler } from '../common/scheduler/interval-scheduler';
import { normalizeIp } from './ip-utils';
import {
  resolveIpBlockCacheTtlMs,
  type IpBlockSeverity,
} from './security.constants';

/** Ergebnis einer Sperr-Pruefung (analog LoginGuard.BlockResult). */
export interface IpBlockCheck {
  blocked: boolean;
  /** Verbleibende Sekunden bis zum Ablauf (nur bei befristeter Sperre). */
  retryAfterSec?: number;
}

/** Eingabe fuer eine neue Sperre. */
export interface BlockInput {
  ip: string;
  reason: string;
  severity?: IpBlockSeverity;
  /** 'system' (auto) ODER die PLATFORM_ADMIN-userId. */
  createdBy: string;
  /** Ablauf; NULL/undefined = dauerhaft (nur manuell zulaessig). */
  expiresAt?: Date | null;
}

const PURGE_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Verwaltet aktive IP-Sperren (Sentinel Teil 2) mit einem KURZEN In-Memory-Cache
 * ueber der DB: `isBlocked()` liest die Liste aktiver Sperren hoechstens einmal
 * pro Cache-Fenster (Default 30s) statt bei jedem Request. Je IP wird die
 * Ablaufzeit mitgecacht, sodass eine befristete Sperre auch INNERHALB des Fensters
 * sekundengenau ablaeuft (kein "haengt 30s zu lange").
 *
 * Mutationen (block/unblock) invalidieren den Cache sofort -> die naechste
 * Pruefung liest frisch (manuelle Sperren wirken unmittelbar).
 */
@Injectable()
export class IpBlockService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IpBlockService.name);
  private readonly purger: IntervalScheduler;

  /** ip -> Ablauf-ms (null = dauerhaft). Nur AKTIVE, nicht-abgelaufene Sperren. */
  private cache: Map<string, number | null> = new Map();
  private cacheLoadedAt = 0;
  private readonly cacheTtlMs: number;

  constructor(
    @InjectRepository(IpBlock)
    private readonly repo: Repository<IpBlock>,
  ) {
    this.cacheTtlMs = resolveIpBlockCacheTtlMs();
    this.purger = new IntervalScheduler(
      'ip-block-purge',
      async () => {
        await this.deactivateExpired();
      },
      PURGE_INTERVAL_MS,
      this.logger,
    );
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.IP_BLOCK_PURGE_DISABLED === '1') {
      return;
    }
    this.purger.start();
  }

  onModuleDestroy(): void {
    this.purger.stop();
  }

  /**
   * Ist die IP aktuell gesperrt? Nutzt den Cache (eine DB-Query pro Fenster).
   * Faengt DB-Fehler ab und antwortet dann NICHT blockiert (fail-open) – ein
   * DB-Hickup soll nie die gesamte App aussperren.
   */
  async isBlocked(ip: string | undefined | null, now: number = Date.now()): Promise<IpBlockCheck> {
    const norm = normalizeIp(ip);
    if (!norm) return { blocked: false };
    try {
      await this.ensureCache(now);
    } catch (err) {
      this.logger.warn(`IP-Sperr-Cache nicht ladbar (fail-open): ${(err as Error).message}`);
      return { blocked: false };
    }
    const exp = this.cache.get(norm);
    if (exp === undefined) return { blocked: false };
    if (exp === null) return { blocked: true }; // dauerhaft
    if (exp > now) return { blocked: true, retryAfterSec: Math.ceil((exp - now) / 1000) };
    return { blocked: false }; // befristet + abgelaufen (innerhalb des Fensters)
  }

  /** Schnelle De-Dup-Pruefung ohne retryAfter (fuer ThreatDetection). */
  async hasActiveBlock(ip: string, now: number = Date.now()): Promise<boolean> {
    return (await this.isBlocked(ip, now)).blocked;
  }

  /**
   * Setzt eine Sperre. `expiresAt=null` (dauerhaft) ist nur fuer manuelle Sperren
   * gedacht; der Aufrufer (ThreatDetection) setzt bei Auto-Sperren immer eine TTL.
   * Invalidiert den Cache -> die Sperre wirkt sofort.
   */
  async block(input: BlockInput): Promise<IpBlock> {
    const ip = normalizeIp(input.ip);
    const entity = this.repo.create({
      ip,
      reason: input.reason,
      severity: input.severity ?? 'warn',
      createdBy: input.createdBy,
      expiresAt: input.expiresAt ?? null,
      active: true,
      releasedAt: null,
      releasedBy: null,
    });
    const saved = await this.repo.save(entity);
    this.invalidate();
    return saved;
  }

  /**
   * Hebt eine Sperre auf (setzt active=false + releasedAt/releasedBy, ohne die
   * Zeile zu loeschen -> Historie). Gibt die aktualisierte Sperre zurueck oder
   * null, wenn keine aktive Sperre mit der id existiert.
   */
  async unblock(id: string, releasedBy: string, now: Date = new Date()): Promise<IpBlock | null> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row || !row.active) return null;
    row.active = false;
    row.releasedAt = now;
    row.releasedBy = releasedBy;
    const saved = await this.repo.save(row);
    this.invalidate();
    return saved;
  }

  /**
   * Listet Sperren (fuers Betreiber-Dashboard). `nurAktive` (Default true) filtert
   * abgelaufene/aufgehobene heraus. Hart gedeckelt (Denial-of-Service ueber ?limit).
   */
  async list(opts: { nurAktive?: boolean; limit?: number } = {}): Promise<IpBlock[]> {
    const take = Math.min(Math.max(1, opts.limit ?? 100), 500);
    const where = opts.nurAktive === false ? {} : { active: true };
    return this.repo.find({ where, order: { createdAt: 'DESC' }, take });
  }

  /** Anzahl aktuell aktiver (nicht abgelaufener) Sperren – fuer die Summary-Kachel. */
  async countActive(now: Date = new Date()): Promise<number> {
    // active=true UND (expiresAt IS NULL ODER expiresAt > now).
    const permanent = await this.repo.count({ where: { active: true, expiresAt: IsNull() } });
    const befristet = await this.repo.count({
      where: { active: true, expiresAt: Not(LessThanOrEqual(now)) },
    });
    // `Not(LessThanOrEqual(now))` schliesst NULL in TypeORM aus -> beide Zaehler
    // sind disjunkt und duerfen summiert werden.
    return permanent + befristet;
  }

  /**
   * Deaktiviert abgelaufene Sperren (active=true, expiresAt <= now) – vom Purge-
   * Timer und direkt (Tests/Ops) aufrufbar. Gibt die Anzahl zurueck.
   */
  async deactivateExpired(now: Date = new Date()): Promise<number> {
    try {
      const res = await this.repo.update(
        { active: true, expiresAt: LessThanOrEqual(now) },
        { active: false, releasedAt: now, releasedBy: 'system' },
      );
      const n = res.affected ?? 0;
      if (n > 0) this.invalidate();
      return n;
    } catch (err) {
      this.logger.warn(`IP-Sperr-Purge fehlgeschlagen: ${(err as Error).message}`);
      return 0;
    }
  }

  /** Nur fuer Tests: Cache leeren (erzwingt Reload). */
  invalidate(): void {
    this.cacheLoadedAt = 0;
  }

  // ---------------------------------------------------------------------------
  // intern
  // ---------------------------------------------------------------------------

  private async ensureCache(now: number): Promise<void> {
    if (this.cacheLoadedAt !== 0 && now - this.cacheLoadedAt < this.cacheTtlMs) return;
    await this.reload(now);
  }

  /** EIN DB-Read der aktiven Sperren -> Map ip->Ablauf. Abgelaufene fliegen raus. */
  private async reload(now: number): Promise<void> {
    const rows = await this.repo.find({
      where: { active: true },
      select: ['ip', 'expiresAt'],
    });
    const m = new Map<string, number | null>();
    for (const r of rows) {
      const exp = r.expiresAt ? new Date(r.expiresAt).getTime() : null;
      if (exp !== null && exp <= now) continue; // bereits abgelaufen
      const prev = m.get(r.ip);
      if (prev === null) continue; // schon dauerhaft gesperrt -> nichts strengeres
      if (exp === null) m.set(r.ip, null); // dauerhaft ueberschreibt befristet
      else m.set(r.ip, Math.max(prev ?? 0, exp)); // laengste befristete Sperre gewinnt
    }
    this.cache = m;
    this.cacheLoadedAt = now;
  }
}
