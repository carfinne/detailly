import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SupportAiService } from './support-ai.service';
import { AskSupportDto } from './dto/support-ai.dto';

/**
 * Interner Support-Assistent (nur fuer eingeloggte Mitarbeiter des Betriebs).
 *
 * - @UseGuards(JwtAuthGuard): KEIN Endkunden-/oeffentlicher Zugang.
 * - @Throttle: LLM-Aufrufe sind teuer -> eng begrenzt gegen Missbrauch.
 * - Bewusst KEINE Tenant-Daten im Prompt: der Assistent erklaert nur die
 *   Bedienung, er liest keine Kunden-/Auftragsdaten. Damit ist die
 *   Mandantentrennung unberuehrt (dieser Endpoint beruehrt die DB nicht).
 */
@ApiTags('support-ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('support-ai')
export class SupportAiController {
  constructor(private readonly service: SupportAiService) {}

  @Post('ask')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Frage an den internen Detailly-Support-Assistenten stellen' })
  async ask(@Body() dto: AskSupportDto): Promise<{ answer: string }> {
    const answer = await this.service.ask(dto);
    return { answer };
  }
}
