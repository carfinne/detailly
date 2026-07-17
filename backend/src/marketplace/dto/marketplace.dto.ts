import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MarketplaceOrderStatus } from '../entities/marketplace-order.entity';

/** Nur http/https – die Links werden als href gerendert (kein javascript: o. ae.). */
const URL_OPTS = { require_protocol: true, protocols: ['http', 'https'] };

/** Feste Marktplatz-Bereiche (Haupt-Navigation im Katalog). */
export const MARKTPLATZ_BEREICHE = ['folierung', 'aufbereitung', 'ppf', 'sonstiges'];

export class CreateDealerDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  beschreibung?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  webseite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aktiv?: boolean;

  @ApiPropertyOptional({ description: 'Kontakt fuer Bestell-Benachrichtigungen' })
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  kontaktEmail?: string;

  @ApiPropertyOptional({ description: 'Betreiber-Provision in Prozent (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  provisionSatz?: number;
}

export class UpdateDealerDto extends PartialType(CreateDealerDto) {}

export class CreateProductDto {
  @ApiProperty({ description: 'Haendler (MarketplaceDealer.id)' })
  @IsString()
  dealerId: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: MARKTPLATZ_BEREICHE, description: 'Bereich (Haupt-Navigation im Katalog)' })
  @IsIn(MARKTPLATZ_BEREICHE)
  bereich: string;

  @ApiPropertyOptional({ description: 'Marke/Hersteller, z. B. "3M", "Koch Chemie" (Schnellfilter)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  marke?: string;

  @ApiPropertyOptional({ description: 'Legacy-Kategorie (durch bereich+marke abgeloest)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  kategorie?: string;

  @ApiPropertyOptional({ description: 'Detailly-Affiliate-Link zum Haendler-Shop (optional bei bestellbaren Produkten)' })
  @IsOptional()
  @IsUrl(URL_OPTS)
  affiliateUrl?: string;

  @ApiPropertyOptional({ description: 'Direkt in der App bestellbar (braucht preis)' })
  @IsOptional()
  @IsBoolean()
  bestellbar?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  preis?: number;

  @ApiPropertyOptional({ description: 'z. B. "pro Rolle", "ab"' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  preisHinweis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  bildUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  beschreibung?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aktiv?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

// ---------------------------------------------------------------------------
// In-App-Bestellung (Betrieb)
// ---------------------------------------------------------------------------

export class OrderItemInputDto {
  @ApiProperty({ description: 'MarketplaceProduct.id' })
  @IsString()
  @MaxLength(64)
  productId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(999)
  menge: number;
}

export class CreateMarketplaceOrderDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  kontaktName: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(160)
  kontaktEmail: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  kontaktTelefon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  lieferFirma?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  lieferStrasse?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  lieferPlz?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lieferOrt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lieferLand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notiz?: string;

  @ApiProperty({ type: [OrderItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  positionen: OrderItemInputDto[];
}

// ---------------------------------------------------------------------------
// Produkt-Bewertung (Buy-Side): nur verifizierte Kaeufer, eine je Betrieb
// ---------------------------------------------------------------------------

/**
 * Bewertung schreiben/aendern. sterne 1–5 (Pflicht), text optional. Strikte
 * Whitelist: tenantId/userId/verifiziert/aktiv kommen NIE aus dem Body – sie
 * werden serverseitig gesetzt (JWT bzw. Kauf-Nachweis). Zusammen mit der
 * globalen ValidationPipe (whitelist + forbidNonWhitelisted) ist Mass-Assignment
 * ausgeschlossen.
 */
export class CreateReviewDto {
  @ApiProperty({ description: 'Sterne 1–5', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  sterne: number;

  @ApiPropertyOptional({ description: 'Bewertungstext (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;
}

// ---------------------------------------------------------------------------
// Haendler-Portal (Token-Zugriff): eigene Produkte + Bestellstatus
// ---------------------------------------------------------------------------

/** Produktpflege durch den Haendler selbst - ohne dealerId (kommt aus dem Token). */
export class PortalProductDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: MARKTPLATZ_BEREICHE, description: 'Bereich (Haupt-Navigation im Katalog)' })
  @IsIn(MARKTPLATZ_BEREICHE)
  bereich: string;

  @ApiPropertyOptional({ description: 'Marke/Hersteller, z. B. "3M", "Koch Chemie" (Schnellfilter)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  marke?: string;

  @ApiPropertyOptional({ description: 'Legacy-Kategorie (durch bereich+marke abgeloest)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  kategorie?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  preis?: number;

  @ApiPropertyOptional({ description: 'z. B. "pro Rolle", "ab"' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  preisHinweis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  bildUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  affiliateUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  beschreibung?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bestellbar?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aktiv?: boolean;
}

export class UpdatePortalProductDto extends PartialType(PortalProductDto) {}

export class OrderStatusDto {
  @ApiProperty({ enum: MarketplaceOrderStatus })
  @IsIn(Object.values(MarketplaceOrderStatus))
  status: MarketplaceOrderStatus;
}

// ---------------------------------------------------------------------------
// Grosshaendler-Bewerbung (oeffentlich) + Betreiber-Review (Welle 3)
// ---------------------------------------------------------------------------

/**
 * Oeffentliche Grosshaendler-Bewerbung. STRIKTE Whitelist wie bei der
 * Online-Terminanfrage: KEIN status/aktiv/provisionSatz/Token aus dem Body –
 * zusammen mit der globalen ValidationPipe (whitelist+forbidNonWhitelisted)
 * ist Mass-Assignment ausgeschlossen. Pflicht laut Betreiber-Entscheidung:
 * Firma, Ansprechpartner, E-Mail und USt-IdNr (B2B-Seriositaets-Check).
 */
export class HaendlerBewerbungDto {
  @ApiProperty({ description: 'Firmenname' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ description: 'Ansprechpartner (Vor- und Nachname)' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ansprechpartner: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(160)
  kontaktEmail: string;

  /** Pflichtfeld (Betreiber-Entscheidung); Format prueft der Betreiber im Review. */
  @ApiProperty({ description: 'USt-IdNr., z. B. DE123456789' })
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  ustIdNr: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  webseite?: string;

  @ApiPropertyOptional({ description: 'Anschrift (Freitext)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  adresse?: string;

  @ApiPropertyOptional({ description: 'Sortiment als CSV der Marktplatz-Bereiche' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sortiment?: string;

  @ApiPropertyOptional({ description: 'Nachricht an das Detailly-Team' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nachricht?: string;

  /**
   * Honeypot (wie CreateBookingRequestDto.website): per CSS versteckt, Menschen
   * lassen es leer. Gefuellt -> still verwerfen, Erfolg vortaeuschen. Wird NIE
   * gespeichert.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

/** Betreiber-Freigabe einer Bewerbung; Provision im Review anpassbar (Default 10 %). */
export class DealerFreigabeDto {
  @ApiPropertyOptional({ description: 'Betreiber-Provision in Prozent (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  provisionSatz?: number;
}
