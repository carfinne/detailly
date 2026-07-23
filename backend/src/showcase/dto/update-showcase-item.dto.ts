import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ShowcaseGewerk, SHOWCASE_GEWERKE } from '../entities/showcase-item.entity';

/**
 * Bearbeiten eines Schaufenster-Eintrags. Alle Felder optional; die Bilder werden
 * nur ersetzt, wenn eine neue Data-URL uebergeben wird. Consent/Veroeffentlichung
 * laufen NICHT hierueber (separater publish-Endpunkt, damit die rechtliche
 * Durchsetzung an EINER Stelle sitzt).
 */
export class UpdateShowcaseItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  titel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  beschreibung?: string;

  @ApiPropertyOptional({ enum: SHOWCASE_GEWERKE })
  @IsOptional()
  @IsIn(SHOWCASE_GEWERKE as unknown as string[])
  gewerk?: ShowcaseGewerk;

  @ApiPropertyOptional({ description: 'Neues Vorher-Bild als Data-URL (ersetzt das bestehende)' })
  @IsOptional()
  @IsString()
  vorherBild?: string;

  @ApiPropertyOptional({ description: 'Neues Nachher-Bild als Data-URL (ersetzt das bestehende)' })
  @IsOptional()
  @IsString()
  nachherBild?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  reihenfolge?: number;
}
