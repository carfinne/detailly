import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  IsArray,
  IsBoolean,
  IsIn,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceType, OrderStatus } from '../entities/order.entity';
import { OrderItemType } from '../entities/order-item.entity';

// --- Branchenspezifische Leistungsdetails ---
export class PpfDetailsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() folie?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() hersteller?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() qm?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() garantieJahre?: number;
}

export class KeramikDetailsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() produkt?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() schichten?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() garantieJahre?: number;
}

export class FolierungDetailsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() farbe?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() hersteller?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() qm?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() teilfolierung?: boolean;
}

export class LeistungDetailsDto {
  @ApiPropertyOptional({ type: PpfDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PpfDetailsDto)
  ppf?: PpfDetailsDto;

  @ApiPropertyOptional({ type: KeramikDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => KeramikDetailsDto)
  keramik?: KeramikDetailsDto;

  @ApiPropertyOptional({ type: FolierungDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FolierungDetailsDto)
  folierung?: FolierungDetailsDto;
}

export class OrderItemDto {
  @ApiProperty()
  @IsString()
  beschreibung: string;

  @ApiPropertyOptional({ enum: OrderItemType })
  @IsOptional()
  @IsEnum(OrderItemType)
  typ?: OrderItemType;

  @ApiProperty()
  @IsNumber()
  menge: number;

  @ApiProperty()
  @IsNumber()
  einzelpreis: number;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  materialkosten?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  arbeitsstunden?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  geplanterStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  geplantesEnde?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internerHinweis?: string;

  @ApiPropertyOptional({ type: [OrderItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  bilderVorher?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  bilderNachher?: string[];

  @ApiPropertyOptional({ type: LeistungDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LeistungDetailsDto)
  leistungDetails?: LeistungDetailsDto;
}

/** Foto-Upload als Base64-Data-URLs, getrennt nach Vorher/Nachher. */
export class UploadFotosDto {
  @ApiProperty({ enum: ['vorher', 'nachher'] })
  @IsIn(['vorher', 'nachher'])
  phase: 'vorher' | 'nachher';

  @ApiProperty({ type: [String], description: 'Bilder als Data-URLs (data:image/...)' })
  @IsArray()
  @IsString({ each: true })
  bilder: string[];
}

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}

export class ChangeStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
