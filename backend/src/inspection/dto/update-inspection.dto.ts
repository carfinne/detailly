import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { InspectionStatus } from '../entities/damage-inspection.entity';

/** Teil-Aktualisierung einer Inspektion (kmStand, Status, Notiz ...). */
export class UpdateInspectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  kmStand?: number;

  @ApiPropertyOptional({ description: 'Tankstand in Prozent (0–100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  tankstand?: number;

  @ApiPropertyOptional({ enum: ['entwurf', 'abgeschlossen', 'freigegeben'] })
  @IsOptional()
  @IsIn(['entwurf', 'abgeschlossen', 'freigegeben'])
  status?: InspectionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modelKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;
}
