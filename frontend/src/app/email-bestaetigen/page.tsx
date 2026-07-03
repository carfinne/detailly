'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PublicShell, PublicBrandHeader } from '@/components/PublicShell';

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
    <PublicShell>
        <PublicBrandHeader small title="E-Mail-Bestätigung" />

        <div className="card space-y-4 text-center">
          {status === 'pruefe' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <span className="spinner h-7 w-7 text-copper" />
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
    </PublicShell>
  );
}
