import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsIn,
  IsOptional,
  IsNumber,
  IsInt,
  IsPositive,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { KASSENBUCH_TYPEN, MAX_KASSENBUCH_BETRAG } from '../kassenbuch.constants';

/** Anlegen eines Kassenbuch-Eintrags (Entwurf). */
export class CreateKassenbuchEintragDto {
  @ApiProperty({ enum: KASSENBUCH_TYPEN, description: 'Buchungsart (einnahme/ausgabe)' })
  @IsIn(KASSENBUCH_TYPEN as unknown as string[])
  typ: string;

  @ApiProperty({ description: 'Betrag in EUR (immer > 0; Richtung steckt in typ)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_KASSENBUCH_BETRAG)
  betrag: number;

  @ApiProperty({ description: 'Zweck/Betreff der Buchung (Pflicht – GoBD-Buchungstext)' })
  @IsString()
  @MaxLength(200)
  zweck: string;

  @ApiPropertyOptional({ description: 'MwSt-Satz in Prozent (0/7/19). Default 0.' })
  @IsOptional()
  @IsIn([0, 7, 19])
  mwstSatz?: number;

  @ApiPropertyOptional({ description: 'Externe Belegnummer (Quittung/Bon)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  belegNummer?: string;

  @ApiPropertyOptional({ description: 'Freie Kategorie (z. B. Materialeinkauf)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  kategorie?: string;

  @ApiPropertyOptional({
    description:
      'Buchungsdatum (ISO). Muss >= Datum des Vorgaengers sein (kein Rueckdatieren). Default: jetzt.',
  })
  @IsOptional()
  @IsDateString()
  datum?: string;
}

/**
 * Aendern eines Entwurfs. Nur der ZULETZT erfasste, noch nicht festgeschriebene
 * Eintrag ist aenderbar (Service-Regel, GoBD-Verkettung) – festgeschriebene
 * Eintraege werden ausschliesslich per Storno korrigiert. `typ`/`betrag`
 * beeinflussen den Saldo und werden serverseitig neu verkettet.
 */
export class UpdateKassenbuchEintragDto {
  @ApiPropertyOptional({ enum: KASSENBUCH_TYPEN })
  @IsOptional()
  @IsIn(KASSENBUCH_TYPEN as unknown as string[])
  typ?: string;

  @ApiPropertyOptional({ description: 'Betrag in EUR (> 0)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_KASSENBUCH_BETRAG)
  betrag?: number;

  @ApiPropertyOptional({ description: 'Zweck/Betreff' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  zweck?: string;

  @ApiPropertyOptional({ description: 'MwSt-Satz in Prozent (0/7/19)' })
  @IsOptional()
  @IsIn([0, 7, 19])
  mwstSatz?: number;

  @ApiPropertyOptional({ description: 'Externe Belegnummer' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  belegNummer?: string;

  @ApiPropertyOptional({ description: 'Freie Kategorie' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  kategorie?: string;
}

/** Storno-Gegenbuchung: optionaler abweichender Zweck. */
export class StornoKassenbuchDto {
  @ApiPropertyOptional({ description: 'Abweichender Zweck der Storno-Buchung' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  zweck?: string;
}

/** Query-Parameter fuer die paginierte Liste (Zeitraum-/Typ-Filter). */
export class ListKassenbuchQueryDto {
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

  @ApiPropertyOptional({ enum: KASSENBUCH_TYPEN })
  @IsOptional()
  @IsIn(KASSENBUCH_TYPEN as unknown as string[])
  typ?: string;

  @ApiPropertyOptional({ description: 'Zeitraum-Beginn (YYYY-MM-DD), inklusive' })
  @IsOptional()
  @IsDateString()
  von?: string;

  @ApiPropertyOptional({ description: 'Zeitraum-Ende (YYYY-MM-DD), inklusive' })
  @IsOptional()
  @IsDateString()
  bis?: string;
}

/** Query-Parameter fuer den CSV-Export (Zeitraum optional). */
export class KassenbuchExportQueryDto {
  @ApiPropertyOptional({ description: 'Zeitraum-Beginn (YYYY-MM-DD), inklusive' })
  @IsOptional()
  @IsDateString()
  von?: string;

  @ApiPropertyOptional({ description: 'Zeitraum-Ende (YYYY-MM-DD), inklusive' })
  @IsOptional()
  @IsDateString()
  bis?: string;
}
