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
}
