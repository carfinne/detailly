import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsInt, Min, Max } from 'class-validator';

/** Tagesgrenze: eine einzelne Buchung kann hoechstens 24 h (1440 min) umfassen. */
export const MAX_MINUTEN = 1440;

/**
 * Arbeitszeit auf einen Auftrag buchen. `userId` wird NUR fuer die Leitung
 * beachtet (Erfassung fuer andere); ein normaler Mitarbeiter bucht immer auf sich
 * selbst (Service erzwingt user.id). `datum` als ISO-String.
 */
export class CreateOrderTimeDto {
  @ApiProperty({ description: 'Auftrag (Order.id)' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: 'Tag der Arbeit (ISO-Datum)' })
  @IsDateString()
  datum: string;

  @ApiProperty({ description: 'Dauer in Minuten (1..1440)' })
  @IsInt()
  @Min(1)
  @Max(MAX_MINUTEN)
  minuten: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;

  @ApiPropertyOptional({ description: 'Nur Leitung: Mitarbeiter (User.id); sonst ignoriert.' })
  @IsOptional()
  @IsString()
  userId?: string;
}

/** Leitung korrigiert einen bestehenden Eintrag (orderId bleibt fix). */
export class UpdateOrderTimeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  datum?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_MINUTEN)
  minuten?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
}
