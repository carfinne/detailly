import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { NewsletterService } from './newsletter.service';
import { NewsletterAnmeldenDto, NewsletterTokenDto } from './dto/newsletter.dto';
import { SecurityEventService } from '../security/security-event.service';
import { istHoneypotGefuellt, protokolliereHoneypotTreffer } from '../common/security/honeypot';

/**
 * OEFFENTLICHES Newsletter-Surface – BEWUSST OHNE Auth-Guard (wie
 * /public/booking, /tenants/register). Streng gedrosselt, da unauthentifiziert.
 *
 * Rechtssicherheit (§ 7 UWG, Double-Opt-in): Die Anmeldung antwortet IMMER
 * identisch (keine Account-Enumeration); erst der Klick auf den Bestaetigungs-
 * Link aktiviert das Abo. Abmeldung ist sofort per Token wirksam.
 */
@ApiTags('public')
@Controller('public/newsletter')
export class PublicNewsletterController {
  constructor(
    private readonly service: NewsletterService,
    private readonly securityEvents: SecurityEventService,
  ) {}

  @Post('anmelden')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Newsletter-Anmeldung (Double-Opt-in, enumeration-sicher)' })
  @ApiResponse({ status: 202, description: 'Antwort immer identisch – ggf. wurde eine Bestätigungs-Mail versendet' })
  async anmelden(@Body() dto: NewsletterAnmeldenDto, @Req() req?: Request): Promise<{ ok: true }> {
    // Honeypot (gemeinsamer Baustein): gefuellt => Bot. Erfolg vortaeuschen, NICHTS
    // speichern/versenden (der Bot lernt nicht, erkannt worden zu sein), aber den
    // Treffer als Sicherheits-Ereignis protokollieren. Antwort identisch zum Erfolg.
    if (istHoneypotGefuellt(dto.website)) {
      protokolliereHoneypotTreffer(this.securityEvents, 'public_newsletter', req?.ip);
      return { ok: true };
    }
    await this.service.anmelden(dto.email);
    // Immer dieselbe Antwort – egal ob neu, pending oder bereits bestaetigt.
    return { ok: true };
  }

  @Post('bestaetigen')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Newsletter-Anmeldung per Token bestätigen (Double-Opt-in Schritt 2)' })
  @ApiResponse({ status: 200, description: 'Bestätigt' })
  @ApiResponse({ status: 400, description: 'Token ungültig oder abgelaufen' })
  async bestaetigen(@Body() dto: NewsletterTokenDto): Promise<{ ok: true }> {
    await this.service.bestaetigen(dto.token);
    return { ok: true };
  }

  @Post('abmelden')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Newsletter abmelden (1-Klick, sofort wirksam)' })
  @ApiResponse({ status: 200, description: 'Abgemeldet' })
  @ApiResponse({ status: 400, description: 'Token ungültig' })
  async abmelden(@Body() dto: NewsletterTokenDto): Promise<{ ok: true }> {
    await this.service.abmelden(dto.token);
    return { ok: true };
  }
}
