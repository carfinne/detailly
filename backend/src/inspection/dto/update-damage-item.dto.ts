import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import {
  DamageArt,
  DamageItemStatus,
  DamageOrigin,
  DamageReparaturart,
  DamageSchweregrad,
} from '../entities/damage-item.entity';

/**
 * Teil-Aktualisierung eines Schadens. `origin` ist absichtlich aenderbar
 * (Vorschaden/Neu-Korrektur), die Rollen-Hoheit dafuer erzwingt der Controller.
 */
export class UpdateDamageItemDto {
  @ApiPropertyOptional({
    enum: [
      'kratzer',
      'delle',
      'steinschlag',
      'lackschaden',
      'rost',
      'riss',
      'bruch',
      'verzogen',
      'fehlteil',
      'sonstiges',
    ],
  })
  @IsOptional()
  @IsIn([
    'kratzer',
    'delle',
    'steinschlag',
    'lackschaden',
    'rost',
    'riss',
    'bruch',
    'verzogen',
    'fehlteil',
    'sonstiges',
  ])
  art?: DamageArt;

  @ApiPropertyOptional({ enum: ['leicht', 'mittel', 'schwer'] })
  @IsOptional()
  @IsIn(['leicht', 'mittel', 'schwer'])
  schweregrad?: DamageSchweregrad;

  @ApiPropertyOptional({ enum: ['vorschaden', 'neu'] })
  @IsOptional()
  @IsIn(['vorschaden', 'neu'])
  origin?: DamageOrigin;

  @ApiPropertyOptional({
    enum: ['offen', 'in_arbeit', 'erledigt', 'abgelehnt', 'uebernommen'],
  })
  @IsOptional()
  @IsIn(['offen', 'in_arbeit', 'erledigt', 'abgelehnt', 'uebernommen'])
  status?: DamageItemStatus;

  @ApiPropertyOptional({
    enum: ['polieren', 'smart_repair', 'lackieren', 'instandsetzen', 'austausch', 'keine'],
  })
  @IsOptional()
  @IsIn(['polieren', 'smart_repair', 'lackieren', 'instandsetzen', 'austausch', 'keine'])
  reparaturart?: DamageReparaturart;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  groesseLaengeMm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  groesseBreiteMm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ausmass?: string;

  @ApiPropertyOptional({ description: 'Geschaetzte Kosten (decimal als String)' })
  @IsOptional()
  @IsString()
  kostenSchaetzung?: string;

  @ApiPropertyOptional({ description: 'Soll/Ist: war Vorschaden -> behoben?' })
  @IsOptional()
  @IsBoolean()
  behobenBeiAusgang?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;
}
