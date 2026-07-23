import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AffiliateService } from './affiliate.service';

/**
 * Tenant-Sicht des Empfehlungsprogramms („Weiterempfehlen"). Bewusst OHNE
 * SubscriptionGuard – auch ein Testphasen-Betrieb soll werben duerfen (Wachstum).
 * Nur der Inhaber (OWNER): der Code/die Belohnungs-Anwartschaft sind kaufmaennische
 * Informationen des Betriebs. tenantId stammt IMMER aus dem Token – strikte
 * Isolation (ein Betrieb sieht nur SEINE eigenen Werbungen).
 */
@ApiTags('affiliate')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
@Controller('affiliate')
export class AffiliateController {
  constructor(private readonly service: AffiliateService) {}

  @Get('me')
  @ApiOperation({ summary: 'Eigener Empfehlungs-Code, Link, Zaehler und Belohnungs-Stand' })
  me(@CurrentUser() user: AuthUser) {
    return this.service.getMyView(user.tenantId);
  }
}
