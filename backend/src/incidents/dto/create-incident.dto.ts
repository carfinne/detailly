import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  INCIDENT_QUELLE,
  INCIDENT_SCHWEREGRAD,
  type IncidentQuelle,
  type IncidentSchweregrad,
} from '../incident.constants';

/**
 * Manuelles Anlegen eines Vorfalls durch den Betrieb (OWNER). `tenantId`,
 * `status` und `quelle==='auto_signal'` werden NIE aus dem Body uebernommen –
 * der Server setzt tenantId aus dem Nutzer, Status startet auf 'erkannt', und
 * eine manuelle Anlage ist per Definition keine Auto-Erkennung.
 */
export class CreateIncidentDto {
  /** Herkunft (Default 'manuell'); 'auto_signal' ist hier nicht zulaessig. */
  @IsOptional()
  @IsIn(INCIDENT_QUELLE.filter((q) => q !== 'auto_signal'))
  quelle?: Exclude<IncidentQuelle, 'auto_signal'>;

  @IsOptional() @IsIn(INCIDENT_SCHWEREGRAD) schweregrad?: IncidentSchweregrad;

  /** Kenntniszeitpunkt (ISO). Fehlt er, setzt der Server 'jetzt' (Start 72h). */
  @IsOptional() @IsISO8601() kenntnisAm?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  betroffeneDatenkategorien?: string[];

  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) betroffenePersonenAnzahl?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) betroffeneDatensaetzeAnzahl?: number;

  @IsString() @MaxLength(4000) beschreibung!: string;

  @IsOptional() @IsString() @MaxLength(4000) wahrscheinlicheFolgen?: string;
  @IsOptional() @IsString() @MaxLength(4000) getroffeneMassnahmen?: string;
  @IsOptional() @IsString() @MaxLength(4000) risikoBewertung?: string;
}
