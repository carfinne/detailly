import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

/** Obergrenze gegen Tippfehler (sehr grosse Mengen). */
export const MAX_MENGE = 100000;

export class CreateOrderMaterialDto {
  @ApiProperty({ description: 'Auftrag (Order.id)' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: 'Produkt (Product.id) aus dem Lager' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Verbrauchte Menge' })
  @IsNumber()
  @Min(0.01)
  @Max(MAX_MENGE)
  menge: number;

  @ApiPropertyOptional({ description: 'Optionale Restrolle (FolienRolle.id), von der gebucht wird' })
  @IsOptional()
  @IsString()
  folienRolleId?: string;

  @ApiPropertyOptional({ description: 'Geplanter Verbrauch in lfm (Basis der Verschnitt-KPI)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MENGE)
  geplantLfm?: number;
}
