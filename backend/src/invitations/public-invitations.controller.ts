import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InvitationsService } from './invitations.service';
import { AcceptInvitationDto, LookupInvitationDto } from './dto/invitation.dto';

/**
 * OEFFENTLICHE Einloese-Endpunkte fuer Mitarbeiter-Einladungen (ohne Login) – ein
 * Controller OHNE @UseGuards ist oeffentlich (wie /auth/password-reset/* und
 * /public/booking). Beide Endpunkte sind gegen Token-Bruteforce gedrosselt
 * (wie /auth/password-reset/confirm: 5/min) und liefern bei ungueltigem/
 * abgelaufenem/verbrauchtem Token EINE einheitliche, nicht-verratende 400.
 *
 * POST statt GET fuer die Vorschau, damit das Roh-Token NICHT in Server-/Proxy-
 * Zugriffslogs (Query-String) landet.
 */
@ApiTags('public')
@Controller('public/einladung')
export class PublicInvitationsController {
  constructor(private readonly service: InvitationsService) {}

  @Post('info')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Einladung nachschlagen (Betrieb + Rolle)' })
  @ApiResponse({ status: 200, description: 'Betrieb + Rolle der Einladung' })
  @ApiResponse({ status: 400, description: 'Token ungueltig, abgelaufen oder verbraucht' })
  lookup(@Body() dto: LookupInvitationDto) {
    return this.service.lookup(dto.token);
  }

  @Post('annehmen')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Einladung einloesen (eigenes Passwort setzen, Auto-Login)' })
  @ApiResponse({ status: 200, description: 'Konto angelegt + eingeloggt' })
  @ApiResponse({ status: 400, description: 'Token ungueltig, abgelaufen oder verbraucht' })
  @ApiResponse({ status: 403, description: 'Mitarbeiter-Limit des Tarifs erreicht' })
  accept(@Body() dto: AcceptInvitationDto) {
    return this.service.accept(dto.token, dto);
  }
}
