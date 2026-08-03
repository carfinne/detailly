import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsInt,
  IsArray,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { SubscriptionStatus, KUENDIGUNG_GRUND_KATEGORIEN } from '../entities/subscription.entity';
import { ADDON_FEATURE_KEYS } from '../plan-catalog';

/**
 * Weist einem Betrieb einen Tarif zu bzw. ersetzt das bestehende Abo
 * (platform_admin). Datumsfelder als ISO-String; der Service wandelt sie in `Date`.
 */
export class AssignSubscriptionDto {
  @ApiProperty()
  @IsString()
  planId: string;

  @ApiPropertyOptional({ enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ description: 'Ende der Testphase (ISO-Datum)' })
  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;

  @ApiPropertyOptional({ description: 'Beginn der laufenden Periode (ISO-Datum)' })
  @IsOptional()
  @IsDateString()
  currentPeriodStart?: string;

  @ApiPropertyOptional({ description: 'Ende der laufenden Periode (ISO-Datum)' })
  @IsOptional()
  @IsDateString()
  currentPeriodEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;

  @ApiPropertyOptional({
    description: 'Gebuchte à-la-carte Add-on-Feature-Keys (z. B. ["folierung_ppf"]).',
    isArray: true,
    enum: ADDON_FEATURE_KEYS,
  })
  @IsOptional()
  @IsArray()
  @IsIn(ADDON_FEATURE_KEYS, { each: true })
  addons?: string[];
}

/** Teil-Aktualisierung eines bestehenden Abos (platform_admin). */
export class UpdateSubscriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ description: 'Kuendigung zum Laufzeitende' })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  currentPeriodStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  currentPeriodEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;

  @ApiPropertyOptional({
    description: 'Gebuchte à-la-carte Add-on-Feature-Keys (ersetzt die Liste vollstaendig).',
    isArray: true,
    enum: ADDON_FEATURE_KEYS,
  })
  @IsOptional()
  @IsArray()
  @IsIn(ADDON_FEATURE_KEYS, { each: true })
  addons?: string[];
}

/** Verlaengert das Abo um N Monate und setzt es auf `active`. */
export class ExtendSubscriptionDto {
  @ApiProperty({ example: 1, minimum: 1, maximum: 36 })
  @IsInt()
  @Min(1)
  @Max(36)
  months: number;
}

/**
 * Verlaengert die TESTPHASE eines Betriebs um N Tage (Betreiber-Cockpit). Nur auf
 * Betriebe im Trial-Status anwendbar – zahlende/gekuendigte Tarife bleiben
 * unberuehrt (der Service wirft sonst 409).
 */
export class ExtendTrialDto {
  @ApiProperty({ example: 14, minimum: 1, maximum: 365 })
  @IsInt()
  @Min(1)
  @Max(365)
  days: number;
}

/**
 * Setzt einen Betrieb auf „Pilot" (Betreiber-Cockpit): unbefristeter Vollzugriff,
 * sperrt nie automatisch. Optionale interne Notiz (z. B. Pilot-Kontext/Ansprechpartner).
 */
export class SetPilotDto {
  @ApiPropertyOptional({ description: 'Interne Notiz zum Pilotstatus' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notiz?: string;
}

/**
 * Selbstkuendigung des eigenen Betriebs durch den Inhaber (OWNER). ALLE Felder
 * sind OPTIONAL – der Grund ist FREIWILLIG, die Kuendigung darf nie an einer
 * Pflichtangabe haengen. Ein leerer Body kuendigt zum Laufzeitende.
 */
export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Freiwillige grobe Kategorie des Kuendigungsgrundes.',
    enum: KUENDIGUNG_GRUND_KATEGORIEN,
  })
  @IsOptional()
  @IsIn(KUENDIGUNG_GRUND_KATEGORIEN)
  grundKategorie?: string;

  @ApiPropertyOptional({ description: 'Freiwilliger Freitext zum Kuendigungsgrund.', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  grundText?: string;

  @ApiPropertyOptional({
    description:
      'true = der Betrieb markiert sein Problem als moeglicherweise loesbar; ' +
      'aus dem Freitext entsteht zusaetzlich ein Support-Ticket beim Betreiber.',
  })
  @IsOptional()
  @IsBoolean()
  alsSupportAnfrage?: boolean;
}
