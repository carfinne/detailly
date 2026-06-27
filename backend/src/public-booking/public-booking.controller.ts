import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
