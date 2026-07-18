import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TENANT_ROLLEN } from '../users/entities/user.entity';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { SupportService } from './support.service';
import { CreateTicketDto, TicketMessageDto } from './dto/support.dto';

/**
 * Support-Anfragen (Kunden-Seite, tenant-getrennt). BEWUSST OHNE
 * SubscriptionGuard: Der Support muss auch bei gesperrtem/abgelaufenem Abo
 * erreichbar sein (z. B. fuer Abrechnungsfragen) – sonst kann sich ein
 * ausgesperrter Kunde nicht einmal melden.
 *
 * ISOLATION: ausdruecklich auf TENANT_ROLLEN beschraenkt (RolesGuard). Ein
 * Prinzipal OHNE Tenant (Marktplatz-Haendler role='haendler', tenantId=null –
 * oder eine Plattform-Rolle) hat hier keinen Kundensupport-Kanal und darf die
 * Tenant-gescopten Tickets NICHT erreichen. Zusaetzlich lehnt der Service eine
 * fehlende tenantId hart ab (Defense-in-Depth) – noetig, weil TypeORM
 * `where:{tenantId:null}` sonst als "kein Filter" behandelt (alle Betriebe).
 */
@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...TENANT_ROLLEN)
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
