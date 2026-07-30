import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

import { Betriebstyp } from '../../tenants/entities/tenant.entity';

/**
 * Query der OEFFENTLICHEN Betriebs-Suche (GET /public/mitglieder/suche). Alle
 * Parameter optional; ohne Filter liefert die Suche die erste Seite aller
 * zustimmenden (Opt-in) Betriebe. Die eigentliche Whitelist-/Opt-in-/Abo-Logik
 * liegt im Service (Wiederverwendung von PublicMembersService) – dieses DTO
 * validiert und begrenzt NUR die Eingaben (ValidationPipe: whitelist +
 * forbidNonWhitelisted, daher werden unbekannte Query-Keys hart abgelehnt).
 */
export class SucheMitgliederDto {
  /** Freitext: matcht Firmenname ODER Ort (case-/diakritik-insensitiv im Service). */
  @ApiPropertyOptional({ description: 'Suchtext (Firmenname oder Ort)', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  /** 2-stellige PLZ-Leitregion (z. B. "10" fuer Berlin) – NIE die volle PLZ. */
  @ApiPropertyOptional({ description: '2-stellige PLZ-Leitregion', example: '10' })
  @IsOptional()
  @Matches(/^\d{2}$/, { message: 'plzRegion muss genau 2 Ziffern haben' })
  plzRegion?: string;

  /** Gewerk/Betriebstyp-Filter (bereits oeffentliches Feld je Betrieb). */
  @ApiPropertyOptional({ enum: Betriebstyp })
  @IsOptional()
  @IsEnum(Betriebstyp)
  betriebstyp?: Betriebstyp;

  /** 1-basierte Seite (Default 1). */
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /** Eintraege je Seite (Default 12, max 48). */
  @ApiPropertyOptional({ minimum: 1, maximum: 48, default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  pageSize?: number;
}
