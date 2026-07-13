import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Aktivierung der 2FA nach dem Enrollment: der aktuell in der Authenticator-App
 * angezeigte 6-stellige Code. Bewusst KEINE strenge Format-Validierung, die 400
 * werfen wuerde – ein falscher/ungueltiger Code fuehrt einheitlich zu 401
 * (kein Oracle "Format falsch" vs. "Code falsch").
 */
export class MfaAktivierenDto {
  @IsString()
  @MaxLength(16)
  code: string;
}

/**
 * Zweite Login-Stufe: entweder ein TOTP-`code` ODER ein `recoveryCode`. Beide
 * optional (die Pruefung/das einheitliche 401 uebernimmt der Service, damit nicht
 * durchsickert, ob ueberhaupt ein Secret existiert). MaxLength schuetzt nur vor
 * Ueberlaenge, nicht als fachliche Format-Pruefung.
 */
export class MfaVerifyDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  recoveryCode?: string;
}

/**
 * Deaktivierung der 2FA: per aktuellem TOTP-`code` ODER Konto-`passwort`. Beide
 * optional; der Service prueft und antwortet im Fehlerfall einheitlich mit 401
 * (kein Hinweis, ob ein Secret hinterlegt ist).
 */
export class MfaDeaktivierenDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  passwort?: string;
}
