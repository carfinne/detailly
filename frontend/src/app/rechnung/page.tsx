'use client';

// Oeffentliche Beleg-Download-Seite. Kein Login: der Zugang ist das geheime Token
// in der URL (?t=...). Statischer Export -> Token clientseitig aus window.location.
// Zeigt Eckdaten + Download-Button (oeffentlicher PDF-Endpoint).

import { useEffect, useState } from 'react';
import { api, ApiError, absoluteApiUrl } from '@/lib/api';
import { eur, datum } from '@/lib/format';

interface Meta {
  betrieb: string;
  nummer: string;
  art: string;
  status: string;
  brutto: number;
  datum: string | null;
}

function readToken(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('t')?.trim() ?? '';
}

export default function RechnungDownloadPage() {
  const [token, setToken] = useState('');
  const [data, setData] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = readToken();
    setToken(t);
    if (!t) {
      setLoading(false);
      setError('Kein Beleg angegeben. Bitte den vollständigen Link aus Ihrer Nachricht verwenden.');
      return;
    }
    api
      .get<Meta>(`/public/invoices/${encodeURIComponent(t)}`)
      .then(setData)
      .catch((e) =>
        setError(
          e instanceof ApiError && e.status === 404
            ? 'Dieser Beleg wurde nicht gefunden. Möglicherweise ist der Link veraltet.'
            : 'Die Seite konnte nicht geladen werden. Bitte später erneut versuchen.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const istAngebot = data?.art === 'angebot';
  const titel = istAngebot ? 'Angebot' : 'Rechnung';
  const pdfUrl = token ? absoluteApiUrl(`/public/invoices/${encodeURIComponent(token)}/pdf`) : '';

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-900 p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-copper-glow blur-[120px]" />
        <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-info/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {loading ? (
          <div className="card text-center text-chrome-400">Lädt…</div>
        ) : error ? (
          <div className="card text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-ink-700 bg-ink-850 text-chrome-500">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
            </div>
            <p className="text-sm text-chrome-300">{error}</p>
          </div>
        ) : data ? (
          <>
            <div className="mb-7 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-copper-300">{titel} zum Download</p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{data.betrieb}</h1>
            </div>

            <div className="card space-y-5 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-copper-grad text-ink-950 shadow-glow">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h12v18l-3-1.6L12 21l-3-1.6L6 21z" />
                  <path d="M9 8h6M9 12h6" />
                </svg>
              </div>

              <div>
                <p className="font-mono text-lg font-semibold text-chrome-50">{data.nummer || titel}</p>
                <p className="mt-1 text-sm text-chrome-400">
                  {data.datum ? `vom ${datum(data.datum)} · ` : ''}{eur(data.brutto)}
                  {!istAngebot && data.status === 'bezahlt' && ' · bezahlt'}
                </p>
              </div>

              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-primary w-full justify-center">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
                </svg>
                PDF herunterladen
              </a>
            </div>

            <p className="mt-4 text-center text-xs text-chrome-600">{data.betrieb} · Detailly</p>
          </>
        ) : null}
      </div>
    </main>
  );
}
