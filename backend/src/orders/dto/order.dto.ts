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
  IsInt,
  Min,
  Max,
  ValidateNested,
  IsDateString,
  ArrayMaxSize,
  MaxLength,
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
  // Welle 1 (F4): Garantie/Uebergabe.
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(50) garantieJahre?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) pflegehinweis?: string;
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
  @Min(0)
  menge: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  einzelpreis: number;

  @ApiPropertyOptional({ description: 'Geplante Dauer dieser Position in Minuten (Soll, optional).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  geplanteDauerMinuten?: number;
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

  @ApiPropertyOptional({
    description:
      'Geplante Gesamtdauer in Minuten (Soll-Override). Leer/null = aus den Positionen summieren.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  geplanteDauerMinuten?: number;

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

  // bilderVorher/bilderNachher sind BEWUSST nicht client-setzbar: Foto-Dateinamen
  // entstehen ausschliesslich serverseitig in uploadFotos (randomUUID). So kann
  // die Membership-Whitelist im OrderPhotoController nicht manipuliert werden.

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

  // Harte Obergrenzen gegen Disk-DoS: max. 20 Bilder/Request, je Data-URL max.
  // ~8 MB String (Base64 ~ +33% -> deckt das 5-MB-Bild-Limit im Service ab).
  @ApiProperty({ type: [String], description: 'Bilder als Data-URLs (data:image/...)' })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(8_000_000, { each: true })
  bilder: string[];
}

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}

export class ChangeStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
