import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { GeraetemarktService } from './geraetemarkt.service';
import {
  CreateInseratDto,
  UpdateInseratDto,
  UpdateInseratStatusDto,
  BrowseInseratDto,
} from './dto/inserat.dto';

// Inserate anlegen/pflegen ist Leitungssache (Anschaffung/Verkauf von Ausruestung).
const VERWALTUNG = [UserRole.OWNER, UserRole.MANAGER];

/**
 * Geraete-Gebrauchtmarkt (PR1 – Fundament). Browse/Detail sehen ALLE
 * eingeloggten Betriebe (cross-tenant, kontaktfrei projiziert); Mutationen sind
 * strikt auf den eigenen Betrieb gescoped und nur der Leitung (OWNER/MANAGER)
 * erlaubt. `tenantId`/`userId` stammen IMMER aus dem JWT, nie aus dem Body.
 *
 * Guards: JwtAuthGuard (eingeloggt) + RolesGuard (@Roles nur an Mutationen).
 * KEIN SubscriptionGuard – auch ein gesperrter Betrieb darf stoebern.
 */
@ApiTags('geraetemarkt')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('geraetemarkt')
export class GeraetemarktController {
  constructor(private readonly service: GeraetemarktService) {}

  @Get()
  @ApiOperation({ summary: 'Gebrauchtmarkt durchsuchen (cross-tenant, paginiert, kontaktfrei)' })
  browse(@Query() query: BrowseInseratDto) {
    return this.service.browse(query);
  }

  @Get('meine')
  @ApiOperation({ summary: 'Eigene Inserate des Betriebs' })
  meine(@CurrentUser() user: AuthUser) {
    return this.service.findMine(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Inserat-Detail (eigenes voll, fremdes nur sichtbar + kontaktfrei)' })
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOnePublic(user, id);
  }

  @Post()
  @Roles(...VERWALTUNG)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Inserat anlegen (nur Leitung; gewerbliche Bestaetigung Pflicht)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInseratDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Eigenes Inserat bearbeiten' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateInseratDto) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/status')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Status des eigenen Inserats setzen (reserviert/verkauft/entfernt/aktiv)' })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateInseratStatusDto,
  ) {
    return this.service.updateStatus(user, id, dto);
  }

  @Delete(':id')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Eigenes Inserat loeschen' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
