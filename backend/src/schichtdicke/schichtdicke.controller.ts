import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequiresFeature } from '../common/decorators/requires-feature.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { FEATURE_SCHICHTDICKE } from '../subscriptions/plan-catalog';
import { SchichtdickeService } from './schichtdicke.service';
import { SchichtdickePdfService } from './schichtdicke-pdf.service';
import { buildLayerMeasurementDocDef } from './layer-measurement-pdf';
import { CreateLayerMeasurementDto } from './dto/create-layer-measurement.dto';
import { UpdateLayerMeasurementDto } from './dto/update-layer-measurement.dto';
import { CreateLayerPointDto, UpdateLayerPointDto } from './dto/layer-point.dto';

/**
 * Schichtdicken-Messprotokoll (Lackschichtdicke, µm). Ganzer Controller hinter
 * dem Tarif-Feature 'schichtdicke' (Pro-Add-on): Tarife ohne den Key erhalten
 * 403 PLAN_FEATURE_MISSING. Guard-Kette wie InspectionController; tenantId NIE
 * aus dem Body, FKs ueber assertRefInTenant im Service.
 *
 * Welle 1: CRUD + Messpunkte + PDF-Download (kein Freigabe-Link, keine Signatur).
 */
@ApiTags('schichtdicke')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, PlanFeatureGuard, RolesGuard)
@RequiresFeature(FEATURE_SCHICHTDICKE)
@Controller('schichtdicke')
export class SchichtdickeController {
  constructor(
    private readonly service: SchichtdickeService,
    private readonly pdf: SchichtdickePdfService,
  ) {}

  // --- Protokolle ---

  @Post()
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Messprotokoll anlegen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLayerMeasurementDto) {
    return this.service.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Messprotokolle auflisten (Filter: orderId, vehicleId, status)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('orderId') orderId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(user, { orderId, vehicleId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Messprotokoll inkl. Punkte + Bauteil-Auswertung' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Messprotokoll als PDF-Bericht (Download, tenant-sicher)' })
  async pdfReport(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const ctx = await this.service.getReportContext(user, id);
    const buffer = await this.pdf.render(
      buildLayerMeasurementDocDef(
        ctx.measurement as any,
        ctx.points as any,
        ctx.auswertung as any,
        ctx.customer as any,
        ctx.vehicle as any,
        ctx.tenant as any,
      ),
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Schichtdicke_${id.slice(0, 8)}.pdf"`,
    );
    return new StreamableFile(buffer);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Messprotokoll aktualisieren' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLayerMeasurementDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Messprotokoll löschen' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }

  // --- Messpunkte ---

  @Post(':id/points')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Messpunkt anlegen' })
  createPoint(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateLayerPointDto,
  ) {
    return this.service.createPoint(user, id, dto);
  }

  @Patch(':id/points/:pointId')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Messpunkt aktualisieren (µm-Werte, Label)' })
  updatePoint(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('pointId') pointId: string,
    @Body() dto: UpdateLayerPointDto,
  ) {
    return this.service.updatePoint(user, id, pointId, dto);
  }

  @Delete(':id/points/:pointId')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Messpunkt löschen' })
  removePoint(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('pointId') pointId: string,
  ) {
    return this.service.removePoint(user, id, pointId);
  }
}
