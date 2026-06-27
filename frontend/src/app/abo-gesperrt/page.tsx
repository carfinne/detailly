'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, appPath, clearToken } from '@/lib/api';
import type { Subscription } from '@/lib/types';

/**
 * Sperrseite: erscheint, wenn das Backend einen Zugriff wegen inaktivem Abo
 * blockt (403 `SUBSCRIPTION_INACTIVE`). Der Login bleibt moeglich, damit der
 * Betrieb sich anmelden und hier den Status sehen kann.
 */
export default function AboGesperrtPage() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [checking, setChecking] = useState(true);

  const pruefen = useCallback(async () => {
    setChecking(true);
    try {
      const me = await api.get<Subscription | null>('/subscriptions/me');
      setSub(me);
      // Wieder freigeschaltet? -> zurueck in die App.
      if (me?.access && me.access.access !== 'blocked') {
        window.location.href = appPath('/dashboard/');
      }
    } catch {
      /* /me ist frei zugaenglich; Fehler hier ignorieren wir bewusst. */
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    pruefen();
  }, [pruefen]);

  function abmelden() {
    clearToken();
    window.location.href = appPath('/login/');
  }

  const grund = sub?.access?.reason ?? 'Das Abo dieses Betriebs ist derzeit nicht aktiv.';

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 p-4">
      <div className="w-full max-w-md animate-fade-in rounded-2xl border border-ink-700 bg-ink-850 p-8 text-center shadow-pop">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-danger/30 bg-danger-soft text-danger">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h1 className="mt-5 font-display text-xl font-bold text-chrome-50">Abo nicht aktiv</h1>
        <p className="mt-2 text-sm text-chrome-400">
          Der Zugriff auf Detailly ist pausiert, weil das Abo dieses Betriebs nicht aktiv ist.
        </p>

        <div className="mt-5 rounded-xl border border-ink-700 bg-ink-800/60 px-4 py-3 text-sm text-chrome-200">
          <span className="text-chrome-500">Grund: </span>
          {grund}
        </div>

        <p className="mt-5 text-xs text-chrome-500">
          Als Inhaber kannst du unten einen Tarif wählen und das Abo direkt reaktivieren.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            className="btn-primary w-full"
            onClick={() => (window.location.href = appPath('/abo/'))}
          >
            Tarif wählen & bezahlen
          </button>
          <button className="btn-ghost w-full" onClick={pruefen} disabled={checking}>
            {checking ? 'Pruefe…' : 'Erneut pruefen'}
          </button>
          <button className="btn-ghost w-full" onClick={abmelden}>
            Abmelden
          </button>
        </div>
      </div>
    </div>
  );
}
