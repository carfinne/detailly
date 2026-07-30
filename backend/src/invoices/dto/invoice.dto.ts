import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  IsArray,
  IsIn,
  Max,
  Min,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
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
  @Min(0)
  menge: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
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

  @ApiPropertyOptional({ description: 'Zahlungsfrist in Tagen (0..365, Standard 14, nur Rechnung).' })
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

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {
  // items weglassen = Positionen bleiben unveraendert. WENN items geschickt wird,
  // muss mind. eine Position dabei sein – ein leeres Array wuerde sonst serverseitig
  // ALLE Positionen loeschen und die Summen auf 0 setzen (das Frontend verhindert
  // es, ein direkter PATCH nicht). @IsOptional greift nur, wenn das Feld fehlt.
  @ApiPropertyOptional({ type: [InvoiceItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];
}

export class ChangeInvoiceStatusDto {
  @ApiProperty({ enum: InvoiceStatus })
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;
}

// --- Welle 1 (F1): Angebots-Set aus 2-3 Varianten ---
export class AngebotVarianteDto {
  @ApiProperty({ description: 'Anzeigename der Variante, z.B. "Vollfolierung 3M".' })
  @IsString()
  @MaxLength(120)
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hinweis?: string;

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

export class CreateAngebotsSetDto {
  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiProperty({ type: [AngebotVarianteDto], description: 'Zwei bis drei Angebots-Varianten.' })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => AngebotVarianteDto)
  varianten: AngebotVarianteDto[];
}

// --- Welle 1 (F3): Anzahlung/Abschlag ---
// Genau EINE Basis (invoiceId ODER orderId) und genau EINE Hoehe (betragBrutto ODER
// prozent). Der Betrag ist BRUTTO: der Kunde zahlt exakt den genannten Betrag.
export class CreateAnzahlungDto {
  @ApiPropertyOptional({ description: 'Basis-Rechnung (Schlussrechnung/Entwurf), auf die sich die Anzahlung bezieht.' })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiPropertyOptional({ description: 'Basis-Auftrag, aus dessen Brutto die Anzahlung berechnet wird.' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Anzahlungsbetrag in EUR BRUTTO (inkl. MwSt).' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  betragBrutto?: number;

  @ApiPropertyOptional({ description: 'Anzahlung als Prozent vom Basis-Brutto (0..100).' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  prozent?: number;
}

// --- Welle 1 (F2): oeffentliche Kunden-Annahme einer Variante ---
export class PublicAcceptDto {
  @ApiProperty({ description: 'ID der vom Kunden gewaehlten Angebots-Variante.' })
  @IsUUID()
  invoiceId: string;
}
