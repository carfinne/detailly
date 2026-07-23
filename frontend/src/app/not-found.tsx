'use client';

// Next.js App-Router 404: greift fuer unbekannte Routen (statischer Export ->
// 404.html). Rendert INNERHALB des Root-Layouts, d. h. LanguageProvider/
// AuthProvider stehen bereit -> i18n via useT moeglich. Markenkonform ueber die
// bestehende PublicShell + Kupfer-Kachel, mit dezenter Auftritts-Animation.

import Link from 'next/link';
import { useT } from '@/lib/i18n';
import { PublicShell, PublicBrandHeader } from '@/components/PublicShell';

export default function NotFound() {
  const t = useT();

  return (
    <PublicShell raster>
      <PublicBrandHeader
        title={
          <>
            <span className="text-gradient">404</span>
          </>
        }
        subtitle={t('notFound.title')}
      />

      <div className="card space-y-5 text-center">
        <span
          className="dl-error-pulse mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-copper/15 text-copper"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3M9 9l4 4m0-4-4 4" />
          </svg>
        </span>

        <p className="text-sm text-chrome-300">{t('notFound.desc')}</p>

        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-primary btn-sm">
            {t('common.toStart')}
          </Link>
          <Link href="/dashboard" className="btn-ghost btn-sm">
            {t('notFound.dashboard')}
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
