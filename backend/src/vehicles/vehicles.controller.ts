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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@ApiTags('vehicles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly service: VehiclesService) {}

  @Get()
  @ApiOperation({ summary: 'Fahrzeuge auflisten (optional nach Kunde gefiltert)' })
  findAll(@CurrentUser() user: AuthUser, @Query('customerId') customerId?: string) {
    return this.service.findAll(user.tenantId, customerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnes Fahrzeug abrufen' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Get(':id/akte')
  @ApiOperation({ summary: 'Fahrzeugakte: Fahrzeug + Auftragshistorie' })
  getDossier(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getDossier(user.tenantId, id);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.FRANCHISE_OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Fahrzeug anlegen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVehicleDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.FRANCHISE_OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Fahrzeug aktualisieren' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.FRANCHISE_OWNER)
  @ApiOperation({ summary: 'Fahrzeug loeschen' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
