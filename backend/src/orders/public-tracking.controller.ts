import { Body, Controller, Get, Param, Post, Res, StreamableFile } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { storage } from '../common/storage';
import { OrdersService } from './orders.service';
import { OrdersPdfService } from './orders-pdf.service';
import { buildUebergabeDocDef } from './uebergabe-pdf';
import { CreateOrderFeedbackDto } from './dto/order-feedback.dto';

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

  // Dreisegmentig (…/:token/foto/:phase/:index) – vor allen kuerzeren :token-Routen.
  // Token-scoped Kundenbild: NUR Fotos des zum Token gehoerenden Auftrags. Der
  // Service loest Tenant + Dateiname aus dem Token auf (kein Request-Tenant, kein
  // fremder Dateiname aus der URL, Traversal-Guard ueber die Storage-Abstraktion).
  // Header wie das Schaufenster: nosniff (kein MIME-Sniffing) + Cache-Control
  // no-store, damit ein zurueckgezogener Zugriff (Token neu vergeben / Status
  // zurueckgesetzt) sofort wirkt und kein Shared Cache das Bild weiter ausliefert.
  @Get(':token/foto/:phase/:index')
  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @ApiExcludeEndpoint()
  async foto(
    @Param('token') token: string,
    @Param('phase') phase: string,
    @Param('index') index: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { key, contentType } = await this.orders.mappeFotoContextByToken(token, phase, index);
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(await storage.getStream('private', key));
  }

  // Kunden-Feedback (login-frei, ueber den Token). Bewusst niedriges Rate-Limit
  // gegen Missbrauch; Doppel-Absenden ist serverseitig idempotent (ein Feedback
  // je Auftrag). Antwort enthaelt den Bewertungs-Link OHNE Gating (kein Review-
  // Gating) – die Betonung im UI haengt allein an der Stimmung.
  @Post(':token/feedback')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  @ApiExcludeEndpoint()
  feedback(@Param('token') token: string, @Body() dto: CreateOrderFeedbackDto) {
    return this.orders.submitFeedbackByToken(token, dto);
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
