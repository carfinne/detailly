'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PublicShell, PublicBrandHeader } from '@/components/PublicShell';

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
    <PublicShell>
        <PublicBrandHeader
          backHref="/"
          small
          title="Passwort vergessen?"
          subtitle="Wir senden dir einen Link zum Zurücksetzen."
        />

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
                  <span className="spinner" />
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
    </PublicShell>
  );
}
