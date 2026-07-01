import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { InspectionTyp } from '../entities/damage-inspection.entity';

/**
 * Anlegen einer Inspektion. Offline-Idempotenz laeuft ausschliesslich ueber die
 * tenant-scoped `clientUuid`. `tenantId` NIE aus dem Body.
 */
export class CreateInspectionDto {
  // Wird serverseitig IGNORIERT (nie als Primaerschluessel uebernommen) – eine
  // fremde PK im Body koennte sonst einen Datensatz eines anderen Mandanten
  // ueberschreiben. Feld bleibt nur erhalten, damit aeltere Clients kein 400
  // (forbidNonWhitelisted) bekommen; die Idempotenz laeuft ueber clientUuid.
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

  @ApiProperty({ enum: ['annahme', 'gutachten', 'ausgang'] })
  @IsIn(['annahme', 'gutachten', 'ausgang'])
  typ: InspectionTyp;

  @ApiPropertyOptional({ description: 'Vor-Inspektion fuer Carry-over (typ=ausgang)' })
  @IsOptional()
  @IsString()
  previousInspectionId?: string;

  @ApiPropertyOptional({ description: '3D-Modell-Identifier' })
  @IsOptional()
  @IsString()
  modelKey?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;

  @ApiPropertyOptional({ description: 'Offline-Sync-Idempotenz' })
  @IsOptional()
  @IsString()
  clientUuid?: string;
}
