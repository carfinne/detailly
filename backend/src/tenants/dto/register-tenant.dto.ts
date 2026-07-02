import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Betriebstyp } from '../entities/tenant.entity';

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

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  /** Ausrichtung des Betriebs (Theming + Kalkulations-Katalog). Default: komplett. */
  @IsOptional()
  @IsIn(Object.values(Betriebstyp))
  betriebstyp?: Betriebstyp;
}
