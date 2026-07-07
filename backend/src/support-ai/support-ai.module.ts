import { Module } from '@nestjs/common';
import { SupportAiController } from './support-ai.controller';
import { SupportAiService } from './support-ai.service';

/**
 * Interner Detailly-Support-Assistent. ConfigModule ist global
 * (isGlobal: true in app.module) -> ConfigService steht ohne Extra-Import
 * bereit. Keine Entities/DB -> reines HTTP-gegen-Anthropic-Modul.
 */
@Module({
  controllers: [SupportAiController],
  providers: [SupportAiService],
})
export class SupportAiModule {}
