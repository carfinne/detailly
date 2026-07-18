import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import {
  MELDUNG_GRUND,
  MODERATION_STATUS,
} from '../geraetemarkt.constants';

/** Bearbeitungs-Ziele einer Meldung durch den Betreiber (offen bleibt implizit). */
export const MELDUNG_BEARBEITUNG = ['erledigt', 'verworfen'] as const;

/**
 * Ein Inserat melden (z. B. verbotene Chemie, Spam, Betrug). `grund` ist auf die
 * Whitelist MELDUNG_GRUND (inkl. „chemie_verboten") beschraenkt; melderTenantId/
 * melderUserId stammen IMMER aus dem JWT, nie aus dem Body.
 */
export class MeldeInseratDto {
  @ApiProperty({ enum: MELDUNG_GRUND, description: 'Melde-Grund (Whitelist)' })
  @IsIn(MELDUNG_GRUND as unknown as string[])
  grund: string;

  @ApiPropertyOptional({ description: 'Optionaler Freitext-Kommentar zur Meldung' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  kommentar?: string;
}

/**
 * Betreiber-Moderation eines Inserats: Moderations-Status setzen
 * (ok/verborgen/entfernt). Kein Tenant-Scope – der Betreiber agiert
 * plattformweit.
 */
export class ModerationInseratDto {
  @ApiProperty({ enum: MODERATION_STATUS, description: 'Neuer Moderations-Status' })
  @IsIn(MODERATION_STATUS as unknown as string[])
  moderationStatus: string;

  @ApiPropertyOptional({ description: 'Interner Vermerk zur Moderations-Entscheidung' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  vermerk?: string;
}

/** Betreiber schliesst eine Meldung ab (erledigt) oder verwirft sie (verworfen). */
export class UpdateMeldungDto {
  @ApiProperty({ enum: MELDUNG_BEARBEITUNG, description: 'Neuer Bearbeitungs-Status' })
  @IsIn(MELDUNG_BEARBEITUNG as unknown as string[])
  status: string;
}

/** Query fuer die Betreiber-Meldungs-Queue (paginiert, optional nach Status). */
export class MeldungenQueryDto {
  @ApiPropertyOptional({ description: 'Seite (>=1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Eintraege pro Seite' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter nach Meldungs-Status (Default: offen)' })
  @IsOptional()
  @IsIn(['offen', 'erledigt', 'verworfen'])
  status?: string;
}

/** Query fuer die Betreiber-Inseratsliste (alle inkl. verborgene, paginiert). */
export class ModerationInserateQueryDto {
  @ApiPropertyOptional({ description: 'Seite (>=1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Eintraege pro Seite' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ enum: MODERATION_STATUS, description: 'Filter nach Moderations-Status' })
  @IsOptional()
  @IsIn(MODERATION_STATUS as unknown as string[])
  moderationStatus?: string;
}
