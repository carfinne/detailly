import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Digitale Unterschrift einer Inspektion (POST /inspections/:id/signatur).
 *
 * `unterschriftPng` ist die Canvas-Ausgabe als PNG-Data-URL
 * (toDataURL('image/png')). Bewusst NUR PNG – die Signatur-Canvas exportiert
 * immer PNG, und so bleibt das Format eindeutig validierbar. Das Bild wird
 * inline in der Entity gespeichert (klein, < ~1 MB), nicht als Datei.
 *
 * `consentText` kommt NICHT aus dem Body – der Server setzt den eingefrorenen
 * Einwilligungstext selbst (manipulationssicher).
 */
export class SignInspectionDto {
  @ApiProperty({ description: 'Unterschrift als PNG-Data-URL: data:image/png;base64,...' })
  @IsString()
  @Matches(/^data:image\/png;base64,.+/, {
    message: 'unterschriftPng muss eine PNG-Data-URL sein (data:image/png;base64,...).',
  })
  unterschriftPng: string;

  @ApiProperty({ description: 'Name des Unterzeichnenden (z. B. Kunde)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  unterschriebenVonName: string;
}
