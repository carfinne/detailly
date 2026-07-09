import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Not, Repository } from 'typeorm';
import { BookingRequest, BookingRequestStatus } from './entities/booking-request.entity';
import { IntervalScheduler } from '../common/scheduler/interval-scheduler';
import { RETENTION_DAYS } from './public-booking.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Untergrenze fuer das Job-Intervall (schuetzt vor versehentlichem Dauerlauf per ENV). */
const MIN_INTERVAL_MS = 60 * 1000;

/**
 * B3 (DSGVO-Datensparsamkeit): periodischer Retention-Job fuer Online-Terminanfragen.
 *
 * Hintergrund: Anfragen enthalten Klartext-Kontakt-PII. Der bisherige Cleanup lief
 * NUR opportunistisch beim Anlegen einer neuen Anfrage – bei geringem Volumen blieb
 * PII faktisch unbefristet liegen. Dieser Job laeuft – wie der Auto-Mahn-Job – ueber
 * den dependency-freien IntervalScheduler taeglich und loescht ALLE abgelaufenen,
 * nicht angenommenen Anfragen.
 *
 * Tenant-Isolation: BEWUSSTE, klar begrenzte Cross-Tenant-Ausnahme. Es ist ein reiner
 * Housekeeping-GC-Delete – er loescht ausschliesslich abgelaufene, nicht angenommene
 * Zeilen (jede Zeile gehoert ihrem eigenen Tenant); es werden KEINE Daten gelesen oder
 * zwischen Tenants bewegt/exponiert. Ein einzelner Delete ist damit korrekt und guenstig
 * (kein Per-Tenant-Scan noetig). Angenommene Anfragen (ANGENOMMEN) werden nie geloescht.
 */
@Injectable()
export class BookingRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingRetentionService.name);
  private readonly scheduler: IntervalScheduler;

  constructor(
    @InjectRepository(BookingRequest) private readonly repo: Repository<BookingRequest>,
  ) {
    this.scheduler = new IntervalScheduler(
      'booking-retention',
      async () => {
        await this.runRetention();
      },
      this.resolveIntervalMs(),
      this.logger,
    );
  }

  onModuleInit(): void {
    // Im Test-/CI-Kontext KEIN Hintergrund-Timer (Jest setzt NODE_ENV=test).
    // BOOKING_RETENTION_DISABLED=1 erlaubt zusaetzlich ein bewusstes Abschalten.
    if (process.env.NODE_ENV === 'test' || process.env.BOOKING_RETENTION_DISABLED === '1') return;
    this.scheduler.start();
  }

  onModuleDestroy(): void {
    this.scheduler.stop();
  }

  /** Job-Intervall aus ENV (BOOKING_RETENTION_INTERVAL_MS), Default 24h, mind. 60s. */
  private resolveIntervalMs(): number {
    const raw = Number(process.env.BOOKING_RETENTION_INTERVAL_MS);
    if (Number.isFinite(raw) && raw >= MIN_INTERVAL_MS) return raw;
    return DAY_MS;
  }

  /**
   * Loescht abgelaufene, nicht angenommene Anfragen ueber ALLE Betriebe (s. Klassen-
   * Doku: Housekeeping-GC). Direkt aufrufbar (Tests/Ops); `now` injizierbar fuer
   * deterministische Tests. Faengt Fehler ab und gibt die Anzahl geloeschter Zeilen
   * zurueck (kein Wurf – der Timer-Lauf darf nie brechen).
   */
  async runRetention(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
    try {
      const res = await this.repo.delete({
        status: Not(BookingRequestStatus.ANGENOMMEN),
        createdAt: LessThan(cutoff),
      });
      const geloescht = res.affected ?? 0;
      if (geloescht > 0) {
        this.logger.log(`Booking-Retention: ${geloescht} abgelaufene Anfrage(n) geloescht.`);
      }
      return geloescht;
    } catch (err) {
      this.logger.warn(`Booking-Retention fehlgeschlagen: ${(err as Error).message}`);
      return 0;
    }
  }
}
