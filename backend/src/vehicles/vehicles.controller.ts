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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { VehiclesService } from './vehicles.service';
import { VehiclesImportService } from './vehicles-import.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { ImportOptionenDto } from '../customers/dto/import.dto';
import { HochgeladeneDatei } from '../common/csv/csv-parse';

@ApiTags('vehicles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly service: VehiclesService,
    private readonly importService: VehiclesImportService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Fahrzeuge auflisten (optional nach Kunde; optional paginiert)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('customerId') customerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(user.tenantId, {
      customerId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
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
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Fahrzeug anlegen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVehicleDto) {
    return this.service.create(user, dto);
  }

  /**
   * CSV-Import (T-007): Kunden-Zuordnung ueber Spalte "KundeEmail". Gleiche
   * Schutzmassnahmen wie beim Kunden-Import (nur MANAGER/OWNER, Drossel,
   * memoryStorage, 1 MB, Preview als Default).
   */
  @Post('import')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Fahrzeuge per CSV importieren (preview/commit)' })
  importCsv(
    @CurrentUser() user: AuthUser,
    @UploadedFile() datei: HochgeladeneDatei,
    @Body() dto: ImportOptionenDto,
  ) {
    return this.importService.importCsv(user, datei, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Fahrzeug aktualisieren' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Fahrzeug loeschen' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
