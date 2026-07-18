'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, appPath } from '@/lib/api';
import { PublicShell } from '@/components/PublicShell';
import { PublicLegalFooter } from '@/components/PublicLegalFooter';
import { LoadingCard } from '@/components/ui';
import { useT } from '@/lib/i18n';
import {
  baueMusterWiderrufsformular,
  baueWiderrufsbelehrung,
  istInnerhalbWiderrufsfrist,
  type WiderrufBetrieb,
} from './widerruf';

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
// Buchungs-Meta (W2): Slot-Picker + rechtlicher Abschluss-Modus. PII-frei.
interface BuchungMeta {
  slotModus: boolean;
  slotDauerMin: number;
  vorlaufMinStunden: number;
  vorlaufMaxTage: number;
  modus: 'anfrage' | 'verbindlich';
}
interface BetriebResponse {
  betrieb: Betrieb;
  leistungen: Leistung[];
  buchung?: BuchungMeta;
}
interface SlotsResponse {
  datum: string;
  slotDauerMin: number;
  slots: string[];
}
// Oeffentliche Impressum-Ausgabe des Betriebs (§ 5 DDG) – Vertragspartner-Identitaet.
interface ImpressumAusgabe {
  firmenname: string;
  rechtsformLabel: string;
  anschrift: { strasse: string; plzOrt: string; land: string };
  vertretungLabel: string;
  vertretungsberechtigte: string;
  telefon: string;
  email: string;
  registergericht: string;
  registernummer: string;
  ustId: string;
  berufshaftpflicht: string;
  aufsichtsbehoerde: string;
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

/** Preis-Pflichtinfo (Art. 246a EGBGB): Gesamtpreis ODER Berechnungsgrundlage. */
function preisInfo(l: Leistung | undefined, verbindlich: boolean): string {
  if (!l) {
    return verbindlich
      ? 'Gesamtpreis: nach Begutachtung des Fahrzeugs / individueller Absprache.'
      : 'Preis: nach Begutachtung / individueller Absprache.';
  }
  const betrag = `${Number(l.basispreis).toFixed(2).replace('.', ',')} €`;
  if (l.einheit === 'qm') return `Berechnungsgrundlage: ${betrag} pro m² – Gesamtpreis nach Aufmaß/Begutachtung.`;
  if (l.einheit === 'stunde') return `Berechnungsgrundlage: ${betrag} pro Stunde – Gesamtpreis nach Aufwand.`;
  // Pauschale: im verbindlichen Modus verbindlicher Gesamtpreis (Art. 246a §1
  // Nr. 4), im anfrage-Modus Richtwert. Muss zur Backend-preisInfoZeile passen.
  if (verbindlich) return `Gesamtpreis: ${betrag}`;
  return `Preis (Richtwert): ${betrag} – verbindlicher Endpreis nach Begutachtung.`;
}

export default function BuchenPage() {
  const t = useT();
  const [slug, setSlug] = useState('');
  const [data, setData] = useState<BetriebResponse | null>(null);
  const [impressum, setImpressum] = useState<ImpressumAusgabe | null>(null);
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

  // Verbraucherrechtliche Zustimmungen (nur Modus `verbindlich` relevant).
  const [pflichtinfoBestaetigt, setPflichtinfoBestaetigt] = useState(false);
  const [vorzeitigOk, setVorzeitigOk] = useState(false);
  const [datenschutzOk, setDatenschutzOk] = useState(false);

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
    // Impressum (Vertragspartner-Identitaet) best effort – Fehler blendet den
    // Anbieter-Block nur aus, die Buchungsseite bleibt nutzbar.
    api
      .get<ImpressumAusgabe>(`/public/booking/${encodeURIComponent(s)}/impressum`)
      .then((res) => setImpressum(res))
      .catch(() => setImpressum(null));
  }, []);

  const slotModusAktiv = !!data?.buchung?.slotModus;
  const modus = data?.buchung?.modus ?? 'anfrage';
  const verbindlich = modus === 'verbindlich';

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

  // Gewaehlte Leistung + gewaehlter Termin (ISO-lokal) fuer Pflichtinfos/§356.
  const gewaehlteLeistung = useMemo(
    () => data?.leistungen.find((l) => l.id === serviceItemId),
    [data, serviceItemId],
  );
  const terminLokal = slotModusAktiv
    ? slotDatum && slotZeit
      ? `${slotDatum}T${slotZeit}`
      : ''
    : wunschtermin;
  const terminDate = terminLokal ? new Date(terminLokal) : null;
  const terminInnerhalbFrist = verbindlich && istInnerhalbWiderrufsfrist(terminDate);

  // Vertragspartner-Kontakt fuer die Widerrufsbelehrung/das Muster-Formular.
  const widerrufBetrieb: WiderrufBetrieb = {
    name: impressum?.firmenname || data?.betrieb.name || '',
    strasse: impressum?.anschrift.strasse || data?.betrieb.street || '',
    plzOrt:
      impressum?.anschrift.plzOrt ||
      [data?.betrieb.postalCode, data?.betrieb.city].filter(Boolean).join(' '),
    land: impressum?.anschrift.land || '',
    telefon: impressum?.telefon || data?.betrieb.phone || '',
    email: impressum?.email || '',
  };

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
    if (verbindlich && !email.trim()) {
      setFormError(t('buchen.recht.verbindlich.emailRequired'));
      return;
    }
    if (verbindlich && !serviceItemId) {
      setFormError(t('buchen.recht.verbindlich.leistungRequired'));
      return;
    }
    if (verbindlich && !pflichtinfoBestaetigt) {
      setFormError(t('buchen.recht.pflichtinfo.checkboxError'));
      return;
    }
    if (terminInnerhalbFrist && !vorzeitigOk) {
      setFormError(t('buchen.recht.vorzeitig.error'));
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
          wunschtermin: terminLokal ? new Date(terminLokal).toISOString() : undefined,
          nachricht: nachricht.trim() || undefined,
          website: website || undefined, // Honeypot
          // Verbraucherrechtliche Zustimmungen – serverseitig gegen den Modus geprueft.
          pflichtinfoBestaetigt: verbindlich ? pflichtinfoBestaetigt : undefined,
          vorzeitigerLeistungsbeginn: terminInnerhalbFrist ? vorzeitigOk : undefined,
          datenschutzHinweis: datenschutzOk || undefined,
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
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {verbindlich ? t('buchen.recht.success.verbindlich.title') : t('buchen.recht.success.anfrage.title')}
          </h1>
          <p className="mt-2 text-sm text-chrome-400">
            {verbindlich
              ? t('buchen.recht.success.verbindlich.text', { betrieb: data?.betrieb.name ?? '' })
              : t('buchen.recht.success.anfrage.text', { betrieb: data?.betrieb.name ?? '' })}
          </p>
          <p className="mt-4 inline-block rounded-xl border border-ink-700 bg-ink-850 px-4 py-2 text-sm text-chrome-300">
            {t('buchen.recht.success.reference')}{' '}
            <span className="font-mono font-semibold text-copper-200">{reference}</span>
          </p>
          <div className="mt-5">
            <a
              href={`${appPath('/status/')}?ref=${encodeURIComponent(reference)}`}
              className="btn-ghost inline-flex"
            >
              Status verfolgen
            </a>
            <p className="mt-2 text-xs text-chrome-400">
              Mit dieser Referenz können Sie den Stand Ihrer {verbindlich ? 'Buchung' : 'Anfrage'} jederzeit abrufen.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-7 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-copper-300">
              {verbindlich ? t('buchen.recht.badge.verbindlich') : t('buchen.recht.badge.anfrage')}
            </p>
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
                <label className="label" htmlFor="email">
                  E-Mail{verbindlich && <span className="text-copper-300"> *</span>}
                </label>
                <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={150} autoComplete="email" required={verbindlich} aria-required={verbindlich} />
              </div>
              <div className="field">
                <label className="label" htmlFor="phone">Telefon</label>
                <input id="phone" type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} autoComplete="tel" />
              </div>
            </div>
            <p className="-mt-1 text-xs text-chrome-400">
              {verbindlich
                ? t('buchen.recht.verbindlich.emailRequired')
                : 'Bitte mindestens E-Mail oder Telefon angeben.'}
            </p>

            {data && data.leistungen.length > 0 && (
              <div className="field">
                <label className="label" htmlFor="leistung">
                  Leistung{' '}
                  {verbindlich ? (
                    <span className="text-copper-300">*</span>
                  ) : (
                    <span className="text-chrome-400">(optional)</span>
                  )}
                </label>
                <select id="leistung" className="input" value={serviceItemId} onChange={(e) => setServiceItemId(e.target.value)} required={verbindlich} aria-required={verbindlich}>
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

            {/* --- Pflichtinformationen unmittelbar vor dem Abschluss (Art. 246a EGBGB) --- */}
            <div className="rounded-xl border border-ink-700 bg-ink-850/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-copper-300">
                {t('buchen.recht.pflichtinfo.title')}
              </p>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-chrome-400">{t('buchen.recht.pflichtinfo.leistung')}</dt>
                  <dd className="text-chrome-200">{gewaehlteLeistung?.name ?? t('buchen.recht.pflichtinfo.keineLeistung')}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-chrome-400">{t('buchen.recht.pflichtinfo.preis')}</dt>
                  <dd className="text-chrome-200">{preisInfo(gewaehlteLeistung, verbindlich)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-chrome-400">{t('buchen.recht.pflichtinfo.termin')}</dt>
                  <dd className="text-chrome-200">
                    {terminDate
                      ? terminDate.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr'
                      : t('buchen.recht.pflichtinfo.keinTermin')}
                  </dd>
                </div>
                {widerrufBetrieb.name && (
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-chrome-400">{t('buchen.recht.anbieter.title')}</dt>
                    <dd className="text-chrome-200">
                      {widerrufBetrieb.name}
                      {impressum?.rechtsformLabel ? ` · ${impressum.rechtsformLabel}` : ''}
                      {widerrufBetrieb.plzOrt ? `, ${widerrufBetrieb.plzOrt}` : ''}
                    </dd>
                  </div>
                )}
              </dl>
              <p className="mt-2 text-xs text-chrome-500">{t('buchen.recht.anbieter.hint')}</p>
            </div>

            {/* --- Widerrufsrecht (nur verbindlicher Modus) --- */}
            {verbindlich && (
              <div className="rounded-xl border border-ink-700 bg-ink-850/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-copper-300">
                  {t('buchen.recht.widerruf.title')}
                </p>
                <p className="mt-1 text-xs text-chrome-500">{t('buchen.recht.widerruf.deHint')}</p>
                <details className="group mt-2">
                  <summary className="cursor-pointer text-sm text-copper-200 hover:text-copper-100">
                    {t('buchen.recht.widerruf.belehrungLabel')}
                  </summary>
                  <div className="mt-2 space-y-2 text-xs leading-relaxed text-chrome-300" lang="de">
                    {baueWiderrufsbelehrung(widerrufBetrieb).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </details>
                <details className="group mt-2">
                  <summary className="cursor-pointer text-sm text-copper-200 hover:text-copper-100">
                    {t('buchen.recht.widerruf.formularLabel')}
                  </summary>
                  <div className="mt-2 space-y-1 text-xs leading-relaxed text-chrome-300" lang="de">
                    {baueMusterWiderrufsformular(widerrufBetrieb).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* --- Pflicht-Zustimmungen (nur verbindlicher Modus) --- */}
            {verbindlich && (
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-chrome-300">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0"
                  checked={pflichtinfoBestaetigt}
                  onChange={(e) => setPflichtinfoBestaetigt(e.target.checked)}
                />
                <span>{t('buchen.recht.pflichtinfo.checkbox')}</span>
              </label>
            )}
            {terminInnerhalbFrist && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-caution/30 bg-caution-soft/40 p-3 text-sm text-chrome-200">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0"
                  checked={vorzeitigOk}
                  onChange={(e) => setVorzeitigOk(e.target.checked)}
                />
                <span>{t('buchen.recht.vorzeitig.checkbox')}</span>
              </label>
            )}

            {/* --- Datenschutz-Kenntnisnahme (kein Zwang, Kopplungsverbot) --- */}
            <div className="space-y-2">
              <p className="text-xs leading-relaxed text-chrome-400">
                {verbindlich
                  ? t('buchen.recht.datenschutz.hintVerbindlich')
                  : t('buchen.recht.datenschutz.hintAnfrage')}{' '}
                <a href={appPath('/datenschutz/')} target="_blank" rel="noreferrer" className="link-muted underline">
                  {t('buchen.recht.datenschutz.link')}
                </a>
              </p>
              {/* Freiwillige Kenntnisnahme – bewusst NICHT vorangekreuzt und NICHT
                  erzwungen (Kopplungsverbot): setzt nur den Nachweis-Zeitstempel. */}
              <label className="flex cursor-pointer items-start gap-2.5 text-xs text-chrome-400">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0"
                  checked={datenschutzOk}
                  onChange={(e) => setDatenschutzOk(e.target.checked)}
                />
                <span>{t('buchen.recht.datenschutz.checkbox')}</span>
              </label>
            </div>

            {/* Klarer Modus-Hinweis unmittelbar vor dem Button. */}
            <p className="text-xs leading-relaxed text-chrome-400">
              {verbindlich ? t('buchen.recht.verbindlich.intro') : t('buchen.recht.anfrage.hinweis')}
            </p>

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
                  {verbindlich ? t('buchen.recht.verbindlich.submitting') : t('buchen.recht.anfrage.submitting')}
                </>
              ) : verbindlich ? (
                t('buchen.recht.verbindlich.button')
              ) : (
                t('buchen.recht.anfrage.button')
              )}
            </button>
          </form>
        </>
      )}
      <PublicLegalFooter slug={slug} />
    </PublicShell>
  );
}
