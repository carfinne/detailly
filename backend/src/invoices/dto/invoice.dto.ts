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
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceKind, InvoiceStatus } from '../entities/invoice.entity';

export class InvoiceItemDto {
  @ApiProperty()
  @IsString()
  beschreibung: string;

  @ApiProperty()
  @IsNumber()
  menge: number;

  @ApiProperty()
  @IsNumber()
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
  hinweis?: string;

  @ApiPropertyOptional({ description: 'Zahlungsfrist in Tagen (Standard 14, nur Rechnung).' })
  @IsOptional()
  @IsNumber()
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
