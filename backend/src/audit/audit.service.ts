import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditEntry {
  tenantId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /** Protokolliert einen Schreibvorgang. Fehler hier duerfen den Hauptvorgang nie blockieren. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.repo.save(this.repo.create(entry));
    } catch (err) {
      this.logger.warn(`Audit-Log fehlgeschlagen: ${(err as Error).message}`);
    }
  }

  async findAll(
    tenantId: string,
    options: { entityType?: string; limit?: number; offset?: number } = {},
  ): Promise<{ data: AuditLog[]; total: number }> {
    const where: Record<string, unknown> = { tenantId };
    if (options.entityType) where.entityType = options.entityType;
    // Limit hart deckeln (1..200) – ein ungedeckeltes take laedt sonst die
    // komplette Audit-Historie in den Speicher (Denial-of-Service ueber ?limit=).
    const take = Math.min(Math.max(1, options.limit ?? 50), 200);
    const skip = Math.max(0, options.offset ?? 0);
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
    return { data, total };
  }
}
