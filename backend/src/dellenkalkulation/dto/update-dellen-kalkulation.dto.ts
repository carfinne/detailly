import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { DELLEN_MODI, DellenModus } from '../dellen-preis.util';

/**
 * Aktualisierung des Kalkulations-Kopfs. `status` wird hier NICHT gesetzt
 * (Finalisierung laeuft ueber den eigenen Endpunkt). Preis-Felder werden nicht
 * akzeptiert – der Preis bleibt serverseitig berechnet.
 */
export class UpdateDellenKalkulationDto {
  @ApiPropertyOptional({ enum: DELLEN_MODI })
  @IsOptional()
  @IsIn(DELLEN_MODI)
  modus?: DellenModus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modelKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;
}
