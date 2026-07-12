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
import { VerschnittService } from './verschnitt.service';

/**
 * Verschnitt-KPI (Folierer-Welle 2): geplant (lfm-Rechner) vs. verbraucht
 * (gebuchtes Material). NUR Leitung - Effizienz-/Margen-nahe Kennzahl.
 * - Auftrags-KPI: FREI (kein Tarif-Gate).
 * - Zeitraum-Aggregat: hinter 'auswertungen' (Basic+), wie die uebrigen Berichte.
 * Guard-Reihenfolge: Jwt -> Subscription -> PlanFeature -> Roles.
 */
@ApiTags('verschnitt')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, PlanFeatureGuard, RolesGuard)
@Roles(UserRole.MANAGER, UserRole.OWNER)
@Controller('verschnitt')
export class VerschnittController {
  constructor(private readonly service: VerschnittService) {}

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Verschnitt-KPI eines Auftrags (geplant vs. verbraucht)' })
  forOrder(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.service.forOrder(user.tenantId, orderId);
  }

  @Get('aggregat')
  @RequiresFeature('auswertungen')
  @ApiOperation({ summary: 'Verschnitt-Aggregat je Zeitraum (je Produkt), Basic+' })
  aggregat(
    @CurrentUser() user: AuthUser,
    @Query('von') von?: string,
    @Query('bis') bis?: string,
  ) {
    return this.service.aggregat(user.tenantId, von, bis);
  }
}
