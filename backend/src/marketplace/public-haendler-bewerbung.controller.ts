import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { MarketplaceService } from './marketplace.service';
import { HaendlerBewerbungDto } from './dto/marketplace.dto';
import { HochgeladenesDokument, MAX_DOKUMENT_BYTES } from './kyb.service';
import { SecurityEventService } from '../security/security-event.service';
import { istHoneypotGefuellt, protokolliereHoneypotTreffer } from '../common/security/honeypot';

/**
 * OEFFENTLICHE Grosshaendler-Bewerbung (Welle 3) - BEWUSST OHNE Auth-Guard,
 * exakt nach dem public-booking-Muster (Controller ohne @UseGuards ist
 * oeffentlich; NIE 401 werfen, sonst Redirect-Schleife fuer Besucher).
 *
 * Welle 5 (KYB): Der Endpoint nimmt jetzt MULTIPART entgegen - die
 * Gewerbeanmeldung ist PFLICHT (PDF/JPG/PNG bis 10 MB). Multipart umgeht das
 * globale JSON-Body-Limit (256kb): die Datei parst Multer (memoryStorage), die
 * Textfelder validiert die globale ValidationPipe unveraendert.
 *
 * Schutzschichten: globaler ThrottlerGuard + strenges Routen-Limit (5/h je IP,
 * unauthentifiziertes Schreib-Surface), Honeypot (gemeinsamer Baustein – hier am
 * HTTP-Rand protokolliert, im Service zusaetzlich still verworfen = Defense-in-
 * Depth), Doppel-Bewerbungs-Guard im Service (409) und Magic-Byte-/Groessen-
 * Pruefung des Dokuments. Es entsteht NUR ein Datensatz mit status='beantragt'.
 */
@ApiTags('public')
@Controller('public/haendler-bewerbung')
export class PublicHaendlerBewerbungController {
  constructor(
    private readonly service: MarketplaceService,
    private readonly securityEvents: SecurityEventService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @UseInterceptors(FileInterceptor('dokument', { limits: { fileSize: MAX_DOKUMENT_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Grosshaendler-Bewerbung absenden (mit Gewerbeanmeldung, Review durch Detailly)' })
  async create(
    @Body() dto: HaendlerBewerbungDto,
    @UploadedFile() dokument?: HochgeladenesDokument,
    @Req() req?: Request,
  ): Promise<{ ok: true }> {
    // Honeypot: gefuellt => Bot. Erfolg vortaeuschen (KEIN Service-Aufruf, kein
    // Datei-Write), Treffer als Sicherheits-Ereignis protokollieren. Der Service
    // fuehrt denselben Check nochmal (Defense-in-Depth), falls er direkt aufgerufen
    // wird. Die verworfene Multipart-Datei liegt nur im Speicher und wird verworfen.
    if (istHoneypotGefuellt(dto.website)) {
      protokolliereHoneypotTreffer(this.securityEvents, 'haendler_bewerbung', req?.ip);
      return { ok: true };
    }
    return this.service.createBewerbung(dto, dokument);
  }
}
