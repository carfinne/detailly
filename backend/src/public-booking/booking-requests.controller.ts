import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { BookingRequestsService } from './booking-requests.service';
import { BookingRequestStatus } from './entities/booking-request.entity';
import { AcceptBookingRequestDto } from './dto/accept-booking-request.dto';

/**
 * INTERNE Verwaltung der Online-Terminanfragen (authentifiziert, tenant-gescoped).
 * Anfragen sind untrusted; erst beim Annehmen entsteht ein echter Termin (+Kunde).
 */
@ApiTags('booking-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
@Controller('booking-requests')
export class BookingRequestsController {
  constructor(private readonly service: BookingRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Terminanfragen des Betriebs' })
  findAll(@CurrentUser() user: AuthUser, @Query('status') status?: BookingRequestStatus) {
    return this.service.findAll(user.tenantId, status);
  }

  @Get('count')
  @ApiOperation({ summary: 'Anzahl neuer Anfragen (Badge)' })
  count(@CurrentUser() user: AuthUser) {
    return this.service.countNeu(user.tenantId);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Anfrage annehmen -> Termin (+ optional Kunde)' })
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptBookingRequestDto,
  ) {
    return this.service.accept(user, id, dto);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Anfrage ablehnen' })
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.reject(user, id);
  }
}
