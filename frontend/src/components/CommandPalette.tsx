'use client';

// Globale Suche als Command-Palette (⌘K / Strg+K). Wird vom Topbar gesteuert
// (open/onClose). Sucht entprellt gegen GET /api/v1/search?q= und zeigt die
// Treffer gruppiert (Kunden, Fahrzeuge, Aufträge, Rechnungen, Termine).
// Tastatur: ↑/↓ navigieren, ↵ öffnen, Esc schließen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { GlobalSearchResult, SearchGroupKey, SearchHit } from '@/lib/types';

const MIN_LEN = 2;

type GroupMeta = {
  key: SearchGroupKey;
  label: string;
  icon: React.ReactNode;
  href: (hit: SearchHit) => string;
};

// Kleine, einheitliche Outline-Icons (16px).
const IconCustomer = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
  </svg>
);
const IconVehicle = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 11l1.4-4.2A2 2 0 0 1 8.3 5.4h7.4a2 2 0 0 1 1.9 1.4L19 11" />
    <path d="M4 11h16v5H4zM7 16v1.5M17 16v1.5" />
  </svg>
);
const IconOrder = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3h6l5 5v13H5V5a2 2 0 0 1 2-2z" />
    <path d="M14 3v5h5M8.5 13h7M8.5 16.5h7" />
  </svg>
);
const IconInvoice = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12v18l-3-1.6L12 21l-3-1.6L6 21z" />
    <path d="M9 8h6M9 12h6" />
  </svg>
);
const IconAppointment = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="5" width="16" height="16" rx="2" />
    <path d="M4 9h16M8 3v4M16 3v4" />
  </svg>
);

// Reihenfolge der Gruppen in der Anzeige + Sprungziel je Treffer.
// Detailseiten existieren fuer Fahrzeuge/Auftraege; Kunden/Rechnungen/Termine
// fuehren auf die jeweilige Liste (Kunden zusaetzlich mit ?q= zum Vorfiltern).
const GROUPS: GroupMeta[] = [
  { key: 'customers', label: 'Kunden', icon: IconCustomer, href: (h) => `/kunden/?q=${encodeURIComponent(h.title)}` },
  { key: 'vehicles', label: 'Fahrzeuge', icon: IconVehicle, href: (h) => `/fahrzeuge/detail/?id=${h.id}` },
  { key: 'orders', label: 'Aufträge', icon: IconOrder, href: (h) => `/auftraege/detail/?id=${h.id}` },
  { key: 'invoices', label: 'Rechnungen', icon: IconInvoice, href: () => `/rechnungen/` },
  { key: 'appointments', label: 'Termine', icon: IconAppointment, href: () => `/plantafel/` },
];

type FlatRow = { group: GroupMeta; hit: SearchHit; href: string };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const reqId = useRef(0);

  // Beim Öffnen: Feld fokussieren. Beim Schließen: Zustand zurücksetzen.
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setActiveIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Entprellte Suche; nur die jüngste Antwort gewinnt (reqId-Guard).
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < MIN_LEN) {
      // Eine evtl. noch laufende Anfrage entwerten, sonst könnte deren späte
      // Antwort veraltete Treffer wieder einblenden, obwohl das Feld schon leer ist.
      reqId.current += 1;
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const r = await api.get<GlobalSearchResult>(`/search?q=${encodeURIComponent(q)}`);
        if (id === reqId.current) {
          setResults(r);
          setActiveIndex(0);
        }
      } catch {
        if (id === reqId.current) setResults(null);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  // Flache Liste aller Treffer (für Tastatur-Navigation + Highlight).
  const flat = useMemo<FlatRow[]>(() => {
    if (!results) return [];
    const out: FlatRow[] = [];
    for (const group of GROUPS) {
      for (const hit of results[group.key]) out.push({ group, hit, href: group.href(hit) });
    }
    return out;
  }, [results]);

  // Aktive Zeile bei Tastatur-Navigation in den sichtbaren Bereich scrollen.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = flat[activeIndex];
      if (row) go(row.href);
    }
  };

  if (!open) return null;

  const q = query.trim();
  const showHint = q.length < MIN_LEN;
  const showEmpty = !showHint && !loading && results !== null && flat.length === 0;

  // Laufender Index über die flache Liste, um die aktive Zeile zu markieren.
  let rowIdx = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/70 px-4 pt-[12vh] backdrop-blur-sm animate-fade-in"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Globale Suche"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900/95 shadow-2xl shadow-black/50"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Eingabezeile */}
        <div className="flex items-center gap-3 border-b border-ink-700/70 px-4">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-chrome-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Kunden, Fahrzeuge, Aufträge, Rechnungen, Termine…"
            className="w-full bg-transparent py-4 text-base text-chrome-50 placeholder:text-chrome-600 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && (
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-chrome-600 border-t-copper" aria-hidden />
          )}
          <kbd className="hidden shrink-0 rounded-md border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[10px] text-chrome-400 sm:inline">
            esc
          </kbd>
        </div>

        {/* Ergebnisbereich */}
        <div className="max-h-[55vh] overflow-y-auto py-2">
          {showHint && (
            <p className="px-4 py-8 text-center text-sm text-chrome-500">
              Tippe mindestens {MIN_LEN} Zeichen, um alles zu durchsuchen.
            </p>
          )}
          {showEmpty && (
            <p className="px-4 py-8 text-center text-sm text-chrome-500">
              Nichts gefunden für „{q}".
            </p>
          )}
          {!showHint &&
            results &&
            GROUPS.map((group) => {
              const hits = results[group.key];
              if (!hits.length) return null;
              return (
                <div key={group.key} className="mb-1">
                  <div className="flex items-center gap-2 px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-chrome-600">
                    <span className="text-chrome-500">{group.icon}</span>
                    {group.label}
                  </div>
                  {hits.map((hit) => {
                    rowIdx += 1;
                    const idx = rowIdx;
                    const active = idx === activeIndex;
                    return (
                      <button
                        key={`${group.key}-${hit.id}`}
                        ref={active ? activeRef : undefined}
                        type="button"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => go(group.href(hit))}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          active ? 'bg-copper/15' : 'hover:bg-ink-800/60'
                        }`}
                      >
                        <span className={`shrink-0 ${active ? 'text-copper' : 'text-chrome-500'}`}>
                          {group.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-chrome-50">
                            {hit.title}
                          </span>
                          {hit.subtitle && (
                            <span className="block truncate text-xs text-chrome-500">{hit.subtitle}</span>
                          )}
                        </span>
                        {active && (
                          <kbd className="hidden shrink-0 rounded-md border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[10px] text-chrome-400 sm:inline">
                            ↵
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
        </div>

        {/* Fußzeile mit Tastatur-Hinweisen */}
        <div className="flex items-center gap-4 border-t border-ink-700/70 px-4 py-2 text-[11px] text-chrome-600">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-ink-700 bg-ink-800 px-1 py-0.5">↑</kbd>
            <kbd className="rounded border border-ink-700 bg-ink-800 px-1 py-0.5">↓</kbd>
            navigieren
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-ink-700 bg-ink-800 px-1 py-0.5">↵</kbd>
            öffnen
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-ink-700 bg-ink-800 px-1 py-0.5">esc</kbd>
            schließen
          </span>
        </div>
      </div>
    </div>
  );
}
