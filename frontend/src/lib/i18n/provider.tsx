'use client';

// ===========================================================================
// i18n-Fundament: schlanker, eigener Übersetzungs-Context (KEIN externes Paket).
// ---------------------------------------------------------------------------
// - Kompatibel mit statischem Export (output: 'export'): rein clientseitig,
//   kein Server-Runtime, kein Zugriff auf window/localStorage beim ersten Render.
// - Deterministischer erster Render = DE (passt zu <html lang="de"> aus dem
//   Root-Layout) → keine Hydration-Diskrepanz. Die gespeicherte Sprache wird
//   erst NACH dem Mount per useEffect angewendet.
// - Fallback-Kette: aktuelle Sprache → DE → roher Key (Letzteres nur bei echtem
//   Entwicklerfehler, damit nie ein leerer String erscheint).
// - RU/PL sind Partial<Dict>: fehlende Keys landen automatisch beim DE-Wert.
// ===========================================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { de, type Dict } from './dictionaries/de';
import { en } from './dictionaries/en';
import { ru } from './dictionaries/ru';
import { pl } from './dictionaries/pl';

export type Lang = 'de' | 'en' | 'ru' | 'pl';

/** Anzeige-Metadaten für den Sprachumschalter (native Bezeichnung + Kürzel). */
export const LANGS: { code: Lang; label: string; short: string; flag: string }[] = [
  { code: 'de', label: 'Deutsch', short: 'DE', flag: '🇩🇪' },
  { code: 'en', label: 'English', short: 'EN', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', short: 'RU', flag: '🇷🇺' },
  { code: 'pl', label: 'Polski', short: 'PL', flag: '🇵🇱' },
];

const DICTS: Record<Lang, Partial<Dict>> = { de, en, ru, pl };
const STORAGE_KEY = 'detailly.lang';
const DEFAULT_LANG: Lang = 'de';

type Params = Record<string, string | number>;

/** Ersetzt einfache {name}-Platzhalter; unbekannte bleiben unverändert stehen. */
function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? String(params[key]) : whole,
  );
}

/** Sichere Suche in einem (evtl. unvollständigen) Wörterbuch. */
function lookup(table: Partial<Dict>, key: string): string | undefined {
  return (table as Record<string, string | undefined>)[key];
}

function isLang(value: unknown): value is Lang {
  return value === 'de' || value === 'en' || value === 'ru' || value === 'pl';
}

type TFn = (key: string, params?: Params) => string;

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFn;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Erststand IMMER Default (Export-/SSR-sicher). Die gespeicherte Sprache wird
  // erst im Effect nachgezogen, damit Server- und Client-Erstrender identisch sind.
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // Gespeicherte Sprache nach dem Mount laden + <html lang> setzen.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isLang(stored) && stored !== lang) {
        setLangState(stored);
        document.documentElement.lang = stored;
      }
    } catch {
      /* localStorage evtl. gesperrt -> beim Default bleiben */
    }
    // Nur einmal beim Mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Schreiben nicht möglich -> nur In-Memory umschalten */
    }
    if (typeof document !== 'undefined') document.documentElement.lang = next;
  }, []);

  const t = useCallback<TFn>(
    (key, params) => {
      const raw = lookup(DICTS[lang], key) ?? lookup(de, key) ?? key;
      return interpolate(raw, params);
    },
    [lang],
  );

  const value = useMemo<LanguageContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function useLanguageContext(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('i18n: useT/useLanguage muss innerhalb von <LanguageProvider> verwendet werden.');
  }
  return ctx;
}

/** Übersetzungs-Hook: liefert die t()-Funktion der aktuellen Sprache. */
export function useT(): TFn {
  return useLanguageContext().t;
}

/** Zugriff auf die aktive Sprache + Umschalter (für den LanguageSwitcher). */
export function useLanguage(): { lang: Lang; setLang: (lang: Lang) => void } {
  const { lang, setLang } = useLanguageContext();
  return { lang, setLang };
}
