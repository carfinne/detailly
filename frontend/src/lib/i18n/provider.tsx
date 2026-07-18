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
//
// Bundle-Splitting (Welle-1-Perf):
// - NUR DE wird statisch gebündelt (Default-Sprache, Fallback-Kette, Typquelle).
// - EN/RU/PL werden per nativem dynamischem import() nachgeladen → jedes landet
//   im statischen Export in einem EIGENEN Chunk und belastet NICHT das
//   gemeinsame Haupt-Bundle jeder Seite (spart ~135 KB gzip beim Erstaufruf).
// - Modulweiter Cache lädt jedes Fremdwörterbuch höchstens einmal.
// ===========================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { de, type Dict } from './dictionaries/de';

export type Lang = 'de' | 'en' | 'ru' | 'pl';

/** Sprachen außer DE – werden bei Bedarf als eigener Chunk nachgeladen. */
type ForeignLang = Exclude<Lang, 'de'>;

/** Anzeige-Metadaten für den Sprachumschalter (native Bezeichnung + Kürzel).
 *  Bewusst ohne Flaggen-Emoji: Flaggen stehen für Länder, nicht für Sprachen,
 *  und Windows rendert Regional-Indicator-Flaggen nicht (Buchstabenkästchen). */
export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: 'de', label: 'Deutsch', short: 'DE' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ru', label: 'Русский', short: 'RU' },
  { code: 'pl', label: 'Polski', short: 'PL' },
];

const STORAGE_KEY = 'detailly.lang';
const DEFAULT_LANG = 'de' as const;

// Lazy-Loader je Fremdsprache: nativer dynamischer Import → beim statischen
// Export erzeugt Webpack pro Wörterbuch einen eigenen Async-Chunk (kein
// zusätzliches Paket). DE bleibt statisch (siehe Import oben).
const LOADERS: Record<ForeignLang, () => Promise<Partial<Dict>>> = {
  en: () => import('./dictionaries/en').then((m) => m.en),
  ru: () => import('./dictionaries/ru').then((m) => m.ru),
  pl: () => import('./dictionaries/pl').then((m) => m.pl),
};

// Modulweiter Cache: jedes Wörterbuch wird höchstens einmal geladen – auch über
// mehrere Provider-Mounts / React-StrictMode-Doppelaufrufe hinweg. DE ist von
// Anfang an vorhanden.
const dictCache: Partial<Record<Lang, Partial<Dict>>> = { de };
// Laufende Ladevorgänge, damit paralleles setLang/Mount nicht doppelt importiert.
const inflight = new Map<ForeignLang, Promise<Partial<Dict>>>();

/** Lädt ein Fremdwörterbuch (falls nötig) und legt es im Cache ab. */
function loadDict(lang: ForeignLang): Promise<Partial<Dict>> {
  const cached = dictCache[lang];
  if (cached) return Promise.resolve(cached);

  let pending = inflight.get(lang);
  if (!pending) {
    pending = LOADERS[lang]()
      .then((dict) => {
        dictCache[lang] = dict;
        inflight.delete(lang);
        return dict;
      })
      .catch((err) => {
        inflight.delete(lang);
        throw err;
      });
    inflight.set(lang, pending);
  }
  return pending;
}

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
  // Gerenderte Wörterbücher: startet mit den bereits im Modul-Cache liegenden
  // (mind. DE). Nachgeladene Chunks werden hier ergänzt → löst Re-Render aus.
  const [dicts, setDicts] = useState<Partial<Record<Lang, Partial<Dict>>>>(
    () => ({ ...dictCache }),
  );

  // Latest-Wins-Guard: jeder Sprachwunsch (Mount-Restore ODER setLang) zieht vor
  // dem async Chunk-Load eine fortlaufende Sequenznummer. Nur der zuletzt
  // gestartete Wunsch darf seinen Zustand anwenden. Verhindert, dass eine
  // spät auflösende Import-Promise einen neueren Wechsel überschreibt
  // (inkl. localStorage) und dass der Mount-Restore einen Nutzer-Klick überstimmt.
  const langReqSeq = useRef(0);

  /** Merkt sich ein nachgeladenes Wörterbuch im State (idempotent). */
  const registerDict = useCallback((code: Lang, dict: Partial<Dict>) => {
    setDicts((prev) => (prev[code] ? prev : { ...prev, [code]: dict }));
  }, []);

  // Gespeicherte Sprache nach dem Mount laden + <html lang> setzen.
  // Fremdsprache ≠ DE: Chunk nachladen, bis dahin mit DE rendern (kein Flash
  // roher Keys). Erst nach dem Laden auf die Zielsprache umschalten.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* localStorage evtl. gesperrt -> beim Default bleiben */
      return;
    }
    if (!isLang(stored) || stored === DEFAULT_LANG) return;

    const target = stored; // 'en' | 'ru' | 'pl'
    const mySeq = ++langReqSeq.current;
    loadDict(target)
      .then((dict) => {
        registerDict(target, dict);
        // Verworfen, sobald zwischenzeitlich ein Nutzer-Klick (setLang) startete.
        if (mySeq !== langReqSeq.current) return;
        setLangState(target);
        if (typeof document !== 'undefined') document.documentElement.lang = target;
      })
      .catch(() => {
        /* Chunk-Laden fehlgeschlagen -> bei DE bleiben (Fallback greift ohnehin) */
      });
    // Nur einmal beim Mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback(
    (next: Lang) => {
      // Neuer Sprachwunsch -> Sequenz hochzählen. Das macht alle noch laufenden
      // Loads (Mount-Restore ODER früheres setLang) zu Verlierern – auch der
      // synchrone Pfad, damit eine spät auflösende Import-Promise diesen Wechsel
      // nicht mehr überschreibt.
      const mySeq = ++langReqSeq.current;

      const apply = () => {
        setLangState(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* Schreiben nicht möglich -> nur In-Memory umschalten */
        }
        if (typeof document !== 'undefined') document.documentElement.lang = next;
      };

      // DE oder bereits geladen -> sofort umschalten (dieser Wunsch ist der neueste).
      if (next === DEFAULT_LANG || dictCache[next]) {
        apply();
        return;
      }
      // Fremdsprache noch nicht im Cache -> erst Chunk laden, DANN wechseln
      // (kein Flash roher Keys während des Ladens).
      loadDict(next)
        .then((dict) => {
          registerDict(next, dict);
          // Verworfen, falls inzwischen ein neuerer Wechsel gestartet wurde
          // (kein Persistieren des veralteten Werts in localStorage).
          if (mySeq !== langReqSeq.current) return;
          apply();
        })
        .catch(() => {
          /* Laden fehlgeschlagen -> bei aktueller Sprache bleiben */
        });
    },
    [registerDict],
  );

  const t = useCallback<TFn>(
    (key, params) => {
      const active = dicts[lang] ?? de;
      const raw = lookup(active, key) ?? lookup(de, key) ?? key;
      return interpolate(raw, params);
    },
    [lang, dicts],
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
