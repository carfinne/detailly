import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsArray,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MovementType } from '../entities/stock-movement.entity';
import { RentalStatus } from '../entities/rental.entity';
import { PurchaseOrderStatus } from '../entities/purchase-order.entity';

export class ChangePurchaseOrderStatusDto {
  @ApiProperty({ enum: PurchaseOrderStatus })
  @IsEnum(PurchaseOrderStatus)
  status: PurchaseOrderStatus;
}

export class CreateProductDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sku?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() kategorie?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() einkaufspreis?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() verkaufspreis?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() bestand?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() mindestbestand?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() einheit?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() istVermietbar?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() mietpreisProTag?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() aktiv?: boolean;
  // Folierer-Welle 2: strukturierte Folien-Attribute (optional/additiv).
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) hersteller?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) serie?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) farbcode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) finish?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(500) breiteCm?: number;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class StockMovementDto {
  @ApiProperty({ enum: MovementType }) @IsEnum(MovementType) typ: MovementType;
  @ApiProperty() @IsNumber() @Min(0) menge: number;
  @ApiPropertyOptional() @IsOptional() @IsString() grund?: string;
}

export class PurchaseOrderItemDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiProperty() @IsString() beschreibung: string;
  @ApiProperty() @IsNumber() menge: number;
  @ApiProperty() @IsNumber() einzelpreis: number;
}

export class CreatePurchaseOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() lieferant?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notiz?: string;
  @ApiProperty({ type: [PurchaseOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderDto extends PartialType(CreatePurchaseOrderDto) {}

export class CreateRentalDto {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty() @IsUUID() customerId: string;
  @ApiProperty() @IsDateString() von: string;
  @ApiProperty() @IsDateString() bis: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() preis?: number;
  @ApiPropertyOptional({ enum: RentalStatus }) @IsOptional() @IsEnum(RentalStatus) status?: RentalStatus;
}

export class ChangeRentalStatusDto {
  @ApiProperty({ enum: RentalStatus })
  @IsEnum(RentalStatus)
  status: RentalStatus;
}
