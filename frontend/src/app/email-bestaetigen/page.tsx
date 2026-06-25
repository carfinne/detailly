'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function EmailBestaetigenPage() {
  const [status, setStatus] = useState<'pruefe' | 'ok' | 'fehler'>('pruefe');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    // Token nach dem Auslesen aus der URL entfernen (History/Referer).
    if (token) window.history.replaceState({}, '', window.location.pathname);
    if (!token) {
      setStatus('fehler');
      return;
    }
    api
      .post('/auth/verify-email', { token })
      .then(() => setStatus('ok'))
      .catch(() => setStatus('fehler'));
  }, []);

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
          <h1 className="font-display text-2xl font-bold tracking-tight">E-Mail-Bestätigung</h1>
        </div>

        <div className="card space-y-4 text-center">
          {status === 'pruefe' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-chrome-600 border-t-copper" />
              <p className="text-sm text-chrome-400">Bestätige deine E-Mail-Adresse…</p>
            </div>
          )}

          {status === 'ok' && (
            <>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-copper-soft text-copper">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m4 12 5 5L20 6" />
                </svg>
              </div>
              <p className="text-sm text-chrome-200">
                Deine E-Mail-Adresse ist bestätigt. Vielen Dank!
              </p>
              <Link href="/dashboard" className="btn-primary w-full">Zum Dashboard</Link>
            </>
          )}

          {status === 'fehler' && (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-left text-sm text-danger">
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4m0 4h.01" />
                </svg>
                Der Bestätigungslink ist ungültig oder abgelaufen.
              </div>
              <p className="text-sm text-chrome-400">
                Melde dich an und fordere über das Hinweis-Banner einen neuen Link an.
              </p>
              <Link href="/login" className="btn-subtle w-full">Zur Anmeldung</Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
