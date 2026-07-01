import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  IsArray,
  IsIn,
  ValidateNested,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceKind, InvoiceStatus } from '../entities/invoice.entity';

export class InvoiceItemDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  beschreibung: string;

  // Menge/Preis duerfen nie negativ sein (sonst negative Rechnungen) und sind
  // nach oben begrenzt, damit Summen nicht den decimal(10,2)-Bereich sprengen.
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(1_000_000)
  menge: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  einzelpreis: number;
}

export class CreateInvoiceDto {
  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ enum: InvoiceKind })
  @IsOptional()
  @IsEnum(InvoiceKind)
  art?: InvoiceKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  hinweis?: string;

  @ApiPropertyOptional({ description: 'Zahlungsfrist in Tagen (Standard 14, nur Rechnung).' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  zahlungsziel?: number;

  @ApiPropertyOptional({ description: 'MwSt-Satz in Prozent (19, 7 oder 0). Standard 19.' })
  @IsOptional()
  @IsIn([0, 7, 19])
  mwstSatz?: number;

  @ApiProperty({ type: [InvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];
}

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {}

export class ChangeInvoiceStatusDto {
  @ApiProperty({ enum: InvoiceStatus })
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;
}
