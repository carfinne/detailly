'use client';

// Command-Palette (⌘K / Strg+K) – Aktions-Cockpit. Vom Topbar gesteuert
// (open/onClose). Vereint drei Ebenen in EINER Liste (Tastatur: ↑/↓/↵/Esc):
//   1. Befehle  – Modul-Sprünge (aus der Navigations-Datenquelle NAV_GROUPS,
//                 rollen-/tarif-gefiltert wie die Sidebar) + feste Aktionen
//                 (Neuanlage, Thema, Sprache, Abmelden).
//   2. Zuletzt besucht – kleine localStorage-Liste, in der Topbar gepflegt.
//   3. Suchtreffer – entprellte Volltextsuche gegen GET /api/v1/search?q=.
// Fuzzy-Match rein clientseitig; Sprung-/Aktions-Ziele werden nie angeboten,
// wenn der Nutzer sie laut Nav-Filter nicht sehen darf.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useT, useLanguage, LANGS } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useHasFeature } from '@/lib/entitlements';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { NAV_GROUPS, type NavItem } from './nav-data';
import type { GlobalSearchResult, SearchGroupKey, SearchHit } from '@/lib/types';

const MIN_LEN = 2; // ab dieser Länge feuert die Volltextsuche (Befehle filtern ab 1)

// ---------------------------------------------------------------------------
// Zuletzt-besucht-Liste (localStorage). Wird von der Topbar bei jedem
// Routenwechsel über recordRecentPath() gepflegt – hier nur gelesen.
// Gespeichert werden ausschliesslich Nav-Modul-Pfade (längster Präfix-Treffer),
// damit jeder Eintrag ein sauberes Label + Icon aus der Nav-Quelle bekommt.
// ---------------------------------------------------------------------------
const RECENT_KEY = 'detailly.recent';
const RECENT_MAX = 8;

/** Löst einen beliebigen Pfad auf das zugehörige Nav-Modul auf (längster Präfix). */
function resolveNavHref(pathname: string): string | null {
  let best: string | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) {
        if (!best || item.href.length > best.length) best = item.href;
      }
    }
  }
  return best;
}

/** In der Topbar aufgerufen: merkt den zuletzt besuchten Modul-Pfad vor. */
export function recordRecentPath(pathname: string): void {
  const href = resolveNavHref(pathname);
  if (!href) return; // Nicht-Modul-Pfade (Login o. Ä.) ignorieren
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [href, ...list.filter((h) => h !== href)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* localStorage evtl. gesperrt -> Verlauf entfällt still */
  }
}

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fuzzy-Match (rein clientseitig, subsequenz-basiert mit Wortanfang-/Streak-Bonus).
// ---------------------------------------------------------------------------
/** Kleinschreibung + Umlaut-Faltung, damit „ä" auch auf „a" matcht. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss');
}

/** Bewertet, wie gut `query` in `text` als Teilsequenz steckt. -1 = kein Treffer. */
function fuzzyScore(query: string, text: string): number {
  const q = fold(query);
  const t = fold(text);
  if (!q) return 0;
  let ti = 0;
  let score = 0;
  let streak = 0;
  let prev = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi], ti);
    if (found === -1) return -1;
    let bonus = 1;
    if (found === 0 || t[found - 1] === ' ') bonus += 3; // Wortanfang
    if (found === prev + 1) {
      streak += 1;
      bonus += streak;
    } else {
      streak = 0;
    }
    score += bonus;
    prev = found;
    ti = found + 1;
  }
  if (t.startsWith(q)) score += 5;
  return score;
}

// ---------------------------------------------------------------------------
// Suchtreffer-Gruppen (unverändert): Reihenfolge + Sprungziel je Treffer.
// ---------------------------------------------------------------------------
type GroupMeta = {
  key: SearchGroupKey;
  labelKey: string;
  iconPath: JSX.Element; // rohes <path>-Kind: der Zeilen-Renderer wickelt EINMAL in <Icon>
  icon: React.ReactNode; // fertiges <Icon> nur für die Sektions-Überschrift
  href: (hit: SearchHit) => string;
};
const gruppenIcon = (key: string) => <Icon className="h-4 w-4">{ICON_PATHS[key]}</Icon>;
const GROUPS: GroupMeta[] = [
  { key: 'customers', labelKey: 'nav.item.customers', iconPath: ICON_PATHS.customers, icon: gruppenIcon('customers'), href: (h) => `/kunden/detail/?id=${h.id}` },
  { key: 'vehicles', labelKey: 'nav.item.vehicles', iconPath: ICON_PATHS.vehicles, icon: gruppenIcon('vehicles'), href: (h) => `/fahrzeuge/detail/?id=${h.id}` },
  { key: 'orders', labelKey: 'nav.item.orders', iconPath: ICON_PATHS.orders, icon: gruppenIcon('orders'), href: (h) => `/auftraege/detail/?id=${h.id}` },
  { key: 'invoices', labelKey: 'nav.item.invoices', iconPath: ICON_PATHS.invoices, icon: gruppenIcon('invoices'), href: (h) => `/rechnungen/?q=${encodeURIComponent(h.title)}` },
  { key: 'appointments', labelKey: 'ui.search.group.appointments', iconPath: ICON_PATHS.calendar, icon: gruppenIcon('calendar'), href: () => `/plantafel/` },
];

// Icons für feste Aktionen (kein passender Nav-Pfad -> lokal, im Icon-Stil).
const THEME_ICON = <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.4 5.4 0 0 1-7.54-7.54c-.44-.06-.9-.1-1.36-.1Z" />;
const LOGOUT_ICON = <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />;

// Einheitliches Anzeige-Modell für JEDE Zeile (Befehl, Zuletzt-besucht, Treffer).
type Row = {
  key: string;
  icon: JSX.Element;
  title: string;
  subtitle?: string;
  search: string; // Text für Fuzzy-Match (nur Befehle)
  keepOpen?: boolean; // true -> Palette bleibt nach Auswahl offen (Thema/Sprache)
  onSelect: () => void;
};

const LIST_ID = 'cmdk-listbox';
const rowId = (i: number) => `cmdk-opt-${i}`;

function currentTheme(): 'dark' | 'light' {
  try {
    return localStorage.getItem('detailly_theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const t = useT();
  const { user, logout } = useAuth();
  const { lang, setLang } = useLanguage();
  const hasFeature = useHasFeature();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const reqId = useRef(0);

  // Beim Öffnen: Feld fokussieren, Zustand zurücksetzen, Verlauf + Thema lesen.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults(null);
    setActiveIndex(0);
    setRecent(readRecent());
    setTheme(currentTheme());
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [open]);

  // Aktive Zeile bei jeder Eingabe zurücksetzen (Liste ändert sich).
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Entprellte Volltextsuche; nur die jüngste Antwort gewinnt (reqId-Guard).
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < MIN_LEN) {
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
        if (id === reqId.current) setResults(r);
      } catch {
        if (id === reqId.current) setResults(null);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  // Thema umschalten – identischer Mechanismus wie in den Einstellungen
  // (localStorage 'detailly_theme' + data-theme am <html>). Palette bleibt offen.
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('detailly_theme', next);
      } catch {
        /* ignore */
      }
      const d = document.documentElement;
      if (next === 'light') d.setAttribute('data-theme', 'light');
      else d.removeAttribute('data-theme');
      return next;
    });
  }, []);

  // Sprache durchschalten – über den vorhandenen Umschalter (setLang aus dem
  // i18n-Context). Palette bleibt offen, Labels aktualisieren sich sofort.
  const cycleLanguage = useCallback(() => {
    const idx = LANGS.findIndex((l) => l.code === lang);
    const next = LANGS[(idx + 1) % LANGS.length];
    setLang(next.code);
  }, [lang, setLang]);

  const nextLang = useMemo(() => {
    const idx = LANGS.findIndex((l) => l.code === lang);
    return LANGS[(idx + 1) % LANGS.length];
  }, [lang]);

  // Sichtbare Nav-Einträge – EXAKT dieselbe Filter-Logik wie die Sidebar
  // (Rolle + Tarif-Feature), gespeist aus derselben Quelle NAV_GROUPS.
  const visibleNav = useMemo<NavItem[]>(
    () =>
      NAV_GROUPS.flatMap((g) => g.items).filter(
        (item) =>
          (!item.rollen || (user != null && item.rollen.includes(user.role))) &&
          hasFeature(item.feature),
      ),
    [user, hasFeature],
  );
  const navVisible = useCallback(
    (href: string) => visibleNav.some((i) => i.href === href),
    [visibleNav],
  );

  // Befehls-Katalog: Modul-Sprünge + feste Aktionen (bereits gefiltert).
  const allCommands = useMemo<Row[]>(() => {
    const cmds: Row[] = [];

    // (a) Sprung zu jedem sichtbaren Modul.
    for (const item of visibleNav) {
      const label = t(item.labelKey);
      const title = t('command.goto', { target: label });
      cmds.push({
        key: `nav:${item.href}`,
        icon: item.icon,
        title,
        search: `${label} ${title}`,
        onSelect: () => go(item.href),
      });
    }

    // (b) Feste Aktionen. Neuanlagen nur, wenn das Zielmodul sichtbar ist.
    const fixed: Row[] = [];
    if (navVisible('/fahrzeugannahme')) {
      fixed.push({
        key: 'act:new-intake',
        icon: ICON_PATHS.intake as JSX.Element,
        title: t('command.action.newIntake'),
        search: `${t('command.action.newIntake')} annahme fahrzeug intake`,
        onSelect: () => go('/fahrzeugannahme'),
      });
    }
    if (navVisible('/kunden')) {
      fixed.push({
        key: 'act:new-customer',
        icon: ICON_PATHS.customers as JSX.Element,
        title: t('command.action.newCustomer'),
        search: `${t('command.action.newCustomer')} kunde customer`,
        onSelect: () => go('/kunden'),
      });
    }
    if (navVisible('/rechnungen')) {
      fixed.push({
        key: 'act:new-invoice',
        icon: ICON_PATHS.invoices as JSX.Element,
        title: t('command.action.newInvoice'),
        search: `${t('command.action.newInvoice')} rechnung invoice`,
        onSelect: () => go('/rechnungen'),
      });
    }
    // Thema hell/dunkel – Titel zeigt die Richtung an.
    fixed.push({
      key: 'act:theme',
      icon: THEME_ICON,
      title: theme === 'light' ? t('command.action.themeToDark') : t('command.action.themeToLight'),
      search: 'thema theme hell dunkel light dark darstellung',
      keepOpen: true,
      onSelect: toggleTheme,
    });
    // Sprache wechseln – Untertitel nennt die nächste Sprache.
    fixed.push({
      key: 'act:language',
      icon: ICON_PATHS.globe as JSX.Element,
      title: t('command.action.switchLanguage'),
      subtitle: nextLang.label,
      search: 'sprache language lang',
      keepOpen: true,
      onSelect: cycleLanguage,
    });
    // Abmelden.
    fixed.push({
      key: 'act:logout',
      icon: LOGOUT_ICON,
      title: t('command.action.logout'),
      search: `${t('command.action.logout')} abmelden logout ausloggen`,
      onSelect: () => {
        onClose();
        logout();
      },
    });

    return [...cmds, ...fixed];
    // fixedActionSubset (für den Leer-Zustand) = die letzten `fixed.length` Einträge.
  }, [visibleNav, navVisible, t, theme, nextLang, toggleTheme, cycleLanguage, go, logout, onClose]);

  // Feste Aktionen separat für den Leer-Zustand („häufigste Befehle").
  const quickCommands = useMemo<Row[]>(
    () => allCommands.filter((c) => c.key.startsWith('act:')),
    [allCommands],
  );

  // Zuletzt-besucht -> Zeilen (nur sichtbare Module, sauberes Label + Icon).
  const recentRows = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    for (const href of recent) {
      const item = visibleNav.find((i) => i.href === href);
      if (!item) continue; // nicht (mehr) sichtbar -> auslassen
      rows.push({
        key: `recent:${href}`,
        icon: item.icon,
        title: t(item.labelKey),
        search: t(item.labelKey),
        onSelect: () => go(href),
      });
      if (rows.length >= 6) break;
    }
    return rows;
  }, [recent, visibleNav, t, go]);

  const q = query.trim();

  // Sichtbare Befehls-Zeilen: leer -> Schnellbefehle; sonst Fuzzy-Rangliste.
  const commandRows = useMemo<Row[]>(() => {
    if (!q) return quickCommands;
    const scored = allCommands
      .map((c) => ({ c, s: fuzzyScore(q, c.search) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s);
    return scored.map((x) => x.c);
  }, [q, quickCommands, allCommands]);

  // Suchtreffer-Zeilen je Gruppe (nur ab MIN_LEN, aus der API-Antwort).
  const hitSections = useMemo(() => {
    if (!results) return [] as { group: GroupMeta; rows: Row[] }[];
    return GROUPS.map((group) => ({
      group,
      rows: results[group.key].map<Row>((hit) => ({
        key: `${group.key}-${hit.id}`,
        icon: group.iconPath, // rohes <path> -> im Renderer einfach in <Icon> gewickelt
        title: hit.title,
        subtitle: hit.subtitle,
        search: '',
        onSelect: () => go(group.href(hit)),
      })),
    })).filter((s) => s.rows.length > 0);
  }, [results, go]);

  // Abschnitte in Anzeige-Reihenfolge zusammensetzen.
  const sections = useMemo(() => {
    const out: { key: string; label: string; icon?: React.ReactNode; rows: Row[] }[] = [];
    if (!q && recentRows.length) out.push({ key: 'recent', label: t('command.group.recent'), rows: recentRows });
    if (commandRows.length) out.push({ key: 'commands', label: t('command.group.commands'), rows: commandRows });
    for (const hs of hitSections) out.push({ key: hs.group.key, label: t(hs.group.labelKey), icon: hs.group.icon, rows: hs.rows });
    return out;
  }, [q, recentRows, commandRows, hitSections, t]);

  const flat = useMemo<Row[]>(() => sections.flatMap((s) => s.rows), [sections]);

  // Aktive Zeile in den sichtbaren Bereich scrollen.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const select = useCallback(
    (row: Row | undefined) => {
      if (!row) return;
      row.onSelect(); // schliesst selbst (go/logout) oder bleibt offen (keepOpen)
      // Bleibt die Palette offen (Thema/Sprache), den Fokus per Maus-Klick zurück
      // ins Suchfeld holen – sonst haengt er am Button und Esc/↑/↓ waeren tot.
      if (row.keepOpen) inputRef.current?.focus();
    },
    [],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      // Fokusfalle: der Fokus bleibt im Suchfeld, Navigation läuft über ↑/↓.
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(flat[activeIndex]);
    }
  };

  if (!open) return null;

  const showEmpty = q.length > 0 && !loading && flat.length === 0;
  let rowIdx = -1; // laufender Index über alle Abschnitte (= flat-Index)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/70 px-4 pt-[12vh] backdrop-blur-sm dl-modal-backdrop"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.search.title')}
    >
      <div
        className="dl-modal-in w-full max-w-2xl overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900/95 shadow-2xl shadow-black/50"
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
            placeholder={t('command.placeholder')}
            className="w-full bg-transparent py-4 text-base text-chrome-50 placeholder:text-chrome-600 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded
            aria-controls={LIST_ID}
            aria-activedescendant={flat[activeIndex] ? rowId(activeIndex) : undefined}
          />
          {loading && <span className="spinner text-copper" aria-hidden />}
          <kbd className="hidden shrink-0 rounded-md border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[10px] text-chrome-400 sm:inline">
            esc
          </kbd>
        </div>

        {/* Ergebnisbereich */}
        <div id={LIST_ID} role="listbox" aria-label={t('ui.search.title')} className="max-h-[55vh] overflow-y-auto py-2">
          {showEmpty && (
            <p className="px-4 py-8 text-center text-sm text-chrome-500">{t('ui.search.empty', { query: q })}</p>
          )}
          {sections.map((section) => (
            <div key={section.key} className="mb-1">
              <div className="flex items-center gap-2 px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-chrome-600">
                {section.icon && <span className="text-chrome-500">{section.icon}</span>}
                {section.label}
              </div>
              {section.rows.map((row) => {
                rowIdx += 1;
                const idx = rowIdx;
                const active = idx === activeIndex;
                return (
                  <button
                    key={row.key}
                    id={rowId(idx)}
                    ref={active ? activeRef : undefined}
                    type="button"
                    role="option"
                    aria-selected={active}
                    tabIndex={-1}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => select(row)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      active ? 'bg-copper/15' : 'hover:bg-ink-800/60'
                    }`}
                  >
                    <span className={`shrink-0 ${active ? 'text-copper' : 'text-chrome-500'}`}>
                      <Icon className="h-4 w-4">{row.icon}</Icon>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-chrome-50">{row.title}</span>
                      {row.subtitle && <span className="block truncate text-xs text-chrome-500">{row.subtitle}</span>}
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
          ))}
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
