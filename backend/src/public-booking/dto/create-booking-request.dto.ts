import {
  IsBoolean,
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

  // --- Verbraucherrechtliche Pflicht-Zustimmungen (nur Modus `verbindlich`) -----
  // Serverseitig gegen den aktiven Modus des Betriebs geprueft (nicht dem Client
  // vertrauen). Im Modus `anfrage` werden diese Felder ignoriert (kein Vertrag).

  /**
   * Kenntnisnahme der Pflichtinformationen (Art. 246a EGBGB) + der Widerrufs-
   * belehrung. Im Modus `verbindlich` PFLICHT (fehlt sie -> 400). Der Button-Klick
   * selbst ist die zahlungspflichtige Willenserklaerung (§312j Abs. 3).
   */
  @IsOptional()
  @IsBoolean()
  pflichtinfoBestaetigt?: boolean;

  /**
   * Ausdrueckliches Verlangen des vorzeitigen Leistungsbeginns (§356 Abs. 4 BGB):
   * nur noetig, wenn der Termin INNERHALB der 14-taegigen Widerrufsfrist liegt.
   * Dann PFLICHT (fehlt sie -> 400), sonst irrelevant.
   */
  @IsOptional()
  @IsBoolean()
  vorzeitigerLeistungsbeginn?: boolean;

  /**
   * Datenschutz-Kenntnisnahme (freiwillig, KEINE erzwungene Einwilligung –
   * Kopplungsverbot). Wird – falls gesetzt – als Nachweis-Zeitstempel gespeichert,
   * blockiert die Absendung aber NIE.
   */
  @IsOptional()
  @IsBoolean()
  datenschutzHinweis?: boolean;

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
