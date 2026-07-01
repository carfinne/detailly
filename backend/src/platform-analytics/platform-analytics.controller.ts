import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { PlatformAnalyticsService } from './platform-analytics.service';

/**
 * Plattform-Auswertung (betriebsuebergreifend) – NUR fuer Detailly-Plattform-
 * Rollen. KEIN SubscriptionGuard (Plattform-intern, nicht an ein Kunden-Abo
 * gebunden). RolesGuard begrenzt strikt auf Plattform-Rollen; platform_admin
 * wird ohnehin vom Guard durchgelassen.
 */
@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_ANALYST, UserRole.PLATFORM_SUPPORT)
@Controller('platform/analytics')
export class PlatformAnalyticsController {
  constructor(private readonly service: PlatformAnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'Plattform-Kennzahlen ueber alle Betriebe (Abos/MRR, Wachstum, Nutzung, Aktivitaet)' })
  overview() {
    return this.service.overview();
  }
}
