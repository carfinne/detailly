import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, Min, Max, MaxLength } from 'class-validator';
import { FolienRolleStatus } from '../entities/folien-rolle.entity';

/** Obergrenze gegen Tippfehler (sehr grosse Laufmeter). */
export const MAX_LFM = 100000;

export class CreateFolienRolleDto {
  @ApiProperty({ description: 'Bezeichnung der Restrolle' })
  @IsString()
  @MaxLength(200)
  bezeichnung: string;

  @ApiPropertyOptional({ description: 'Zugehoeriges Folien-Produkt (Product.id)' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Chargen-/Los-Nummer' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  charge?: string;

  @ApiProperty({ description: 'Verbleibende Laufmeter' })
  @IsNumber()
  @Min(0)
  @Max(MAX_LFM)
  restLfm: number;
}

export class UpdateFolienRolleDto {
  @ApiPropertyOptional({ description: 'Bezeichnung der Restrolle' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bezeichnung?: string;

  @ApiPropertyOptional({ description: 'Chargen-/Los-Nummer' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  charge?: string;

  @ApiPropertyOptional({ description: 'Verbleibende Laufmeter' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_LFM)
  restLfm?: number;

  @ApiPropertyOptional({ enum: FolienRolleStatus, description: 'Status (Abschreiben via ENTSORGT)' })
  @IsOptional()
  @IsEnum(FolienRolleStatus)
  status?: FolienRolleStatus;
}
