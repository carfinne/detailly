import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Globaler Exception-Filter (FIX 6).
 *
 * Ziel: KEINE Stacktraces / internen Details an den Client leaken und ein
 * EINHEITLICHES Fehlerformat liefern – ohne das bestehende NestJS-Format zu
 * brechen, auf das sich das Frontend verlaesst.
 *
 * Verhalten:
 * - `HttpException` (z.B. NotFound, Forbidden, BadRequest, das vom
 *   SubscriptionGuard geworfene `{ code: 'SUBSCRIPTION_INACTIVE', message }`):
 *   Body UNVERAENDERT durchreichen. Das Frontend (frontend/src/lib/api.ts)
 *   liest `body.code` und `body.message` und steuert daraus den 401-Redirect
 *   und die Abo-Sperrseite – dieses Format MUSS erhalten bleiben.
 * - Alles andere (unbehandelte Fehler): generische 500-Antwort
 *   `{ statusCode, message: 'Interner Serverfehler' }`. Der echte Fehler inkl.
 *   Stacktrace wird NUR serverseitig geloggt, nie an den Client gesendet.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Bekannte HttpExceptions: Status + Body unveraendert durchreichen.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(body);
      return;
    }

    // Unbehandelter Fehler -> serverseitig vollstaendig loggen ...
    const message = exception instanceof Error ? exception.stack ?? exception.message : String(exception);
    this.logger.error(
      `Unbehandelte Ausnahme bei ${request?.method} ${request?.url}: ${message}`,
    );

    // ... aber dem Client nur eine generische 500 zeigen (kein Detail-Leak).
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Interner Serverfehler',
    });
  }
}
