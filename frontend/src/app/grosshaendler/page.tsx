'use client';

// Öffentliche Großhändler-Bewerbung (Marktplatz Welle 3). BEWUSST fest deutsch
// (Zielgruppe: deutsche B2B-Lieferanten; die öffentlichen Seiten sind nicht
// i18n-isiert). KEINE Selbst-Freischaltung: die Bewerbung landet im Betreiber-
// Review unter /plattform-marktplatz – erst die Freigabe erzeugt den Portal-Link.

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { PublicShell, PublicBrandHeader } from '@/components/PublicShell';

/** Feste Marktplatz-Bereiche (Backend verwirft alles außerhalb dieser Liste). */
const BEREICHE: { key: string; label: string }[] = [
  { key: 'folierung', label: 'Folierung' },
  { key: 'aufbereitung', label: 'Aufbereitung' },
  { key: 'ppf', label: 'PPF & Lackschutz' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

/** Nüchterne Wert-Argumente – keine Superlative, nur der konkrete Nutzen. */
const WERTE: { titel: string; text: string }[] = [
  {
    titel: 'Verkaufe an Detailing-Betriebe deutschlandweit',
    text: 'Deine Produkte erscheinen im Marktplatz der Detailly-Werkstattsoftware – dort, wo Aufbereiter, Folierer und PPF-Betriebe ohnehin täglich arbeiten und einkaufen.',
  },
  {
    titel: 'Eigenes Portal, kein Aufwand',
    text: 'Produkte pflegst du selbst über einen persönlichen Portal-Link – ohne Login-System, ohne Integration. Bestellungen wickelst du direkt mit dem Betrieb ab.',
  },
  {
    titel: 'Faire Konditionen',
    text: 'Detailly erhält eine Provision je Bestellung über den Marktplatz. Den Satz besprechen wir bei der Freigabe – keine Grundgebühr, keine Laufzeit.',
  },
];

export default function GrosshaendlerPage() {
  // Formular (Pflicht: Firma, Ansprechpartner, E-Mail, USt-IdNr.)
  const [name, setName] = useState('');
  const [ansprechpartner, setAnsprechpartner] = useState('');
  const [kontaktEmail, setKontaktEmail] = useState('');
  const [ustIdNr, setUstIdNr] = useState('');
  const [telefon, setTelefon] = useState('');
  const [webseite, setWebseite] = useState('');
  const [adresse, setAdresse] = useState('');
  const [sortiment, setSortiment] = useState<string[]>([]);
  const [nachricht, setNachricht] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot – bleibt leer

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [gesendet, setGesendet] = useState(false);

  function toggleBereich(key: string) {
    setSortiment((s) => (s.includes(key) ? s.filter((b) => b !== key) : [...s, key]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await api.post('/public/haendler-bewerbung', {
        name: name.trim(),
        ansprechpartner: ansprechpartner.trim(),
        kontaktEmail: kontaktEmail.trim(),
        ustIdNr: ustIdNr.trim(),
        telefon: telefon.trim() || undefined,
        webseite: webseite.trim() || undefined,
        adresse: adresse.trim() || undefined,
        sortiment: sortiment.length ? sortiment.join(',') : undefined,
        nachricht: nachricht.trim() || undefined,
        website: website || undefined, // Honeypot
      });
      setGesendet(true);
    } catch (err) {
      setFormError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Die Bewerbung konnte nicht gesendet werden. Bitte später erneut versuchen.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicShell width="lg" raster>
      {gesendet ? (
        <div className="card text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-copper-grad text-ink-950 shadow-glow">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Bewerbung eingegangen</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-chrome-400">
            Vielen Dank! Wir prüfen jede Bewerbung persönlich und melden uns per E-Mail an{' '}
            <span className="text-chrome-200">{kontaktEmail.trim()}</span>, sobald die Prüfung
            abgeschlossen ist.
          </p>
        </div>
      ) : (
        <>
          <PublicBrandHeader
            title="Großhändler bei Detailly"
            subtitle="Werde Lieferant im B2B-Marktplatz für Aufbereitung, Folierung und PPF."
            backHref="/"
          />

          {/* Wert-Sektion: nüchtern, drei konkrete Argumente */}
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {WERTE.map((w) => (
              <div key={w.titel} className="rounded-2xl border border-ink-700 bg-ink-850/80 px-4 py-3.5">
                <h2 className="text-sm font-semibold text-chrome-50">{w.titel}</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-chrome-400">{w.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={onSubmit} className="card space-y-4">
            <h2 className="font-display text-lg font-semibold">Jetzt bewerben</h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="firma">Firma</label>
                <input id="firma" type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="organization" required />
              </div>
              <div className="field">
                <label className="label" htmlFor="ansprechpartner">Ansprechpartner</label>
                <input id="ansprechpartner" type="text" className="input" value={ansprechpartner} onChange={(e) => setAnsprechpartner(e.target.value)} maxLength={120} autoComplete="name" required />
              </div>
              <div className="field">
                <label className="label" htmlFor="email">E-Mail</label>
                <input id="email" type="email" className="input" value={kontaktEmail} onChange={(e) => setKontaktEmail(e.target.value)} maxLength={160} autoComplete="email" required />
              </div>
              <div className="field">
                <label className="label" htmlFor="ustidnr">USt-IdNr.</label>
                <input id="ustidnr" type="text" className="input" value={ustIdNr} onChange={(e) => setUstIdNr(e.target.value)} maxLength={20} placeholder="DE123456789" required />
              </div>
              <div className="field">
                <label className="label" htmlFor="telefon">Telefon <span className="text-chrome-600">(optional)</span></label>
                <input id="telefon" type="tel" className="input" value={telefon} onChange={(e) => setTelefon(e.target.value)} maxLength={40} autoComplete="tel" />
              </div>
              <div className="field">
                <label className="label" htmlFor="webseite">Webseite <span className="text-chrome-600">(optional)</span></label>
                <input id="webseite" type="url" className="input" value={webseite} onChange={(e) => setWebseite(e.target.value)} placeholder="https://…" />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="adresse">Anschrift <span className="text-chrome-600">(optional)</span></label>
              <input id="adresse" type="text" className="input" value={adresse} onChange={(e) => setAdresse(e.target.value)} maxLength={300} placeholder="Straße Nr., PLZ Ort" autoComplete="street-address" />
            </div>

            <fieldset className="field">
              <legend className="label">Sortiment <span className="text-chrome-600">(optional)</span></legend>
              <div className="flex flex-wrap gap-2">
                {BEREICHE.map((b) => {
                  const aktiv = sortiment.includes(b.key);
                  return (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => toggleBereich(b.key)}
                      aria-pressed={aktiv}
                      className={`rounded-xl border px-3.5 py-2 text-sm transition-colors ${
                        aktiv
                          ? 'border-copper/60 bg-copper/15 text-copper-200'
                          : 'border-ink-700 bg-ink-850 text-chrome-300 hover:border-ink-600 hover:text-chrome-100'
                      }`}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="field">
              <label className="label" htmlFor="nachricht">Nachricht <span className="text-chrome-600">(optional)</span></label>
              <textarea id="nachricht" className="input min-h-[90px] resize-y" value={nachricht} onChange={(e) => setNachricht(e.target.value)} maxLength={2000} placeholder="Kurz zu euch: Sortiment, Liefergebiet, Konditionen …" />
            </div>

            {/* Honeypot: für Menschen unsichtbar, nur Bots füllen es aus. */}
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
                  <span className="spinner" />
                  Wird gesendet…
                </>
              ) : (
                'Bewerbung senden'
              )}
            </button>

            <p className="text-center text-xs leading-relaxed text-chrome-600">
              Kein automatischer Zugang: Wir prüfen jede Bewerbung persönlich und melden uns per E-Mail.
              Mit dem Absenden übermittelst du deine Angaben zur Prüfung an Detailly.
            </p>
          </form>
        </>
      )}
    </PublicShell>
  );
}
