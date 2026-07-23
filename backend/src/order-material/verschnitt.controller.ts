import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequiresFeature } from '../common/decorators/requires-feature.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { FEATURE_FOLIERUNG_PPF } from '../subscriptions/plan-catalog';
import { VerschnittService } from './verschnitt.service';

/**
 * Verschnitt-KPI (Folierer/PPF, lfm): geplant (lfm-Rechner) vs. verbraucht
 * (gebuchtes Material). NUR Leitung - Effizienz-/Margen-nahe Kennzahl.
 *
 * Ganzer Controller hinter dem à-la-carte Add-on 'folierung_ppf' (4,99 €/Monat):
 * ohne gebuchtes Add-on -> 403 PLAN_FEATURE_MISSING (Trial/Pilot offen). Beide
 * Endpunkte (Auftrags-KPI + Zeitraum-Aggregat) erben das Klassen-Gate; die
 * frueher separate 'auswertungen'-Bindung des Aggregats entfaellt, da das Add-on
 * die ganze Folierer-Verschnitt-Flaeche gated. Die Konsumenten (Materialkarte,
 * Auswertungen-Seite) blenden bei 403 still aus. Guard-Reihenfolge: Jwt ->
 * Subscription -> PlanFeature -> Roles.
 */
@ApiTags('verschnitt')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, PlanFeatureGuard, RolesGuard)
@Roles(UserRole.MANAGER, UserRole.OWNER)
@RequiresFeature(FEATURE_FOLIERUNG_PPF)
@Controller('verschnitt')
export class VerschnittController {
  constructor(private readonly service: VerschnittService) {}

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Verschnitt-KPI eines Auftrags (geplant vs. verbraucht)' })
  forOrder(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.service.forOrder(user.tenantId, orderId);
  }

  @Get('aggregat')
  @ApiOperation({ summary: 'Verschnitt-Aggregat je Zeitraum (je Produkt)' })
  aggregat(
    @CurrentUser() user: AuthUser,
    @Query('von') von?: string,
    @Query('bis') bis?: string,
  ) {
    return this.service.aggregat(user.tenantId, von, bis);
  }
}
