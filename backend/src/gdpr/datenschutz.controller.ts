import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

import { DatenschutzCockpitService } from './datenschutz-cockpit.service';
import { TenantExportService } from './tenant-export.service';

/**
 * Datenschutz-Cockpit + Betriebs-Gesamtexport.
 *  - Pruefliste faelliger Kunden + Verlauf: OWNER/MANAGER (Leitung).
 *  - Betriebs-Gesamtexport: OWNER (enthaelt saemtliche Betriebsdaten).
 * Alles tenant-scoped ueber die tenantId aus dem Token.
 */
@ApiTags('datenschutz')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('datenschutz')
export class DatenschutzController {
  constructor(
    private readonly cockpit: DatenschutzCockpitService,
    private readonly tenantExport: TenantExportService,
  ) {}

  @Get('faellige-kunden')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Pruefliste faelliger (inaktiver) Kunden (DSGVO-Retention)' })
  faellige(@CurrentUser() user: AuthUser) {
    return this.cockpit.findFaelligeKunden(user.tenantId);
  }

  @Get('verlauf')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'PII-freier Verlauf der DSGVO-Aktionen' })
  verlauf(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : undefined;
    return this.cockpit.getVerlauf(user.tenantId, Number.isFinite(n as number) ? n : undefined);
  }

  @Get('export')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Betriebs-Gesamtexport als JSON (Datenportabilitaet)' })
  async export(@CurrentUser() user: AuthUser, @Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="betriebsdaten-${user.tenantId}.json"`,
    );
    await this.tenantExport.streamExport(user, res);
  }
}
