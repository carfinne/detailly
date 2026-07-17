import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { PlatformSecurityService } from './platform-security.service';
import { CreateIpBlockDto, SecurityEventQueryDto } from './dto/platform-security.dto';
import type { IpBlockSeverity } from './security.constants';

/**
 * Betreiber-Sicht "Sicherheit" (Sentinel Teil 2) – NUR Detailly-Plattform-Rollen.
 * KEIN SubscriptionGuard (plattform-intern, nicht an ein Kunden-Abo gebunden).
 *
 * Rollen-Gate (heilig): Klassen-Ebene laesst alle drei Plattform-Rollen LESEN;
 * die schreibenden Sperr-Endpunkte tragen ein Methoden-`@Roles(PLATFORM_ADMIN)`,
 * das das Klassen-Gate ueberschreibt (Reflector.getAllAndOverride, Handler
 * zuerst) -> Analyst/Support koennen lesen, aber NICHT sperren/entsperren.
 * platform_admin wird ohnehin vom RolesGuard generell durchgelassen.
 *
 * Datensparsam: Antworten tragen nie Klartext-Mails (die Entity haelt nur
 * emailHash). Manuelle Sperren werden ueber den PlatformSecurityService auditiert.
 */
@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_ANALYST, UserRole.PLATFORM_SUPPORT)
@Controller('platform/security')
export class PlatformSecurityController {
  constructor(private readonly service: PlatformSecurityService) {}

  @Get('events')
  @ApiOperation({ summary: 'Sicherheits-Ereignisse (paginiert, Filter type/severity/ip/since)' })
  async events(@Query() q: SecurityEventQueryDto) {
    const sinceMs = q.since ? Date.parse(q.since) : undefined;
    return this.service.findEvents({
      type: q.type,
      severity: q.severity,
      ip: q.ip,
      sinceMs: Number.isFinite(sinceMs) ? (sinceMs as number) : undefined,
      limit: q.limit,
      offset: q.offset,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Sicherheits-Kacheln (Fehl-Logins 24h, aktive Sperren, Top-IPs)' })
  summary() {
    return this.service.summary();
  }

  @Get('blocks')
  @ApiOperation({ summary: 'Aktive IP-Sperren' })
  blocks() {
    return this.service.listBlocks(true);
  }

  @Post('blocks')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'IP manuell sperren (nur PLATFORM_ADMIN, auditiert)' })
  createBlock(@Body() dto: CreateIpBlockDto, @CurrentUser() user: AuthUser) {
    return this.service.manualBlock({
      ip: dto.ip,
      reason: dto.reason,
      severity: dto.severity as IpBlockSeverity | undefined,
      durationMs: dto.durationMinutes ? dto.durationMinutes * 60_000 : null,
      admin: { id: user.id, tenantId: user.tenantId },
    });
  }

  @Delete('blocks/:id')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'IP-Sperre aufheben (nur PLATFORM_ADMIN, auditiert)' })
  async removeBlock(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const block = await this.service.manualUnblock(id, { id: user.id, tenantId: user.tenantId });
    if (!block) throw new NotFoundException('Keine aktive Sperre mit dieser id.');
    return block;
  }
}
