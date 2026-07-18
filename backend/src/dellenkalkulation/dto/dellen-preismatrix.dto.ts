import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Obergrenze fuer Euro-Betraege der Matrix. Bewusst DEUTLICH unter der
 * numeric(10,2)-Spaltengrenze (99.999.999,99) UND fachlich absurd hoch – kappt
 * Fehleingaben/DoS, bevor Postgres einen numeric-overflow (unbehandelter 500)
 * wirft. SQLite (Dev/Tests) prueft die Praezision nicht, Postgres schon.
 */
const MAX_BETRAG = 99999.99;
/** Faktor-Obergrenze (numeric(6,3) -> < 1000; 10 ist fachlich mehr als genug). */
const MAX_FAKTOR = 10;

/** Eine Staffel-Stufe der Hagel-Kalkulation. */
export class HagelStaffelStufeDto {
  @ApiPropertyOptional({ description: 'Obere Dellen-Anzahl (inkl.); null = "und mehr"', nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  maxDellen?: number | null;

  @ApiProperty({ description: 'Panel-Pauschale (Euro)' })
  @IsNumber()
  @Min(0)
  @Max(MAX_BETRAG)
  pauschale: number;
}

/**
 * Setzen der betriebs-eigenen Preismatrix (Upsert je Tenant). Alle Betraege in
 * Euro (gekappt gegen numeric-overflow), Faktoren als Multiplikatoren. Der
 * Service normalisiert/sortiert die Hagel-Staffel serverseitig.
 *
 * Faktoren sind ZUSCHLAGSfaktoren (Kante/Alu erschweren die Arbeit) und damit
 * fachlich >= 1: `@Min(1)` verhindert, dass ein versehentlicher Faktor < 1
 * (insb. 0) den Basispreis STILL herunterrechnet oder nullt.
 */
export class SetDellenPreismatrixDto {
  @ApiProperty() @IsNumber() @Min(0) @Max(MAX_BETRAG) basis1Euro: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(MAX_BETRAG) basis2Euro: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(MAX_BETRAG) basis5Euro: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(MAX_BETRAG) basisGolfball: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(MAX_BETRAG) basisGroesser: number;

  @ApiProperty({ description: 'Faktor Kanten-/Sicken-Delle (>= 1, z.B. 1.5)' })
  @IsNumber()
  @Min(1)
  @Max(MAX_FAKTOR)
  kantenFaktor: number;

  @ApiProperty({ description: 'Faktor Aluminium (>= 1, z.B. 1.4)' })
  @IsNumber()
  @Min(1)
  @Max(MAX_FAKTOR)
  aluFaktor: number;

  @ApiProperty({ description: 'Aufschlag je Delle mit Lackschaden (Euro)' })
  @IsNumber()
  @Min(0)
  @Max(MAX_BETRAG)
  lackschadenAufschlag: number;

  @ApiProperty({ description: 'Mindestpauschale je Kalkulation (0 = keine)' })
  @IsNumber()
  @Min(0)
  @Max(MAX_BETRAG)
  mindestpauschale: number;

  @ApiProperty({ description: 'Anfahrtspauschale je Kalkulation (0 = keine)' })
  @IsNumber()
  @Min(0)
  @Max(MAX_BETRAG)
  anfahrtspauschale: number;

  // Mindestens eine Stufe (sonst liefert der Hagel-Modus stumm 0 EUR je Panel);
  // gekappt bei 20 Stufen (Validierungs-DoS-Schutz vor der Service-Schranke).
  @ApiProperty({ type: [HagelStaffelStufeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => HagelStaffelStufeDto)
  hagelStaffel: HagelStaffelStufeDto[];
}
