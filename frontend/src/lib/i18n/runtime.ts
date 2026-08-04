// ===========================================================================
// i18n-Laufzeitbrücke (KEIN React)
// ---------------------------------------------------------------------------
// Erlaubt Code AUSSERHALB der React-Baumstruktur – vor allem dem zentralen
// API-Client (lib/api.ts) – sichtbare Texte in der AKTIVEN Sprache zu
// übersetzen. Der LanguageProvider registriert nach jedem Sprachwechsel seine
// t()-Funktion (useEffect), sodass die aktive Sprache hier gespiegelt bleibt.
//
// Vor der Registrierung (SSR / allererster Tick, bevor der Provider gemountet
// ist) greift der DE-Fallback: das statisch gebündelte Referenz-Wörterbuch. So
// erscheint NIE ein roher Key. DE ist ohnehin im Haupt-Bundle -> kein Mehrgewicht.
// ===========================================================================
import { de } from './dictionaries/de';

type Params = Record<string, string | number>;
type TFn = (key: string, params?: Params) => string;

let activeT: TFn | null = null;

/** Vom LanguageProvider aufgerufen: die aktuelle t()-Funktion hinterlegen. */
export function setActiveTranslator(t: TFn): void {
  activeT = t;
}

/** Ersetzt einfache {name}-Platzhalter (gleiche Regel wie der Provider). */
function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? String(params[key]) : whole,
  );
}

/**
 * Übersetzt einen Key außerhalb von React. Nutzt die registrierte t() der
 * aktiven Sprache; vor der Registrierung fällt sie sauber auf DE zurück.
 */
export function translate(key: string, params?: Params): string {
  if (activeT) return activeT(key, params);
  const raw = (de as Record<string, string | undefined>)[key] ?? key;
  return interpolate(raw, params);
}
