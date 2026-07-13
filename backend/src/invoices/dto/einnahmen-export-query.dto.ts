import { IsDateString } from 'class-validator';

/**
 * Query-Parameter fuer GET /invoices/einnahmen-export (Welle 2, EUeR-/
 * Einnahmenuebersicht). Reiner Zeitraum – Format ist immer CSV.
 */
export class EinnahmenExportQueryDto {
  /** Zeitraum-Beginn (YYYY-MM-DD), inklusive. */
  @IsDateString()
  von!: string;

  /** Zeitraum-Ende (YYYY-MM-DD), inklusive. */
  @IsDateString()
  bis!: string;
}
