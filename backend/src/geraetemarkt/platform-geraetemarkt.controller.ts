import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { GeraeteModerationService } from './geraete-moderation.service';
import {
  MeldungenQueryDto,
  ModerationInserateQueryDto,
  ModerationInseratDto,
  UpdateMeldungDto,
} from './dto/meldung.dto';

/**
 * Betreiber-Moderation des Geraetemarkts (Detailly-Team). Lesen: alle
 * Plattform-Rollen; Aktionen (Verbergen/Meldung schliessen): Platform-Admin +
 * -Support (Analyst read-only). Kunden-Rollen kommen ueber den RolesGuard
 * grundsaetzlich nicht rein. BEWUSST plattformweit (kein tenantId-Scope).
 */
@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT, UserRole.PLATFORM_ANALYST)
@Controller('platform/geraetemarkt')
export class PlatformGeraetemarktController {
  constructor(private readonly service: GeraeteModerationService) {}

  @Get('meldungen')
  @ApiOperation({ summary: 'Melde-Queue (Default offen, paginiert, inkl. Inseratbezug)' })
  meldungen(@Query() query: MeldungenQueryDto) {
    return this.service.listMeldungen(query);
  }

  @Get('inserate')
  @ApiOperation({ summary: 'Alle Inserate fuer die Moderation (inkl. verborgene/entfernte)' })
  inserate(@Query() query: ModerationInserateQueryDto) {
    return this.service.listInserate(query);
  }

  @Patch('inserate/:id/moderation')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Moderations-Status eines Inserats setzen (ok/verborgen/entfernt)' })
  moderateInserat(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerationInseratDto,
  ) {
    return this.service.moderateInserat(user, id, dto);
  }

  @Patch('meldungen/:id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Meldung abschliessen (erledigt) oder verwerfen (verworfen)' })
  updateMeldung(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMeldungDto,
  ) {
    return this.service.updateMeldung(user, id, dto);
  }
}
