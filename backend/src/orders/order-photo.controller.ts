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
import { basename, extname, resolve, sep } from 'path';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { findOneScoped } from '../common/tenant/tenant-scope';
import { Order } from './entities/order.entity';

/**
 * Guard-geschuetzte, tenant-scoped Auslieferung der Auftrags-Fotos
 * (Vorher/Nachher). Spiegelt den InspectionPhotoController.
 *
 * Bisher lagen die Auftrags-Fotos flach unter dem oeffentlich-statischen
 * /uploads-Mount -> jeder mit der URL sah personenbezogene Fahrzeugfotos JEDES
 * Mandanten ohne Login (DSGVO-Leck). Jetzt:
 *  - JwtAuthGuard + SubscriptionGuard (nur authentifiziert, eigener Betrieb),
 *  - der Auftrag wird tenant-scoped geladen (findOneScoped -> NotFound bei
 *    Fremd-/Nichtexistenz, orakel-sicher),
 *  - der angefragte Dateiname MUSS zu DIESEM Auftrag gehoeren (Membership-Check
 *    gegen bilderVorher/bilderNachher) -> kein Erraten anderer Tenant-Dateien,
 *  - der Disk-Pfad wird STRENG unter private-uploads/orders/<tenantId>/ aufgeloest
 *    (basename + Praefix-Check) -> kein Directory-Traversal.
 *
 * KEINE @Roles: Lesen ist fuer jede authentifizierte Rolle des eigenen Tenants
 * erlaubt. @SkipThrottle, weil Galerien viele parallele Bild-Requests ausloesen.
 */
@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@SkipThrottle()
@Controller('orders')
export class OrderPhotoController {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  @Get(':id/fotos/:dateiname')
  @ApiOperation({ summary: 'Auftrags-Foto (Vorher/Nachher) tenant-sicher streamen' })
  async getFoto(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('dateiname') dateiname: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const order = await findOneScoped(this.orderRepo, user, id, 'Auftrag nicht gefunden');

    // Membership: nur Dateien, die tatsaechlich zu diesem Auftrag gehoeren.
    const datei = basename(dateiname);
    const erlaubt = [...(order.bilderVorher ?? []), ...(order.bilderNachher ?? [])].map((b) =>
      basename(b),
    );
    if (!erlaubt.includes(datei)) {
      throw new NotFoundException('Foto nicht gefunden');
    }

    const absoluterPfad = this.resolveTenantFile(user.tenantId, datei);
    if (!absoluterPfad || !existsSync(absoluterPfad)) {
      throw new NotFoundException('Foto-Datei nicht gefunden');
    }

    res.setHeader('Content-Type', this.contentType(absoluterPfad));
    res.setHeader('X-Content-Type-Options', 'nosniff'); // kein MIME-Sniffing (SVG-XSS)
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return new StreamableFile(createReadStream(absoluterPfad));
  }

  /**
   * Loest den Disk-Pfad STRENG innerhalb von private-uploads/orders/<tenantId>/
   * auf. Es wird NUR der Dateiname (basename) verwendet; ein Praefix-Check inkl.
   * Trenner verhindert Ausbrechen aus dem Tenant-Ordner. Liefert null, wenn
   * ausserhalb.
   */
  private resolveTenantFile(tenantId: string, datei: string): string | null {
    if (!datei) return null;
    const tenantDir = resolve(process.cwd(), 'private-uploads', 'orders', tenantId);
    const kandidat = resolve(tenantDir, basename(datei));
    if (kandidat !== tenantDir && !kandidat.startsWith(tenantDir + sep)) {
      return null;
    }
    return kandidat;
  }

  /** Minimaler Content-Type aus der Dateiendung (PNG/JPG/WebP/GIF). */
  private contentType(pfad: string): string {
    switch (extname(pfad).toLowerCase()) {
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      case '.gif':
        return 'image/gif';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      default:
        return 'application/octet-stream';
    }
  }
}
