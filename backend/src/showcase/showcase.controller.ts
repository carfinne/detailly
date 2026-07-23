import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequiresFeature } from '../common/decorators/requires-feature.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { FEATURE_SCHAUFENSTER } from '../subscriptions/plan-catalog';
import { ShowcaseService } from './showcase.service';
import { CreateShowcaseItemDto } from './dto/create-showcase-item.dto';
import { UpdateShowcaseItemDto } from './dto/update-showcase-item.dto';
import { PublishShowcaseItemDto } from './dto/publish-showcase-item.dto';

/**
 * Betreiber-Verwaltung des oeffentlichen Schaufensters (Vorher/Nachher-
 * Referenzen). Ganzer Controller hinter dem Tarif-Feature 'schaufenster' (ab
 * Basic): Tarife ohne den Key erhalten 403 PLAN_FEATURE_MISSING. Guard-Kette wie
 * SchichtdickeController; tenantId NIE aus dem Body, FKs/Scope ueber tenant-scope.
 *
 * Schreiben (anlegen/aendern/loeschen/veroeffentlichen) ist Leitung vorbehalten
 * (OWNER/MANAGER) – die Bildveroeffentlichung ist eine Marketing-/Rechts-
 * entscheidung. Lesen (Liste/Einzel) steht jeder Rolle des eigenen Tenants offen.
 */
@ApiTags('schaufenster')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, PlanFeatureGuard, RolesGuard)
@RequiresFeature(FEATURE_SCHAUFENSTER)
@Controller('schaufenster')
export class ShowcaseController {
  constructor(private readonly service: ShowcaseService) {}

  @Get()
  @ApiOperation({ summary: 'Schaufenster-Eintraege des eigenen Betriebs auflisten' })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user);
  }

  // Zweisegmentig (…/:id/bild/:variante) – VOR @Get(':id') deklariert.
  @Get(':id/bild/:variante')
  @SkipThrottle() // authentifizierter Bild-Stream (Galerie = viele parallele XHR)
  @ApiOperation({ summary: 'Eigenes Schaufenster-Bild (Vorschau, tenant-sicher streamen)' })
  async bild(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variante') variante: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (variante !== 'vorher' && variante !== 'nachher') {
      throw new NotFoundException('Bild nicht gefunden');
    }
    const abs = await this.service.resolveOperatorImagePath(user, id, variante);
    res.setHeader('Content-Type', this.service.contentType(abs));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return new StreamableFile(createReadStream(abs));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnen Eintrag laden' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(user, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Eintrag anlegen (Vorher/Nachher-Bild, unveroeffentlicht)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateShowcaseItemDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Eintrag bearbeiten (Text/Reihenfolge/Bilder ersetzen)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShowcaseItemDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Post(':id/veroeffentlichen')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Veroeffentlichen/Zurueckziehen (Consent-Pflicht bei Veroeffentlichen)' })
  setPublish(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishShowcaseItemDto,
  ) {
    return this.service.setPublish(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Eintrag loeschen (inkl. Bild-Kopien)' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user, id);
  }
}
