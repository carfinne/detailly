import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { MarktregisterService } from './marktregister.service';
import {
  CreateMarktBeobachtungDto,
  UpdateMarktBeobachtungDto,
  UpdateMarktPrioritaetDto,
  UpdateMarktStatusDto,
} from './dto/markt-beobachtung.dto';

/**
 * MARKTRECHERCHE-REGISTER (Plattform-intern). STRIKT nur PLATFORM_ADMIN – ein
 * neutrales, internes Werkzeug des Detailly-Betreibers, KEIN Kunden-/Endnutzer-
 * Feature. KEIN SubscriptionGuard (nicht an ein Kunden-Abo gebunden), KEIN
 * tenantId (plattformweit; die Rolle ist die einzige Zugriffsgrenze).
 *
 * NEUTRALITAET: Das Register haelt nur sachliche, oeffentlich beobachtbare Fakten
 * + die daraus abgeleitete eigene Idee. Es gibt kein Bewertungs-/Herabsetzungs-
 * feld und keine automatische Konkurrenz-Analyse.
 */
@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
@Controller('platform/marktregister')
export class MarktregisterController {
  constructor(private readonly service: MarktregisterService) {}

  @Get()
  @ApiOperation({
    summary: 'Marktbeobachtungen auflisten (paginiert, Filter status/kategorie/prioritaet).',
  })
  list(
    @Query('status') status?: string,
    @Query('kategorie') kategorie?: string,
    @Query('prioritaet') prioritaet?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.list({ status, kategorie, prioritaet, limit, offset });
  }

  @Post()
  @ApiOperation({ summary: 'Marktbeobachtung anlegen (sachliche Beobachtung + eigene Idee).' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMarktBeobachtungDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Marktbeobachtung bearbeiten.' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMarktBeobachtungDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Status der eigenen Idee schnellwechseln.' })
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMarktStatusDto,
  ) {
    return this.service.setStatus(user, id, dto.status);
  }

  @Patch(':id/prioritaet')
  @ApiOperation({ summary: 'Prioritaet der eigenen Idee schnellwechseln.' })
  setPrioritaet(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMarktPrioritaetDto,
  ) {
    return this.service.setPrioritaet(user, id, dto.prioritaet);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Marktbeobachtung loeschen (echtes Delete – interne Notiz).' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
