import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { LayerMeasurementAnlass } from '../entities/layer-measurement.entity';

/**
 * Anlegen eines Schichtdicken-Messprotokolls. Offline-Idempotenz laeuft
 * ausschliesslich ueber die tenant-scoped `clientUuid`; `tenantId` NIE aus dem
 * Body. `id` wird serverseitig ignoriert (nie als PK uebernommen).
 */
export class CreateLayerMeasurementDto {
  @ApiPropertyOptional({ deprecated: true, description: 'Ignoriert – Idempotenz via clientUuid' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  customerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Optionale Verknuepfung an eine Inspektion' })
  @IsOptional()
  @IsString()
  inspectionId?: string;

  @ApiPropertyOptional({ description: '3D-Modell-Identifier' })
  @IsOptional()
  @IsString()
  modelKey?: string;

  @ApiPropertyOptional({ enum: ['vor_folierung', 'vor_ppf', 'ankauf', 'gutachten', 'sonstiges'] })
  @IsOptional()
  @IsIn(['vor_folierung', 'vor_ppf', 'ankauf', 'gutachten', 'sonstiges'])
  anlass?: LayerMeasurementAnlass;

  @ApiPropertyOptional({ description: 'Normprofil-Schluessel (Default serienlack_stahl)' })
  @IsOptional()
  @IsString()
  normProfileKey?: string;

  @ApiPropertyOptional({ description: 'Freitext-Bezeichnung des Messgeraets' })
  @IsOptional()
  @IsString()
  messgeraet?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;

  @ApiPropertyOptional({ description: 'Offline-Sync-Idempotenz' })
  @IsOptional()
  @IsString()
  clientUuid?: string;
}
