import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequiresFeature } from '../common/decorators/requires-feature.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ReportsService } from './reports.service';

/**
 * Betriebswirtschaftliche Auswertungen (Berichte). NUR Leitung – enthaelt
 * Umsatz-/Kundendaten ueber die ganze Werkstatt. Zusaetzlich hinter dem
 * Tarif-Feature 'auswertungen' (Basic/Pro); das Basis-Dashboard bleibt in jeder
 * Stufe frei. Guard-Reihenfolge: Jwt -> Subscription -> PlanFeature -> Roles.
 */
@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, PlanFeatureGuard, RolesGuard)
@RequiresFeature('auswertungen')
@Roles(UserRole.MANAGER, UserRole.OWNER)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Auswertung fuer einen Zeitraum (Volumen, Umsatz, Leistungsart, Top-Kunden)' })
  overview(
    @CurrentUser() user: AuthUser,
    @Query('von') von?: string,
    @Query('bis') bis?: string,
  ) {
    return this.service.overview(user.tenantId, von, bis);
  }
}
