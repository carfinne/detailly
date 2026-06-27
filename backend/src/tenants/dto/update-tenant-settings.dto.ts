import { IsOptional, IsString, MaxLength } from 'class-validator';

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

  // sevDesk-API-Token (pro Betrieb). Leerer String = Integration deaktivieren.
  // Wird verschluesselt in der dedizierten Spalte tenant.sevdeskApiToken abgelegt
  // (NICHT in settings) und nie im Klartext zurueckgegeben.
  @IsOptional() @IsString() @MaxLength(120) sevdeskApiToken?: string;
}
