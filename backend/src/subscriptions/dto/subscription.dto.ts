import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { SubscriptionStatus } from '../entities/subscription.entity';

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
}

/** Verlaengert das Abo um N Monate und setzt es auf `active`. */
export class ExtendSubscriptionDto {
  @ApiProperty({ example: 1, minimum: 1, maximum: 36 })
  @IsInt()
  @Min(1)
  @Max(36)
  months: number;
}
