import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Ein Schadensmarker im Annahmeprotokoll. */
export class SchadensMarkerDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  ansicht: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(100)
  x: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(100)
  y: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiProperty()
  @IsString()
  art: string;

  @ApiProperty()
  @IsString()
  schweregrad: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;
}

export class CreateIntakeDto {
  @ApiProperty()
  @IsString()
  customerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  kmStand?: number;

  @ApiPropertyOptional({ description: 'Tankstand in Prozent (0–100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  tankstand?: number;

  @ApiPropertyOptional({ type: [SchadensMarkerDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchadensMarkerDto)
  marker?: SchadensMarkerDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;
}
