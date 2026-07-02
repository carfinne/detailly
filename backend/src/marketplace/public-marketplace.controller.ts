import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { MarketplaceService } from './marketplace.service';

/**
 * OEFFENTLICHE Auslieferung der Marktplatz-Produktbilder. Bewusst ohne Auth:
 * der Katalog ist fuer alle Betriebe gleich UND das Haendler-Portal (Token,
 * kein Login) braucht die Bilder ebenfalls. Nicht sensibel; Dateiname ist
 * eine zufaellige UUID und wird im Service strikt validiert (kein Traversal).
 */
@ApiTags('marketplace')
@Throttle({ default: { limit: 300, ttl: 60000 } })
@Controller('public/marketplace')
export class PublicMarketplaceController {
  constructor(private readonly service: MarketplaceService) {}

  @Get('produktbilder/:datei')
  @ApiOperation({ summary: 'Produktbild ausliefern (oeffentlich, unveraenderlich gecacht)' })
  async produktbild(@Param('datei') datei: string, @Res() res: Response) {
    const { pfad, contentType } = await this.service.produktbildDatei(datei);
    res.setHeader('Content-Type', contentType);
    // Dateiname ist ein Zufalls-UUID je Upload -> Inhalt aendert sich nie.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // Helmet setzt global CORP same-origin; Katalogbilder sind bewusst
    // oeffentlich und muessen auch cross-origin (Dev: Frontend-Port) laden.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.sendFile(pfad);
  }
}
