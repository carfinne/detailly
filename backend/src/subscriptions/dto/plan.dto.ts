import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsObject,
  Min,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'pro' })
  @IsString()
  slug: string;

  @ApiProperty({ example: 'Pro' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  beschreibung?: string;

  @ApiProperty({ example: 99.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  preisMonatlich: number;

  @ApiPropertyOptional({ default: 'EUR' })
  @IsOptional()
  @IsString()
  waehrung?: string;

  @ApiPropertyOptional({ type: [String], example: ['zeiterfassung', 'shop'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ example: { maxUsers: 10, maxLocations: 2, maxCustomers: null } })
  @IsOptional()
  @IsObject()
  limits?: Record<string, number | null>;

  @ApiPropertyOptional({ example: 199.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  preisJaehrlich?: number;

  @ApiPropertyOptional({ example: 'price_1AbCDeFgHiJkLmNo' })
  @IsOptional()
  @IsString()
  stripePriceId?: string;

  @ApiPropertyOptional({ example: 'price_1YearlyAbCDeFg' })
  @IsOptional()
  @IsString()
  stripePriceIdYearly?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  istAktiv?: boolean;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
