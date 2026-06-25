/**
 * Serverseitige Formatter fuer PDF-/Backend-Ausgaben (de-DE, EUR).
 *
 * Bewusst eine 1:1-Duplikation der relevanten Helfer aus
 * frontend/src/lib/format.ts. Das Frontend-Modul wird NICHT importiert, weil es
 * ein anderes Build-Target (Browser/Next) ist. Der PDF-Inhalt wird serverseitig
 * gerendert, daher leben diese Formatter hier.
 *
 * Hinweis: Decimal-Felder kommen aus TypeORM als STRINGS zurueck – eur() castet
 * deshalb intern mit Number(...), datum() toleriert string|Date.
 */

/** Geldbetrag in deutschem Format mit Euro-Zeichen, z.B. "1.234,50 €". */
export function eur(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });
}

/** Datum als dd.mm.yyyy (de-DE). Leere/ungueltige Werte -> "–". */
export function datum(value?: string | Date | null): string {
  if (!value) return '–';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Anzeigename eines Kunden nach derselben Konvention wie das Frontend
 * (format.ts kundenName): business/companyName -> companyName, sonst Vor-/Nachname.
 */
export function kundenName(c?: {
  type?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}): string {
  if (!c) return '–';
  if (c.type === 'business' || c.companyName) return c.companyName || '–';
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || '–';
}
