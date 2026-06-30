import { Controller, Get, Post, Patch, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { SubscriptionsService } from './subscriptions.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import {
  AssignSubscriptionDto,
  UpdateSubscriptionDto,
  ExtendSubscriptionDto,
} from './dto/subscription.dto';

/**
 * Abo-Verwaltung. Bewusst OHNE `SubscriptionGuard`: ein gesperrter Betrieb muss
 * sein eigenes Abo (`/me`) weiterhin lesen koennen, um die Sperrseite zu sehen.
 * Schreibende Endpunkte sind dem Detailly-Betreiber (`platform_admin`) vorbehalten.
 */
@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  // --- Eigenes Abo (jede Rolle) ---
  @Get('me')
  @ApiOperation({ summary: 'Abo des eigenen Betriebs inkl. Zugriffsstufe' })
  myView(@CurrentUser() user: AuthUser) {
    return this.service.getMyView(user.tenantId);
  }

  // --- Tarife ---
  @Get('plans')
  @ApiOperation({ summary: 'Tarife auflisten' })
  listPlans(@Query('includeInactive') includeInactive?: string) {
    return this.service.listPlans(includeInactive === 'true');
  }

  @Post('plans')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Tarif anlegen (Betreiber)' })
  createPlan(@CurrentUser() user: AuthUser, @Body() dto: CreatePlanDto) {
    return this.service.createPlan(user, dto);
  }

  @Patch('plans/:id')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Tarif aktualisieren (Betreiber)' })
  updatePlan(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.service.updatePlan(user, id, dto);
  }

  // --- Betreiber-Verwaltung der Betriebs-Abos ---
  @Get('overview')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Alle Betriebe mit ihrem Abo (Betreiber)' })
  overview() {
    return this.service.listOverview();
  }

  @Put('tenant/:tenantId')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Betrieb einen Tarif zuweisen / Abo ersetzen (Betreiber)' })
  assign(
    @CurrentUser() user: AuthUser,
    @Param('tenantId') tenantId: string,
    @Body() dto: AssignSubscriptionDto,
  ) {
    return this.service.assign(user, tenantId, dto);
  }

  @Patch('tenant/:tenantId')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Abo eines Betriebs aktualisieren (Status, Kuendigung ...)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.service.update(user, tenantId, dto);
  }

  @Post('tenant/:tenantId/extend')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Abo um N Monate verlaengern (Betreiber)' })
  extend(
    @CurrentUser() user: AuthUser,
    @Param('tenantId') tenantId: string,
    @Body() dto: ExtendSubscriptionDto,
  ) {
    return this.service.extend(user, tenantId, dto);
  }
}
