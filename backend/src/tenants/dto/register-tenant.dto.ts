import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Betriebstyp } from '../entities/tenant.entity';
import {
  IsKeinTrivialPasswort,
  PASSWORT_MIN_LAENGE,
} from '../../common/validation/password-policy';

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

  // A3: Mindestlaenge 10 + Trivial-Passwort-Blocklist (common/validation/password-policy).
  @IsString()
  @MinLength(PASSWORT_MIN_LAENGE)
  @MaxLength(100)
  @IsKeinTrivialPasswort()
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  /**
   * Pflicht-Zustimmung zu den AGB. MUSS `true` sein – der Service (`register`)
   * erzwingt das zusaetzlich hart: fehlt eine der drei Zustimmungen, wird die
   * Registrierung mit 400 abgebrochen und NICHTS angelegt (kein Tenant/User/Abo).
   * `@IsBoolean` (statt @Equals(true)) laesst `false` bis in den Service durch,
   * damit der Honeypot-Zweig im Controller vorher greifen kann. Der eigentliche
   * Nachweis-Zeitstempel wird SERVERSEITIG gesetzt (nie dieser Client-Wert).
   */
  @IsBoolean()
  agbAkzeptiert: boolean;

  /** Pflicht-Zustimmung zur Datenschutzerklaerung. MUSS `true` sein (s. agbAkzeptiert). */
  @IsBoolean()
  datenschutzAkzeptiert: boolean;

  /** Pflicht-Zustimmung zum Auftragsverarbeitungsvertrag (AVV, Art. 28 DSGVO). MUSS `true` sein. */
  @IsBoolean()
  avvAkzeptiert: boolean;

  /** Ausrichtung des Betriebs (Theming + Kalkulations-Katalog). Default: komplett. */
  @IsOptional()
  @IsIn(Object.values(Betriebstyp))
  betriebstyp?: Betriebstyp;

  /**
   * Optionaler Empfehlungs-Code (aus `?ref=CODE` vorbefuellt). Wird serverseitig
   * normalisiert und exakt aufgeloest; ein unbekannter Code wird STILL verworfen
   * (kein Fehler, die Registrierung laeuft normal weiter). MaxLength deckt das
   * kurze Code-Format grosszuegig ab (Missbrauch/Enumeration ueber lange Werte
   * ausgeschlossen).
   */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  ref?: string;

  /**
   * Honeypot (wie CreateBookingRequestDto.website): per CSS verstecktes Feld.
   * Menschen lassen es leer, Bots fuellen es. Ist es gesetzt, taeuscht der
   * Controller Erfolg vor und legt NICHTS an (kein Tenant/User/Abo). Da der
   * ValidationPipe `forbidNonWhitelisted` nutzt, MUSS das Feld hier bekannt sein,
   * damit die Anmeldung nicht schon an einem 400 scheitert (dann kein Honeypot).
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
