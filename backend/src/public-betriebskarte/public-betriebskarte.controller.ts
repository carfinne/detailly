import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  PublicBetriebskarteService,
  BetriebskarteResponse,
} from './public-betriebskarte.service';

/**
 * OEFFENTLICHE Betriebskarte fuer die Startseite (Deutschlandkarte + Zaehler
 * „X Betriebe bundesweit"). BEWUSST OHNE jeden Auth-Guard (ein Controller ohne
 * @UseGuards ist oeffentlich, wie /public/mitglieder und /public/booking).
 * Liefert NUR aktiv ZAHLENDE Betriebe, die der Anzeige ausdruecklich zugestimmt
 * haben (Opt-in), und NUR PII-arme, freigegebene Felder (strikte Whitelist im
 * Service) plus eine anonyme Gesamtzahl.
 *
 * Gedrosselt wie die uebrigen oeffentlichen GETs (30/min pro IP). Cache-freundlich:
 * die Liste aendert sich selten -> kurzer, gemeinsamer Cache (kein personalisierter
 * Inhalt). Route unter /api/v1/public/betriebskarte – klar als „ohne Auth" erkennbar.
 */
@ApiTags('public')
@Controller('public/betriebskarte')
export class PublicBetriebskarteController {
  constructor(private readonly service: PublicBetriebskarteService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Zahlende, zustimmende Betriebe + Gesamtzahl (Opt-in, PII-arm)' })
  get(): Promise<BetriebskarteResponse> {
    return this.service.getBetriebskarte();
  }
}
