import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { IntakeService } from './intake.service';
import { CreateIntakeDto } from './dto/create-intake.dto';

@ApiTags('fahrzeugannahme')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('fahrzeugannahme')
export class IntakeController {
  constructor(private readonly service: IntakeService) {}

  @Get()
  @ApiOperation({ summary: 'Annahmeprotokolle auflisten' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnes Annahmeprotokoll abrufen' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Post()
  @Roles(
    UserRole.MANAGER,
    UserRole.FRANCHISE_OWNER,
    UserRole.RECEPTIONIST,
    UserRole.TECHNICIAN,
  )
  @ApiOperation({ summary: 'Fahrzeugannahme mit Schadensprotokoll speichern' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateIntakeDto) {
    return this.service.create(user, dto);
  }
}
