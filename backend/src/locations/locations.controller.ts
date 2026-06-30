import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { LocationsService } from './locations.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';

// Nur Leitungsrollen duerfen Standorte verwalten (platform_admin implizit via RolesGuard).
const VERWALTUNG = [UserRole.OWNER, UserRole.MANAGER];

@ApiTags('locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('locations')
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'Standorte auflisten' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.tenantId);
  }

  @Get('auswertung')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Standortübergreifende Auswertung (Umsatz, Aufträge, Termine)' })
  auswertung(@CurrentUser() user: AuthUser) {
    return this.service.auswertung(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnen Standort abrufen' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Post()
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Standort anlegen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLocationDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Standort bearbeiten / deaktivieren' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Standort löschen' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
