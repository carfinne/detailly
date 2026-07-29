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
import { CustomersService } from './customers.service';
import { CustomersImportService } from './customers-import.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ImportOptionenDto } from './dto/import.dto';
import { HochgeladeneDatei } from '../common/csv/csv-parse';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly service: CustomersService,
    private readonly importService: CustomersImportService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Kunden auflisten (Suche + Paginierung)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.findAll(user.tenantId, {
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      includeInactive: includeInactive === 'true',
    });
  }

  // WICHTIG vor @Get(':id') deklarieren, sonst faengt :id "select" ab.
  @Get('select')
  @ApiOperation({ summary: 'Leichte Kundenliste (id + Name) fuer Auswahl-Dropdowns – ohne Cap' })
  selectList(@CurrentUser() user: AuthUser) {
    return this.service.selectList(user.tenantId);
  }

  // Statische Route VOR ':id' (sonst als id='limit' gematcht). Muster:
  // /employees/limit – das Kontingent muss auch bei erreichtem Limit lesbar
  // bleiben (die UI zeigt "X von Y Kunden"), daher keine Zusatz-Rolle/Feature.
  @Get('limit')
  @ApiOperation({ summary: 'Kunden-Kontingent (genutzt/Limit) des Tarifs' })
  usage(@CurrentUser() user: AuthUser) {
    return this.service.getUsage(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnen Kunden abrufen' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Kunden anlegen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    return this.service.create(user, dto);
  }

  /**
   * CSV-Import (T-007): multipart mit Datei-Feld "file" + Optionen mode/duplikate.
   * Default ist der PREVIEW-Modus (schreibt nichts). Bewusst nur MANAGER/OWNER
   * (Massen-Schreiboperation) und eng gedrosselt; die Datei bleibt im Speicher
   * (multer memoryStorage, kein Disk-Write) und ist auf 1 MB begrenzt.
   */
  @Post('import')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Kunden per CSV importieren (preview/commit)' })
  importCsv(
    @CurrentUser() user: AuthUser,
    @UploadedFile() datei: HochgeladeneDatei,
    @Body() dto: ImportOptionenDto,
  ) {
    return this.importService.importCsv(user, datei, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Kunden aktualisieren' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Kunden deaktivieren (Soft-Delete)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
