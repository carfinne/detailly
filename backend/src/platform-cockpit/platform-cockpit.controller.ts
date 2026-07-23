import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { PlatformCockpitService } from './platform-cockpit.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ExtendTrialDto, SetPilotDto } from '../subscriptions/dto/subscription.dto';

/**
 * BETREIBER-COCKPIT (Detailly-Plattform, Teil 1 = nur Backend-API). NUR fuer die
 * Detailly-Plattform-Rollen. KEIN SubscriptionGuard (plattform-intern, nicht an
 * ein Kunden-Abo gebunden). Der RolesGuard begrenzt strikt auf Plattform-Rollen:
 * platform_admin wird generisch durchgelassen, die @Roles-Liste steuert nur, ob
 * Analyst/Support zusaetzlich lesen duerfen. NIEMALS eine Tenant-Rolle in @Roles.
 *
 * Lesen ist fuer alle Plattform-Rollen offen; die SCHREIBENDEN Pilot-Verwaltungs-
 * Aktionen (Pilot setzen, Trial verlaengern, Passwort-Reset ausloesen) sind per
 * Method-Override strikt auf PLATFORM_ADMIN begrenzt. Sensible Cross-Tenant-Reads
 * und jede Schreibaktion werden im Service per AuditService protokolliert (DSGVO).
 */
@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_ANALYST, UserRole.PLATFORM_SUPPORT)
@Controller('platform')
export class PlatformCockpitController {
  constructor(
    private readonly service: PlatformCockpitService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Get('tenants')
  @ApiOperation({ summary: 'Betriebe suchen (paginiert): #Nutzer + Abo-Summary. Lesen: alle Plattform-Rollen.' })
  listTenants(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('plan') plan?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listTenants({ q, status, plan, limit, offset });
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Betriebs-Detail: Profil, minimale Nutzerliste, Nutzung, Abo. Lesen: alle Plattform-Rollen.' })
  getTenant(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getTenantDetail(user, id);
  }

  @Get('users')
  @Roles(UserRole.PLATFORM_ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Cross-Tenant-Nutzer-Lookup per E-Mail (nur Platform-Admin, eng gedrosselt).' })
  lookupUsers(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return this.service.lookupUsers(user, q);
  }

  @Get('locations')
  @ApiOperation({ summary: 'Region-Aggregation je 2-stelliger Leitregion (datensparsam). Lesen: alle Plattform-Rollen.' })
  locations() {
    return this.service.locations();
  }

  @Get('cockpit/live')
  @ApiOperation({ summary: 'Live-KPI: Testphasen-Ende (7 Tage), aktive Nutzer (24h), offene Tickets/KYB. Lesen: alle Plattform-Rollen.' })
  live() {
    return this.service.live();
  }

  @Get('audit')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Plattformweite Audit-Lesesicht (paginiert, gedeckelt). Nur Platform-Admin.' })
  audit(
    @Query('action') action?: string,
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.readAudit({ action, tenantId, limit, offset });
  }

  // --- Pilot-Verwaltung (SCHREIBEND, strikt nur PLATFORM_ADMIN) ----------------

  @Post('tenants/:id/pilot')
  @Roles(UserRole.PLATFORM_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Betrieb auf „Pilot" setzen: unbefristeter Vollzugriff, sperrt nie automatisch. Nur Platform-Admin.',
  })
  setPilot(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetPilotDto) {
    return this.subscriptions.setPilot(user, id, dto);
  }

  @Post('tenants/:id/trial-extend')
  @Roles(UserRole.PLATFORM_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Testphase eines Betriebs um N Tage verlaengern. Nur Platform-Admin.' })
  extendTrial(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ExtendTrialDto) {
    return this.subscriptions.extendTrial(user, id, dto);
  }

  @Post('users/:userId/password-reset')
  @Roles(UserRole.PLATFORM_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Passwort-Reset fuer einen Tenant-Nutzer ausloesen (Token + Mail, KEIN Klartext-PW). Nur Platform-Admin.',
  })
  resetUserPassword(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    return this.service.triggerUserPasswordReset(user, userId);
  }
}
