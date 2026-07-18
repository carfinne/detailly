import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { DELLEN_MODI, DellenModus } from '../dellen-preis.util';

/**
 * Anlegen einer Dellenkalkulation. `tenantId` NIE aus dem Body; `id` wird
 * serverseitig ignoriert (nie als PK uebernommen); Idempotenz via clientUuid.
 * Preis-Felder werden NICHT akzeptiert – der Preis ist immer serverseitig
 * berechnet.
 */
export class CreateDellenKalkulationDto {
  @ApiPropertyOptional({ deprecated: true, description: 'Ignoriert – Idempotenz via clientUuid' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ enum: DELLEN_MODI, description: 'einzel = Parkschaden, hagel = Staffel je Bauteil' })
  @IsIn(DELLEN_MODI)
  modus: DellenModus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({ description: '3D-Modell-Identifier' })
  @IsOptional()
  @IsString()
  modelKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;

  @ApiPropertyOptional({ description: 'Offline-Sync-Idempotenz' })
  @IsOptional()
  @IsString()
  clientUuid?: string;
}
