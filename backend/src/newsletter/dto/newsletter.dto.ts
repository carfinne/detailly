import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Anmeldung zum Newsletter (nur E-Mail – PII-minimal). */
export class NewsletterAnmeldenDto {
  @IsEmail()
  email: string;

  /**
   * Honeypot (wie CreateBookingRequestDto.website): per CSS verstecktes Feld.
   * Menschen lassen es leer, Bots fuellen es. Ist es gesetzt, verwirft der
   * Controller die Anmeldung STILL (antwortet aber wie bei Erfolg). Wird NIE
   * gespeichert. `forbidNonWhitelisted` erzwingt, dass das Feld hier bekannt ist.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

/** Bestaetigung ODER Abmeldung per Token aus dem Mail-Link. */
export class NewsletterTokenDto {
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token: string;
}

/** Newsletter-Versand durch den Betreiber (Betreff + Freitext-Inhalt). */
export class NewsletterSendenDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  betreff: string;

  @IsString()
  @MinLength(10)
  @MaxLength(20000)
  inhalt: string;
}
