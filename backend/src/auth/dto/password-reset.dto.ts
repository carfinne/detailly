import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Mindest-Komplexität: >= 10 Zeichen und mind. ein Buchstabe + eine Ziffer. */
export const PASSWORT_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;
export const PASSWORT_HINWEIS =
  'Passwort muss mindestens 10 Zeichen lang sein und Buchstaben sowie Ziffern enthalten.';

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
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  @Matches(PASSWORT_REGEX, { message: PASSWORT_HINWEIS })
  newPassword: string;
}
