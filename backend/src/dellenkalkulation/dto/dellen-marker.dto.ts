import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  GROESSENKLASSEN,
  Groessenklasse,
  POSITION_MODES,
  PositionMode,
} from '../dellen-preis.util';

/** 3D-Weltpunkt + Oberflaechennormale (nur Visualisierung). */
export class Position3DDto {
  @ApiProperty() @IsNumber() x: number;
  @ApiProperty() @IsNumber() y: number;
  @ApiProperty() @IsNumber() z: number;
  @ApiProperty() @IsNumber() nx: number;
  @ApiProperty() @IsNumber() ny: number;
  @ApiProperty() @IsNumber() nz: number;
}

/**
 * Ein einzelner Dellen-Marker (Teil des Batch-Requests). BEWUSST KEIN
 * `einzelpreis`-Feld: der Preis wird serverseitig aus der Tenant-Matrix berechnet
 * und ein etwaig gesendeter Wert waere wirkungslos. Im Einzel-Modus zaehlen
 * groessenklasse/kante/alu/lackschaden; im Hagel-Modus dellenAnzahl.
 */
export class DellenMarkerDto {
  @ApiProperty({ description: 'Kanonische Bauteil-ID (partId)' })
  @IsString()
  bauteil: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bauteilLabel?: string;

  @ApiProperty({ enum: POSITION_MODES })
  @IsIn(POSITION_MODES)
  positionMode: PositionMode;

  @ApiPropertyOptional({ type: Position3DDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => Position3DDto)
  position3d?: Position3DDto;

  @ApiPropertyOptional({ description: 'front|heck|links|rechts|dach' })
  @IsOptional()
  @IsString()
  ansicht2d?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  x2d?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  y2d?: number;

  @ApiPropertyOptional({ enum: GROESSENKLASSEN, description: 'Einzel-Modus: Groessenklasse der Delle' })
  @IsOptional()
  @IsIn(GROESSENKLASSEN)
  groessenklasse?: Groessenklasse;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  kante?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alu?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  lackschaden?: boolean;

  @ApiPropertyOptional({ description: 'Hagel-Modus: Dellen-Anzahl an diesem Bauteil' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  dellenAnzahl?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  reihenfolge?: number;

  @ApiPropertyOptional({ description: 'Offline-Sync-Idempotenz' })
  @IsOptional()
  @IsString()
  clientUuid?: string;
}

/**
 * Batch-Setzen ALLER Marker einer Kalkulation in EINEM Request (ersetzt die
 * bisherige Marker-Liste vollstaendig). Bewusst kein Einzel-POST je Marker:
 * ein Klick-Workflow synchronisiert die komplette Liste. Max-Cap gegen DoS.
 */
export class SetDellenMarkerDto {
  // @ArrayMaxSize kappt schon in der Validierungs-Pipe (vor dem Service), analog
  // zur Service-Schranke MAX_MARKER (500) – Projekt-Konvention gegen Payload-DoS.
  @ApiProperty({ type: [DellenMarkerDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => DellenMarkerDto)
  markers: DellenMarkerDto[];
}
