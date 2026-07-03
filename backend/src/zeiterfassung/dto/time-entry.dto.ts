import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { TimeEntryType } from '../entities/time-entry.entity';

/**
 * Self-Service Kommen/Gehen. `userId` kommt aus dem JWT (`user.id`), den
 * `zeitpunkt` setzt der Service auf `new Date()`.
 */
export class StempelDto {
  @ApiProperty({ enum: TimeEntryType })
  @IsEnum(TimeEntryType)
  art: TimeEntryType;

  @ApiPropertyOptional({ description: 'Optionaler Standort (Location.id)' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;
}

/**
 * Leitung legt einen Eintrag fuer einen Mitarbeiter an. Datumsfelder als
 * ISO-String; der Service wandelt sie in `Date`.
 */
export class CreateTimeEntryDto {
  @ApiProperty({ description: 'Mitarbeiter (User.id)' })
  @IsString()
  userId: string;

  @ApiProperty({ enum: TimeEntryType })
  @IsEnum(TimeEntryType)
  art: TimeEntryType;

  @ApiProperty({ description: 'Zeitpunkt des Stempelns (ISO-Datum)' })
  @IsDateString()
  zeitpunkt: string;

  @ApiPropertyOptional({ description: 'Optionaler Standort (Location.id)' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;
}

/** Leitung korrigiert einen bestehenden Eintrag (alle Felder optional). */
export class UpdateTimeEntryDto extends PartialType(CreateTimeEntryDto) {}

/** Filter der Leitungs-Liste – als Query-Strings. */
export class TimeEntryQueryDto {
  @ApiPropertyOptional({ description: 'Nach Mitarbeiter filtern (User.id)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Nach Standort filtern (Location.id)' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Von-Datum (ISO-Datum)' })
  @IsOptional()
  @IsDateString()
  von?: string;

  @ApiPropertyOptional({ description: 'Bis-Datum (ISO-Datum)' })
  @IsOptional()
  @IsDateString()
  bis?: string;

  // Opt-in Pagination (T-009): ohne page/limit bleibt die Antwort ein Array
  // (Bestands-Consumer), mit page/limit kommt {data,total,page,limit}.
  // Grenzen klammert der zentrale Clamp (common/util/pagination) im Service.
  @ApiPropertyOptional({ description: 'Seite (aktiviert Pagination)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ description: 'Eintraege pro Seite, max 100 (aktiviert Pagination)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}
