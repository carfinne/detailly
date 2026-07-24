import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  MARKT_KATEGORIEN,
  MARKT_PRIORITAETEN,
  MARKT_STATUS,
  type MarktKategorie,
  type MarktPrioritaet,
  type MarktStatus,
} from '../entities/markt-beobachtung.entity';

/**
 * Nur http/https – die Quelle wird als href gerendert (kein javascript: o. ae.).
 * Identische Option wie im Marktplatz-Modul.
 */
const URL_OPTS = { require_protocol: true, protocols: ['http', 'https'] };

/**
 * Neue Marktbeobachtung anlegen. NEUTRALITAET: nur sachliche, oeffentlich
 * beobachtbare Fakten + die daraus abgeleitete EIGENE Idee. Es gibt bewusst kein
 * Bewertungs-/Herabsetzungsfeld. `erstelltVonUserId` wird NIE aus dem Body
 * uebernommen (setzt der Server aus dem eingeloggten Plattform-Nutzer).
 */
export class CreateMarktBeobachtungDto {
  @ApiProperty({ description: 'Name des beobachteten Wettbewerbers' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  wettbewerber: string;

  @ApiProperty({ enum: MARKT_KATEGORIEN, description: 'Kategorie der Beobachtung' })
  @IsIn(MARKT_KATEGORIEN as unknown as string[])
  kategorie: MarktKategorie;

  @ApiProperty({ description: 'Sachliche, oeffentlich beobachtbare Beobachtung' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  beobachtung: string;

  @ApiPropertyOptional({ description: 'Quelle-URL (nur http/https)' })
  @IsOptional()
  @IsUrl(URL_OPTS)
  @MaxLength(2000)
  quelleUrl?: string;

  @ApiProperty({ description: 'Beobachtungsdatum (ISO, z. B. 2026-07-23)' })
  @IsDateString()
  beobachtetAm: string;

  @ApiProperty({ description: 'Unsere abgeleitete „besser machen"-Idee' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  abgeleiteteIdee: string;

  @ApiPropertyOptional({ enum: MARKT_STATUS, description: 'Arbeitsstatus (Default neu)' })
  @IsOptional()
  @IsIn(MARKT_STATUS as unknown as string[])
  status?: MarktStatus;

  @ApiPropertyOptional({ enum: MARKT_PRIORITAETEN, description: 'Prioritaet (Default mittel)' })
  @IsOptional()
  @IsIn(MARKT_PRIORITAETEN as unknown as string[])
  prioritaet?: MarktPrioritaet;
}

/** Vollstaendiges Bearbeiten (alle Felder optional; nichts wird ungewollt geleert). */
export class UpdateMarktBeobachtungDto {
  @ApiPropertyOptional({ description: 'Name des beobachteten Wettbewerbers' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  wettbewerber?: string;

  @ApiPropertyOptional({ enum: MARKT_KATEGORIEN, description: 'Kategorie der Beobachtung' })
  @IsOptional()
  @IsIn(MARKT_KATEGORIEN as unknown as string[])
  kategorie?: MarktKategorie;

  @ApiPropertyOptional({ description: 'Sachliche, oeffentlich beobachtbare Beobachtung' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  beobachtung?: string;

  @ApiPropertyOptional({ description: 'Quelle-URL (nur http/https)' })
  @IsOptional()
  @IsUrl(URL_OPTS)
  @MaxLength(2000)
  quelleUrl?: string;

  @ApiPropertyOptional({ description: 'Beobachtungsdatum (ISO)' })
  @IsOptional()
  @IsDateString()
  beobachtetAm?: string;

  @ApiPropertyOptional({ description: 'Unsere abgeleitete „besser machen"-Idee' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  abgeleiteteIdee?: string;

  @ApiPropertyOptional({ enum: MARKT_STATUS, description: 'Arbeitsstatus' })
  @IsOptional()
  @IsIn(MARKT_STATUS as unknown as string[])
  status?: MarktStatus;

  @ApiPropertyOptional({ enum: MARKT_PRIORITAETEN, description: 'Prioritaet' })
  @IsOptional()
  @IsIn(MARKT_PRIORITAETEN as unknown as string[])
  prioritaet?: MarktPrioritaet;
}

/** Schnellwechsel: nur der Arbeitsstatus. */
export class UpdateMarktStatusDto {
  @ApiProperty({ enum: MARKT_STATUS, description: 'Neuer Arbeitsstatus' })
  @IsIn(MARKT_STATUS as unknown as string[])
  status: MarktStatus;
}

/** Schnellwechsel: nur die Prioritaet. */
export class UpdateMarktPrioritaetDto {
  @ApiProperty({ enum: MARKT_PRIORITAETEN, description: 'Neue Prioritaet' })
  @IsIn(MARKT_PRIORITAETEN as unknown as string[])
  prioritaet: MarktPrioritaet;
}
