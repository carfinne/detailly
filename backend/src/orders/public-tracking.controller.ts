import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { OrdersService } from './orders.service';
import { OrdersPdfService } from './orders-pdf.service';
import { buildUebergabeDocDef } from './uebergabe-pdf';

/**
 * OEFFENTLICHE Auftrags-Verfolgung: GET /api/v1/public/orders/:token
 *
 * BEWUSST OHNE Auth – das geheime Token in der URL ist der Zugang (der Betrieb
 * teilt den Link mit seinem Kunden). Der Tenant ergibt sich aus dem Token, NICHT
 * aus dem Request. Ungueltiges/unbekanntes Token -> 404 (nie 401, kein Hinweis
 * ob ein Token existiert). Es bleibt die globale Rate-Limit-Bremse aktiv
 * (kein @SkipThrottle), um Enumeration zusaetzlich zu erschweren.
 *
 * Die Mappe-Routen (Pro-Feature `kundenerlebnis`) sind ZWEISEGMENTIG und daher
 * VOR `:token` deklariert (gleiche Konvention wie public-booking). Sie sind
 * zusaetzlich per @Throttle gedrosselt (unauthentifiziert) und liefern bei
 * fehlendem Feature/Status 404 (Service-Gate, kein Orakel).
 */
@Controller('public/orders')
export class PublicTrackingController {
  constructor(
    private readonly orders: OrdersService,
    private readonly pdf: OrdersPdfService,
  ) {}

  @Get(':token/mappe')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiExcludeEndpoint()
  mappe(@Param('token') token: string) {
    return this.orders.mappeWebByToken(token);
  }

  @Get(':token/mappe.pdf')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiExcludeEndpoint()
  async mappePdf(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { order, customer, vehicle, tenant, akzent, logoDataUrl } =
      await this.orders.mappePdfContextByToken(token);
    const buffer = await this.pdf.render(
      buildUebergabeDocDef(order as any, customer as any, vehicle as any, tenant as any, {
        akzent,
        logoDataUrl,
      }),
    );
    res.setHeader('Content-Type', 'application/pdf');
    // inline: der Kunde oeffnet die Mappe direkt im Browser (Download optional).
    res.setHeader('Content-Disposition', `inline; filename="Uebergabe_${order.auftragsnummer}.pdf"`);
    return new StreamableFile(buffer);
  }

  @Get(':token')
  @ApiExcludeEndpoint()
  track(@Param('token') token: string) {
    return this.orders.trackingByToken(token);
  }
}
