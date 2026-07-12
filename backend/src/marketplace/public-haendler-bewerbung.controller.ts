import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MarketplaceService } from './marketplace.service';
import { HaendlerBewerbungDto } from './dto/marketplace.dto';

/**
 * OEFFENTLICHE Grosshaendler-Bewerbung (Welle 3) - BEWUSST OHNE Auth-Guard,
 * exakt nach dem public-booking-Muster (Controller ohne @UseGuards ist
 * oeffentlich; NIE 401 werfen, sonst Redirect-Schleife fuer Besucher).
 *
 * Schutzschichten: globaler ThrottlerGuard + strenges Routen-Limit (5/h je IP,
 * unauthentifiziertes Schreib-Surface), Honeypot im DTO (still verworfen) und
 * Doppel-Bewerbungs-Guard im Service (409). Es entsteht NUR ein Datensatz mit
 * status='beantragt' - Freischaltung ist ausschliesslich Betreiber-Sache.
 */
@ApiTags('public')
@Controller('public/haendler-bewerbung')
export class PublicHaendlerBewerbungController {
  constructor(private readonly service: MarketplaceService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Grosshaendler-Bewerbung absenden (Review durch Detailly)' })
  create(@Body() dto: HaendlerBewerbungDto) {
    return this.service.createBewerbung(dto);
  }
}
