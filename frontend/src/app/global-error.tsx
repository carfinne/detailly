'use client';

// Next.js GLOBAL-Fehler-Boundary: greift, wenn selbst das Root-Layout beim
// Rendern scheitert. Sie ERSETZT das Root-Layout komplett -> muss eigenes
// <html>/<body> mitbringen und steht AUSSERHALB von LanguageProvider/
// AuthProvider. Daher bewusst SELBSTGENUEGSAM: kein useT (i18n nicht verfuegbar),
// kein App-Import ausser dem globalen Stylesheet, Text zweisprachig (DE/EN).
// Letzte Verteidigungslinie gegen den weissen Screen im Pilot.

import './globals.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body
        className="min-h-screen font-sans"
        style={{ backgroundColor: '#0B0D11', color: '#E7ECF3' }}
      >
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
          <div className="animate-fade-in w-full max-w-md text-center">
            {/* Markenkachel (inline, damit die Boundary von keinem App-Modul abhaengt). */}
            <span
              className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg,#C6803B,#E0A15E)', color: '#0B0D11' }}
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
                <path d="M5 11h14a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1M5 11a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h1" />
              </svg>
            </span>

            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'inherit' }}>
              Etwas ist schiefgelaufen
            </h1>
            <p className="mt-1 text-sm" style={{ color: '#9FB0C3' }}>
              Something went wrong
            </p>

            <p className="mx-auto mt-4 max-w-sm text-sm" style={{ color: '#B8C4D2' }}>
              Ein unerwarteter Fehler ist aufgetreten. Bitte lade die Seite neu.
              <br />
              <span style={{ color: '#8595A6' }}>
                An unexpected error occurred. Please reload the page.
              </span>
            </p>

            {error?.digest && (
              <p className="mt-3 font-mono text-xs" style={{ color: '#6B7A8C' }}>
                Ref: {error.digest}
              </p>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-xl px-4 py-2 text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg,#C6803B,#E0A15E)', color: '#0B0D11' }}
              >
                Erneut versuchen · Try again
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') window.location.href = '/';
                }}
                className="rounded-xl px-4 py-2 text-sm font-medium"
                style={{ border: '1px solid #2A323C', color: '#B8C4D2' }}
              >
                Zur Startseite · Home
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
