import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { InvoicesService } from './invoices.service';

/**
 * OEFFENTLICHER Beleg-Download: GET /api/v1/public/invoices/:token (Meta)
 * und GET /api/v1/public/invoices/:token/pdf (PDF).
 *
 * BEWUSST OHNE Auth – das geheime Token in der URL ist der Zugang (der Betrieb
 * teilt den Link mit seinem Kunden). Der Tenant ergibt sich aus dem Token, NICHT
 * aus dem Request. Nur OFFENE/BEZAHLTE Belege; alles andere (Entwurf/Storno) oder
 * ein unbekanntes Token -> 404 (nie 401, kein Hinweis ob ein Token existiert).
 * Zusaetzlich zum globalen Limit ein enges Pro-IP-Limit (30/min): der PDF-Bau ist
 * CPU-intensiv und der Endpunkt unauthentifiziert -> Schutz gegen Bau-Flut/DoS.
 */
@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('public/invoices')
export class PublicInvoiceController {
  constructor(private readonly service: InvoicesService) {}

  @Get(':token')
  @ApiExcludeEndpoint()
  meta(@Param('token') token: string) {
    return this.service.downloadMetaByToken(token);
  }

  @Get(':token/pdf')
  @ApiExcludeEndpoint()
  async pdf(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, nummer } = await this.service.buildPdfByToken(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nummer}.pdf"`);
    return new StreamableFile(buffer);
  }
}
