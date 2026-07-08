import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Betriebstyp } from '../entities/tenant.entity';
import { FRIST_MAX, FRIST_MIN, GEBUEHR_MAX, GEBUEHR_MIN } from '../../common/mahnwesen/mahnwesen-config';
import { PORT_MAX, PORT_MIN } from '../../common/mail/mail-config';

/**
 * Fristen des Mahnwesens (Tage nach Faelligkeit). Jedes Feld optional (Teil-Update);
 * die Reihenfolge-Regel (aufsteigend) prueft der Service auf dem zusammengefuehrten
 * Ergebnis, da sie felduebergreifend ist.
 */
class MahnwesenFristenDto {
  @IsOptional() @IsInt() @Min(FRIST_MIN) @Max(FRIST_MAX) erinnerung?: number;
  @IsOptional() @IsInt() @Min(FRIST_MIN) @Max(FRIST_MAX) mahnung1?: number;
  @IsOptional() @IsInt() @Min(FRIST_MIN) @Max(FRIST_MAX) mahnung2?: number;
}

/** Mahngebuehren (EUR) je Stufe. Nicht negativ, gedeckelt. */
class MahnwesenGebuehrDto {
  @IsOptional() @IsNumber() @Min(GEBUEHR_MIN) @Max(GEBUEHR_MAX) mahnung1?: number;
  @IsOptional() @IsNumber() @Min(GEBUEHR_MIN) @Max(GEBUEHR_MAX) mahnung2?: number;
}

/**
 * SMTP-Konfiguration fuer den betriebseigenen Mail-Versand (feat/night-email).
 * Alle Felder optional (Teil-Update). Die felduebergreifende Regel
 * (enabled -> Host/Port/From Pflicht) prueft der Service (assertMailConfigValid)
 * auf dem zusammengefuehrten Ergebnis. Das Passwort ist WRITE-ONLY: leerer String
 * loescht es, Weglassen laesst es unveraendert; es wird NIE zurueckgegeben.
 * Nicht-secret-Felder landen in tenant.settings.mailConfig, `pass` in der
 * verschluesselten select:false-Spalte tenant.smtpPassword.
 */
export class MailConfigDto {
  @IsOptional() @IsBoolean() enabled?: boolean;

  @IsOptional() @IsString() @MaxLength(255) host?: string;

  @IsOptional() @IsInt() @Min(PORT_MIN) @Max(PORT_MAX) port?: number;

  /** true = SMTPS (implizites TLS, meist Port 465); false = STARTTLS (587). */
  @IsOptional() @IsBoolean() secure?: boolean;

  @IsOptional() @IsString() @MaxLength(255) user?: string;

  /** SMTP-Passwort (write-only). Leerer String = loeschen, weglassen = unveraendert. */
  @IsOptional() @IsString() @MaxLength(255) pass?: string;

  /** Absender-Adresse (From). Leerer String erlaubt (= Feld leeren, Versand dann inaktiv). */
  @IsOptional()
  @ValidateIf((o: MailConfigDto) => o.fromEmail !== '')
  @IsEmail({}, { message: 'Bitte eine gueltige Absender-Adresse (From) angeben.' })
  @MaxLength(255)
  fromEmail?: string;

  /** Anzeigename des Absenders (z. B. Firmenname). */
  @IsOptional() @IsString() @MaxLength(120) fromName?: string;
}

/** Mahnwesen-Konfiguration je Betrieb (C1-C). Landet als Objekt in tenant.settings.mahnwesen. */
export class MahnwesenDto {
  @IsOptional() @IsBoolean() autoMahnen?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => MahnwesenFristenDto)
  fristen?: MahnwesenFristenDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MahnwesenGebuehrDto)
  gebuehr?: MahnwesenGebuehrDto;
}

/**
 * EUR/qm-Richtwerte der 3D-Sofortkalkulation je Betrieb. Alle Felder optional
 * (Teil-Update); nicht negativ. Landet als Objekt in tenant.settings.kalkulation.
 */
export class KalkulationDto {
  @IsOptional() @IsNumber() @Min(0) folierungProQm?: number;
  @IsOptional() @IsNumber() @Min(0) ppfProQm?: number;
  @IsOptional() @IsNumber() @Min(0) aufbereitungProQm?: number;
}

/**
 * Stammdaten des EIGENEN Betriebs (Self-Service durch den Inhaber).
 * Alle Felder optional -> Teil-Update (PATCH). Adress-/Kontaktfelder landen in
 * echten Tenant-Spalten, Steuer-/Bankfelder in tenant.settings (genau die Keys,
 * die das Rechnungs-PDF bereits ausliest: steuernummer/ustId/iban/bic/bankname).
 *
 * §14 UStG: Name + Anschrift + (Steuernummer ODER USt-IdNr) sind Pflichtangaben
 * auf einer gueltigen Rechnung.
 */
export class UpdateTenantSettingsDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;

  /** Ausrichtung des Betriebs (Theming + Kalkulations-Katalog). */
  @IsOptional() @IsIn(Object.values(Betriebstyp)) betriebstyp?: Betriebstyp;
  /**
   * Betriebs-E-Mail: dient u. a. als Reply-To der Kunden-Mails (T-003), deshalb
   * echte E-Mail-Validierung. Leerer String bleibt erlaubt (= Feld loeschen) –
   * ValidateIf ueberspringt die Pruefung dann.
   */
  @IsOptional()
  @ValidateIf((o: UpdateTenantSettingsDto) => o.email !== '')
  @IsEmail({}, { message: 'Bitte eine gueltige E-Mail-Adresse angeben.' })
  @MaxLength(160)
  email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;

  @IsOptional() @IsString() @MaxLength(120) street?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(60) country?: string;

  @IsOptional() @IsString() @MaxLength(40) steuernummer?: string;
  @IsOptional() @IsString() @MaxLength(40) ustId?: string;

  @IsOptional() @IsString() @MaxLength(40) iban?: string;
  @IsOptional() @IsString() @MaxLength(20) bic?: string;
  @IsOptional() @IsString() @MaxLength(80) bankname?: string;

  // DATEV-Buchhaltungsexport (je Betrieb pflegbar).
  @IsOptional() @IsString() @MaxLength(20) datevBeraterNr?: string;
  @IsOptional() @IsString() @MaxLength(20) datevMandantNr?: string;
  @IsOptional() @IsString() @MaxLength(4) datevSkr?: string;
  @IsOptional() @IsString() @MaxLength(8) datevErloeskonto19?: string;
  @IsOptional() @IsString() @MaxLength(8) datevErloeskonto7?: string;
  @IsOptional() @IsString() @MaxLength(8) datevErloeskonto0?: string;
  @IsOptional() @IsString() @MaxLength(8) datevDebitorSammelkonto?: string;

  // Rechnungsstellung: Standardwerte fuer NEUE Rechnungen (bestehende bleiben unveraendert).
  /** Standard-Zahlungsziel in Tagen (leer = Systemstandard 14). */
  @IsOptional()
  @Matches(/^\d{0,3}$/, { message: 'Zahlungsziel bitte als Zahl in Tagen angeben (z. B. 14).' })
  rechnungZahlungszielTage?: string;

  /** Freier Fusstext auf dem Rechnungs-/Angebots-PDF (z. B. Danke-Zeile, Hinweis). */
  @IsOptional() @IsString() @MaxLength(300) rechnungFusstext?: string;

  /**
   * Eigener Online-Zahlungslink des Betriebs (T-006), z. B. PayPal.me oder ein
   * im EIGENEN Stripe-Konto erstellter Payment Link. Wird auf der oeffentlichen
   * Belegseite als "Online bezahlen"-Button gezeigt – das Geld fliesst direkt
   * an den Betrieb, nie ueber die Plattform. Leerer String = Link entfernen
   * (ValidateIf ueberspringt die Pruefung dann, setOrDelete-Muster).
   */
  @IsOptional()
  @ValidateIf((o: UpdateTenantSettingsDto) => o.rechnungPaymentLink !== '')
  @Matches(/^https:\/\/\S+$/, { message: 'Der Zahlungslink muss mit https:// beginnen.' })
  @MaxLength(300)
  rechnungPaymentLink?: string;

  // Automatische Kunden-Mails (T-003): '1' = an (Default, auch wenn ungesetzt),
  // '0' = aus, '' = Key loeschen (zurueck auf Default). Werte als String, weil
  // tenant.settings durchgaengig String-Keys haelt (setOrDelete-Muster).
  /** Status-Mails an Endkunden (bestaetigt/in Arbeit/abholbereit, mit Track-Link). */
  @IsOptional() @IsIn(['0', '1', '']) kundenmailStatus?: string;

  /** Terminbestaetigung an Endkunden bei Annahme einer Online-Anfrage. */
  @IsOptional() @IsIn(['0', '1', '']) kundenmailTerminbestaetigung?: string;

  // sevDesk-API-Token (pro Betrieb). Leerer String = Integration deaktivieren.
  // Wird verschluesselt in der dedizierten Spalte tenant.sevdeskApiToken abgelegt
  // (NICHT in settings) und nie im Klartext zurueckgegeben.
  @IsOptional() @IsString() @MaxLength(120) sevdeskApiToken?: string;

  /**
   * Mahnwesen-Konfiguration (C1-C): Auto-Mahnen an/aus, Fristen (Tage nach
   * Faelligkeit) und Mahngebuehren. Teil-Update: nur die uebergebenen Felder
   * werden auf die bestehende Konfiguration angewandt (Service). Landet als
   * Objekt in tenant.settings.mahnwesen.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => MahnwesenDto)
  mahnwesen?: MahnwesenDto;

  /**
   * SMTP-Konfiguration fuer den betriebseigenen Mail-Versand (feat/night-email).
   * Teil-Update: nur uebergebene Felder werden angewandt. Nicht-secret-Felder
   * landen in tenant.settings.mailConfig, das Passwort in der verschluesselten
   * select:false-Spalte tenant.smtpPassword (nie in settings, nie in Antworten).
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => MailConfigDto)
  mailConfig?: MailConfigDto;

  /**
   * EUR/qm-Richtwerte der 3D-Sofortkalkulation (Folierung/PPF/Aufbereitung).
   * Teil-Update: nur uebergebene Felder werden angewandt. Landet als Objekt in
   * tenant.settings.kalkulation; Defaults spiegeln 60/130/25.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => KalkulationDto)
  kalkulation?: KalkulationDto;
}
