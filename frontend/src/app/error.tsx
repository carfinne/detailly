'use client';

// Next.js App-Router Fehler-Boundary (Segment-Ebene): faengt Render-/Runtime-
// Fehler in den Seiten ab, damit ein Pilot NICHT auf einem weissen Screen landet.
// Rendert INNERHALB des Root-Layouts -> LanguageProvider steht bereit (useT).
// `reset()` versucht das fehlerhafte Segment neu zu rendern; zusaetzlich bieten
// wir „Seite neu laden" und den Weg zur Startseite an. Markenkonform + animiert.

import { useEffect } from 'react';
import Link from 'next/link';
import { useT } from '@/lib/i18n';
import { PublicShell, PublicBrandHeader } from '@/components/PublicShell';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    // Best-effort-Protokollierung in der Browser-Konsole (kein Fremd-Dienst).
    // Hilft im Pilot bei der Fehlersuche, ohne Nutzerdaten zu versenden.
    // eslint-disable-next-line no-console
    console.error('[Detailly] Unerwarteter Render-Fehler:', error);
  }, [error]);

  return (
    <PublicShell raster>
      <PublicBrandHeader
        title={
          <>
            Detail<span className="text-gradient">ly</span>
          </>
        }
        subtitle={t('errorBoundary.title')}
      />

      <div className="card space-y-5 text-center">
        <span
          className="dl-error-pulse mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger/15 text-danger"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </span>

        <p className="text-sm text-chrome-300">{t('errorBoundary.desc')}</p>

        {error?.digest && (
          <p className="font-mono text-xs text-chrome-600">
            {t('errorBoundary.reference')}: {error.digest}
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => reset()} className="btn-primary btn-sm">
            {t('errorBoundary.retry')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload();
            }}
            className="btn-ghost btn-sm"
          >
            {t('errorBoundary.reload')}
          </button>
          <Link href="/" className="btn-ghost btn-sm">
            {t('common.toStart')}
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
