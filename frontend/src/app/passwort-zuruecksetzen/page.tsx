'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PublicShell, PublicBrandHeader } from '@/components/PublicShell';

export default function PasswortZuruecksetzenPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fertig, setFertig] = useState(false);

  // Token clientseitig aus der URL lesen (kein useSearchParams -> kein
  // Suspense-/Prerender-Zwang beim statischen Export). Danach das Token aus der
  // URL entfernen (history.replaceState) -> nicht in Browser-History/Referer.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    setToken(t);
    setReady(true);
    if (t) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen haben.');
      return;
    }
    if (password !== confirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    if (!token) {
      setError('Der Link ist unvollständig. Fordere einen neuen an.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/password-reset/confirm', { token, newPassword: password });
      setFertig(true);
      setTimeout(() => router.push('/login'), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zurücksetzen fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicShell>
        <PublicBrandHeader
          small
          title="Neues Passwort"
          subtitle="Vergib ein neues Passwort für dein Konto."
        />

        {fertig ? (
          <div className="card space-y-4 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-copper-soft text-copper">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m4 12 5 5L20 6" />
              </svg>
            </div>
            <p className="text-sm text-chrome-200">
              Dein Passwort wurde geändert. Du wirst zur Anmeldung weitergeleitet…
            </p>
            <Link href="/login" className="btn-subtle w-full">Jetzt anmelden</Link>
          </div>
        ) : ready && !token ? (
          <div className="card space-y-4 text-center">
            <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-left text-sm text-danger">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
              Dieser Link ist unvollständig oder ungültig.
            </div>
            <Link href="/passwort-vergessen" className="btn-primary w-full">Neuen Link anfordern</Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="card space-y-4">
            <div className="field">
              <label className="label" htmlFor="password">Neues Passwort</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  className="input pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
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
              <p className="mt-1.5 text-xs text-chrome-600">Mindestens 8 Zeichen.</p>
            </div>

            <div className="field">
              <label className="label" htmlFor="confirm">Passwort bestätigen</label>
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

            <button type="submit" className="btn-primary w-full" disabled={loading || !ready}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Speichern…
                </>
              ) : (
                'Passwort speichern'
              )}
            </button>
          </form>
        )}
    </PublicShell>
  );
}
