import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsArray,
  ValidateNested,
  IsUUID,
  IsDateString,
  Min,
  Max,
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
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000) einkaufspreis?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000) verkaufspreis?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(10_000_000) bestand?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(10_000_000) mindestbestand?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() einheit?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() istVermietbar?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000) mietpreisProTag?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() aktiv?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class StockMovementDto {
  @ApiProperty({ enum: MovementType }) @IsEnum(MovementType) typ: MovementType;
  // Bewegungsmenge IMMER > 0; das Vorzeichen ergibt sich aus `typ` (Zugang/Abgang).
  // Sonst kann ein "Abgang" mit negativer Menge den Bestand erhoehen.
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(10_000_000) menge: number;
  @ApiPropertyOptional() @IsOptional() @IsString() grund?: string;
}

export class PurchaseOrderItemDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiProperty() @IsString() beschreibung: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(10_000_000) menge: number;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000) einzelpreis: number;
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
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000) preis?: number;
  @ApiPropertyOptional({ enum: RentalStatus }) @IsOptional() @IsEnum(RentalStatus) status?: RentalStatus;
}
