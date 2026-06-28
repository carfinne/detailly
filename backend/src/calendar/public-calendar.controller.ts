import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CalendarService } from './calendar.service';

/**
 * OEFFENTLICHER iCal-Feed: GET /api/v1/public/calendar/:token(.ics)
 *
 * BEWUSST OHNE Auth (Kalender-Apps koennen keinen Bearer-Token senden) – das
 * geheime Token in der URL ist der Zugang. @SkipThrottle, da Kalender-Apps in
 * kurzen Abstaenden pollen. Ungueltiges Token -> 404.
 */
@Controller('public/calendar')
export class PublicCalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get(':token')
  @SkipThrottle()
  @ApiExcludeEndpoint()
  async ics(@Param('token') token: string, @Res() res: Response) {
    const ics = await this.calendar.icsForToken(token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="detailly.ics"');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(ics);
  }
}
