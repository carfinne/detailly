import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ShowcaseGewerk, SHOWCASE_GEWERKE } from '../entities/showcase-item.entity';

/**
 * Anlegen eines Schaufenster-Eintrags. `vorherBild`/`nachherBild` sind Data-URLs
 * (Muster wie Inspektion/Orders-Foto-Upload); der Service schreibt eigene Kopien
 * unter private-uploads/schaufenster/<tenantId>/ und setzt die Pfade selbst.
 * Ein neuer Eintrag ist IMMER unveroeffentlicht (Consent + Veroeffentlichen
 * laufen ueber den separaten publish-Endpunkt).
 */
export class CreateShowcaseItemDto {
  @ApiProperty({ description: 'Titel des Referenz-Eintrags (oeffentlich sichtbar)' })
  @IsString()
  @MaxLength(120)
  titel: string;

  @ApiPropertyOptional({ description: 'Kurze Beschreibung (oeffentlich sichtbar)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  beschreibung?: string;

  @ApiProperty({ enum: SHOWCASE_GEWERKE, description: 'Gewerk: folie | aufbereitung | ppf' })
  @IsIn(SHOWCASE_GEWERKE as unknown as string[])
  gewerk: ShowcaseGewerk;

  @ApiProperty({ description: 'Vorher-Bild als Data-URL: data:image/(png|jpg|webp);base64,...' })
  @IsString()
  vorherBild: string;

  @ApiProperty({ description: 'Nachher-Bild als Data-URL: data:image/(png|jpg|webp);base64,...' })
  @IsString()
  nachherBild: string;

  @ApiPropertyOptional({ description: 'Sortier-Reihenfolge (aufsteigend)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  reihenfolge?: number;
}
