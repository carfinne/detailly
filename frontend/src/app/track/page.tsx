'use client';

// Oeffentliche Auftrags-Verfolgung ("Wo ist mein Auto?"). Kein Login: der Zugang
// ist das geheime Token in der URL (?t=...). Statischer Export -> Token wird
// clientseitig aus window.location gelesen (keine dynamische Route, kein Suspense).

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface Tracking {
  betrieb: string;
  auftragsnummer: string;
  serviceType: string;
  status: string;
  fahrzeug: string | null;
  kennzeichen: string | null;
  geplanterStart: string | null;
  geplantesEnde: string | null;
  aktualisiertAm: string;
}

const SERVICE_LABEL: Record<string, string> = {
  aufbereitung: 'Aufbereitung',
  folierung: 'Folierung',
  ppf: 'Lackschutz (PPF)',
  sonstiges: 'Service',
};

// Kundenfreundliche Phasen (fasst den internen Workflow zusammen).
const PHASES: { label: string; matches: string[] }[] = [
  { label: 'Anfrage erhalten', matches: ['angefragt', 'kalkuliert'] },
  { label: 'Termin bestätigt', matches: ['bestaetigt'] },
  { label: 'In Arbeit', matches: ['in_arbeit'] },
  { label: 'Qualitätskontrolle', matches: ['qualitaetskontrolle'] },
  { label: 'Fertig – abholbereit', matches: ['fertig', 'abgerechnet'] },
];

function phaseIndex(status: string): number {
  const i = PHASES.findIndex((p) => p.matches.includes(status));
  return i < 0 ? 0 : i;
}

function readToken(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('t')?.trim() ?? '';
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

export default function TrackPage() {
  const [data, setData] = useState<Tracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = readToken();
    if (!token) {
      setLoading(false);
      setError('Kein Auftrag angegeben. Bitte den vollständigen Link aus Ihrer Nachricht verwenden.');
      return;
    }
    api
      .get<Tracking>(`/public/orders/${encodeURIComponent(token)}`)
      .then(setData)
      .catch((e) =>
        setError(
          e instanceof ApiError && e.status === 404
            ? 'Dieser Auftrag wurde nicht gefunden. Möglicherweise ist der Link veraltet.'
            : 'Die Seite konnte nicht geladen werden. Bitte später erneut versuchen.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const storniert = data?.status === 'storniert';
  const fertig = data?.status === 'fertig' || data?.status === 'abgerechnet';
  const aktuell = data ? phaseIndex(data.status) : 0;

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

      <div className="relative z-10 w-full max-w-lg animate-fade-in">
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
              <p className="text-xs font-medium uppercase tracking-wider text-copper-300">Auftrags-Status</p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{data.betrieb}</h1>
              <p className="mt-2 text-sm text-chrome-400">
                Auftrag <span className="font-mono text-chrome-200">{data.auftragsnummer}</span>
              </p>
            </div>

            <div className="card space-y-6">
              {/* Fahrzeug + Leistung */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/70 pb-4">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-chrome-50">{data.fahrzeug ?? 'Ihr Fahrzeug'}</p>
                  <p className="text-sm text-chrome-400">{SERVICE_LABEL[data.serviceType] ?? 'Service'}</p>
                </div>
                {data.kennzeichen && (
                  <span className="rounded-lg border border-ink-600 bg-ink-850 px-3 py-1 font-mono text-sm tracking-wide text-chrome-100">
                    {data.kennzeichen}
                  </span>
                )}
              </div>

              {storniert ? (
                <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-center text-sm text-danger">
                  Dieser Auftrag wurde storniert. Bei Fragen wenden Sie sich bitte an {data.betrieb}.
                </div>
              ) : (
                /* Phasen-Timeline */
                <ol className="space-y-0">
                  {PHASES.map((p, i) => {
                    const done = i < aktuell || (fertig && i <= aktuell);
                    const active = i === aktuell && !fertig;
                    const last = i === PHASES.length - 1;
                    return (
                      <li key={p.label} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ring-1 transition-colors ${
                              done
                                ? 'bg-copper text-ink-950 ring-copper'
                                : active
                                  ? 'bg-copper-soft text-copper ring-copper/40'
                                  : 'bg-ink-850 text-chrome-600 ring-ink-600'
                            }`}
                          >
                            {done ? (
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            ) : (
                              i + 1
                            )}
                          </span>
                          {!last && <span className={`my-1 w-px flex-1 ${done ? 'bg-copper/50' : 'bg-ink-600'}`} />}
                        </div>
                        <div className={last ? 'pb-0' : 'pb-6'}>
                          <p className={`text-sm font-medium ${done || active ? 'text-chrome-50' : 'text-chrome-500'}`}>
                            {p.label}
                          </p>
                          {active && <p className="mt-0.5 text-xs text-copper-300">Aktueller Stand</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              {/* Eckdaten */}
              <dl className="grid grid-cols-2 gap-3 border-t border-ink-700/70 pt-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-chrome-600">Geplanter Start</dt>
                  <dd className="mt-0.5 text-chrome-200">{fmt(data.geplanterStart, true)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-chrome-600">Voraussichtlich fertig</dt>
                  <dd className="mt-0.5 text-chrome-200">{fmt(data.geplantesEnde, true)}</dd>
                </div>
              </dl>
            </div>

            <p className="mt-4 text-center text-xs text-chrome-600">
              Zuletzt aktualisiert am {fmt(data.aktualisiertAm, true)} · {data.betrieb}
            </p>
          </>
        ) : null}
      </div>
    </main>
  );
}
