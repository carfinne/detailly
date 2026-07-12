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
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequiresFeature } from '../common/decorators/requires-feature.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { PatchAppointmentTimeDto } from './dto/patch-appointment-time.dto';

// PlanFeatureGuard ist ohne @RequiresFeature-Metadata ein No-Op: Termine bleiben
// KERN (alle Tarife); nur `GET umsatz` traegt das 'auswertungen'-Gate (Basic+).
@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, PlanFeatureGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Termine im Zeitraum (Plantafel) oder eines Kunden' })
  findRange(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.service.findRange(user.tenantId, from, to, customerId);
  }

  /**
   * Umsatz-Aggregat je Kalendertag (Chef-Layer): NUR Leitung (MANAGER/OWNER) und
   * hinter dem 'auswertungen'-Gate (Basic+), weil hier Umsatzzahlen + Wochenziel
   * (`zielWoche`) ausgeliefert werden. WICHTIG: Route MUSS vor `@Get(':id')`
   * deklariert bleiben, sonst frisst der Param-Catch-all den Pfad 'umsatz'.
   */
  @Get('umsatz')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @RequiresFeature('auswertungen')
  @ApiOperation({ summary: 'Umsatz je Tag im Zeitraum (Chef-Layer), Leitung + Basic+' })
  umsatz(
    @CurrentUser() user: AuthUser,
    @Query('von') von?: string,
    @Query('bis') bis?: string,
  ) {
    return this.service.umsatzProTag(user.tenantId, von, bis);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Termin anlegen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/zeit')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Termin verschieben (Drag): Start/Ende, optional Mitarbeiter' })
  patchTime(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PatchAppointmentTimeDto,
  ) {
    return this.service.patchTime(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
