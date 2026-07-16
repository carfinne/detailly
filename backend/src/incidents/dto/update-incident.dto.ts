import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  INCIDENT_SCHWEREGRAD,
  INCIDENT_STATUS,
  type IncidentSchweregrad,
  type IncidentStatus,
} from '../incident.constants';

/**
 * Teil-Update eines Vorfalls (OWNER). Alle Felder optional. Die drei
 * Eskalationsschritte werden als BOOLEAN-Schalter uebergeben (Checkliste im UI):
 * true setzt den zugehoerigen Zeitstempel auf 'jetzt' (falls noch leer), false
 * loescht ihn wieder. Der eigentliche VERSAND (Behoerde/Verantwortlicher/
 * Betroffene) erfolgt IMMER durch einen Menschen ausserhalb der App –
 * das Register dokumentiert nur, DASS/WANN gemeldet wurde (Review-before-send).
 */
export class UpdateIncidentDto {
  @IsOptional() @IsIn(INCIDENT_STATUS) status?: IncidentStatus;
  @IsOptional() @IsIn(INCIDENT_SCHWEREGRAD) schweregrad?: IncidentSchweregrad;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  betroffeneDatenkategorien?: string[];

  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) betroffenePersonenAnzahl?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) betroffeneDatensaetzeAnzahl?: number;

  @IsOptional() @IsString() @MaxLength(4000) beschreibung?: string;
  @IsOptional() @IsString() @MaxLength(4000) wahrscheinlicheFolgen?: string;
  @IsOptional() @IsString() @MaxLength(4000) getroffeneMassnahmen?: string;
  @IsOptional() @IsString() @MaxLength(4000) risikoBewertung?: string;

  /** Art. 33 Abs. 2: Verantwortlicher (Betrieb) wurde informiert. */
  @IsOptional() @IsBoolean() verantwortlicherInformiert?: boolean;
  /** Meldung an die Aufsichtsbehoerde ist erfolgt. */
  @IsOptional() @IsBoolean() aufsichtsbehoerdeGemeldet?: boolean;
  /** Art. 34: betroffene Personen wurden benachrichtigt. */
  @IsOptional() @IsBoolean() betroffeneInformiert?: boolean;
}
