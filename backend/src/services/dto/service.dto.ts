import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';
import { ServiceCategory, ServiceUnit } from '../entities/service-item.entity';

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
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}
