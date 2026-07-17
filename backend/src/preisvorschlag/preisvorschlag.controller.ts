import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { TENANT_ROLLEN } from '../users/entities/user.entity';
import { PreisvorschlagService, PreisVorschlagErgebnis } from './preisvorschlag.service';

/**
 * Read-only-Lookup: Preisvorschlag aus der eigenen Auftragshistorie.
 *
 * Bewusst schlank und in einem EIGENEN Controller (kein Eingriff in
 * orders.controller/service). Strikt tenant-gescoped ueber den Service; die
 * `tenantId` kommt aus dem Token (`@CurrentUser`), nie aus der Query.
 *
 * Guard-Kette wie andere Tenant-Endpunkte: Jwt -> Subscription -> Roles
 * (alle Betriebs-Rollen duerfen kalkulieren -> TENANT_ROLLEN).
 */
@ApiTags('preisvorschlag')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Roles(...TENANT_ROLLEN)
@Controller('preis-vorschlag')
export class PreisvorschlagController {
  constructor(private readonly service: PreisvorschlagService) {}

  @Get()
  // Debounced-Lookup beim Tippen -> grosszuegig, aber begrenzt gegen Missbrauch.
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    summary: 'Preisvorschlag aus eigener Auftragshistorie (Median/letzter/Anzahl)',
  })
  vorschlag(
    @CurrentUser() user: AuthUser,
    @Query('beschreibung') beschreibung?: string,
    @Query('serviceType') serviceType?: string,
  ): Promise<PreisVorschlagErgebnis> {
    return this.service.ermittleVorschlag(user, beschreibung ?? '', serviceType ?? '');
  }
}
