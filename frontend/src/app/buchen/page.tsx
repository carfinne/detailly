'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, appPath } from '@/lib/api';

interface Leistung {
  id: string;
  name: string;
  beschreibung: string | null;
  kategorie: string;
  basispreis: number;
  einheit: string;
}
interface Betrieb {
  name: string;
  phone: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  logoUrl: string | null;
  businessHours: Record<string, unknown> | null;
}
interface BetriebResponse {
  betrieb: Betrieb;
  leistungen: Leistung[];
}

// Slug aus ?b=... lesen (statischer Export -> keine dynamische [slug]-Route).
function readSlug(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('b')?.trim() ?? '';
}

export default function BuchenPage() {
  const [slug, setSlug] = useState('');
  const [data, setData] = useState<BetriebResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  // Formular
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceItemId, setServiceItemId] = useState('');
  const [fahrzeug, setFahrzeug] = useState('');
  const [wunschtermin, setWunschtermin] = useState('');
  const [nachricht, setNachricht] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot – bleibt leer

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [reference, setReference] = useState('');

  useEffect(() => {
    const s = readSlug();
    setSlug(s);
    if (!s) {
      setLoading(false);
      setLoadError('Kein Betrieb angegeben. Bitte den vollständigen Buchungslink verwenden.');
      return;
    }
    api
      .get<BetriebResponse>(`/public/booking/${encodeURIComponent(s)}`)
      .then((res) => setData(res))
      .catch((e) => {
        setLoadError(
          e instanceof ApiError && e.status === 404
            ? 'Dieser Betrieb wurde nicht gefunden.'
            : 'Die Seite konnte nicht geladen werden. Bitte später erneut versuchen.',
        );
      })
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) {
      setFormError('Bitte einen Namen angeben.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setFormError('Bitte mindestens E-Mail oder Telefonnummer angeben.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ reference: string }>(
        `/public/booking/${encodeURIComponent(slug)}`,
        {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          serviceItemId: serviceItemId || undefined,
          fahrzeug: fahrzeug.trim() || undefined,
          // datetime-local -> volles ISO (vom Backend per IsDateString akzeptiert).
          wunschtermin: wunschtermin ? new Date(wunschtermin).toISOString() : undefined,
          nachricht: nachricht.trim() || undefined,
          website: website || undefined, // Honeypot
        },
      );
      setReference(res.reference);
    } catch (err) {
      setFormError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Die Anfrage konnte nicht gesendet werden.',
      );
    } finally {
      setSubmitting(false);
    }
  }

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
        ) : loadError ? (
          <div className="card text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-ink-700 bg-ink-850 text-chrome-500">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
            </div>
            <p className="text-sm text-chrome-300">{loadError}</p>
          </div>
        ) : reference ? (
          <div className="card text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-copper-grad text-ink-950 shadow-glow">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Anfrage gesendet</h1>
            <p className="mt-2 text-sm text-chrome-400">
              Vielen Dank! {data?.betrieb.name} meldet sich bei Ihnen, um den Termin zu bestätigen.
            </p>
            <p className="mt-4 inline-block rounded-xl border border-ink-700 bg-ink-850 px-4 py-2 text-sm text-chrome-300">
              Ihre Referenz: <span className="font-mono font-semibold text-copper-200">{reference}</span>
            </p>
            <div className="mt-5">
              <a
                href={`${appPath('/status/')}?ref=${encodeURIComponent(reference)}`}
                className="btn-ghost inline-flex"
              >
                Status verfolgen
              </a>
              <p className="mt-2 text-xs text-chrome-600">
                Mit dieser Referenz können Sie den Stand Ihrer Anfrage jederzeit abrufen.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-7 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-copper-300">Online-Terminanfrage</p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{data?.betrieb.name}</h1>
              {(data?.betrieb.city || data?.betrieb.phone) && (
                <p className="mt-2 text-sm text-chrome-400">
                  {[data?.betrieb.postalCode, data?.betrieb.city].filter(Boolean).join(' ')}
                  {data?.betrieb.phone ? ` · ${data.betrieb.phone}` : ''}
                </p>
              )}
            </div>

            <form onSubmit={onSubmit} className="card space-y-4">
              <div className="field">
                <label className="label" htmlFor="name">Name</label>
                <input id="name" type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" required />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="field">
                  <label className="label" htmlFor="email">E-Mail</label>
                  <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={150} autoComplete="email" />
                </div>
                <div className="field">
                  <label className="label" htmlFor="phone">Telefon</label>
                  <input id="phone" type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} autoComplete="tel" />
                </div>
              </div>
              <p className="-mt-1 text-xs text-chrome-600">Bitte mindestens E-Mail oder Telefon angeben.</p>

              {data && data.leistungen.length > 0 && (
                <div className="field">
                  <label className="label" htmlFor="leistung">Leistung <span className="text-chrome-600">(optional)</span></label>
                  <select id="leistung" className="input" value={serviceItemId} onChange={(e) => setServiceItemId(e.target.value)}>
                    <option value="">— bitte wählen —</option>
                    {data.leistungen.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="fahrzeug">Fahrzeug <span className="text-chrome-600">(optional)</span></label>
                <input id="fahrzeug" type="text" className="input" value={fahrzeug} onChange={(e) => setFahrzeug(e.target.value)} maxLength={200} placeholder="z. B. VW Golf 7, schwarz" />
              </div>

              <div className="field">
                <label className="label" htmlFor="wunschtermin">Wunschtermin <span className="text-chrome-600">(optional)</span></label>
                <input id="wunschtermin" type="datetime-local" className="input" value={wunschtermin} onChange={(e) => setWunschtermin(e.target.value)} />
              </div>

              <div className="field">
                <label className="label" htmlFor="nachricht">Nachricht <span className="text-chrome-600">(optional)</span></label>
                <textarea id="nachricht" className="input min-h-[90px] resize-y" value={nachricht} onChange={(e) => setNachricht(e.target.value)} maxLength={1000} placeholder="Was sollen wir wissen?" />
              </div>

              {/* Honeypot: fuer Menschen unsichtbar, nur Bots fuellen es aus. */}
              <div aria-hidden="true" className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden" style={{ opacity: 0 }}>
                <label htmlFor="website">Website (bitte leer lassen)</label>
                <input id="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>

              {formError && (
                <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v4m0 4h.01" />
                  </svg>
                  {formError}
                </div>
              )}

              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/40 border-t-ink-950" />
                    Wird gesendet…
                  </>
                ) : (
                  'Anfrage senden'
                )}
              </button>

              <p className="text-center text-xs leading-relaxed text-chrome-600">
                Mit dem Absenden übermitteln Sie Ihre Angaben zur Terminanbahnung an {data?.betrieb.name}.
              </p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
