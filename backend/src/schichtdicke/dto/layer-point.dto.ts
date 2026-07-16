import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
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
import { LayerPointTyp } from '../entities/layer-measurement-point.entity';

/** 3D-Weltpunkt + Oberflaechennormale. */
export class Position3DDto {
  @ApiProperty() @IsNumber() x: number;
  @ApiProperty() @IsNumber() y: number;
  @ApiProperty() @IsNumber() z: number;
  @ApiProperty() @IsNumber() nx: number;
  @ApiProperty() @IsNumber() ny: number;
  @ApiProperty() @IsNumber() nz: number;
}

/** Eine einzelne µm-Messung. Plausibilitaets-Cap bei 5000 µm (5 mm). */
export class LayerReadingDto {
  @ApiProperty({ description: 'Schichtdicke in Mikrometer (µm)' })
  @IsNumber()
  @Min(0)
  @Max(5000)
  wertUm: number;

  @ApiPropertyOptional({ description: 'ISO-Zeitstempel der Messung' })
  @IsOptional()
  @IsString()
  erfasstAm?: string;
}

/**
 * Anlegen eines Messpunktes. `partId` verankert fachlich; die 3D-Position bzw.
 * der 2D-Fallback dienen nur der Visualisierung. `readings` optional (Punkt kann
 * zunaechst ohne Wert gesetzt und spaeter befuellt werden). Idempotenz via
 * clientUuid.
 */
export class CreateLayerPointDto {
  @ApiPropertyOptional({ deprecated: true, description: 'Ignoriert – Idempotenz via clientUuid' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: 'Kanonische Bauteil-ID' })
  @IsString()
  partId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partLabel?: string;

  @ApiPropertyOptional({ enum: ['standard', 'frei'] })
  @IsOptional()
  @IsIn(['standard', 'frei'])
  punktTyp?: LayerPointTyp;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  standardKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ enum: ['3d', '2d'] })
  @IsIn(['3d', '2d'])
  positionMode: '3d' | '2d';

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

  @ApiPropertyOptional({ type: [LayerReadingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LayerReadingDto)
  readings?: LayerReadingDto[];

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
 * Aktualisierung eines Messpunktes. `readings` ersetzt (nicht merged) die Liste
 * am Punkt – der Client fuehrt die vollstaendige Messreihe des Punktes.
 */
export class UpdateLayerPointDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ type: [LayerReadingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LayerReadingDto)
  readings?: LayerReadingDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  reihenfolge?: number;
}
