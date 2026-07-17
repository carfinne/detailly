import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IP_BLOCK_SEVERITY, SECURITY_EVENT_SEVERITY, SECURITY_EVENT_TYPES } from '../security.constants';

/** Query-Filter fuer GET /platform/security/events (alle optional). */
export class SecurityEventQueryDto {
  @IsOptional()
  @IsIn(SECURITY_EVENT_TYPES as unknown as string[])
  type?: string;

  @IsOptional()
  @IsIn(SECURITY_EVENT_SEVERITY as unknown as string[])
  severity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ip?: string;

  /** ISO-Zeitpunkt: nur Ereignisse danach. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  since?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

/** POST /platform/security/blocks – manuelle Sperre (PLATFORM_ADMIN). */
export class CreateIpBlockDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  ip: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason: string;

  @IsOptional()
  @IsIn(IP_BLOCK_SEVERITY as unknown as string[])
  severity?: string;

  /**
   * Sperrdauer in Minuten (optional). Fehlt der Wert -> DAUERHAFTE Sperre
   * (nur manuell erlaubt). 1..43200 min (max 30 Tage).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(43200)
  durationMinutes?: number;
}
