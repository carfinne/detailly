import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { APP_VERSION } from './health.constants';

/**
 * Betriebs-Health-Endpunkte fuer Load-Balancer/Monitoring.
 *
 *  - GET /api/v1/health        Liveness: ist der Prozess erreichbar?
 *                              Antwort bewusst MINIMAL ({status, version}) –
 *                              keine Interna (Host, DB, ENV, Stacktrace), damit
 *                              der oeffentliche Endpunkt keine Recon-Flaeche bietet.
 *  - GET /api/v1/health/ready  Readiness: zusaetzlich ein trivialer DB-Ping.
 *                              DB nicht erreichbar -> 503 (LB nimmt die Instanz
 *                              aus der Rotation, statt Nutzer auf eine kaputte
 *                              Instanz zu leiten).
 *
 * KEIN Auth (public): ein Health-Check muss ohne Token pingbar sein.
 *
 * @SkipThrottle(): der globale Rate-Limiter zaehlt Health-Pings NICHT – ein
 * haeufig pingender LB darf die IP-Quote nie aufbrauchen. Zusaetzlich ist der
 * Pfad in der IP-Sperr-Middleware (main.ts, exemptPrefixes) ausgenommen, damit
 * ein Ping nie zu einer Sperre fuehrt.
 */
@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Liveness – ist der Prozess erreichbar?' })
  @ApiOkResponse({ description: 'Prozess laeuft.' })
  live(): { status: 'ok'; version: string } {
    return { status: 'ok', version: APP_VERSION };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness – Prozess + Datenbank erreichbar?' })
  @ApiOkResponse({ description: 'Prozess laeuft und die Datenbank antwortet.' })
  @ApiServiceUnavailableResponse({ description: 'Datenbank nicht erreichbar (503).' })
  async ready(): Promise<{ status: 'ready' }> {
    try {
      // Trivialer Ping – funktioniert unter Postgres UND better-sqlite3.
      await this.dataSource.query('SELECT 1');
    } catch {
      // Generisch, ohne DB-Fehlerdetails (kein Leak).
      throw new ServiceUnavailableException({ status: 'unavailable' });
    }
    return { status: 'ready' };
  }
}
