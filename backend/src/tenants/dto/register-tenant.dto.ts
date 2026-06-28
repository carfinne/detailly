import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORT_REGEX, PASSWORT_HINWEIS } from '../../auth/dto/password-reset.dto';

/**
 * Selbst-Registrierung eines neuen Werkstattbetriebs (oeffentlicher Endpoint).
 *
 * BEWUSST eng gehalten: KEINE Felder fuer `role`, `tenantId`, `status` o. ae. –
 * die werden serverseitig gesetzt. Da der globale ValidationPipe
 * `forbidNonWhitelisted: true` nutzt, fuehrt jedes zusaetzliche Feld im Body zu
 * einem 400 (zweite Verteidigungslinie gegen Privilege-/Tenant-Injection).
 */
export class RegisterTenantDto {
  /** Name des Betriebs -> wird zu Tenant.name + Basis fuer den eindeutigen slug. */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  firmenname: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName: string;

  /** Login-E-Mail des ersten Inhabers. Global eindeutig (users.email UNIQUE). */
  @IsEmail()
  @MaxLength(160)
  email: string;

  // Max. 72: bcrypt verarbeitet nur die ersten 72 Bytes (laengere wuerden still
  // abgeschnitten). Mindest-Komplexitaet wie beim Passwort-Reset.
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  @Matches(PASSWORT_REGEX, { message: PASSWORT_HINWEIS })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}
