import {
  Controller,
  Get,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { ShowcaseService, ShowcaseBildVariante } from './showcase.service';

/**
 * OEFFENTLICHES Schaufenster-Surface – BEWUSST OHNE Auth-Guard (wie
 * PublicBookingController / PublicTrackingController): der Zugang ist der Slug
 * (Galerie) bzw. der shareToken (Einzel/Bild). Der Tenant ergibt sich aus dem
 * Slug, NIE aus dem Request. Unbekannt/inaktiv/Feature-fehlt/zurueckgezogen ->
 * 404 (nie 401, kein Orakel). Payload strikt PII-frei (Whitelist im Service).
 *
 * Routen unter /api/v1/public/schaufenster/... – ausserhalb des SPA-Fallbacks und
 * klar als "ohne Auth" erkennbar. Zusaetzlich @Throttle (unauthentifiziert); der
 * Bild-Endpunkt hat ein hoeheres Limit, da eine Galerie viele parallele Bild-
 * Requests ausloest. Verteilte Enumeration ist zusaetzlich durch das nicht-
 * erratbare shareToken (48 hex) und die Formatpruefung vor dem DB-Treffer begrenzt.
 *
 * WICHTIG: mehrsegmentige Routen VOR `:tenantSlug` deklarieren (eindeutige
 * Reihenfolge, gleiche Konvention wie public-booking).
 */
@ApiTags('public')
@Controller('public/schaufenster')
export class PublicShowcaseController {
  constructor(private readonly service: ShowcaseService) {}

  // Dreisegmentig (…/:shareToken/bild/:variante) – vor allen kuerzeren Routen.
  @Get(':tenantSlug/:shareToken/bild/:variante')
  @Throttle({ default: { limit: 240, ttl: 60000 } })
  @ApiOperation({ summary: 'Token-scoped Bild (nur veroeffentlichte Eintraege, traversal-sicher)' })
  async bild(
    @Param('tenantSlug') tenantSlug: string,
    @Param('shareToken') shareToken: string,
    @Param('variante') variante: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const v: ShowcaseBildVariante = variante === 'vorher' ? 'vorher' : 'nachher';
    const abs = await this.service.resolvePublicImagePath(tenantSlug, shareToken, v);
    res.setHeader('Content-Type', this.service.contentType(abs));
    // Kein MIME-Sniffing (SVG/Skript-XSS): der Upload erzwingt zwar Raster-
    // Magic-Bytes, nosniff ist die ausgabeseitige zweite Verteidigung.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Oeffentlich cachebar (Bilder aendern sich unter demselben Dateinamen nie).
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return new StreamableFile(createReadStream(abs));
  }

  // Zweisegmentig (…/:shareToken) – vor der einsegmentigen Galerie.
  @Get(':tenantSlug/:shareToken')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Einzelner veroeffentlichter Eintrag (PII-frei)' })
  item(
    @Param('tenantSlug') tenantSlug: string,
    @Param('shareToken') shareToken: string,
  ) {
    return this.service.publicItem(tenantSlug, shareToken);
  }

  @Get(':tenantSlug')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Oeffentliche Galerie aller veroeffentlichten Referenzen (PII-frei)' })
  gallery(@Param('tenantSlug') tenantSlug: string) {
    return this.service.publicGallery(tenantSlug);
  }
}
