import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequiresFeature } from '../common/decorators/requires-feature.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { FEATURE_DELLENKALKULATION } from '../subscriptions/plan-catalog';
import { DellenkalkulationService } from './dellenkalkulation.service';
import { CreateDellenKalkulationDto } from './dto/create-dellen-kalkulation.dto';
import { UpdateDellenKalkulationDto } from './dto/update-dellen-kalkulation.dto';
import { SetDellenMarkerDto } from './dto/dellen-marker.dto';
import { SetDellenPreismatrixDto } from './dto/dellen-preismatrix.dto';

/**
 * Dellenkalkulation (Smart Repair / PDR – Hagel-/Parkdellen). Ganzer Controller
 * hinter dem Tarif-Feature 'dellenkalkulation' (ab Basic): Tarife ohne den Key
 * erhalten 403 PLAN_FEATURE_MISSING. Guard-Kette wie SchichtdickeController;
 * tenantId NIE aus dem Body, FKs ueber assertRefInTenant im Service. Preise
 * werden ausschliesslich serverseitig berechnet.
 *
 * WICHTIG (Routing): die statischen `preismatrix`-Routen stehen VOR `:id`, damit
 * `:id` sie nicht als ID einfaengt.
 */
@ApiTags('dellenkalkulation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, PlanFeatureGuard, RolesGuard)
@RequiresFeature(FEATURE_DELLENKALKULATION)
@Controller('dellenkalkulation')
export class DellenkalkulationController {
  constructor(private readonly service: DellenkalkulationService) {}

  // --- Preismatrix (statische Routen zuerst) ---

  @Get('preismatrix')
  @ApiOperation({ summary: 'Betriebs-Preismatrix lesen (Default, falls ungepflegt)' })
  getMatrix(@CurrentUser() user: AuthUser) {
    return this.service.getMatrix(user);
  }

  @Put('preismatrix')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Betriebs-Preismatrix setzen (Upsert)' })
  setMatrix(@CurrentUser() user: AuthUser, @Body() dto: SetDellenPreismatrixDto) {
    return this.service.setMatrix(user, dto);
  }

  // --- Kalkulationen ---

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Kalkulation anlegen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDellenKalkulationDto) {
    return this.service.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Kalkulationen auflisten (paginiert; Filter vehicleId/status/modus)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('vehicleId') vehicleId?: string,
    @Query('status') status?: string,
    @Query('modus') modus?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(user, {
      vehicleId,
      status,
      modus,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Kalkulation inkl. Marker laden' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Kalkulations-Kopf aktualisieren (Modus/Fahrzeug/Notiz)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDellenKalkulationDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Put(':id/marker')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Alle Marker in EINEM Request setzen (Batch, Preis serverseitig)' })
  setMarker(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetDellenMarkerDto,
  ) {
    return this.service.setMarker(user, id, dto);
  }

  @Post(':id/neu-berechnen')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Preis aus gespeicherten Markern + aktueller Matrix neu berechnen' })
  neuBerechnen(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.neuBerechnen(user, id);
  }

  @Post(':id/finalisieren')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Kalkulation finalisieren (danach read-only)' })
  finalisieren(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.finalisieren(user, id);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Kalkulation löschen' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
