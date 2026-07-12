import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { FolienRollenService } from './folien-rollen.service';
import { FolienRolleStatus } from './entities/folien-rolle.entity';
import { CreateFolienRolleDto, UpdateFolienRolleDto } from './dto/folien-rolle.dto';

// Loeschen entfernt eine Rolle endgueltig -> nur Leitung (Schwund-Schutz;
// regulaeres Abschreiben laeuft ueber status=ENTSORGT).
const VERWALTUNG = [UserRole.OWNER, UserRole.MANAGER];

/**
 * Restrollen-Verwaltung (Folierer-Welle 2). KEIN Tarif-Gate (Lager/Shop ist KERN).
 * Ansehen/Anlegen/Pflegen: jede Rolle (wie Material buchen). Loeschen: nur Leitung.
 */
@ApiTags('folien-rollen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('folien-rollen')
export class FolienRollenController {
  constructor(private readonly service: FolienRollenService) {}

  @Get()
  @ApiOperation({ summary: 'Restrollen auflisten (optional nach Produkt/Status gefiltert)' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('productId') productId?: string,
    @Query('status') status?: FolienRolleStatus,
  ) {
    return this.service.findAll(user.tenantId, { productId, status });
  }

  @Post()
  @ApiOperation({ summary: 'Restrolle anlegen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFolienRolleDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Restrolle bearbeiten (restLfm/Status/Bezeichnung/Charge)' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateFolienRolleDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Restrolle loeschen (nur Leitung; Abschreiben via Status ENTSORGT)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
