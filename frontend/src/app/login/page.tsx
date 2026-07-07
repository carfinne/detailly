'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { PublicShell, PublicBrandHeader } from '@/components/PublicShell';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicShell raster>
        <PublicBrandHeader
          backHref="/"
          title={<>Detail<span className="text-gradient">ly</span></>}
          subtitle={<>Detailing Suite — Aufbereitung, Folierung &amp; PPF</>}
        />

        <form onSubmit={onSubmit} className="card space-y-4">
          <div className="field">
            <label className="label" htmlFor="email">E-Mail</label>
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
              <label className="label" htmlFor="password">Passwort</label>
              <Link href="/passwort-vergessen" className="text-xs font-medium text-copper-300 hover:text-copper-200">
                Passwort vergessen?
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
                aria-label={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'}
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
                Anmelden…
              </>
            ) : (
              'Anmelden'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-chrome-400">
          Noch kein Konto?{' '}
          <Link href="/registrieren" className="font-medium text-copper-300 hover:text-copper-200">
            Betrieb registrieren
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-chrome-600">
          © {new Date().getFullYear()} Detailly · Eigenständige Detailing-Software
        </p>
    </PublicShell>
  );
}
