'use client';

// Oeffentliche Uebergabe-Mappe (Pro-Feature "Kunden-Erlebnis"). Kein Login: der
// Zugang ist dasselbe geheime Token wie beim Ticker (?t=...). Statischer Export
// -> Token clientseitig aus window.location. Zeigt eine gebrandete Ergebnis-
// Zusammenfassung (Leistungen, Pflege, Garantie) + Verweis auf das PDF.
//
// Welle 2-C: zusaetzlich die NACHHER-Fotos ("so sieht mein Auto jetzt aus") ueber
// den token-scoped, login-freien Bild-Endpunkt (no-store), optional als Vorher/
// Nachher-Vergleich, plus ein dezenter, privater Feedback-Block.

import { useEffect, useState } from 'react';
import { api, ApiError, absoluteApiUrl } from '@/lib/api';
import { PublicShell } from '@/components/PublicShell';
import { LoadingCard } from '@/components/ui';
import { useT } from '@/lib/i18n';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';

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
  fotosNachher: string[];
  fotosVorher: string[];
  bewertungslink: string | null;
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
  const t = useT();
  const [data, setData] = useState<Mappe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const tk = readToken();
    setToken(tk);
    if (!tk) {
      setLoading(false);
      setError('Keine Mappe angegeben. Bitte den vollständigen Link aus Ihrer Nachricht verwenden.');
      return;
    }
    api
      .get<Mappe>(`/public/orders/${encodeURIComponent(tk)}/mappe`)
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
  const hatVergleich = !!data && data.fotosVorher.length > 0 && data.fotosNachher.length > 0;

  return (
    <PublicShell width="lg" raster>
      {loading ? (
        <LoadingCard />
      ) : error ? (
        <div role="alert" className="card text-center">
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

          {/* Nachher-Fotos: der emotionale Moment ("so sieht mein Auto jetzt aus"). */}
          {data.fotosNachher.length > 0 && (
            <div className="card mb-4 space-y-4 animate-fade-in">
              <p
                className="text-xs font-semibold uppercase tracking-wide text-copper-300"
                style={brand ? { color: brand } : undefined}
              >
                {t('mappe.fotos.title')}
              </p>

              {hatVergleich && (
                <BeforeAfterSlider
                  before={
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={absoluteApiUrl(data.fotosVorher[0])} alt={t('mappe.fotos.before')} className="h-full w-full object-cover" loading="lazy" />
                  }
                  after={
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={absoluteApiUrl(data.fotosNachher[0])} alt={t('mappe.fotos.after')} className="h-full w-full object-cover" loading="lazy" />
                  }
                  beforeLabel={t('mappe.fotos.before')}
                  afterLabel={t('mappe.fotos.after')}
                  ariaLabel={t('mappe.fotos.sliderAria')}
                  handleLabel={t('mappe.fotos.sliderHandle')}
                />
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.fotosNachher.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={absoluteApiUrl(src)}
                    alt={t('mappe.fotos.alt', { n: i + 1 })}
                    loading="lazy"
                    className="aspect-square w-full rounded-xl border border-ink-700 bg-ink-850 object-cover"
                  />
                ))}
              </div>
            </div>
          )}

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

          {/* Feedback-Moment (privat an den Betrieb) */}
          <FeedbackBlock token={token} brand={brand} initialBewertungslink={data.bewertungslink} />

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

// ===========================================================================
// Feedback-Block – dezente Sterne-Bewertung + optionaler Freitext.
// ---------------------------------------------------------------------------
// Das Feedback geht PRIVAT an den Betrieb (erscheint in dessen App), es geht
// NICHTS automatisch nach aussen. WICHTIG (kein Review-Gating): ist ein
// oeffentlicher Bewertungs-Link hinterlegt, wird er NACH dem Absenden IMMER
// gezeigt – unabhaengig von der Sterne-Zahl (Google verbietet es, den Link nur
// Zufriedenen zu zeigen). Der einzige Unterschied ist die Betonung: bei einer
// positiven Rueckmeldung ist die oeffentliche Bewertung die prominente Einladung,
// sonst bleibt sie eine dezent angebotene Option.
// ===========================================================================
function FeedbackBlock({
  token,
  brand,
  initialBewertungslink,
}: {
  token: string;
  brand?: string;
  initialBewertungslink: string | null;
}) {
  const t = useT();
  const [sterne, setSterne] = useState(0);
  const [hover, setHover] = useState(0);
  const [kommentar, setKommentar] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [ergebnis, setErgebnis] = useState<{ positiv: boolean; bewertungslink: string | null }>({
    positiv: false,
    bewertungslink: initialBewertungslink,
  });

  async function submit() {
    if (sterne < 1 || status === 'submitting') return;
    setStatus('submitting');
    setError('');
    try {
      const res = await api.post<{ success: true; positiv: boolean; bewertungslink: string | null }>(
        `/public/orders/${encodeURIComponent(token)}/feedback`,
        { sterne, kommentar: kommentar.trim() || undefined },
      );
      setErgebnis({ positiv: res.positiv, bewertungslink: res.bewertungslink ?? initialBewertungslink });
      setStatus('done');
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 429
          ? t('mappe.feedback.rateLimited')
          : t('mappe.feedback.error'),
      );
      setStatus('error');
    }
  }

  if (status === 'done') {
    const link = ergebnis.bewertungslink;
    return (
      <div className="card mt-4 animate-fade-in text-center">
        <div
          className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-copper/40 bg-copper-soft text-copper"
          style={brand ? { color: brand, borderColor: `${brand}66`, backgroundColor: `${brand}1a` } : undefined}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <p className="text-base font-semibold text-chrome-50">{t('mappe.feedback.thanksTitle')}</p>
        <p className="mt-1 text-sm text-chrome-400">{t('mappe.feedback.thanksText')}</p>

        {link && (
          <div className="mt-4">
            {/* Betonung positiv vs. sonst – der Link selbst wird IMMER gezeigt. */}
            <p className="mb-2 text-sm text-chrome-300">
              {ergebnis.positiv ? t('mappe.feedback.publicPromptPositive') : t('mappe.feedback.publicPromptNeutral')}
            </p>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={
                ergebnis.positiv
                  ? 'inline-flex items-center gap-2 rounded-xl border border-copper/50 bg-copper-soft px-4 py-2.5 text-sm font-semibold text-copper transition-colors hover:border-copper'
                  : 'inline-flex items-center gap-2 text-sm font-medium text-chrome-400 underline decoration-chrome-600 underline-offset-4 transition-colors hover:text-chrome-200'
              }
              style={ergebnis.positiv && brand ? { color: brand, borderColor: `${brand}80`, backgroundColor: `${brand}1a` } : undefined}
            >
              {t('mappe.feedback.publicCta')}
              <svg viewBox="0 0 24 24" className="h-4 w-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7M8 7h9v9" />
              </svg>
            </a>
          </div>
        )}
      </div>
    );
  }

  const aktiv = hover || sterne;
  return (
    <div className="card mt-4">
      <p className="text-center text-base font-semibold text-chrome-50">{t('mappe.feedback.title')}</p>
      <p className="mt-1 text-center text-sm text-chrome-400">{t('mappe.feedback.subtitle')}</p>

      {/* Sterne-Auswahl */}
      <div className="mt-4 flex justify-center gap-1.5" role="radiogroup" aria-label={t('mappe.feedback.ratingAria')}>
        {[1, 2, 3, 4, 5].map((n) => {
          const gefuellt = n <= aktiv;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={sterne === n}
              aria-label={t('mappe.feedback.starAria', { n })}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(0)}
              onClick={() => setSterne(n)}
              className="rounded-lg p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-9 w-9 transition-colors ${gefuellt ? 'text-copper' : 'text-ink-600'}`}
                style={gefuellt && brand ? { color: brand } : undefined}
                fill={gefuellt ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
              </svg>
            </button>
          );
        })}
      </div>

      {/* Optionaler Freitext */}
      <textarea
        value={kommentar}
        onChange={(e) => setKommentar(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder={t('mappe.feedback.placeholder')}
        className="mt-4 w-full resize-y rounded-xl border border-ink-700 bg-ink-850 px-3.5 py-2.5 text-sm text-chrome-100 placeholder:text-chrome-600 focus:border-copper focus:outline-none focus:ring-1 focus:ring-copper"
      />

      {error && (
        <p role="alert" className="dl-error-in mt-3 text-center text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={sterne < 1 || status === 'submitting'}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-copper px-5 py-3 text-sm font-semibold text-ink-950 transition-colors hover:bg-copper-300 disabled:cursor-not-allowed disabled:opacity-50"
        style={brand && sterne >= 1 ? { backgroundColor: brand } : undefined}
      >
        {status === 'submitting' ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/40 border-t-ink-950" />
            {t('mappe.feedback.sending')}
          </>
        ) : (
          t('mappe.feedback.submit')
        )}
      </button>
    </div>
  );
}
