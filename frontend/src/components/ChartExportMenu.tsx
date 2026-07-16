'use client';

// Dezentes Export-Menue fuer Diagramme (CSV, optional PNG). Bewusst als
// natives <details>-Element umgesetzt (kein Portal, kein schwerer State) mit
// einem kleinen Klick-ausserhalb/Escape-Handler zum Schliessen. Design ueber
// Tokens; PNG-Eintrag erscheint nur, wenn ein onPng-Handler uebergeben wird
// (reine DOM/DIV-Charts bieten nur CSV an).

import { useEffect, useRef } from 'react';
import { useT } from '@/lib/i18n';

export function ChartExportMenu({
  onCsv,
  onPng,
  className,
}: {
  onCsv: () => void;
  /** Nur setzen, wenn ein sauberer PNG-Export moeglich ist (SVG-Chart). */
  onPng?: () => void;
  className?: string;
}) {
  const t = useT();
  const ref = useRef<HTMLDetailsElement>(null);

  // Schliesst das Menue bei Klick ausserhalb oder Escape (nur solange offen).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onPointer = (e: PointerEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && el.open) el.open = false;
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const run = (fn?: () => void) => {
    fn?.();
    if (ref.current) ref.current.open = false;
  };

  const item =
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-chrome-200 transition-colors hover:bg-ink-750 focus-visible:bg-ink-750 focus-visible:outline-none';

  return (
    <details ref={ref} className={`relative ${className ?? ''}`}>
      <summary
        aria-label={t('export.menu')}
        title={t('export.menu')}
        className="btn-subtle btn-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
        </svg>
        <span className="hidden sm:inline">{t('export.menu')}</span>
      </summary>

      <div className="absolute right-0 z-20 mt-1.5 min-w-[11rem] rounded-xl border border-ink-700 bg-ink-850 p-1 shadow-pop">
        <button type="button" onClick={() => run(onCsv)} className={item}>
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-chrome-400" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 3h9l3 3v15H6z" /><path d="M15 3v3h3M9 13h6M9 17h6" />
          </svg>
          {t('export.csv')}
        </button>
        {onPng && (
          <button type="button" onClick={() => run(onPng)} className={item}>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-chrome-400" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4 4 3 3-2 4 3" />
            </svg>
            {t('export.png')}
          </button>
        )}
      </div>
    </details>
  );
}
