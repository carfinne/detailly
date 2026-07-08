import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequiresFeature } from '../common/decorators/requires-feature.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ProfitabilityService } from './profitability.service';

/**
 * Wirtschaftlichkeit (Deckungsbeitrag) je Auftrag. NUR Leitung – enthaelt
 * Lohnkosten (Gehaltsdaten) und Margen. Zusaetzlich hinter dem Tarif-Feature
 * 'wirtschaftlichkeit' (Pro-only). Guard-Reihenfolge: Jwt -> Subscription ->
 * PlanFeature -> Roles.
 */
@ApiTags('profitability')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, PlanFeatureGuard, RolesGuard)
@RequiresFeature('wirtschaftlichkeit')
@Roles(UserRole.MANAGER, UserRole.OWNER)
@Controller('profitability')
export class ProfitabilityController {
  constructor(private readonly service: ProfitabilityService) {}

  @Get(':orderId')
  @ApiOperation({ summary: 'Deckungsbeitrag eines Auftrags (Netto - Lohn - Material)' })
  forOrder(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.service.forOrder(user.tenantId, orderId);
  }
}
