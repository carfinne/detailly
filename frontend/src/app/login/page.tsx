'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { PublicShell, PublicBrandHeader } from '@/components/PublicShell';

export default function LoginPage() {
  const { login, completeMfa } = useAuth();
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Zweite Login-Stufe (2FA): sobald mfaToken gesetzt ist, wird der Code-Schritt
  // gezeigt. useRecovery schaltet zwischen 6-stelligem TOTP-Code und Recovery-Code.
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.status === 'mfa') {
        setMfaToken(res.mfaToken);
        return; // Schritt 2 anzeigen (kein Redirect)
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.failed'));
    } finally {
      setLoading(false);
    }
  }

  async function onMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setError('');
    setLoading(true);
    try {
      await completeMfa(
        mfaToken,
        useRecovery ? { recoveryCode: recoveryCode.trim() } : { code: code.trim() },
      );
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.mfaFailed'));
    } finally {
      setLoading(false);
    }
  }

  function backToCredentials() {
    setMfaToken(null);
    setCode('');
    setRecoveryCode('');
    setUseRecovery(false);
    setError('');
  }

  const errorBox = error ? (
    <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4m0 4h.01" />
      </svg>
      {error}
    </div>
  ) : null;

  // -------------------------------------------------------------------------
  // Schritt 2: Zwei-Faktor-Code
  // -------------------------------------------------------------------------
  if (mfaToken) {
    return (
      <PublicShell raster>
        <PublicBrandHeader
          backHref="/"
          backText={t('common.back')}
          backLabel={t('common.toStart')}
          title={<>Detail<span className="text-gradient">ly</span></>}
          subtitle={t('login.mfaSubtitle')}
        />

        <form onSubmit={onMfaSubmit} className="card space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-copper/25 bg-copper-soft px-3 py-2.5 text-sm text-chrome-200">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-copper/15 text-copper">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
            {t('login.mfaHint')}
          </div>

          {!useRecovery ? (
            <div className="field">
              <label className="label" htmlFor="mfaCode">{t('login.mfaCode')}</label>
              <input
                id="mfaCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                className="input text-center font-mono text-lg tracking-[0.4em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                required
              />
            </div>
          ) : (
            <div className="field">
              <label className="label" htmlFor="mfaRecovery">{t('login.mfaRecovery')}</label>
              <input
                id="mfaRecovery"
                autoComplete="off"
                className="input font-mono"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="xxxxx-xxxxx"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                required
              />
              <p className="help mt-1">{t('login.mfaRecoveryHint')}</p>
            </div>
          )}

          {errorBox}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                {t('login.mfaVerifying')}
              </>
            ) : (
              t('login.mfaSubmit')
            )}
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => { setUseRecovery((v) => !v); setError(''); }}
              className="font-medium text-copper-300 hover:text-copper-200"
            >
              {useRecovery ? t('login.mfaUseCode') : t('login.mfaUseRecovery')}
            </button>
            <button
              type="button"
              onClick={backToCredentials}
              className="text-chrome-500 hover:text-chrome-300"
            >
              {t('login.mfaBack')}
            </button>
          </div>
        </form>
    </PublicShell>
    );
  }

  // -------------------------------------------------------------------------
  // Schritt 1: E-Mail + Passwort
  // -------------------------------------------------------------------------
  return (
    <PublicShell raster>
        <PublicBrandHeader
          backHref="/"
          backText={t('common.back')}
          backLabel={t('common.toStart')}
          title={<>Detail<span className="text-gradient">ly</span></>}
          subtitle={t('login.subtitle')}
        />

        <form onSubmit={onSubmit} className="card space-y-4">
          <div className="field">
            <label className="label" htmlFor="email">{t('login.email')}</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="password">{t('login.password')}</label>
              <Link href="/passwort-vergessen" className="text-xs font-medium text-copper-300 hover:text-copper-200">
                {t('login.forgot')}
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                className="input pr-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-chrome-400 hover:text-chrome-50"
                aria-label={showPw ? t('login.hidePassword') : t('login.showPassword')}
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
          </div>

          {errorBox}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                {t('login.submitting')}
              </>
            ) : (
              t('login.submit')
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-chrome-400">
          {t('login.noAccount')}{' '}
          <Link href="/registrieren" className="font-medium text-copper-300 hover:text-copper-200">
            {t('login.registerCta')}
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-chrome-600">
          {t('login.footer', { year: new Date().getFullYear() })}
        </p>
    </PublicShell>
  );
}
