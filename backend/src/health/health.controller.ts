import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  APP_VERSION,
  READY_DB_TIMEOUT_MS,
  READY_THROTTLE_LIMIT,
  READY_THROTTLE_TTL_MS,
} from './health.constants';

/** Interner Marker: der DB-Ping hat das Zeitlimit gerissen (Netz-Blackhole). */
class ReadyTimeoutError extends Error {}

/**
 * Betriebs-Health-Endpunkte fuer Load-Balancer/Monitoring.
 *
 *  - GET /api/v1/health        Liveness: ist der Prozess erreichbar? KEIN DB-
 *                              Zugriff. Antwort bewusst MINIMAL ({status, version})
 *                              – keine Interna (Host, DB, ENV, Stacktrace), damit
 *                              der oeffentliche Endpunkt keine Recon-Flaeche bietet.
 *  - GET /api/v1/health/ready  Readiness: zusaetzlich ein trivialer DB-Ping (mit
 *                              Timeout). DB nicht erreichbar -> 503 (LB nimmt die
 *                              Instanz aus der Rotation).
 *
 * KEIN Auth (public): ein Health-Check muss ohne Token pingbar sein. Beide Pfade
 * sind in der IP-Sperr-Middleware (main.ts, exemptPrefixes) ausgenommen -> ein
 * LB-Ping fuehrt nie zu einer Sperre.
 *
 * Throttle-Politik (bewusst pro Route unterschiedlich):
 *  - Liveness: `@SkipThrottle` – kein DB-Zugriff, darf beliebig oft gepingt werden.
 *  - Readiness: eigener, grosszuegiger Rate-Limit (READY_THROTTLE_*), weil jeder
 *    Request die DB anfasst -> nicht voellig ungedrosselt lassen (Pool-Druck).
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: 'Liveness – ist der Prozess erreichbar?' })
  @ApiOkResponse({ description: 'Prozess laeuft.' })
  live(): { status: 'ok'; version: string } {
    return { status: 'ok', version: APP_VERSION };
  }

  @Get('ready')
  @Throttle({ default: { limit: READY_THROTTLE_LIMIT, ttl: READY_THROTTLE_TTL_MS } })
  @ApiOperation({ summary: 'Readiness – Prozess + Datenbank erreichbar?' })
  @ApiOkResponse({ description: 'Prozess laeuft und die Datenbank antwortet.' })
  @ApiServiceUnavailableResponse({ description: 'Datenbank nicht erreichbar (503).' })
  async ready(): Promise<{ status: 'ready' }> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Trivialer Ping – funktioniert unter Postgres UND better-sqlite3. Gegen
      // einen Netz-Blackhole (DB antwortet nie) mit Zeitlimit abgesichert: sonst
      // wuerde ready() haengen statt schnell 503 zu liefern.
      const ping = this.dataSource.query('SELECT 1');
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ReadyTimeoutError()), READY_DB_TIMEOUT_MS);
      });
      // Promise.race haengt an `ping` bereits einen Handler an -> selbst wenn das
      // Timeout gewinnt und `ping` erst spaeter ablehnt, gibt es keine
      // unhandledRejection.
      await Promise.race([ping, timeout]);
    } catch (err) {
      if (err instanceof ReadyTimeoutError) {
        // DB antwortet nicht rechtzeitig -> schnell 503, ohne zu haengen.
        throw new ServiceUnavailableException({ status: 'not-ready' });
      }
      // DB erreichbar, aber Query-Fehler -> ebenfalls 503, ohne Detail-Leak.
      throw new ServiceUnavailableException({ status: 'unavailable' });
    } finally {
      if (timer) clearTimeout(timer);
    }
    return { status: 'ready' };
  }
}
