import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InvoicesService } from './invoices.service';
import { PublicAcceptDto } from './dto/invoice.dto';

/**
 * OEFFENTLICHE Angebots-Freigabe: GET /api/v1/public/angebote/:token (Varianten)
 * und POST /api/v1/public/angebote/:token/annehmen (eine Variante annehmen).
 *
 * BEWUSST OHNE Auth – das geheime Token in der URL ist der Zugang (der Betrieb
 * teilt den Link mit seinem Kunden). Der Tenant ergibt sich aus dem Token, NICHT
 * aus dem Request; die Gruppe wird strikt ueber tenantId+varianteGruppeId geladen
 * (kein Fremd-Tenant-Leak). Unbekanntes/unplausibles Token -> 404 (nie 401).
 * Zusaetzlich zum globalen Limit ein enges Pro-IP-Limit (30/min) wie beim
 * oeffentlichen Beleg-Download: unauthentifiziert + schreibende Annahme.
 */
@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('public/angebote')
export class PublicAngebotController {
  constructor(private readonly service: InvoicesService) {}

  @Get(':token')
  @ApiExcludeEndpoint()
  gruppe(@Param('token') token: string) {
    return this.service.angebotGruppeByToken(token);
  }

  @Post(':token/annehmen')
  @ApiExcludeEndpoint()
  annehmen(@Param('token') token: string, @Body() dto: PublicAcceptDto) {
    return this.service.acceptAngebotByToken(token, dto.invoiceId);
  }
}
