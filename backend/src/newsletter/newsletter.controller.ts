import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { NewsletterService, NewsletterUebersicht, VersandStatistik } from './newsletter.service';
import { NewsletterSendenDto } from './dto/newsletter.dto';

/**
 * Betreiber-Seite des Plattform-Newsletters (Detailly-Team). Ausschliesslich
 * Platform-Admin: Uebersicht lesen und – nach expliziter Bestaetigung in der UI
 * (Review-before-send) – an alle bestaetigten Abonnenten versenden. Kunden-Rollen
 * kommen hier grundsaetzlich nicht rein (RolesGuard).
 */
@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly service: NewsletterService) {}

  @Get('uebersicht')
  @ApiOperation({ summary: 'Abonnenten-Zahlen + letzte Anmeldungen' })
  uebersicht(): Promise<NewsletterUebersicht> {
    return this.service.uebersicht();
  }

  @Post('senden')
  @ApiOperation({ summary: 'Newsletter an alle bestätigten Abonnenten senden' })
  senden(@Body() dto: NewsletterSendenDto): Promise<VersandStatistik> {
    return this.service.senden(dto.betreff, dto.inhalt);
  }
}
