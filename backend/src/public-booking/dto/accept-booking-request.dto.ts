import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
