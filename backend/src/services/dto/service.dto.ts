import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  ArrayNotEmpty,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ServiceCategory, ServiceUnit } from '../entities/service-item.entity';
import { STARTER_GEWERKE, StarterGewerk } from '../starter-catalog';

export class CreateServiceDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  beschreibung?: string;

  @ApiProperty({ enum: ServiceCategory })
  @IsEnum(ServiceCategory)
  kategorie: ServiceCategory;

  @ApiProperty()
  @IsNumber()
  basispreis: number;

  @ApiProperty({ enum: ServiceUnit })
  @IsEnum(ServiceUnit)
  einheit: ServiceUnit;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aktiv?: boolean;

  @ApiPropertyOptional({ description: 'Geplante Dauer je Leistung in Minuten (Soll, optional).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  geplanteDauerMinuten?: number;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}

/**
 * Uebernahme des Starter-Katalogs beim Onboarding: eine oder mehrere Gewerke.
 * Bewusst auf die Starter-Gewerke (aufbereitung/folierung/ppf) beschraenkt –
 * `sonstiges` hat keinen Katalog. `each: true` prueft jeden Array-Wert; leere/
 * ungueltige Wahl faellt hier (400) sauber durch, bevor der Service laeuft.
 */
export class StarterImportDto {
  @ApiProperty({ enum: STARTER_GEWERKE, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(STARTER_GEWERKE as readonly string[], { each: true })
  gewerke: StarterGewerk[];
}
