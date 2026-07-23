import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Veroeffentlichen / Zurueckziehen eines Schaufenster-Eintrags.
 *
 * RECHT: `veroeffentlicht=true` ist NUR zulaessig, wenn der Betrieb
 * `kundeEinverstaendnis=true` bestaetigt (schriftliches Einverstaendnis des
 * Kunden zur Bildveroeffentlichung liegt vor). Fehlt die Bestaetigung, wirft der
 * Service 400 – ohne Consent gibt es kein veroeffentlicht=true. Beim Zurueckziehen
 * (`veroeffentlicht=false`) ist keine Bestaetigung noetig.
 */
export class PublishShowcaseItemDto {
  @ApiProperty({ description: 'true = veroeffentlichen, false = zurueckziehen' })
  @IsBoolean()
  veroeffentlicht: boolean;

  @ApiPropertyOptional({
    description:
      'Bestaetigung, dass das schriftliche Einverstaendnis des Kunden zur ' +
      'Bildveroeffentlichung vorliegt. Pflicht fuer veroeffentlicht=true.',
  })
  @IsOptional()
  @IsBoolean()
  kundeEinverstaendnis?: boolean;

  @ApiPropertyOptional({ description: 'Wortlaut der bestaetigten Consent-Erklaerung (Nachweis)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  einverstaendnisHinweis?: string;
}
