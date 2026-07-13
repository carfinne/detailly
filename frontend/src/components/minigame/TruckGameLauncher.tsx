'use client';

// ===========================================================================
// Launcher/Trigger für das Easter-Egg-Minispiel „Detailly-Truck".
// ---------------------------------------------------------------------------
// Bewusst winzig: nur ein dezenter Button + ein Boolean-State. Das eigentliche
// Spiel (TruckGame.tsx, das „schwere" Modul) wird per next/dynamic({ ssr:false })
// als EIGENER Chunk erst geladen, wenn der Nutzer klickt → kein Zuwachs im
// First-Load-Bundle. Dieser Launcher darf zentral (z. B. in ui.tsx) statisch
// importiert werden, ohne das Spiel mitzuziehen.
//
// Zwei Einsatzorte (siehe ui.tsx):
//   - variant="error"   → sofort sichtbarer Button unter einer Fehlermeldung
//   - variant="loading" → erscheint erst nach `delayMs` (lange Wartezeit)
// ===========================================================================

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useT } from '@/lib/i18n';

// Lazy: löst den Chunk-Download erst beim ersten Rendern (= Klick) aus.
const TruckGameLazy = dynamic(() => import('./TruckGame'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink-950/80 backdrop-blur-sm">
      <span className="spinner" aria-hidden="true" />
    </div>
  ),
});

export function TruckGameLauncher({
  variant = 'error',
  delayMs = 0,
  className,
}: {
  variant?: 'error' | 'loading';
  /** Verzögert das Einblenden des Buttons (z. B. erst nach langer Wartezeit). */
  delayMs?: number;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) return;
    const id = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);

  if (!ready && !open) return null;

  const label = variant === 'loading' ? t('minigame.cta.loading') : t('minigame.cta.error');

  return (
    <>
      {ready && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-chrome-400 transition-colors hover:text-copper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50 ${className ?? ''}`}
        >
          {label}
        </button>
      )}
      {open && <TruckGameLazy onClose={() => setOpen(false)} />}
    </>
  );
}
