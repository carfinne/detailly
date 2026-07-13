import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MarketplaceService } from './marketplace.service';
import { HaendlerBewerbungDto } from './dto/marketplace.dto';
import { HochgeladenesDokument, MAX_DOKUMENT_BYTES } from './kyb.service';

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
 * unauthentifiziertes Schreib-Surface), Honeypot im DTO (still verworfen),
 * Doppel-Bewerbungs-Guard im Service (409) und Magic-Byte-/Groessen-Pruefung des
 * Dokuments. Es entsteht NUR ein Datensatz mit status='beantragt'.
 */
@ApiTags('public')
@Controller('public/haendler-bewerbung')
export class PublicHaendlerBewerbungController {
  constructor(private readonly service: MarketplaceService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @UseInterceptors(FileInterceptor('dokument', { limits: { fileSize: MAX_DOKUMENT_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Grosshaendler-Bewerbung absenden (mit Gewerbeanmeldung, Review durch Detailly)' })
  create(@Body() dto: HaendlerBewerbungDto, @UploadedFile() dokument?: HochgeladenesDokument) {
    return this.service.createBewerbung(dto, dokument);
  }
}
