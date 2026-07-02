import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

/**
 * Optionen des CSV-Imports (T-007), kommen als Multipart-Formfelder neben der
 * Datei. Default ist bewusst der PREVIEW-Modus: geschrieben wird erst, wenn der
 * Client ausdruecklich mode=commit sendet (kein versehentlicher Massenimport).
 */
export class ImportOptionenDto {
  @ApiPropertyOptional({ enum: ['preview', 'commit'], default: 'preview' })
  @IsOptional()
  @IsIn(['preview', 'commit'])
  mode?: 'preview' | 'commit';

  /** Umgang mit Duplikaten: ueberspringen (Default) oder Felder aktualisieren. */
  @ApiPropertyOptional({ enum: ['skip', 'update'], default: 'skip' })
  @IsOptional()
  @IsIn(['skip', 'update'])
  duplikate?: 'skip' | 'update';
}
