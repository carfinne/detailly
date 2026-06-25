import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { TenantsService } from './tenants.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * Oeffentliche Selbst-Registrierung eines neuen Betriebs (kein Login noetig).
   * Bewusst streng gedrosselt (3/min pro IP), weil hier ohne Authentifizierung
   * Datensaetze (Tenant/User/Abo) entstehen -> Missbrauchs-/Spam-Schutz.
   */
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Neuen Betrieb registrieren (Self-Signup, Testphase)' })
  @ApiResponse({ status: 201, description: 'Betrieb angelegt, Inhaber angemeldet (JWT)' })
  @ApiResponse({ status: 409, description: 'E-Mail bereits registriert' })
  register(@Body() dto: RegisterTenantDto) {
    return this.tenantsService.register(dto);
  }
}
