/**
 * Zentraler Pagination-Clamp fuer Listen-Endpunkte (T-010).
 *
 * Vorher war die Klammer-Logik dreifach dupliziert (orders/invoices/customers)
 * und bei customers ohne untere Grenze (limit=0/negativ -> leere Liste).
 * Regeln: page >= 1, 1 <= limit <= maxLimit (Default 100), Default-limit 50.
 * Nicht-numerische Werte (NaN aus parseInt) fallen still auf die Defaults
 * zurueck - gleiches Verhalten wie bisher bei fehlendem Parameter.
 */
export interface PageQuery {
  page?: number;
  limit?: number;
}

export interface ClampedPage {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

/** Standard-Form einer paginierten Listen-Antwort (orders/customers/shop). */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export function clampPageQuery(
  query: PageQuery = {},
  opts: { defaultLimit?: number; maxLimit?: number } = {},
): ClampedPage {
  const defaultLimit = opts.defaultLimit ?? 50;
  const maxLimit = opts.maxLimit ?? 100;
  const rawPage = Number.isFinite(query.page) ? (query.page as number) : 1;
  const rawLimit = Number.isFinite(query.limit) ? (query.limit as number) : defaultLimit;
  const page = Math.max(1, Math.floor(rawPage));
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(rawLimit)));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}
