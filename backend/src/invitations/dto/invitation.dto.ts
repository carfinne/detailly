import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole, TENANT_ROLLEN } from '../../users/entities/user.entity';
import {
  IsKeinTrivialPasswort,
  PASSWORT_MIN_LAENGE,
} from '../../common/validation/password-policy';

/**
 * Einladung ausstellen (Leitung: OWNER/MANAGER). Es wird KEIN Passwort vergeben –
 * der Eingeladene setzt sein eigenes beim Einloesen. Nur Betriebs-Rollen sind
 * zulassbar: eine Plattform-Rolle im Body wird schon hier (Validierung) mit 400
 * abgelehnt (zusaetzlich zum Service-Guard).
 */
export class CreateInvitationDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty({ enum: TENANT_ROLLEN })
  @IsIn(TENANT_ROLLEN)
  role: UserRole;
}

/**
 * Einladung einloesen (OEFFENTLICH, ohne Login). Der Eingeladene setzt sein
 * EIGENES Passwort (bestehende Passwort-Policy) und darf optional seinen Namen
 * bestaetigen/korrigieren.
 *
 * SICHERHEIT: Es gibt hier BEWUSST KEIN `role`- und KEIN `tenantId`-Feld. Rolle
 * und Betrieb stammen ausschliesslich aus der Einladung (serverseitig) – niemals
 * aus dem Request-Body. Ein dennoch mitgesendetes `role` wird zusaetzlich von der
 * globalen ValidationPipe (whitelist + forbidNonWhitelisted) verworfen.
 */
export class AcceptInvitationDto {
  @ApiProperty({ description: 'Roh-Token aus dem Einladungs-Link' })
  @IsString()
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(PASSWORT_MIN_LAENGE)
  @IsKeinTrivialPasswort()
  password: string;

  @ApiPropertyOptional({ description: 'Optionale Namensbestaetigung (Fallback: Name aus der Einladung)' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;
}

/** Einladung nachschlagen (oeffentlich): Betrieb + Rolle fuer die Einloese-Seite. */
export class LookupInvitationDto {
  @ApiProperty({ description: 'Roh-Token aus dem Einladungs-Link' })
  @IsString()
  token: string;
}
