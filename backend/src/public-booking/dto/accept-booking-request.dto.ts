import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Optionale Feinheiten beim Annehmen einer Anfrage. Ohne Angaben werden sinnvolle
 * Defaults aus der Anfrage abgeleitet (Wunschtermin bzw. jetzt, Titel aus Name).
 */
export class AcceptBookingRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  titel?: string;

  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  ende?: string;

  /** Standard: true – legt aus den Kontaktdaten der Anfrage einen Kunden an. */
  @IsOptional()
  @IsBoolean()
  kundeAnlegen?: boolean;

  /**
   * Standard: true – legt zum Termin auch einen Auftrag an (uebernimmt die
   * Leistung der Anfrage als Position, Fahrzeug-Freitext als internen Hinweis).
   * Setzt einen Kunden voraus (orders.customerId ist Pflicht): zusammen mit
   * kundeAnlegen=false ist ein EXPLIZITES true ein 400; ohne Angabe wird der
   * Auftrag dann still uebersprungen (abwaertskompatibel zum alten Verhalten).
   */
  @IsOptional()
  @IsBoolean()
  auftragAnlegen?: boolean;

  /**
   * Optional: die Anfrage direkt einem Mitarbeiter zuweisen (tenant-scoped). Loest
   * beim Annehmen den Doppelbuchungs-Schutz gegen die Termine dieses Mitarbeiters aus.
   */
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  /**
   * Nur bei `konfliktverhalten='warnen'`: true nimmt die Anfrage trotz erkannter
   * Terminueberschneidung an. Bei `blockieren` wird das Flag ignoriert (immer 409).
   */
  @IsOptional()
  @IsBoolean()
  konfliktBestaetigt?: boolean;
}
