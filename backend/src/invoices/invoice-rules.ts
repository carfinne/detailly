import { InvoiceKind, InvoiceStatus } from './entities/invoice.entity';

/**
 * Erlaubte Statuswechsel einer RECHNUNG (GoBD). Eine festgesetzte (gestellte)
 * Rechnung kann nicht zurueck in den Entwurf; Korrektur nur per Storno.
 * Angebote sind hiervon ausgenommen (frei aenderbar, kein Buchungsbeleg).
 */
const RECHNUNG_UEBERGAENGE: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.ENTWURF]: [InvoiceStatus.OFFEN, InvoiceStatus.STORNIERT],
  [InvoiceStatus.OFFEN]: [InvoiceStatus.BEZAHLT, InvoiceStatus.STORNIERT],
  [InvoiceStatus.BEZAHLT]: [InvoiceStatus.STORNIERT],
  [InvoiceStatus.STORNIERT]: [],
};

/**
 * "Festgesetzt" = eine Rechnung (kein Angebot), die den Entwurf verlassen hat.
 * Solche Belege sind GoBD-unveraenderlich (Inhalt/Betraege duerfen nicht mehr
 * geaendert werden).
 */
export function istFestgesetzt(art: InvoiceKind, status: InvoiceStatus): boolean {
  return art === InvoiceKind.RECHNUNG && status !== InvoiceStatus.ENTWURF;
}

/**
 * Ist der Statuswechsel erlaubt? Angebote: frei. Rechnungen: nur entlang der
 * erlaubten Uebergaenge (idempotenter Wechsel auf denselben Status ist ok).
 */
export function statuswechselErlaubt(
  art: InvoiceKind,
  von: InvoiceStatus,
  nach: InvoiceStatus,
): boolean {
  if (von === nach) return true;
  if (art !== InvoiceKind.RECHNUNG) return true;
  return (RECHNUNG_UEBERGAENGE[von] ?? []).includes(nach);
}
