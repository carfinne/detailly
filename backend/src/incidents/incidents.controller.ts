import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';

/**
 * Datenpannen-Register (Art. 33/34 DSGVO). KERN-Modul (keine Tarif-Gate –
 * Meldepflicht ist gesetzlich, kein Upsell). Engste Rolle: OWNER; PLATFORM_ADMIN
 * umgeht den RolesGuard und sieht plattformweite Vorfaelle (Service scoped strikt).
 * Guard-Kette wie beim GdprController.
 */
@ApiTags('incidents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly service: IncidentsService) {}

  @Get()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Datenpannen-Register auflisten (tenant-scoped)' })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user);
  }

  @Get(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Einen Vorfall lesen' })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getOne(user, id);
  }

  @Post()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Vorfall manuell erfassen (72h-Frist ab Kenntnis)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateIncidentDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Vorfall aktualisieren (Status/Eskalationsschritte)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Post(':id/meldung-entwurf')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Melde-Vorlage (Art. 33) erzeugen – wird NICHT versendet' })
  meldungEntwurf(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.generateMeldungEntwurf(user, id);
  }
}
