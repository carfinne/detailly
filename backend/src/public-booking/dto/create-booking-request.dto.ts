import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Eingabe der oeffentlichen Terminanfrage. STRIKTE Whitelist: enthaelt bewusst
 * KEIN tenantId/status/IDs interner Objekte. Zusammen mit der globalen
 * ValidationPipe (whitelist + forbidNonWhitelisted) ist damit Mass-Assignment
 * (z.B. eingeschleustes tenantId) ausgeschlossen.
 */
export class CreateBookingRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  // Serverseitig wird zusaetzlich erzwungen: mindestens email ODER phone.
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  /** Optional gewaehlte Leistung – wird gegen den Betrieb (tenantId + aktiv) geprueft. */
  @IsOptional()
  @IsUUID()
  serviceItemId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fahrzeug?: string;

  @IsOptional()
  @IsDateString()
  wunschtermin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nachricht?: string;

  /**
   * Honeypot: ein per CSS verstecktes Feld. Menschen lassen es leer, Bots fuellen
   * es. Ist es gesetzt, verwirft der Server die Anfrage STILL (antwortet aber wie
   * bei Erfolg, damit der Bot nicht lernt, erkannt worden zu sein). Wird NIE
   * gespeichert.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
