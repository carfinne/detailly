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
import { ZeiterfassungService } from './zeiterfassung.service';
import {
  StempelDto,
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
  TimeEntryQueryDto,
} from './dto/time-entry.dto';

// Nur Leitungsrollen duerfen fremde Eintraege verwalten (super_admin implizit via RolesGuard).
const VERWALTUNG = [UserRole.FRANCHISE_OWNER, UserRole.MANAGER];

@ApiTags('zeiterfassung')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('zeiterfassung')
export class ZeiterfassungController {
  constructor(private readonly service: ZeiterfassungService) {}

  // --- Self-Service (jede Rolle); feste Pfade VOR :id-Routen ---

  @Post('stempeln')
  @ApiOperation({ summary: 'Kommen/Gehen stempeln (Self-Service)' })
  stempeln(@CurrentUser() user: AuthUser, @Body() dto: StempelDto) {
    return this.service.stempeln(user, dto);
  }

  @Get('status')
  @ApiOperation({ summary: 'Aktueller Ein-/Ausstempel-Status des eigenen Users' })
  status(@CurrentUser() user: AuthUser) {
    return this.service.aktuellerStatus(user);
  }

  @Get('meine')
  @ApiOperation({ summary: 'Eigene Stempel-Historie' })
  meine(@CurrentUser() user: AuthUser) {
    return this.service.meineEintraege(user);
  }

  // --- Leitung (Verwaltung) ---

  @Get()
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Eintraege auflisten (Leitung, mit Filtern)' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: TimeEntryQueryDto) {
    return this.service.findAll(user.tenantId, query);
  }

  @Post()
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Eintrag fuer Mitarbeiter anlegen (Leitung)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTimeEntryDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Eintrag korrigieren (Leitung)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTimeEntryDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Eintrag loeschen (Leitung)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
