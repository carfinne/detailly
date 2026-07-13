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
import type { Betriebstyp } from './branche';

/** localStorage-Schluessel des Entitlements-Caches. Wird auch in api.ts
 *  (clearToken) referenziert, damit der Cache bei jedem Session-Ende faellt. */
export const ENTITLEMENTS_CACHE_KEY = 'detailly.entitlements';

/**
 * Steuer-Kurzinfo des Betriebs (Welle 1, §19 UStG). Kommt rollen-offen ueber die
 * Entitlements mit – Kalkulation/Schadenserfassung/Auftrags-Detail brauchen den
 * MwSt-Satz bzw. das §19-Flag. Default = Regelbesteuerung, 19 %.
 */
export interface SteuerInfo {
  kleinunternehmer: boolean;
  standardMwstSatz: number;
}

/** Default-Steuerinfo (kein Block geliefert): Regelbesteuerung, 19 %. */
export const STEUER_DEFAULT: SteuerInfo = { kleinunternehmer: false, standardMwstSatz: 19 };

/** Rohform der Backend-Antwort. */
export interface Entitlements {
  planSlug: string | null;
  planName: string | null;
  /** Freigeschaltete Modul-Keys; null = voller Zugriff. */
  features: string[] | null;
  limits: Record<string, number | null> | null;
  /**
   * Betriebstyp des Mandanten (Gewerke-Empfehlungs-Layer, Preismodell V3).
   * Wird von einem PARALLELEN Backend-PR ergaenzt -> hier bewusst optional:
   * fehlt das Feld noch, bleibt der Empfehlungs-Layer einfach aus.
   */
  betriebstyp?: Betriebstyp | null;
  /**
   * Steuer-Kurzinfo (§19 UStG, Welle 1). Optional: aeltere Backends liefern den
   * Block (noch) nicht -> Konsumenten fallen auf STEUER_DEFAULT (19 %) zurueck.
   */
  steuer?: SteuerInfo | null;
}

interface EntitlementsValue {
  /** Freigeschaltete Modul-Keys; null = voller Zugriff. */
  features: string[] | null;
  /** Betriebstyp des Mandanten; null, solange (noch) nicht geliefert. */
  betriebstyp: Betriebstyp | null;
  /** Steuer-Kurzinfo (§19); Default (19 %), solange (noch) nicht geliefert. */
  steuer: SteuerInfo;
  /** true, sobald ein (gecachter oder frischer) Stand vorliegt. */
  ready: boolean;
}

/** Gecachte Form (localStorage) – features + betriebstyp + steuer gemeinsam. */
interface CachedEntitlements {
  features: string[] | null;
  betriebstyp: Betriebstyp | null;
  steuer: SteuerInfo | null;
}

const EntitlementsContext = createContext<EntitlementsValue | undefined>(undefined);

/** Gecachten Stand lesen (nur Client); undefined, wenn nichts/ungueltig. */
function readCache(): CachedEntitlements | undefined {
  try {
    const raw = localStorage.getItem(ENTITLEMENTS_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as {
      features?: unknown;
      betriebstyp?: unknown;
      steuer?: unknown;
    };
    if (parsed && (parsed.features === null || Array.isArray(parsed.features))) {
      const s = parsed.steuer as Record<string, unknown> | null | undefined;
      return {
        features: parsed.features as string[] | null,
        betriebstyp:
          typeof parsed.betriebstyp === 'string' ? (parsed.betriebstyp as Betriebstyp) : null,
        steuer:
          s && typeof s === 'object'
            ? {
                kleinunternehmer: s.kleinunternehmer === true,
                standardMwstSatz: Number(s.standardMwstSatz) === 0 ? 0 : 19,
              }
            : null,
      };
    }
  } catch {
    /* localStorage gesperrt oder Wert kaputt -> als "kein Cache" behandeln */
  }
  return undefined;
}

function writeCache(cache: CachedEntitlements) {
  try {
    localStorage.setItem(ENTITLEMENTS_CACHE_KEY, JSON.stringify(cache));
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
    return cached !== undefined
      ? {
          features: cached.features,
          betriebstyp: cached.betriebstyp,
          steuer: cached.steuer ?? STEUER_DEFAULT,
          ready: true,
        }
      : { features: null, betriebstyp: null, steuer: STEUER_DEFAULT, ready: false };
  });

  useEffect(() => {
    let aktiv = true;
    api
      .get<Entitlements>('/tenants/me/entitlements')
      .then((e) => {
        if (!aktiv) return;
        const features = e.features ?? null;
        const betriebstyp = e.betriebstyp ?? null;
        const steuer: SteuerInfo = e.steuer
          ? {
              kleinunternehmer: e.steuer.kleinunternehmer === true,
              standardMwstSatz: Number(e.steuer.standardMwstSatz) === 0 ? 0 : 19,
            }
          : STEUER_DEFAULT;
        setState({ features, betriebstyp, steuer, ready: true });
        writeCache({ features, betriebstyp, steuer });
      })
      .catch(() => {
        // Endpunkt (noch) nicht verfuegbar / Fehler -> sichere Degradation.
        // Gecachten Stand behalten, sonst Vollzugriff annehmen.
        if (aktiv)
          setState((s) =>
            s.ready ? s : { features: null, betriebstyp: null, steuer: STEUER_DEFAULT, ready: true },
          );
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
  return (
    useContext(EntitlementsContext) ?? {
      features: null,
      betriebstyp: null,
      steuer: STEUER_DEFAULT,
      ready: true,
    }
  );
}

/**
 * Steuer-Kurzinfo des Betriebs (§19 UStG, Welle 1). Liefert immer ein
 * vollstaendiges Objekt (Default 19 %), auch ohne Provider/vor dem Laden.
 * Konsumenten (Kalkulation/Schadenserfassung/Auftrags-Detail) leiten daraus den
 * MwSt-Satz ab: `kleinunternehmer ? 0 : standardMwstSatz`.
 */
export function useSteuer(): SteuerInfo {
  return useEntitlements().steuer;
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
