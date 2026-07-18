import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Eine Staffel-Stufe der Hagel-Kalkulation. */
export class HagelStaffelStufeDto {
  @ApiPropertyOptional({ description: 'Obere Dellen-Anzahl (inkl.); null = "und mehr"', nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxDellen?: number | null;

  @ApiProperty({ description: 'Panel-Pauschale (Euro)' })
  @IsNumber()
  @Min(0)
  pauschale: number;
}

/**
 * Setzen der betriebs-eigenen Preismatrix (Upsert je Tenant). Alle Betraege in
 * Euro, Faktoren als Multiplikatoren (>= 0). Der Service normalisiert/sortiert
 * die Hagel-Staffel serverseitig.
 */
export class SetDellenPreismatrixDto {
  @ApiProperty() @IsNumber() @Min(0) basis1Euro: number;
  @ApiProperty() @IsNumber() @Min(0) basis2Euro: number;
  @ApiProperty() @IsNumber() @Min(0) basis5Euro: number;
  @ApiProperty() @IsNumber() @Min(0) basisGolfball: number;
  @ApiProperty() @IsNumber() @Min(0) basisGroesser: number;

  @ApiProperty({ description: 'Faktor Kanten-/Sicken-Delle (z.B. 1.5)' })
  @IsNumber()
  @Min(0)
  kantenFaktor: number;

  @ApiProperty({ description: 'Faktor Aluminium (z.B. 1.4)' })
  @IsNumber()
  @Min(0)
  aluFaktor: number;

  @ApiProperty({ description: 'Aufschlag je Delle mit Lackschaden (Euro)' })
  @IsNumber()
  @Min(0)
  lackschadenAufschlag: number;

  @ApiProperty({ description: 'Mindestpauschale je Kalkulation (0 = keine)' })
  @IsNumber()
  @Min(0)
  mindestpauschale: number;

  @ApiProperty({ description: 'Anfahrtspauschale je Kalkulation (0 = keine)' })
  @IsNumber()
  @Min(0)
  anfahrtspauschale: number;

  @ApiProperty({ type: [HagelStaffelStufeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HagelStaffelStufeDto)
  hagelStaffel: HagelStaffelStufeDto[];
}
