import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { DamagePhotoKategorie } from '../entities/damage-photo.entity';

/**
 * Foto-Upload (Phase 1). `bild` ist eine Data-URL (Muster wie Orders.uploadFotos);
 * der Service schreibt die Datei unter uploads/ und setzt pfad selbst. Optional
 * direkt an einen Schaden (`damageItemId`, tenant-validiert) oder ein Bauteil
 * (`partId`) gehaengt. Thumbnails/EXIF (sharp) folgen im Feinschliff.
 */
export class CreateDamagePhotoDto {
  @ApiProperty({ description: 'Bild als Data-URL: data:image/(png|jpg|webp);base64,...' })
  @IsString()
  bild: string;

  @ApiPropertyOptional({ description: 'Direkte Zuordnung zu einem Schaden (n:m-Join)' })
  @IsOptional()
  @IsUUID('4')
  damageItemId?: string;

  @ApiPropertyOptional({ description: 'Bauteil-Foto ohne konkreten Schaden' })
  @IsOptional()
  @IsString()
  partId?: string;

  @ApiPropertyOptional({ enum: ['detail', 'uebersicht', 'vin', 'tacho', 'kennzeichen'] })
  @IsOptional()
  @IsIn(['detail', 'uebersicht', 'vin', 'tacho', 'kennzeichen'])
  kategorie?: DamagePhotoKategorie;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  reihenfolge?: number;

  @ApiPropertyOptional({ description: 'Offline-Sync-Idempotenz' })
  @IsOptional()
  @IsString()
  clientUuid?: string;
}
