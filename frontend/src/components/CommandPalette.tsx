'use client';

// Globale Suche als Command-Palette (⌘K / Strg+K). Wird vom Topbar gesteuert
// (open/onClose). Sucht entprellt gegen GET /api/v1/search?q= und zeigt die
// Treffer gruppiert (Kunden, Fahrzeuge, Aufträge, Rechnungen, Termine).
// Tastatur: ↑/↓ navigieren, ↵ öffnen, Esc schließen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Icon, ICON_PATHS } from '@/lib/icons';
import type { GlobalSearchResult, SearchGroupKey, SearchHit } from '@/lib/types';

const MIN_LEN = 2;

type GroupMeta = {
  key: SearchGroupKey;
  labelKey: string;
  icon: React.ReactNode;
  href: (hit: SearchHit) => string;
};

// Gruppen-Icons aus der zentralen Icon-Quelle (gleiche Pfade wie Navigation).
const gruppenIcon = (key: string) => <Icon className="h-4 w-4">{ICON_PATHS[key]}</Icon>;

// Reihenfolge der Gruppen in der Anzeige + Sprungziel je Treffer.
// Detailseiten existieren fuer Kunden/Fahrzeuge/Auftraege (per ?id=). Rechnungen
// haben keine Detailseite -> Liste mit ?q=<Nummer> vorgefiltert. Termine fuehren
// auf die Plantafel.
const GROUPS: GroupMeta[] = [
  { key: 'customers', labelKey: 'nav.item.customers', icon: gruppenIcon('customers'), href: (h) => `/kunden/detail/?id=${h.id}` },
  { key: 'vehicles', labelKey: 'nav.item.vehicles', icon: gruppenIcon('vehicles'), href: (h) => `/fahrzeuge/detail/?id=${h.id}` },
  { key: 'orders', labelKey: 'nav.item.orders', icon: gruppenIcon('orders'), href: (h) => `/auftraege/detail/?id=${h.id}` },
  { key: 'invoices', labelKey: 'nav.item.invoices', icon: gruppenIcon('invoices'), href: (h) => `/rechnungen/?q=${encodeURIComponent(h.title)}` },
  { key: 'appointments', labelKey: 'ui.search.group.appointments', icon: gruppenIcon('calendar'), href: () => `/plantafel/` },
];

type FlatRow = { group: GroupMeta; hit: SearchHit; href: string };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const t = useT();
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
      const timer = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(timer);
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
    const timer = setTimeout(async () => {
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
    return () => clearTimeout(timer);
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
      aria-label={t('ui.search.title')}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900/95 shadow-2xl shadow-black/50"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Eingabezeile */}
        <div className="flex items-center gap-3 border-b border-ink-700/70 px-4">
          <Icon className="h-5 w-5 shrink-0 text-chrome-500">{ICON_PATHS.search}</Icon>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('ui.search.placeholder')}
            className="w-full bg-transparent py-4 text-base text-chrome-50 placeholder:text-chrome-600 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && (
            <span className="spinner text-copper" aria-hidden />
          )}
          <kbd className="hidden shrink-0 rounded-md border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[10px] text-chrome-400 sm:inline">
            esc
          </kbd>
        </div>

        {/* Ergebnisbereich */}
        <div className="max-h-[55vh] overflow-y-auto py-2">
          {showHint && (
            <p className="px-4 py-8 text-center text-sm text-chrome-500">
              {t('ui.search.hint', { min: MIN_LEN })}
            </p>
          )}
          {showEmpty && (
            <p className="px-4 py-8 text-center text-sm text-chrome-500">
              {t('ui.search.empty', { query: q })}
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
                    {t(group.labelKey)}
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
            {t('ui.search.navigate')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-ink-700 bg-ink-800 px-1 py-0.5">↵</kbd>
            {t('ui.search.open')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-ink-700 bg-ink-800 px-1 py-0.5">esc</kbd>
            {t('ui.search.close')}
          </span>
        </div>
      </div>
    </div>
  );
}
