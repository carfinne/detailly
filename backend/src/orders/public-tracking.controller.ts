import { Controller, Get, Param } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { OrdersService } from './orders.service';

/**
 * OEFFENTLICHE Auftrags-Verfolgung: GET /api/v1/public/orders/:token
 *
 * BEWUSST OHNE Auth – das geheime Token in der URL ist der Zugang (der Betrieb
 * teilt den Link mit seinem Kunden). Der Tenant ergibt sich aus dem Token, NICHT
 * aus dem Request. Ungueltiges/unbekanntes Token -> 404 (nie 401, kein Hinweis
 * ob ein Token existiert). Es bleibt die globale Rate-Limit-Bremse aktiv
 * (kein @SkipThrottle), um Enumeration zusaetzlich zu erschweren.
 */
@Controller('public/orders')
export class PublicTrackingController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':token')
  @ApiExcludeEndpoint()
  track(@Param('token') token: string) {
    return this.orders.trackingByToken(token);
  }
}
