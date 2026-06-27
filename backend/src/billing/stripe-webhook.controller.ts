import {
  BadRequestException,
  Controller,
  Logger,
  Post,
  Req,
  RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { BillingService } from './billing.service';

/**
 * Stripe-Webhook-Endpunkt: POST /api/v1/billing/webhook.
 *
 * BEWUSST OHNE jeden Auth-Guard (Stripe ruft Server-zu-Server auf) und mit
 * @SkipThrottle (Stripe kann buendeln). Die Echtheit wird ueber die
 * Stripe-Signatur + den ROHEN Request-Body geprueft (rawBody:true in main.ts) –
 * deshalb hier KEIN @Body()-DTO, sondern req.rawBody.
 */
@Controller('billing')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly billing: BillingService) {}

  @Post('webhook')
  @SkipThrottle()
  @ApiExcludeEndpoint()
  async webhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['stripe-signature'] as string | undefined;
    const raw = req.rawBody;
    if (!raw) throw new BadRequestException('Roher Body fehlt.');

    let event;
    try {
      event = this.billing.verifyEvent(raw, signature);
    } catch (err) {
      // Detail nur serverseitig loggen (Signatur-Oracle vermeiden); Client bekommt
      // eine generische 400. Stripe wertet ohnehin nur den Status aus.
      this.logger.warn(`Webhook-Signaturprüfung fehlgeschlagen: ${(err as Error).message}`);
      throw new BadRequestException('Ungültige Webhook-Signatur.');
    }

    await this.billing.handleEvent(event);
    return { received: true };
  }
}
