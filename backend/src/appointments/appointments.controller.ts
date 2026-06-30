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
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
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

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
