import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Betriebstyp } from '../entities/tenant.entity';

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
  @IsOptional() @IsString() @MaxLength(160) email?: string;
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
}
