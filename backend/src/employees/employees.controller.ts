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

// Tarif-Feature 'mitarbeiter' gilt NUR fuer das ANLEGEN (POST, per Methoden-
// Decorator). Bestandsverwaltung (PATCH/DELETE, inkl. Passwort/Deaktivieren)
// bleibt tariffrei: Offboarding muss immer moeglich sein; die Reaktivierung
// (isActive false->true) ist im Service ueber das maxUsers-Limit geschuetzt.
// Die GET-Listen bleiben tariffrei, weil Starter-Module (Zeiterfassung,
// Auftragszeiten) sie mitnutzen.
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

  // Statische Route VOR ':id', damit '/employees/limit' nicht als id='limit'
  // gematcht wird. Tariffrei (kein @RequiresFeature): das Kontingent muss auch
  // bei erreichtem Limit lesbar bleiben (die UI zeigt "X von Y").
  @Get('limit')
  @ApiOperation({ summary: 'Mitarbeiter-Kontingent (genutzt/Limit) des Tarifs' })
  usage(@CurrentUser() user: AuthUser) {
    return this.service.getUsage(user.tenantId);
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
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Passwort setzen' })
  setPassword(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetPasswordDto) {
    return this.service.setPassword(user, id, dto.password);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Mitarbeiter deaktivieren' })
  deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deactivate(user, id);
  }
}
