'use client';

// Sprachumschalter: kompaktes Dropdown (Flagge + Kürzel) im App-Header/Sidebar
// und im Landing-Header. Muster (Klick-außerhalb/Escape schließt) angelehnt an
// das Profil-Menü der Topbar. Farben ausschließlich über Design-Tokens.

import { useEffect, useRef, useState } from 'react';
import { LANGS, useLanguage, useT } from './provider';

export function LanguageSwitcher({
  className,
  align = 'right',
}: {
  className?: string;
  /** Ausrichtung des Menüs relativ zum Button. */
  align?: 'left' | 'right';
}) {
  const { lang, setLang } = useLanguage();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  // Bei Klick außerhalb / Escape schließen.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`relative ${className ?? ''}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('switcher.label')} · ${t('switcher.current')}: ${current.label}`}
        className="flex items-center gap-1.5 rounded-lg border border-ink-700/70 bg-ink-850/60 px-2.5 py-1.5 text-xs font-semibold text-chrome-300 transition-colors hover:border-ink-600 hover:text-chrome-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
      >
        <span aria-hidden="true" className="text-sm leading-none">{current.flag}</span>
        <span>{current.short}</span>
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 text-chrome-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('switcher.label')}
          className={`absolute top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-ink-700 bg-ink-850 shadow-pop animate-fade-in ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="p-1.5">
            {LANGS.map((l) => {
              const active = l.code === lang;
              return (
                <button
                  key={l.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    setLang(l.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-ink-750 ${
                    active ? 'text-copper' : 'text-chrome-200'
                  }`}
                >
                  <span aria-hidden="true" className="text-base leading-none">{l.flag}</span>
                  <span className="flex-1 text-left font-medium">{l.label}</span>
                  {active && (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
