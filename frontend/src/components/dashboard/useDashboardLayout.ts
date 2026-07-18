'use client';

// ---------------------------------------------------------------------------
// Dashboard-Layout je Nutzer: Reihenfolge der Kacheln + ausgeblendete Kacheln.
// Persistenz zunaechst nur clientseitig via localStorage (Schluessel je userId).
// Serverseitige Ablage ist ein spaeterer Schritt – die Kapselung hier bleibt
// dabei unveraendert (nur die read/write-Quelle wuerde getauscht).
//
// Kein Hydration-Mismatch: der Speicher wird ERST nach dem Mount gelesen. Bis
// dahin gilt die Default-Reihenfolge (identisch zum Server-Render). Zugriff auf
// localStorage ist defensiv gekapselt (gesperrter Speicher in eingebetteten
// Vorschau-iFrames wirft sonst – analog zum api.ts-/Onboarding-Muster).
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'detailly_dashboard_layout_';

interface StoredLayout<T extends string> {
  order: T[];
  hidden: T[];
}

function storageKey(userId: string | undefined): string {
  return `${STORAGE_PREFIX}${userId ?? 'anon'}`;
}

// Gespeicherte Reihenfolge gegen die kanonische Default-Reihenfolge abgleichen:
//  - nur bekannte Ids behalten (verwaiste Eintraege verwerfen),
//  - neu hinzugekommene Default-Ids ans Ende anfuegen (in Default-Reihenfolge),
// damit spaeter ergaenzte Widgets nie unsichtbar verschwinden.
function reconcileOrder<T extends string>(saved: readonly T[], defaults: readonly T[]): T[] {
  const known = new Set(defaults);
  const filtered = saved.filter((id) => known.has(id));
  const present = new Set(filtered);
  const appended = defaults.filter((id) => !present.has(id));
  return [...filtered, ...appended];
}

export interface DashboardLayout<T extends string> {
  order: T[];
  hidden: Set<T>;
  /** true, sobald der Speicher gelesen wurde (nach Mount). */
  hydrated: boolean;
  /** Positionen zweier Kacheln in der Reihenfolge tauschen. */
  swap: (a: T, b: T) => void;
  /** Kachel aus-/einblenden. */
  toggleHidden: (id: T) => void;
  /** Auf Default-Reihenfolge + alles sichtbar zuruecksetzen. */
  reset: () => void;
}

export function useDashboardLayout<T extends string>(
  userId: string | undefined,
  defaultOrder: readonly T[],
): DashboardLayout<T> {
  const [order, setOrder] = useState<T[]>(() => [...defaultOrder]);
  const [hidden, setHidden] = useState<Set<T>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  // localStorage erst nach Mount lesen. Wechselt der Nutzer (userId), wird
  // dessen persoenliches Layout geladen.
  useEffect(() => {
    let nextOrder: T[] = [...defaultOrder];
    let nextHidden: T[] = [];
    try {
      const raw = window.localStorage.getItem(storageKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredLayout<T>>;
        if (Array.isArray(parsed.order)) nextOrder = reconcileOrder(parsed.order, defaultOrder);
        if (Array.isArray(parsed.hidden)) {
          const known = new Set(defaultOrder);
          nextHidden = parsed.hidden.filter((id): id is T => known.has(id));
        }
      }
    } catch {
      /* Gesperrter/kaputter Speicher -> Default-Layout. */
    }
    setOrder(nextOrder);
    setHidden(new Set(nextHidden));
    setHydrated(true);
  }, [userId, defaultOrder]);

  // Persistenz – erst nach der Hydration, damit der initiale Default-Zustand
  // ein vorhandenes gespeichertes Layout nicht ueberschreibt.
  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: StoredLayout<T> = { order, hidden: Array.from(hidden) };
      window.localStorage.setItem(storageKey(userId), JSON.stringify(payload));
    } catch {
      /* Speicher gesperrt -> nur In-Memory fuer diese Session. */
    }
  }, [order, hidden, hydrated, userId]);

  const swap = useCallback((a: T, b: T) => {
    setOrder((prev) => {
      const i = prev.indexOf(a);
      const j = prev.indexOf(b);
      if (i < 0 || j < 0 || i === j) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const toggleHidden = useCallback((id: T) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setOrder([...defaultOrder]);
    setHidden(new Set());
  }, [defaultOrder]);

  return { order, hidden, hydrated, swap, toggleHidden, reset };
}
