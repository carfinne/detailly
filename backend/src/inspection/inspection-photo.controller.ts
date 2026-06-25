import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Res,
  NotFoundException,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { basename, extname, join, resolve, sep } from 'path';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { findOneScoped } from '../common/tenant/tenant-scope';
import { DamagePhoto } from './entities/damage-photo.entity';

/**
 * FIX 2 (DSGVO) – guard-geschuetzte, tenant-scoped Auslieferung von
 * Inspektions-Fotos.
 *
 * Hintergrund: Bisher liegen alle Fotos hinter dem oeffentlich-statischen
 * /uploads-Mount (app.module.ts) – jeder mit der URL sieht personenbezogene
 * Fahrzeug-/Schadenfotos JEDES Mandanten ohne Login. Dieser Controller liefert
 * Inspektions-Fotos NUR noch nach erfolgreichem JwtAuthGuard + SubscriptionGuard
 * UND nur fuer den eigenen Tenant aus (DamagePhoto hat id + tenantId).
 *
 * Sicherheits-Eigenschaften:
 * - `findOneScoped()` wirft NotFound bei Fremd-/Nichtexistenz (existenz-orakel-sicher).
 * - Der in der DB gespeicherte `pfad` ('/uploads/inspections/<tenantId>/<datei>')
 *   wird NICHT als Datei-Lookup genutzt. Stattdessen wird NUR der Dateiname
 *   (`basename`) verwendet und der absolute Pfad strikt unter
 *   uploads/inspections/<tenantId>/ aufgeloest. Ein Praefix-Check gegen den
 *   aufgeloesten Tenant-Ordner verhindert Directory-Traversal (../).
 *
 * Hinweis: KEINE @Roles – Lesen ist fuer jede authentifizierte Rolle des
 * eigenen Tenants erlaubt (deshalb auch KEIN RolesGuard noetig).
 */
@ApiTags('inspektionen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@SkipThrottle() // Foto-Streams (Galerien = viele parallele XHR) nicht aufs globale Limit anrechnen
@Controller('inspections/photos')
export class InspectionPhotoController {
  constructor(
    @InjectRepository(DamagePhoto)
    private readonly photoRepo: Repository<DamagePhoto>,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Inspektions-Foto (Vollbild) tenant-sicher streamen' })
  async getFull(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return this.stream(user, id, 'full', res);
  }

  @Get(':id/thumb')
  @ApiOperation({ summary: 'Inspektions-Foto (Thumbnail) tenant-sicher streamen' })
  async getThumb(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return this.stream(user, id, 'thumb', res);
  }

  /**
   * Laedt das Foto tenant-scoped, leitet den Disk-Pfad traversal-sicher ab und
   * gibt es als Stream mit korrektem Content-Type zurueck.
   */
  private async stream(
    user: AuthUser,
    id: string,
    variante: 'full' | 'thumb',
    res: Response,
  ): Promise<StreamableFile> {
    const photo = await findOneScoped(this.photoRepo, user, id, 'Foto nicht gefunden');

    // thumbnailPfad == pfad, solange kein echtes Thumbnail (sharp = Feinschliff).
    const gespeicherterPfad =
      variante === 'thumb' ? photo.thumbnailPfad || photo.pfad : photo.pfad;

    const absoluterPfad = this.resolveTenantFile(user.tenantId, gespeicherterPfad);
    if (!absoluterPfad || !existsSync(absoluterPfad)) {
      throw new NotFoundException('Foto-Datei nicht gefunden');
    }

    res.setHeader('Content-Type', this.contentType(absoluterPfad));
    res.setHeader('X-Content-Type-Options', 'nosniff'); // kein MIME-Sniffing (SVG-XSS)
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return new StreamableFile(createReadStream(absoluterPfad));
  }

  /**
   * Loest den Disk-Pfad streng innerhalb von private-uploads/inspections/<tenantId>/
   * auf (NICHT statisch gemountet). Es wird NUR der Dateiname (basename) des
   * gespeicherten Pfads verwendet, damit ein manipulierter DB-Wert oder ../-Segment
   * nicht aus dem Tenant-Ordner ausbrechen kann. Liefert null, wenn ausserhalb.
   */
  private resolveTenantFile(tenantId: string, gespeicherterPfad: string): string | null {
    if (!gespeicherterPfad) return null;
    const tenantDir = resolve(process.cwd(), 'private-uploads', 'inspections', tenantId);
    const dateiname = basename(gespeicherterPfad);
    const kandidat = resolve(tenantDir, dateiname);
    // Praefix-Check inkl. Trenner, damit z.B. ".../<tenant>x" nicht durchrutscht.
    if (kandidat !== tenantDir && !kandidat.startsWith(tenantDir + sep)) {
      return null;
    }
    return kandidat;
  }

  /** Minimaler Content-Type aus der Dateiendung (PNG/JPG/WebP). */
  private contentType(pfad: string): string {
    switch (extname(pfad).toLowerCase()) {
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      default:
        return 'application/octet-stream';
    }
  }
}
