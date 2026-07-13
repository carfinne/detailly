import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CalendarService } from './calendar.service';

/**
 * OEFFENTLICHER iCal-Feed: GET /api/v1/public/calendar/:token(.ics)
 *
 * BEWUSST OHNE Auth (Kalender-Apps koennen keinen Bearer-Token senden) – das
 * geheime Token in der URL ist der Zugang. Ungueltiges Token -> 404.
 *
 * D2 (Sicherheitsaudit Welle 1): frueher @SkipThrottle (= unbegrenzt, Token-
 * Bruteforce/DoS-Vektor). Jetzt grosszuegig, aber endlich gedrosselt:
 * 60/min pro IP - Kalender-Apps pollen nur alle paar Minuten, selbst viele
 * Abos hinter einer Buero-IP bleiben weit darunter.
 */
@Controller('public/calendar')
export class PublicCalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get(':token')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiExcludeEndpoint()
  async ics(@Param('token') token: string, @Res() res: Response) {
    const ics = await this.calendar.icsForToken(token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="detailly.ics"');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(ics);
  }
}
