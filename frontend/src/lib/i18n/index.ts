// Öffentliche i18n-Schnittstelle. Import überall via `@/lib/i18n`.
//
// Weitere Seiten anbinden (Folge-Aufwand):
//   1. Sichtbare deutsche Strings der Seite als Keys in dictionaries/de.ts
//      ergänzen (flacher Punkt-Key, sinnvoller Namespace, z. B. `kunden.*`).
//   2. Denselben Key in en.ts vollständig übersetzen (Build erzwingt das).
//   3. Optional Kern-Keys in ru.ts/pl.ts ergänzen; alles andere fällt auf DE
//      zurück – keine erfundenen Übersetzungen.
//   4. In der Seite `const t = useT();` und `t('key')` statt des Literals nutzen.
//      Platzhalter: `t('key', { name })` ersetzt `{name}` im Text.
export { LanguageProvider, useT, useLanguage, LANGS, type Lang } from './provider';
export { LanguageSwitcher } from './LanguageSwitcher';
export type { Dict } from './dictionaries/de';
