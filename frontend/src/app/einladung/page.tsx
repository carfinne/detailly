'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, setToken, appPath } from '@/lib/api';
import { PublicShell, PublicBrandHeader } from '@/components/PublicShell';
import { useT } from '@/lib/i18n';
import type { InvitationInfo } from '@/lib/types';

// Rolle -> i18n-Key (Rohwert-Fallback). Gleiche Keys wie die Mitarbeiter-Ansicht.
const ROLE_KEY: Record<string, string> = {
  owner: 'mitarbeiter.role.owner',
  manager: 'mitarbeiter.role.manager',
  technician: 'mitarbeiter.role.technician',
  receptionist: 'mitarbeiter.role.receptionist',
};

const PW_MIN = 10;

export default function EinladungPage() {
  const t = useT();
  const [token, setTokenValue] = useState<string | null>(null);
  const [phase, setPhase] = useState<'pruefe' | 'formular' | 'ungueltig' | 'fertig'>('pruefe');
  const [info, setInfo] = useState<InvitationInfo | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Token clientseitig aus der URL lesen (kein useSearchParams -> kein Suspense-/
  // Prerender-Zwang beim statischen Export). Danach aus der URL entfernen
  // (history.replaceState) -> nicht in Browser-History/Referer.
  useEffect(() => {
    const t0 = new URLSearchParams(window.location.search).get('token');
    setTokenValue(t0);
    if (t0) window.history.replaceState({}, '', window.location.pathname);
    if (!t0) {
      setPhase('ungueltig');
      return;
    }
    api
      .post<InvitationInfo>('/public/einladung/info', { token: t0 })
      .then((res) => {
        setInfo(res);
        setFirstName(res.firstName ?? '');
        setLastName(res.lastName ?? '');
        setPhase('formular');
      })
      .catch(() => setPhase('ungueltig'));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < PW_MIN) {
      setError(t('einladung.error.pwShort', { min: PW_MIN }));
      return;
    }
    if (password !== confirm) {
      setError(t('einladung.error.pwMismatch'));
      return;
    }
    if (!token) {
      setError(t('einladung.error.incomplete'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ accessToken: string }>('/public/einladung/annehmen', {
        token,
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      // Auto-Login: Token setzen + harte Navigation, damit der AuthProvider neu
      // mountet und /auth/me mit dem neuen Token laedt.
      setToken(res.accessToken);
      setPhase('fertig');
      setTimeout(() => {
        window.location.href = appPath('/dashboard/');
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('einladung.error.accept'));
    } finally {
      setLoading(false);
    }
  }

  const rolleLabel = info ? (ROLE_KEY[info.rolle] ? t(ROLE_KEY[info.rolle]) : info.rolle) : '';

  return (
    <PublicShell>
      <PublicBrandHeader
        backHref="/"
        small
        title={t('einladung.title')}
        subtitle={t('einladung.subtitle')}
      />

      {phase === 'pruefe' && (
        <div className="card space-y-4 text-center">
          <div className="flex flex-col items-center gap-3 py-4">
            <span className="spinner h-7 w-7 text-copper" />
            <p className="text-sm text-chrome-400">{t('einladung.checking')}</p>
          </div>
        </div>
      )}

      {phase === 'ungueltig' && (
        <div className="card space-y-4 text-center">
          <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-left text-sm text-danger">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
            {t('einladung.invalid')}
          </div>
          <Link href="/login" className="btn-subtle w-full">{t('einladung.toLogin')}</Link>
        </div>
      )}

      {phase === 'fertig' && (
        <div className="card space-y-4 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-copper-soft text-copper">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m4 12 5 5L20 6" />
            </svg>
          </div>
          <p className="text-sm text-chrome-200">{t('einladung.done')}</p>
          <div className="flex items-center justify-center gap-2 text-sm text-chrome-400">
            <span className="spinner h-4 w-4 text-copper" />
            {t('einladung.redirecting')}
          </div>
        </div>
      )}

      {phase === 'formular' && info && (
        <form onSubmit={onSubmit} className="card space-y-4">
          <div className="rounded-xl border border-copper/25 bg-copper-soft/40 px-3.5 py-3 text-sm text-chrome-200">
            <p>{t('einladung.intro', { betrieb: info.betrieb })}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-chrome-400">
              <span>
                {t('einladung.roleLabel')}: <span className="font-medium text-chrome-100">{rolleLabel}</span>
              </span>
              <span>
                {t('einladung.emailLabel')}: <span className="font-medium text-chrome-100">{info.email}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label className="label" htmlFor="firstName">{t('einladung.firstName')}</label>
              <input
                id="firstName"
                className="input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="lastName">{t('einladung.lastName')}</label>
              <input
                id="lastName"
                className="input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="password">{t('einladung.password')}</label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                className="input pr-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={PW_MIN}
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-chrome-400 hover:text-chrome-50"
                aria-label={showPw ? t('einladung.pwHide') : t('einladung.pwShow')}
              >
                {showPw ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.3M6.6 6.6A18 18 0 0 0 2 12s3 8 10 8a9 9 0 0 0 4.5-1.2M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-chrome-600">{t('einladung.pwHint', { min: PW_MIN })}</p>
          </div>

          <div className="field">
            <label className="label" htmlFor="confirm">{t('einladung.passwordConfirm')}</label>
            <input
              id="confirm"
              type={showPw ? 'text' : 'password'}
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                {t('einladung.submitting')}
              </>
            ) : (
              t('einladung.submit')
            )}
          </button>
        </form>
      )}
    </PublicShell>
  );
}
