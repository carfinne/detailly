'use client';

// Oeffentliche Status-Seite einer Online-Terminanfrage. Kein Login: der Zugang
// ist die Referenz aus der Bestaetigung (?ref=AF-...). Statischer Export ->
// Referenz clientseitig aus window.location gelesen.

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface Status {
  betrieb: string;
  status: string;
  leistung: string | null;
  wunschtermin: string | null;
  eingegangenAm: string;
}

// Anzeige je Bearbeitungsstand (Farbe + Titel + Erklaerung).
const META: Record<string, { ring: string; dot: string; titel: string; text: string }> = {
  neu: {
    ring: 'bg-copper-soft text-copper-200 ring-copper/30',
    dot: 'bg-copper',
    titel: 'Anfrage eingegangen',
    text: 'Ihre Anfrage liegt vor. Der Betrieb meldet sich, um den Termin abzustimmen.',
  },
  angenommen: {
    ring: 'bg-positive-soft text-positive ring-positive/30',
    dot: 'bg-positive',
    titel: 'Anfrage angenommen',
    text: 'Ihr Termin wurde angenommen. Der Betrieb bestätigt die Einzelheiten mit Ihnen.',
  },
  abgelehnt: {
    ring: 'bg-ink-700/50 text-chrome-300 ring-ink-600',
    dot: 'bg-chrome-500',
    titel: 'Anfrage abgelehnt',
    text: 'Der gewünschte Termin kann leider nicht angeboten werden. Bei Fragen wenden Sie sich an den Betrieb.',
  },
};

function readRef(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('ref')?.trim() ?? '';
}

function fmt(v: string | null, withTime = false): string {
  if (!v) return '–';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export default function StatusPage() {
  const [ref, setRef] = useState('');
  const [data, setData] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const r = readRef();
    setRef(r);
    if (!r) {
      setLoading(false);
      setError('Keine Referenz angegeben. Bitte den vollständigen Link aus Ihrer Bestätigung verwenden.');
      return;
    }
    api
      .get<Status>(`/public/booking/status/${encodeURIComponent(r)}`)
      .then(setData)
      .catch((e) =>
        setError(
          e instanceof ApiError && e.status === 404
            ? 'Zu dieser Referenz wurde keine Anfrage gefunden. Bitte prüfen Sie den Link.'
            : 'Die Seite konnte nicht geladen werden. Bitte später erneut versuchen.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const meta = data ? META[data.status] ?? META.neu : null;

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
        ) : data && meta ? (
          <>
            <div className="mb-7 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-copper-300">Ihre Terminanfrage</p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{data.betrieb}</h1>
              <p className="mt-2 text-sm text-chrome-400">
                Referenz <span className="font-mono text-chrome-200">{ref}</span>
              </p>
            </div>

            <div className="card space-y-5">
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ring-1 ${meta.ring}`}>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                <span className="font-semibold">{meta.titel}</span>
              </div>
              <p className="text-sm leading-relaxed text-chrome-300">{meta.text}</p>

              <dl className="grid grid-cols-2 gap-3 border-t border-ink-700/70 pt-4 text-sm">
                {data.leistung && (
                  <div className="col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-chrome-600">Leistung</dt>
                    <dd className="mt-0.5 text-chrome-200">{data.leistung}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs uppercase tracking-wide text-chrome-600">Wunschtermin</dt>
                  <dd className="mt-0.5 text-chrome-200">{fmt(data.wunschtermin, true)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-chrome-600">Eingegangen</dt>
                  <dd className="mt-0.5 text-chrome-200">{fmt(data.eingegangenAm)}</dd>
                </div>
              </dl>
            </div>

            <p className="mt-4 text-center text-xs text-chrome-600">{data.betrieb} · Detailly</p>
          </>
        ) : null}
      </div>
    </main>
  );
}
