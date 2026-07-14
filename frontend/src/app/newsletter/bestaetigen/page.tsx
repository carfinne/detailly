'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PublicShell, PublicBrandHeader } from '@/components/PublicShell';
import { useT } from '@/lib/i18n';

type Status = 'loading' | 'success' | 'error' | 'missing';

/**
 * Double-Opt-in Schritt 2: bestaetigt die Newsletter-Anmeldung. Liest das Token
 * clientseitig aus der URL (kein useSearchParams -> kein Suspense-/Prerender-
 * Zwang beim statischen Export) und ruft die oeffentliche API. Danach wird das
 * Token aus der URL entfernt (nicht in History/Referer).
 */
export default function NewsletterBestaetigenPage() {
  const t = useT();
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) window.history.replaceState({}, '', window.location.pathname);
    if (!token) {
      setStatus('missing');
      return;
    }
    let aktiv = true;
    api
      .post('/public/newsletter/bestaetigen', { token })
      .then(() => aktiv && setStatus('success'))
      .catch(() => aktiv && setStatus('error'));
    return () => {
      aktiv = false;
    };
  }, []);

  return (
    <PublicShell>
      <PublicBrandHeader
        backHref="/"
        small
        title={t('newsletter.confirm.title')}
        subtitle={t('newsletter.confirm.subtitle')}
      />

      {status === 'loading' ? (
        <div className="card space-y-4 text-center">
          <div className="flex items-center justify-center gap-2.5 text-sm text-chrome-300">
            <span className="spinner" />
            {t('newsletter.confirm.loading')}
          </div>
        </div>
      ) : status === 'success' ? (
        <div className="card space-y-4 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-positive/15 text-positive">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m4 12 5 5L20 6" />
            </svg>
          </div>
          <h2 className="font-display text-lg font-semibold text-chrome-50">{t('newsletter.confirm.successTitle')}</h2>
          <p className="text-sm text-chrome-300">{t('newsletter.confirm.success')}</p>
          <Link href="/" className="btn-subtle w-full">{t('newsletter.backHome')}</Link>
        </div>
      ) : (
        <div className="card space-y-4 text-center">
          <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-left text-sm text-danger">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
            {status === 'missing' ? t('newsletter.confirm.missing') : t('newsletter.confirm.error')}
          </div>
          <Link href="/#newsletter" className="btn-primary w-full">{t('landing.newsletter.button')}</Link>
          <Link href="/" className="link-muted text-sm">{t('newsletter.backHome')}</Link>
        </div>
      )}
    </PublicShell>
  );
}
