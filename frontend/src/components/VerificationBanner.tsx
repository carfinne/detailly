'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

/**
 * Hinweis-Banner fuer noch nicht bestaetigte E-Mail-Adressen (Double-Opt-in).
 * Erscheint nur, wenn der angemeldete Nutzer emailVerified === false hat.
 * Blockiert nichts – nur ein Nudge mit "Erneut senden".
 */
export function VerificationBanner() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  // emailVerified kann undefined sein (Altdaten/JWT ohne Feld) -> nur bei
  // explizitem false anzeigen, um keine falschen Banner zu erzeugen.
  if (!user || user.emailVerified !== false) return null;

  async function resend() {
    setStatus('sending');
    try {
      await api.post('/auth/verify-email/resend');
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-copper/30 bg-copper-soft px-4 py-3 text-sm">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-copper/15 text-copper">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16v16H4z" opacity="0" />
          <path d="M22 6 12 13 2 6M2 6h20v12H2z" />
        </svg>
      </span>
      <span className="text-chrome-200">
        Bitte bestätige deine E-Mail-Adresse{' '}
        <span className="text-chrome-400">({user.email})</span> – prüfe dein Postfach.
      </span>
      <div className="ml-auto flex items-center gap-2">
        {status === 'error' && <span className="text-danger">Fehlgeschlagen</span>}
        <button
          onClick={resend}
          disabled={status === 'sending' || status === 'sent'}
          className="btn-subtle btn-sm"
        >
          {status === 'sent' ? 'Gesendet ✓' : status === 'sending' ? 'Sende…' : 'Erneut senden'}
        </button>
      </div>
    </div>
  );
}
