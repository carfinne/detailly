import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PublicBookingService } from './public-booking.service';
import { CreateBookingRequestDto } from './dto/create-booking-request.dto';

/**
 * OEFFENTLICHES Buchungs-Surface – BEWUSST OHNE jeden Auth-Guard (es gibt keinen
 * globalen Auth-Guard im Projekt; ein Controller ohne @UseGuards ist oeffentlich,
 * wie /tenants/register und /auth/login). Wichtig: NIE 401 werfen, sonst geraet
 * ein nicht eingeloggter Besucher im Frontend in eine Redirect-Schleife.
 *
 * Nur der global registrierte ThrottlerGuard greift; hier zusaetzlich strengere
 * @Throttle-Limits, da unauthentifiziert. Ergaenzend zaehlt der Service ein
 * Pro-Betrieb-Stundenlimit (gegen verteilte Bots).
 *
 * Routen liegen unter /api/v1/public/booking/... – damit ausserhalb des
 * SPA-Fallbacks und klar als "ohne Auth" erkennbar.
 */
@ApiTags('public')
@Controller('public/booking')
export class PublicBookingController {
  constructor(private readonly service: PublicBookingService) {}

  // WICHTIG: vor @Get(':slug') deklarieren. (Zweisegmentig, kollidiert technisch
  // nicht mit dem einsegmentigen :slug, aber die Reihenfolge bleibt eindeutig.)
  @Get('status/:reference')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Status einer Online-Terminanfrage (per Referenz)' })
  getStatus(@Param('reference') reference: string) {
    return this.service.statusByReference(reference);
  }

  // Zweisegmentig, daher vor @Get(':slug') deklariert (gleiche Konvention wie
  // status/:reference). Antwort ist strikt PII-frei: nur 'HH:MM'-Zeitfenster.
  @Get(':slug/slots')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Freie Termin-Slots eines Tages (PII-frei, W2)' })
  getSlots(@Param('slug') slug: string, @Query('datum') datum?: string) {
    return this.service.getSlots(slug, datum ?? '');
  }

  // Zweisegmentig, daher vor @Get(':slug') deklariert. Oeffentliches Impressum des
  // Betriebs (§ 5 DDG) – strikt PII-frei (Whitelist), Link muss immer erreichbar sein.
  @Get(':slug/impressum')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Oeffentliches Impressum des Betriebs (§ 5 DDG, PII-frei)' })
  getImpressum(@Param('slug') slug: string) {
    return this.service.getImpressum(slug);
  }

  @Get(':slug')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Oeffentliche Betriebsinfo + buchbare Leistungen' })
  getBetrieb(@Param('slug') slug: string) {
    return this.service.getBetrieb(slug);
  }

  @Post(':slug')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Online-Terminanfrage absenden' })
  createAnfrage(
    @Param('slug') slug: string,
    @Body() dto: CreateBookingRequestDto,
    @Req() req: Request,
  ) {
    // Echte Client-IP setzt einen korrekt konfigurierten trust-proxy voraus
    // (deploy-spezifisch). Wird nur gehasht zur Spam-Forensik genutzt.
    const ip = (req.ip || req.socket?.remoteAddress || '').toString();
    return this.service.createAnfrage(slug, dto, ip);
  }
}
