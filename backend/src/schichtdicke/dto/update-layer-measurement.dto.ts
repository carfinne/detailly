import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  LayerMeasurementAnlass,
  LayerMeasurementStatus,
} from '../entities/layer-measurement.entity';

/**
 * Teil-Aktualisierung eines Messprotokoll-Kopfes. `status='freigegeben'` ist
 * hier bewusst NICHT setzbar (Welle 2: nur ueber den Signatur-Endpunkt).
 */
export class UpdateLayerMeasurementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ enum: ['vor_folierung', 'vor_ppf', 'ankauf', 'gutachten', 'sonstiges'] })
  @IsOptional()
  @IsIn(['vor_folierung', 'vor_ppf', 'ankauf', 'gutachten', 'sonstiges'])
  anlass?: LayerMeasurementAnlass;

  @ApiPropertyOptional({ enum: ['entwurf', 'abgeschlossen'] })
  @IsOptional()
  @IsIn(['entwurf', 'abgeschlossen', 'freigegeben'])
  status?: LayerMeasurementStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  normProfileKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  messgeraet?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modelKey?: string;
}
