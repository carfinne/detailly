import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { SupportService } from './support.service';
import { CreateTicketDto, TicketMessageDto } from './dto/support.dto';

/**
 * Support-Anfragen (Kunden-Seite, tenant-getrennt). BEWUSST OHNE
 * SubscriptionGuard: Der Support muss auch bei gesperrtem/abgelaufenem Abo
 * erreichbar sein (z. B. fuer Abrechnungsfragen) – sonst kann sich ein
 * ausgesperrter Kunde nicht einmal melden.
 */
@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly service: SupportService) {}

  @Get('tickets')
  @ApiOperation({ summary: 'Eigene Support-Anfragen des Betriebs' })
  list(@CurrentUser() user: AuthUser) {
    return this.service.listForTenant(user.tenantId);
  }

  @Post('tickets')
  @ApiOperation({ summary: 'Neue Support-Anfrage stellen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.service.createTicket(user, dto);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Anfrage mit Verlauf' })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getTicket(user.tenantId, id);
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Auf eine Anfrage antworten' })
  reply(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TicketMessageDto) {
    return this.service.addCustomerMessage(user, id, dto.text);
  }
}
