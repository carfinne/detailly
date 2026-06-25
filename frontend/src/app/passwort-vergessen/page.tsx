'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function PasswortVergessenPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [gesendet, setGesendet] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/password-reset/request', { email });
      // Bewusst neutrale Meldung: verraet NICHT, ob die E-Mail existiert.
      setGesendet(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anfrage fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-900 p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-copper-glow blur-[120px]" />
        <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-info/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-copper-grad text-ink-950 shadow-glow">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
              <path d="M5 11h14a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1M5 11a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h1" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Passwort vergessen?</h1>
          <p className="mt-2 text-sm text-chrome-400">
            Wir senden dir einen Link zum Zurücksetzen.
          </p>
        </div>

        {gesendet ? (
          <div className="card space-y-4 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-copper-soft text-copper">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m4 12 5 5L20 6" />
              </svg>
            </div>
            <p className="text-sm text-chrome-200">
              Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link zum Zurücksetzen geschickt. Prüfe dein Postfach.
            </p>
            <Link href="/login" className="btn-subtle w-full">Zurück zur Anmeldung</Link>
          </div>
        ) : (
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
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/40 border-t-ink-950" />
                  Senden…
                </>
              ) : (
                'Link senden'
              )}
            </button>

            <p className="text-center text-sm text-chrome-400">
              <Link href="/login" className="font-medium text-copper-300 hover:text-copper-200">
                Zurück zur Anmeldung
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
