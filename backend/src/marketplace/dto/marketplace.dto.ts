import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
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
import { MarketplaceSettlementStatus } from '../entities/marketplace-settlement.entity';

/** Nur http/https – die Links werden als href gerendert (kein javascript: o. ae.). */
const URL_OPTS = { require_protocol: true, protocols: ['http', 'https'] };

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

  @ApiPropertyOptional({ description: 'Standard-Lieferzeit in Werktagen (Produkte koennen ueberschreiben)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  lieferzeitTage?: number;
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

  @ApiProperty({ description: 'Freie Kategorie, z. B. "Folien", "Chemie"' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  kategorie: string;

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

  @ApiPropertyOptional({ description: 'Lieferzeit in Werktagen; leer = Haendler-Standard' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  lieferzeitTage?: number;
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
// Haendler-Portal (Token-Zugriff): eigene Produkte + Bestellstatus
// ---------------------------------------------------------------------------

/** Produktpflege durch den Haendler selbst - ohne dealerId (kommt aus dem Token). */
export class PortalProductDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiProperty({ description: 'Freie Kategorie, z. B. "Folien", "Chemie"' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  kategorie: string;

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

  @ApiPropertyOptional({ description: 'Lieferzeit in Werktagen; leer = Haendler-Standard' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  lieferzeitTage?: number;
}

export class UpdatePortalProductDto extends PartialType(PortalProductDto) {}

/** Produktbild-Upload als Data-URL (Validierung/Magic-Bytes im Service). */
export class ProduktBildDto {
  @ApiProperty({ description: 'Bild als Data-URL (png/jpg/webp/gif, max. 5 MB)' })
  @IsString()
  @MaxLength(8_000_000)
  bild: string;
}

/** Bewertung mit Kaufnachweis (Service prueft nicht-stornierte Bestellung). */
export class CreateReviewDto {
  @ApiProperty({ description: '1-5 Sterne' })
  @IsInt()
  @Min(1)
  @Max(5)
  sterne: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  kommentar?: string;
}

export class OrderStatusDto {
  @ApiProperty({ enum: MarketplaceOrderStatus })
  @IsIn(Object.values(MarketplaceOrderStatus))
  status: MarketplaceOrderStatus;

  @ApiPropertyOptional({ description: 'Sendungsnummer (sinnvoll beim Wechsel auf "versendet")' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNummer?: string;

  @ApiPropertyOptional({ description: 'Link zur Sendungsverfolgung' })
  @IsOptional()
  @IsUrl(URL_OPTS)
  trackingUrl?: string;
}

// ---------------------------------------------------------------------------
// Provisions-Report + Abrechnung (Plattform-Seite)
// ---------------------------------------------------------------------------

/** Optionaler Zeitraum fuer Report/Export (Bestell-Eingangsdatum, inklusive). */
export class ProvisionQueryDto {
  @ApiPropertyOptional({ description: 'Beginn (YYYY-MM-DD), inklusive' })
  @IsOptional()
  @IsDateString()
  von?: string;

  @ApiPropertyOptional({ description: 'Ende (YYYY-MM-DD), inklusive' })
  @IsOptional()
  @IsDateString()
  bis?: string;
}

export class CreateSettlementDto {
  @ApiProperty({ description: 'Haendler (MarketplaceDealer.id)' })
  @IsString()
  @MaxLength(64)
  dealerId: string;

  @ApiProperty({ description: 'Zeitraum-Beginn (YYYY-MM-DD), inklusive' })
  @IsDateString()
  von: string;

  @ApiProperty({ description: 'Zeitraum-Ende (YYYY-MM-DD), inklusive' })
  @IsDateString()
  bis: string;
}

export class SettlementStatusDto {
  @ApiProperty({ enum: MarketplaceSettlementStatus })
  @IsIn(Object.values(MarketplaceSettlementStatus))
  status: MarketplaceSettlementStatus;
}

// ---------------------------------------------------------------------------
// Einlagern (Betrieb): Marktplatz-Positionen ins eigene Lager buchen
// ---------------------------------------------------------------------------

export class EinlagernPositionDto {
  @ApiProperty({ description: 'MarketplaceOrderItem.id (Position dieser Bestellung)' })
  @IsString()
  @MaxLength(64)
  itemId: string;

  @ApiPropertyOptional({
    description: 'Vorhandenes Shop-Produkt (Product.id); leer = neues Produkt aus der Position anlegen',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  productId?: string;
}

export class EinlagernDto {
  @ApiProperty({ type: [EinlagernPositionDto], description: 'Zu buchende Positionen (nicht gelistete werden uebersprungen)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EinlagernPositionDto)
  positionen: EinlagernPositionDto[];
}
