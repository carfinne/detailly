'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';

/**
 * App-weiter Nudge zur 2FA-Einrichtung. Zwei Stufen (kein Server-Hard-Block,
 * daher rein clientseitiger Zwang/Empfehlung):
 *  - mfaPflicht (Betrieb verlangt 2FA fuer Betriebs-Rollen) -> deutliches Banner,
 *  - mfaEmpfohlen (Plattform-Rolle) -> dezente Empfehlung.
 * Nur sichtbar, solange 2FA NICHT aktiv ist. Beide verlinken in die Profil-2FA.
 */
export function MfaBanner() {
  const { user } = useAuth();
  const t = useT();

  if (!user || user.mfaEnabled) return null;
  const pflicht = user.mfaPflicht === true;
  const empfohlen = user.mfaEmpfohlen === true;
  if (!pflicht && !empfohlen) return null;

  const tone = pflicht
    ? 'border-danger/30 bg-danger-soft'
    : 'border-copper/30 bg-copper-soft';
  const iconTone = pflicht ? 'bg-danger/15 text-danger' : 'bg-copper/15 text-copper';

  return (
    <div className={`mb-5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${iconTone}`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
      <span className="text-chrome-200">
        {pflicht ? t('mfa.banner.required') : t('mfa.banner.recommended')}
      </span>
      <div className="ml-auto">
        <Link href="/einstellungen?tab=profil" className="btn-subtle btn-sm">
          {t('mfa.banner.setupCta')}
        </Link>
      </div>
    </div>
  );
}
