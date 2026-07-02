import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Eigenes Profil (Self-Service, alle Rollen): nur harmlose Anzeige-Felder.
 * E-Mail (Login-Identitaet, braucht Verifikation), Rolle und Stundenlohn sind
 * bewusst NICHT enthalten - die pflegt die Leitung ueber /employees.
 */
export class UpdateMeDto {
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
}
