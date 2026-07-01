import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DamageArt,
  DamageOrigin,
  DamageReparaturart,
  DamageSchweregrad,
} from '../entities/damage-item.entity';

/** 3D-Weltpunkt + Oberflaechennormale. */
export class Position3DDto {
  @ApiProperty() @IsNumber() x: number;
  @ApiProperty() @IsNumber() y: number;
  @ApiProperty() @IsNumber() z: number;
  @ApiProperty() @IsNumber() nx: number;
  @ApiProperty() @IsNumber() ny: number;
  @ApiProperty() @IsNumber() nz: number;
}

/**
 * Anlegen eines Schadens an einer Inspektion. Idempotent ueber `clientUuid`
 * (gefahrloser Re-Sync). `photoIds[]` legt direkt die n:m-Join-Rows an
 * (jede photoId wird tenant-validiert).
 */
export class CreateDamageItemDto {
  // Serverseitig IGNORIERT (nie als PK). Idempotenz laeuft ueber clientUuid;
  // Feld bleibt nur fuer Abwaertskompatibilitaet (forbidNonWhitelisted).
  @ApiPropertyOptional({ deprecated: true, description: 'Ignoriert – Idempotenz via clientUuid' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  partId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partLabel?: string;

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

  @ApiProperty({ enum: ['vorschaden', 'neu'] })
  @IsIn(['vorschaden', 'neu'])
  origin: DamageOrigin;

  @ApiProperty({
    enum: [
      'kratzer',
      'delle',
      'steinschlag',
      'lackschaden',
      'rost',
      'riss',
      'bruch',
      'verzogen',
      'fehlteil',
      'sonstiges',
    ],
  })
  @IsIn([
    'kratzer',
    'delle',
    'steinschlag',
    'lackschaden',
    'rost',
    'riss',
    'bruch',
    'verzogen',
    'fehlteil',
    'sonstiges',
  ])
  art: DamageArt;

  @ApiProperty({ enum: ['leicht', 'mittel', 'schwer'] })
  @IsIn(['leicht', 'mittel', 'schwer'])
  schweregrad: DamageSchweregrad;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  groesseLaengeMm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  groesseBreiteMm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ausmass?: string;

  @ApiPropertyOptional({
    enum: ['polieren', 'smart_repair', 'lackieren', 'instandsetzen', 'austausch', 'keine'],
  })
  @IsOptional()
  @IsIn(['polieren', 'smart_repair', 'lackieren', 'instandsetzen', 'austausch', 'keine'])
  reparaturart?: DamageReparaturart;

  @ApiPropertyOptional({ description: 'Geschaetzte Kosten (decimal als String)' })
  @IsOptional()
  @IsString()
  kostenSchaetzung?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;

  @ApiPropertyOptional({
    description: 'Direkte n:m-Mehrfachzuordnung von Fotos (jede ID tenant-validiert)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  photoIds?: string[];

  @ApiPropertyOptional({ description: 'Offline-Sync-Idempotenz' })
  @IsOptional()
  @IsString()
  clientUuid?: string;
}
