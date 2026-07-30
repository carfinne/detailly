import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  PublicMembersService,
  PublicMitglied,
  PublicMitgliederSeite,
} from './public-members.service';
import { SucheMitgliederDto } from './dto/suche-mitglieder.dto';

/**
 * OEFFENTLICHES Mitglieder-Verzeichnis fuer die Startseite (Social Proof) –
 * BEWUSST OHNE jeden Auth-Guard (ein Controller ohne @UseGuards ist oeffentlich,
 * wie /public/booking und /tenants/register). Liefert NUR Betriebe, die der
 * Anzeige ausdruecklich zugestimmt haben (Opt-in), und NUR PII-arme, freigegebene
 * Felder (strikte Whitelist im Service).
 *
 * Gedrosselt wie die uebrigen oeffentlichen GETs (30/min pro IP). Cache-freundlich:
 * die Liste aendert sich selten -> kurzer, gemeinsamer Cache erlaubt (kein
 * personalisierter Inhalt).
 *
 * Route unter /api/v1/public/mitglieder – klar als "ohne Auth" erkennbar.
 */
@ApiTags('public')
@Controller('public/mitglieder')
export class PublicMembersController {
  constructor(private readonly service: PublicMembersService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Zustimmende Betriebe fuer die Startseite (Opt-in, PII-arm)' })
  list(): Promise<PublicMitglied[]> {
    return this.service.listMitglieder();
  }

  /**
   * OEFFENTLICHE, paginierte Betriebs-Suche (Firmenname/Ort + Leitregion/Gewerk).
   * Route /api/v1/public/mitglieder/suche – KEIN Auth-Guard (wie die Liste),
   * dieselbe Drosselung (30/min pro IP). Nur GET-Query, keine PII: die Whitelist
   * und der Opt-in-Filter liegen vollstaendig im Service. Kurzer, gemeinsamer Cache
   * (variiert per Query-URL) – die Ergebnismenge aendert sich selten.
   */
  @Get('suche')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: 'Oeffentliche Betriebs-Suche (Opt-in, PII-arm, paginiert)' })
  suche(@Query() dto: SucheMitgliederDto): Promise<PublicMitgliederSeite> {
    return this.service.sucheMitglieder(dto);
  }
}
