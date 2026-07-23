import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AffiliateService } from './affiliate.service';

/**
 * Betreiber-Sicht des Empfehlungsprogramms (Detailly-Plattform, read-only): wer
 * hat wen geworben (Betriebsnamen, Datum, Status) inkl. Gutschrift-Anwartschaften.
 * Strikt auf Plattform-Rollen begrenzt (RolesGuard) – KEIN SubscriptionGuard
 * (plattform-intern). platform_admin wird generisch durchgelassen; Analyst/Support
 * duerfen ebenfalls lesen (nur Lesen, keine Schreibpfade).
 */
@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_ANALYST, UserRole.PLATFORM_SUPPORT)
@Controller('platform/referrals')
export class PlatformAffiliateController {
  constructor(private readonly service: AffiliateService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Werbungen (Werber -> Geworbener, Status, Anwartschaft). Read-only.' })
  list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.service.listForPlatform({ limit, offset });
  }
}
