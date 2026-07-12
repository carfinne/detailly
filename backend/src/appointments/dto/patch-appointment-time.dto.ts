import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * Leichtgewichtiges Verschieben eines Termins auf der Plantafel (Drag & Drop):
 * neuer Start/neues Ende und – beim Ziehen in eine andere Mitarbeiter-Spalte –
 * optional ein neuer `assignedUserId`. Loest denselben Doppelbuchungs-Schutz aus
 * wie create/update. `konfliktBestaetigt` uebersteuert die Warnung (nur im
 * Warn-Modus, s. CreateAppointmentDto).
 */
export class PatchAppointmentTimeDto {
  @ApiProperty()
  @IsDateString()
  start: string;

  @ApiProperty()
  @IsDateString()
  ende: string;

  /** Termin beim Verschieben einem (anderen) Mitarbeiter zuweisen (tenant-scoped). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional({ description: 'Termin trotz erkanntem Konflikt verschieben (nur im Warn-Modus).' })
  @IsOptional()
  @IsBoolean()
  konfliktBestaetigt?: boolean;
}
