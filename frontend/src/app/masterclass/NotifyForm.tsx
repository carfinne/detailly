'use client';

// Reines UI ohne Backend: "Benachrichtige mich"-Feld fuer die Masterclass.
// Beim Absenden wird NICHTS gesendet – es erscheint nur eine lokale Bestaetigung
// (klar als Beispiel markiert). Vor dem Launch an eine echte Anmeldung koppeln.

import { useState } from 'react';

export function NotifyForm() {
  const [email, setEmail] = useState('');
  const [gesendet, setGesendet] = useState(false);

  function absenden(e: React.FormEvent) {
    e.preventDefault();
    // Bewusst kein API-Call: nur lokale Bestaetigung.
    setGesendet(true);
  }

  if (gesendet) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-positive/30 bg-positive-soft px-4 py-3 text-sm text-positive">
        <svg
          viewBox="0 0 24 24"
          className="mt-0.5 h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <p className="leading-relaxed">
          Danke! Sobald die Masterclass startet, melden wir uns.{' '}
          <span className="text-chrome-400">(Beispiel-Formular – es wurde noch nichts gespeichert.)</span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={absenden} className="flex flex-col gap-3 sm:flex-row">
      <label className="sr-only" htmlFor="masterclass-email">
        E-Mail-Adresse
      </label>
      <input
        id="masterclass-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="deine@email.de"
        className="input sm:flex-1"
        autoComplete="email"
      />
      <button type="submit" className="btn-primary shrink-0 px-5">
        Benachrichtige mich
      </button>
    </form>
  );
}
