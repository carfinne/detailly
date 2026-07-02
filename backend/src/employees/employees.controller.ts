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
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequiresFeature } from '../common/decorators/requires-feature.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto, SetPasswordDto } from './dto/employee.dto';

// Tarif-Feature 'mitarbeiter' (Pro-Modul) gilt NUR fuer die Verwaltungs-Endpunkte
// (POST/PATCH/DELETE, per Methoden-Decorator). Die GET-Listen bleiben tariffrei,
// weil Starter-Module (Zeiterfassung, Auftragszeiten) sie mitnutzen.
@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, PlanFeatureGuard, RolesGuard)
@Roles(UserRole.MANAGER, UserRole.OWNER)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'Mitarbeiter auflisten' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Post()
  @RequiresFeature('mitarbeiter')
  @ApiOperation({ summary: 'Mitarbeiter anlegen (mit Rolle)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEmployeeDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @RequiresFeature('mitarbeiter')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/password')
  @RequiresFeature('mitarbeiter')
  @ApiOperation({ summary: 'Passwort setzen' })
  setPassword(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetPasswordDto) {
    return this.service.setPassword(user, id, dto.password);
  }

  @Delete(':id')
  @RequiresFeature('mitarbeiter')
  @ApiOperation({ summary: 'Mitarbeiter deaktivieren' })
  deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deactivate(user, id);
  }
}
