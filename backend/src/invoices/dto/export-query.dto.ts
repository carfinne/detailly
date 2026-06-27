import { IsDateString, IsIn, IsOptional } from 'class-validator';

/** Query-Parameter fuer GET /invoices/export. */
export class ExportQueryDto {
  /** Ausgabeformat. Default 'csv' (universell, laeuft immer). */
  @IsOptional()
  @IsIn(['csv', 'datev'])
  format?: 'csv' | 'datev';

  /** Zeitraum-Beginn (YYYY-MM-DD), inklusive. */
  @IsDateString()
  von!: string;

  /** Zeitraum-Ende (YYYY-MM-DD), inklusive. */
  @IsDateString()
  bis!: string;
}
