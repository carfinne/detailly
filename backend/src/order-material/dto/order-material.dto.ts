import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min, Max } from 'class-validator';

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
}
