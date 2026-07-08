'use client';

// Tarif-Entitlements (T-002, Umsatzsicherung) fuer die Feature-bewusste
// Navigation. EINMAL im App-Shell geladen und ueber Context geteilt, damit
// Desktop-Sidebar UND mobiler Drawer denselben Stand nutzen (ein Fetch).
//
// Kontrakt: GET /tenants/me/entitlements ->
//   { planSlug, planName, features: string[] | null, limits }
// `features === null` (oder kein Plan) = voller Zugriff.
//
// Kein Nachpoppen: der zuletzt bekannte Stand wird in localStorage gecacht
// (analog zum Sprach-Pattern `detailly.lang`) und beim ersten Render sofort
// uebernommen. Fehlt/failt der Endpunkt (z. B. noch nicht ausgerollt), gilt
// sichere Degradation -> Vollzugriff (es wird nie faelschlich etwas verborgen).

import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

/** localStorage-Schluessel des Entitlements-Caches. Wird auch in api.ts
 *  (clearToken) referenziert, damit der Cache bei jedem Session-Ende faellt. */
export const ENTITLEMENTS_CACHE_KEY = 'detailly.entitlements';

/** Rohform der Backend-Antwort. */
export interface Entitlements {
  planSlug: string | null;
  planName: string | null;
  /** Freigeschaltete Modul-Keys; null = voller Zugriff. */
  features: string[] | null;
  limits: Record<string, number | null> | null;
}

interface EntitlementsValue {
  /** Freigeschaltete Modul-Keys; null = voller Zugriff. */
  features: string[] | null;
  /** true, sobald ein (gecachter oder frischer) Stand vorliegt. */
  ready: boolean;
}

const EntitlementsContext = createContext<EntitlementsValue | undefined>(undefined);

/** Gecachten Stand lesen (nur Client); undefined, wenn nichts/ungueltig. */
function readCache(): string[] | null | undefined {
  try {
    const raw = localStorage.getItem(ENTITLEMENTS_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { features?: unknown };
    if (parsed && (parsed.features === null || Array.isArray(parsed.features))) {
      return parsed.features as string[] | null;
    }
  } catch {
    /* localStorage gesperrt oder Wert kaputt -> als "kein Cache" behandeln */
  }
  return undefined;
}

function writeCache(features: string[] | null) {
  try {
    localStorage.setItem(ENTITLEMENTS_CACHE_KEY, JSON.stringify({ features }));
  } catch {
    /* Schreiben nicht moeglich -> nur In-Memory */
  }
}

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  // Sofort aus dem Cache hydrieren -> gegatete Items poppen nicht nach. Wird nur
  // clientseitig gemountet (App-Shell rendert erst nach der Anmeldung), daher
  // ist der Zugriff auf localStorage im Initializer hier unbedenklich.
  const [state, setState] = useState<EntitlementsValue>(() => {
    const cached = readCache();
    return cached !== undefined ? { features: cached, ready: true } : { features: null, ready: false };
  });

  useEffect(() => {
    let aktiv = true;
    api
      .get<Entitlements>('/tenants/me/entitlements')
      .then((e) => {
        if (!aktiv) return;
        const features = e.features ?? null;
        setState({ features, ready: true });
        writeCache(features);
      })
      .catch(() => {
        // Endpunkt (noch) nicht verfuegbar / Fehler -> sichere Degradation.
        // Gecachten Stand behalten, sonst Vollzugriff annehmen.
        if (aktiv) setState((s) => ({ features: s.ready ? s.features : null, ready: true }));
      });
    return () => {
      aktiv = false;
    };
  }, []);

  return <EntitlementsContext.Provider value={state}>{children}</EntitlementsContext.Provider>;
}

/**
 * Entitlements-Stand. Ohne Provider (ausserhalb der App-Shell) gilt bewusst
 * Vollzugriff, damit nie faelschlich etwas ausgeblendet wird.
 */
export function useEntitlements(): EntitlementsValue {
  return useContext(EntitlementsContext) ?? { features: null, ready: true };
}

/**
 * Sichtbarkeits-Check fuer feature-gegatete Nav-Items:
 * - ohne `feature`      -> immer sichtbar
 * - solange nicht ready  -> verborgen (kein Zeigen-dann-Verstecken)
 * - `features === null`  -> voller Zugriff
 * - sonst                -> nur wenn der Key enthalten ist
 */
export function useHasFeature(): (feature?: string) => boolean {
  const { features, ready } = useEntitlements();
  return (feature?: string) => {
    if (!feature) return true;
    if (!ready) return false;
    if (features === null) return true;
    return features.includes(feature);
  };
}
