import { Module } from '@nestjs/common';
import { SupportAiController } from './support-ai.controller';
import { SupportAiService } from './support-ai.service';
import { TenantAiRateLimiter } from './tenant-rate-limiter';

/**
 * Interner Detailly-Support-Assistent. ConfigModule ist global
 * (isGlobal: true in app.module) -> ConfigService steht ohne Extra-Import
 * bereit. Keine Entities/DB -> reines HTTP-gegen-Anthropic-Modul.
 *
 * TenantAiRateLimiter ist ein Provider (Nest-Singleton) -> der In-Memory-
 * Mandanten-Zaehler ueberlebt zwischen Requests, aber nicht ueber Neustarts.
 */
@Module({
  controllers: [SupportAiController],
  providers: [SupportAiService, TenantAiRateLimiter],
})
export class SupportAiModule {}
