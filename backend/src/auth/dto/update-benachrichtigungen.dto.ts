import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Benachrichtigungs-Praeferenzen des eigenen Nutzers (Welle 3-A, alle Rollen).
 * Alle Kategorien optional -> Teil-Update. Kategorien spiegeln die Glocke:
 * Server-Reminder (rechnungenFaellig/termineHeute/materialKnapp) + Inhaber-Nudges
 * (steuerTermine/auslastung/par19). forbidNonWhitelisted-kompatibel (nur diese Keys).
 */
export class UpdateBenachrichtigungenDto {
  @IsOptional() @IsBoolean() rechnungenFaellig?: boolean;
  @IsOptional() @IsBoolean() termineHeute?: boolean;
  @IsOptional() @IsBoolean() materialKnapp?: boolean;
  @IsOptional() @IsBoolean() angeboteAngenommen?: boolean;
  @IsOptional() @IsBoolean() steuerTermine?: boolean;
  @IsOptional() @IsBoolean() auslastung?: boolean;
  @IsOptional() @IsBoolean() par19?: boolean;
}
