import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { SupportService } from './support.service';
import { TicketMessageDto, TicketStatusDto } from './dto/support.dto';
import { TicketStatus } from './entities/support-ticket.entity';

/**
 * Support-Anfragen (Plattform-Seite, Detailly-Team). Lesen: alle Plattform-
 * Rollen (auch Analyst). Antworten/Status: nur Platform-Admin + -Support.
 * Kunden-Rollen kommen hier grundsaetzlich nicht rein (RolesGuard).
 */
@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT, UserRole.PLATFORM_ANALYST)
@Controller('platform/support')
export class PlatformSupportController {
  constructor(private readonly service: SupportService) {}

  @Get('tickets')
  @ApiOperation({ summary: 'Alle Support-Anfragen (optional nach Status)' })
  list(@Query('status') status?: TicketStatus) {
    return this.service.listAll(status);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Anfrage mit Verlauf (betriebsuebergreifend)' })
  get(@Param('id') id: string) {
    return this.service.getForPlatform(id);
  }

  @Post('tickets/:id/antwort')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Als Detailly antworten (setzt Status "beantwortet")' })
  answer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TicketMessageDto) {
    return this.service.answer(user, id, dto.text);
  }

  @Patch('tickets/:id/status')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Status setzen (z. B. schliessen)' })
  setStatus(@Param('id') id: string, @Body() dto: TicketStatusDto) {
    return this.service.setStatus(id, dto.status);
  }
}
