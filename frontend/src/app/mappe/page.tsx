'use client';

// Oeffentliche Uebergabe-Mappe (Pro-Feature "Kunden-Erlebnis"). Kein Login: der
// Zugang ist dasselbe geheime Token wie beim Ticker (?t=...). Statischer Export
// -> Token clientseitig aus window.location. Zeigt eine gebrandete Ergebnis-
// Zusammenfassung (Leistungen, Pflege, Garantie) + Verweis auf das PDF.

import { useEffect, useState } from 'react';
import { api, ApiError, absoluteApiUrl } from '@/lib/api';
import { PublicShell } from '@/components/PublicShell';
import { LoadingCard } from '@/components/ui';

interface Mappe {
  betrieb: {
    name: string;
    logo: string | null;
    akzent: string;
    telefon: string | null;
    email: string | null;
    ort: string | null;
  };
  auftragsnummer: string;
  datum: string | null;
  fahrzeug: string | null;
  kennzeichen: string | null;
  serviceLabel: string;
  leistungen: string[];
  details: Array<{ label: string; wert: string }>;
  pflege: string | null;
  nachherAnzahl: number;
}

function readToken(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('t')?.trim() ?? '';
}

function fmtDatum(v: string | null): string {
  if (!v) return '–';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function MappePage() {
  const [data, setData] = useState<Mappe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const t = readToken();
    setToken(t);
    if (!t) {
      setLoading(false);
      setError('Keine Mappe angegeben. Bitte den vollständigen Link aus Ihrer Nachricht verwenden.');
      return;
    }
    api
      .get<Mappe>(`/public/orders/${encodeURIComponent(t)}/mappe`)
      .then(setData)
      .catch((e) =>
        setError(
          e instanceof ApiError && e.status === 404
            ? 'Diese Mappe ist nicht verfügbar. Möglicherweise ist der Link veraltet oder der Auftrag noch nicht abgeschlossen.'
            : 'Die Seite konnte nicht geladen werden. Bitte später erneut versuchen.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const brand = data?.betrieb.akzent || undefined;
  const pdfHref = token ? absoluteApiUrl(`/public/orders/${encodeURIComponent(token)}/mappe.pdf`) : '#';

  return (
    <PublicShell width="lg" raster>
      {loading ? (
        <LoadingCard />
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
            {data.betrieb.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.betrieb.logo}
                alt={data.betrieb.name}
                className="mx-auto mb-4 h-12 w-auto max-w-[220px] object-contain"
              />
            )}
            <p
              className="text-xs font-medium uppercase tracking-wider text-copper-300"
              style={brand ? { color: brand } : undefined}
            >
              Übergabe-Mappe
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{data.betrieb.name}</h1>
            <p className="mt-2 text-sm text-chrome-400">
              Auftrag <span className="font-mono text-chrome-200">{data.auftragsnummer}</span>
              {data.datum && <> · {fmtDatum(data.datum)}</>}
            </p>
          </div>

          <div className="card space-y-6">
            {/* Fahrzeug + Leistung */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/70 pb-4">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-chrome-50">{data.fahrzeug ?? 'Ihr Fahrzeug'}</p>
                <p className="text-sm text-chrome-400">{data.serviceLabel}</p>
              </div>
              {data.kennzeichen && (
                <span className="rounded-lg border border-ink-600 bg-ink-850 px-3 py-1 font-mono text-sm tracking-wide text-chrome-100">
                  {data.kennzeichen}
                </span>
              )}
            </div>

            {/* Erbrachte Leistungen */}
            {(data.leistungen.length > 0 || data.details.length > 0) && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-chrome-500" style={brand ? { color: brand } : undefined}>
                  Erbrachte Leistung
                </p>
                {data.leistungen.length > 0 && (
                  <ul className="space-y-1.5">
                    {data.leistungen.map((l, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-chrome-100">
                        <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-copper" style={brand ? { color: brand } : undefined} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        {l}
                      </li>
                    ))}
                  </ul>
                )}
                {data.details.length > 0 && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {data.details.map((d, i) => (
                      <div key={i} className="min-w-0">
                        <dt className="text-xs uppercase tracking-wide text-chrome-600">{d.label}</dt>
                        <dd className="mt-0.5 truncate text-chrome-100">{d.wert}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}

            {/* Pflegehinweise */}
            {data.pflege && (
              <div className="rounded-xl border border-ink-700/70 bg-ink-850/60 px-4 py-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-chrome-500" style={brand ? { color: brand } : undefined}>
                  Pflegehinweise
                </p>
                <p className="whitespace-pre-line text-sm text-chrome-200">{data.pflege}</p>
              </div>
            )}

            {/* PDF-CTA */}
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-3 rounded-2xl border border-copper/40 bg-copper-soft px-5 py-4 transition-colors hover:border-copper"
              style={brand ? { borderColor: `${brand}66`, backgroundColor: `${brand}1a` } : undefined}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-chrome-50">Übergabe-Mappe als PDF</span>
                <span className="block text-xs text-chrome-400">Zum Speichern oder Ausdrucken öffnen</span>
              </span>
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-copper" style={brand ? { color: brand } : undefined} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
              </svg>
            </a>
          </div>

          {/* Betriebs-Kontakt */}
          <p className="mt-4 text-center text-xs text-chrome-600">
            {data.betrieb.name}
            {data.betrieb.ort && <> · {data.betrieb.ort}</>}
            {data.betrieb.telefon && <> · {data.betrieb.telefon}</>}
          </p>
        </>
      ) : null}
    </PublicShell>
  );
}
