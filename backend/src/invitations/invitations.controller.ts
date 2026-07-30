import {
  Controller,
  Get,
  Post,
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
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/invitation.dto';

/**
 * Verwaltung der Mitarbeiter-Einladungen durch die Leitung (OWNER/MANAGER).
 *
 * BEWUSST eigener Basis-Pfad `employee-invitations` (NICHT `employees/...`), damit
 * es keine Kollision mit der `employees/:id`-Route des EmployeesController gibt
 * (statische vs. dynamische Segmente ueber zwei Controller sind fragil).
 *
 * Das Tarif-Feature 'mitarbeiter' gilt – wie beim Direkt-Anlegen – NUR fuers
 * Ausstellen (POST). Liste/Erneut-Senden/Zurueckziehen bleiben tariffrei (Offboarding
 * bzw. Bereinigung offener Einladungen muss immer moeglich sein).
 */
@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, PlanFeatureGuard, RolesGuard)
@Roles(UserRole.MANAGER, UserRole.OWNER)
@Controller('employee-invitations')
export class InvitationsController {
  constructor(private readonly service: InvitationsService) {}

  @Get()
  @ApiOperation({ summary: 'Offene Mitarbeiter-Einladungen auflisten' })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.tenantId);
  }

  @Post()
  @RequiresFeature('mitarbeiter')
  @ApiOperation({ summary: 'Mitarbeiter per E-Mail einladen (setzt eigenes Passwort)' })
  invite(@CurrentUser() user: AuthUser, @Body() dto: CreateInvitationDto) {
    return this.service.invite(user, dto);
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Einladung erneut senden (neuer Link)' })
  resend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.resend(user, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Einladung zurueckziehen (Link wird tot)' })
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.withdraw(user, id);
  }
}
