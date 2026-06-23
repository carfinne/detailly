import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsOptional, IsUUID } from 'class-validator';

/**
 * n:m-Mehrfachzuordnung von Fotos zu einem Schaden in einem Call
 * (POST /items/:id/photos). Jede photoId wird tenant-validiert; bereits
 * bestehende Zuordnungen werden idempotent uebersprungen.
 */
export class LinkPhotosDto {
  @ApiProperty({ type: [String], description: 'Fotos, die dem Schaden zugeordnet werden' })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  photoIds: string[];

  @ApiPropertyOptional({ description: 'Optionales Hauptfoto unter den photoIds' })
  @IsOptional()
  @IsUUID('4')
  hauptfotoId?: string;
}
