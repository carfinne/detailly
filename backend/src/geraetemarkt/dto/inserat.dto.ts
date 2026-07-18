import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsIn,
  IsOptional,
  IsNumber,
  IsInt,
  IsBoolean,
  Equals,
  Min,
  Max,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import {
  GERAETE_KATEGORIEN,
  INSERAT_ZUSTAND,
  PREIS_MODUS,
  INSERAT_STATUS,
  MAX_INSERAT_PREIS,
} from '../geraetemarkt.constants';

const PLZ_REGION = /^\d{2}$/;

export class CreateInseratDto {
  @ApiProperty({ description: 'Titel des Inserats' })
  @IsString()
  @MaxLength(120)
  titel: string;

  @ApiProperty({ description: 'Beschreibung des Geraets' })
  @IsString()
  @MaxLength(4000)
  beschreibung: string;

  @ApiProperty({ enum: GERAETE_KATEGORIEN, description: 'Geraete-Kategorie (KEINE Chemie)' })
  @IsIn(GERAETE_KATEGORIEN as unknown as string[])
  kategorie: string;

  @ApiProperty({ enum: INSERAT_ZUSTAND, description: 'Zustand (neu/gebraucht/defekt)' })
  @IsIn(INSERAT_ZUSTAND as unknown as string[])
  zustand: string;

  @ApiProperty({ enum: PREIS_MODUS, description: 'Preis-Modus (fest/vb/anfrage)' })
  @IsIn(PREIS_MODUS as unknown as string[])
  preisModus: string;

  @ApiPropertyOptional({ description: 'Preis in EUR – Pflicht ausser bei preisModus=anfrage' })
  // Konsistenz: preis ist NUR bei preisModus != 'anfrage' zu setzen (dann Pflicht).
  @ValidateIf((o) => o.preisModus !== 'anfrage')
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_INSERAT_PREIS)
  preis?: number;

  @ApiPropertyOptional({ description: 'Nur 2-stellige PLZ-Region (grober Standort)' })
  @IsOptional()
  @Matches(PLZ_REGION, { message: 'plzRegion muss aus genau 2 Ziffern bestehen' })
  plzRegion?: string;

  @ApiPropertyOptional({ description: 'Grober Ort (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ort?: string;

  @ApiProperty({ description: 'Bestaetigung: nur gewerbliche Ausruestung (muss true sein)' })
  // Serverseitig erzwungen: Anlegen nur mit ausdruecklicher gewerblicher Bestaetigung.
  @IsBoolean()
  @Equals(true, { message: 'gewerblichBestaetigt muss true sein' })
  gewerblichBestaetigt: boolean;
}

export class UpdateInseratDto {
  @ApiPropertyOptional({ description: 'Titel des Inserats' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  titel?: string;

  @ApiPropertyOptional({ description: 'Beschreibung des Geraets' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  beschreibung?: string;

  @ApiPropertyOptional({ enum: GERAETE_KATEGORIEN })
  @IsOptional()
  @IsIn(GERAETE_KATEGORIEN as unknown as string[])
  kategorie?: string;

  @ApiPropertyOptional({ enum: INSERAT_ZUSTAND })
  @IsOptional()
  @IsIn(INSERAT_ZUSTAND as unknown as string[])
  zustand?: string;

  @ApiPropertyOptional({ enum: PREIS_MODUS })
  @IsOptional()
  @IsIn(PREIS_MODUS as unknown as string[])
  preisModus?: string;

  @ApiPropertyOptional({ description: 'Preis in EUR (Konsistenz zu preisModus wird serverseitig geprueft)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_INSERAT_PREIS)
  preis?: number;

  @ApiPropertyOptional({ description: 'Nur 2-stellige PLZ-Region' })
  @IsOptional()
  @Matches(PLZ_REGION, { message: 'plzRegion muss aus genau 2 Ziffern bestehen' })
  plzRegion?: string;

  @ApiPropertyOptional({ description: 'Grober Ort' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ort?: string;
}

/** Status-Wechsel des eigenen Inserats (reservieren/verkauft/entfernt/aktiv). */
export class UpdateInseratStatusDto {
  @ApiProperty({ enum: INSERAT_STATUS, description: 'Neuer Status' })
  @IsIn(INSERAT_STATUS as unknown as string[])
  status: string;
}

/** Query-Parameter fuer den cross-tenant Browse (paginiert + gefiltert). */
export class BrowseInseratDto {
  @ApiPropertyOptional({ description: 'Seite (>=1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Eintraege pro Seite' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ enum: GERAETE_KATEGORIEN })
  @IsOptional()
  @IsIn(GERAETE_KATEGORIEN as unknown as string[])
  kategorie?: string;

  @ApiPropertyOptional({ enum: INSERAT_ZUSTAND })
  @IsOptional()
  @IsIn(INSERAT_ZUSTAND as unknown as string[])
  zustand?: string;

  @ApiPropertyOptional({ description: 'Nur 2-stellige PLZ-Region' })
  @IsOptional()
  @Matches(PLZ_REGION, { message: 'plzRegion muss aus genau 2 Ziffern bestehen' })
  plzRegion?: string;

  @ApiPropertyOptional({ description: 'Mindestpreis in EUR' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  preisMin?: number;

  @ApiPropertyOptional({ description: 'Hoechstpreis in EUR' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  preisMax?: number;

  @ApiPropertyOptional({ description: 'Sortierung', enum: ['neu', 'preis_auf', 'preis_ab'] })
  @IsOptional()
  @IsIn(['neu', 'preis_auf', 'preis_ab'])
  sort?: 'neu' | 'preis_auf' | 'preis_ab';
}
