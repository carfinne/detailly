'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';

/**
 * Slide-over von rechts für den Material-&-Lager-Bereich (Muster:
 * HaendlerSlideOver im Marktplatz). Einblenden per Transition, Escape und
 * Backdrop schließen.
 *
 * `blockEscape`: solange darüber ein Modal (z. B. ConfirmDialog) offen ist,
 * muss das Slide-over Escape ignorieren – sonst schließen Dialog UND Slide-over
 * auf denselben Tastendruck (Scroll-Lock-Stacking-Lektion). Der Modal-Stack in
 * ui.tsx behandelt Escape für den Dialog selbst.
 */
export function SlideOver({
  open,
  title,
  subtitle,
  onClose,
  blockEscape = false,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  blockEscape?: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  const [sichtbar, setSichtbar] = useState(false);
  // Refs statt Effect-Dependencies: der Effect läuft nur auf [open] und
  // re-runnt nicht bei jeder neuen Inline-Funktion bzw. jedem blockEscape-Flip.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const blockRef = useRef(blockEscape);
  blockRef.current = blockEscape;

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setSichtbar(true));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !blockRef.current) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      setSichtbar(false);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`absolute inset-0 bg-ink-950/70 backdrop-blur-sm transition-opacity duration-220 ease-emphasized ${sichtbar ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`relative flex h-full w-full max-w-md flex-col border-l border-ink-700 bg-ink-850 shadow-pop transition-transform duration-220 ease-emphasized ${sichtbar ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink-700/70 p-5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-semibold text-chrome-50">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-chrome-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-chrome-400 transition-colors hover:bg-ink-750 hover:text-chrome-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
            aria-label={t('common.close')}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
