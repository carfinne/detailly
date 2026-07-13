import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import {
  IsKeinTrivialPasswort,
  PASSWORT_MIN_LAENGE,
} from '../../common/validation/password-policy';

/** Schritt 1: Reset anfordern. Antwort ist IMMER gleich (keine Enumeration). */
export class RequestPasswordResetDto {
  @IsEmail()
  @MaxLength(160)
  email: string;
}

/** Schritt 2: Reset einloesen. Token kommt aus dem E-Mail-Link. */
export class ConfirmPasswordResetDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;

  // Max. 72: bcrypt verarbeitet nur die ersten 72 Bytes und schneidet den Rest
  // STILL ab -> laengere Eingaben wuerden faelschlich "Sicherheit" suggerieren.
  // A3: Mindestlaenge 10 + Trivial-Passwort-Blocklist (common/validation/password-policy).
  @IsString()
  @MinLength(PASSWORT_MIN_LAENGE)
  @MaxLength(72)
  @IsKeinTrivialPasswort()
  newPassword: string;
}
