import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

/**
 * Request-scoped Memoisierung OHNE REQUEST-scope-Provider (Perf-Memo P3-5b).
 *
 * Hintergrund: Auf gegateten Requests wurde die Subscription bis zu 3x und der
 * Tarif 2x geladen (SubscriptionGuard -> evaluateAccess, PlanFeatureGuard ->
 * assertFeature, Service -> assertLimit/getLimit). Ein REQUEST-scoped Provider
 * wuerde das loesen, aber jede Instanziierung verteuern (Nest baut dann den
 * ganzen Injektor-Teilbaum pro Request). Stattdessen: AsyncLocalStorage-Store,
 * den eine globale Middleware pro Request oeffnet - Services memoisieren
 * darueber transparent, ohne Signatur- oder DI-Aenderungen.
 *
 * Ausserhalb eines Requests (Cron, Seeds, Tests) gibt es keinen Store; dann
 * laeuft der Loader ungecacht wie bisher (Fallback-Pfad).
 */
const als = new AsyncLocalStorage<Map<string, Promise<unknown>>>();

/** Oeffnet den Memo-Store fuer die Dauer des Requests (in main.ts registriert). */
export function requestMemoMiddleware(req: Request, res: Response, next: NextFunction): void {
  als.run(new Map(), next);
}

/**
 * Liefert den memoisierten Wert zu `key` oder fuehrt `loader` aus und merkt
 * sich das PROMISE (dedupliziert auch parallele Aufrufe, z.B. Promise.all).
 * Abgelehnte Promises werden nicht gecacht (naechster Aufruf laedt frisch).
 */
export function memoize<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const store = als.getStore();
  if (!store) return loader();
  const vorhanden = store.get(key);
  if (vorhanden) return vorhanden as Promise<T>;
  const promise = loader().catch((err) => {
    store.delete(key);
    throw err;
  });
  store.set(key, promise);
  return promise;
}

/** Entfernt einen Memo-Eintrag (nach Mutationen, z.B. Abo-Zuweisung). */
export function invalidateMemo(key: string): void {
  als.getStore()?.delete(key);
}
