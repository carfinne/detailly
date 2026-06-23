import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { DamagePhotoKategorie } from '../entities/damage-photo.entity';

/**
 * Metadaten-Create eines Fotos (Phase 0, KEINE Datei-Pipeline). `pfad` als
 * String; Upload/sharp folgt in Phase 1. Optional direkt an einen Schaden
 * (`damageItemId`, tenant-validiert) oder ein Bauteil (`partId`) gehaengt.
 */
export class CreateDamagePhotoDto {
  @ApiProperty({ description: '"/uploads/{tenantId}/insp/{id}/IMG.webp"' })
  @IsString()
  pfad: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumbnailPfad?: string;

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
  breite?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  hoehe?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  reihenfolge?: number;

  @ApiPropertyOptional({ description: 'Offline-Sync-Idempotenz' })
  @IsOptional()
  @IsString()
  clientUuid?: string;
}
