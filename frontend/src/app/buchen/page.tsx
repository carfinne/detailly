'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, appPath } from '@/lib/api';
import { PublicShell } from '@/components/PublicShell';
import { PublicLegalFooter } from '@/components/PublicLegalFooter';
import { LoadingCard } from '@/components/ui';

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
}
// Buchungs-Meta (W2): sagt, ob der Slot-Picker aktiv ist (Arbeitszeiten beim
// Betrieb gepflegt) und mit welchen Rahmenwerten. PII-frei.
interface BuchungMeta {
  slotModus: boolean;
  slotDauerMin: number;
  vorlaufMinStunden: number;
  vorlaufMaxTage: number;
}
interface BetriebResponse {
  betrieb: Betrieb;
  leistungen: Leistung[];
  // Optional: aeltere Backends liefern den Block nicht -> Freitext-Fallback.
  buchung?: BuchungMeta;
}
interface SlotsResponse {
  datum: string;
  slotDauerMin: number;
  slots: string[];
}

/** Lokales Datum als YYYY-MM-DD (fuer native date-Inputs, ohne UTC-Versatz). */
function isoDatumLokal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

  // Slot-Picker (W2): Datum + geladene freie Zeiten + gewaehlter Slot.
  const [slotDatum, setSlotDatum] = useState('');
  const [slotZeit, setSlotZeit] = useState('');
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');

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

  // Slot-Picker: freie Zeiten des gewaehlten Tages laden (W2). Bei Datumswechsel
  // wird die vorherige Auswahl verworfen; ein spaeter eintreffendes Ergebnis
  // eines alten Requests wird ignoriert (aktiv-Flag).
  const slotModusAktiv = !!data?.buchung?.slotModus;
  useEffect(() => {
    if (!slotModusAktiv || !slotDatum || !slug) return;
    let aktiv = true;
    setSlotsLoading(true);
    setSlotsError('');
    setSlots(null);
    setSlotZeit('');
    api
      .get<SlotsResponse>(
        `/public/booking/${encodeURIComponent(slug)}/slots?datum=${encodeURIComponent(slotDatum)}`,
      )
      .then((res) => {
        if (aktiv) setSlots(Array.isArray(res.slots) ? res.slots : []);
      })
      .catch(() => {
        if (aktiv) setSlotsError('Die freien Zeiten konnten nicht geladen werden. Bitte erneut versuchen.');
      })
      .finally(() => {
        if (aktiv) setSlotsLoading(false);
      });
    return () => {
      aktiv = false;
    };
  }, [slotModusAktiv, slotDatum, slug]);

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
      // Slot-Modus: Wunschtermin aus gewaehltem Datum + Slot (lokale Zeit);
      // Freitext-Modus: unveraendert aus dem datetime-local-Feld.
      const terminLokal = slotModusAktiv
        ? slotDatum && slotZeit
          ? `${slotDatum}T${slotZeit}`
          : ''
        : wunschtermin;
      const res = await api.post<{ reference: string }>(
        `/public/booking/${encodeURIComponent(slug)}`,
        {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          serviceItemId: serviceItemId || undefined,
          fahrzeug: fahrzeug.trim() || undefined,
          // datetime-local -> volles ISO (vom Backend per IsDateString akzeptiert).
          wunschtermin: terminLokal ? new Date(terminLokal).toISOString() : undefined,
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
    <PublicShell width="lg" raster>
        {loading ? (
          <LoadingCard />
        ) : loadError ? (
          <div role="alert" className="card text-center">
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
              <p className="mt-2 text-xs text-chrome-400">
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
              <p className="-mt-1 text-xs text-chrome-400">Bitte mindestens E-Mail oder Telefon angeben.</p>

              {data && data.leistungen.length > 0 && (
                <div className="field">
                  <label className="label" htmlFor="leistung">Leistung <span className="text-chrome-400">(optional)</span></label>
                  <select id="leistung" className="input" value={serviceItemId} onChange={(e) => setServiceItemId(e.target.value)}>
                    <option value="">— bitte wählen —</option>
                    {data.leistungen.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="fahrzeug">Fahrzeug <span className="text-chrome-400">(optional)</span></label>
                <input id="fahrzeug" type="text" className="input" value={fahrzeug} onChange={(e) => setFahrzeug(e.target.value)} maxLength={200} placeholder="z. B. VW Golf 7, schwarz" />
              </div>

              {slotModusAktiv ? (
                <div className="field">
                  <label className="label" htmlFor="slot-datum">Wunschtermin <span className="text-chrome-400">(optional)</span></label>
                  <input
                    id="slot-datum"
                    type="date"
                    className="input"
                    value={slotDatum}
                    min={isoDatumLokal(new Date(Date.now() + Math.floor((data?.buchung?.vorlaufMinStunden ?? 0) / 24) * 86400000))}
                    max={isoDatumLokal(new Date(Date.now() + (data?.buchung?.vorlaufMaxTage ?? 60) * 86400000))}
                    onChange={(e) => setSlotDatum(e.target.value)}
                  />
                  {slotDatum && (
                    <div className="mt-3">
                      {slotsLoading ? (
                        // Animierter Ladezustand: pulsierendes Slot-Raster.
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden="true">
                          {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-10 animate-pulse rounded-xl border border-ink-700/60 bg-ink-800/60" />
                          ))}
                        </div>
                      ) : slotsError ? (
                        <p role="status" className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">{slotsError}</p>
                      ) : slots && slots.length > 0 ? (
                        <>
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="listbox" aria-label="Freie Uhrzeiten">
                            {slots.map((s) => (
                              <button
                                key={s}
                                type="button"
                                role="option"
                                aria-selected={slotZeit === s}
                                onClick={() => setSlotZeit(s)}
                                className={`choice px-2 py-2.5 text-center text-sm font-medium tabular-nums ${slotZeit === s ? 'choice-active' : ''}`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                          {slotZeit && (
                            <p className="mt-2 text-xs text-chrome-400">
                              Gewählt: {new Date(`${slotDatum}T${slotZeit}`).toLocaleString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}, {slotZeit} Uhr
                            </p>
                          )}
                        </>
                      ) : slots ? (
                        <p className="rounded-xl border border-ink-700 bg-ink-850 px-3 py-2.5 text-sm text-chrome-400">
                          Keine freien Zeiten an diesem Tag — bitte ein anderes Datum wählen.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : (
                <div className="field">
                  <label className="label" htmlFor="wunschtermin">Wunschtermin <span className="text-chrome-400">(optional)</span></label>
                  <input id="wunschtermin" type="datetime-local" className="input" value={wunschtermin} onChange={(e) => setWunschtermin(e.target.value)} />
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="nachricht">Nachricht <span className="text-chrome-400">(optional)</span></label>
                <textarea id="nachricht" className="input min-h-[90px] resize-y" value={nachricht} onChange={(e) => setNachricht(e.target.value)} maxLength={1000} placeholder="Was sollen wir wissen?" />
              </div>

              {/* Honeypot: fuer Menschen unsichtbar, nur Bots fuellen es aus. */}
              <div aria-hidden="true" className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden" style={{ opacity: 0 }}>
                <label htmlFor="website">Website (bitte leer lassen)</label>
                <input id="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>

              {formError && (
                <div role="alert" className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
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
                    <span className="spinner" />
                    Wird gesendet…
                  </>
                ) : (
                  'Anfrage senden'
                )}
              </button>

              <p className="text-center text-xs leading-relaxed text-chrome-400">
                Mit dem Absenden übermitteln Sie Ihre Angaben zur Terminanbahnung an {data?.betrieb.name}.
              </p>
            </form>
          </>
        )}
        <PublicLegalFooter slug={slug} />
    </PublicShell>
  );
}
