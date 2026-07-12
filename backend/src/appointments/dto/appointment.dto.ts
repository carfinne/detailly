import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { AppointmentStatus } from '../entities/appointment.entity';

export class CreateAppointmentDto {
  @ApiProperty()
  @IsString()
  titel: string;

  @ApiProperty()
  @IsDateString()
  start: string;

  @ApiProperty()
  @IsDateString()
  ende: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notiz?: string;

  /**
   * Nur relevant bei `konfliktverhalten='warnen'`: true speichert den Termin trotz
   * erkannter Ueberschneidung (der Nutzer hat die Warnung bestaetigt). Bei
   * `blockieren` wird das Flag ignoriert (immer 409). Transient (nicht persistiert).
   */
  @ApiPropertyOptional({ description: 'Termin trotz erkanntem Konflikt speichern (nur im Warn-Modus).' })
  @IsOptional()
  @IsBoolean()
  konfliktBestaetigt?: boolean;
}

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {}
