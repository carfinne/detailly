import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUrl, MaxLength, Min, MinLength } from 'class-validator';

/** Nur http/https – die Links werden als href gerendert (kein javascript: o. ae.). */
const URL_OPTS = { require_protocol: true, protocols: ['http', 'https'] };

/** Feste Marktplatz-Bereiche (Haupt-Navigation). */
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

  @ApiProperty({ enum: MARKTPLATZ_BEREICHE, description: 'Bereich (Haupt-Navigation)' })
  @IsIn(MARKTPLATZ_BEREICHE)
  bereich: string;

  @ApiPropertyOptional({ description: 'Marke/Hersteller, z. B. "3M", "Koch Chemie"' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  marke?: string;

  @ApiPropertyOptional({ description: 'Legacy-Kategorie (durch bereich+marke abgeloest)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  kategorie?: string;

  @ApiProperty({ description: 'Detailly-Affiliate-Link zum Haendler-Shop' })
  @IsUrl(URL_OPTS)
  affiliateUrl: string;

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
