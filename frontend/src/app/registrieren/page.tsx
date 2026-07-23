'use client';

import { useEffect, useState } from 'react';
import { BETRIEBSTYP_META, BETRIEBSTYP_LABEL_KEY, type Betriebstyp } from '@/lib/branche';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { PublicShell, PublicBrandHeader } from '@/components/PublicShell';
import { useT } from '@/lib/i18n';

// Gewerke-Start-Paket (Preismodell V3): rein informativer Hinweis auf den
// empfohlenen Einstieg je Betriebstyp. Aendert den Registrier-Flow nicht.
const START_BUNDLE_KEY: Record<Betriebstyp, string> = {
  aufbereitung: 'register.bundle.detailing',
  folierung: 'register.bundle.wrap',
  ppf: 'register.bundle.protect',
  komplett: 'register.bundle.studio',
};

export default function RegisterPage() {
  const t = useT();
  const { register } = useAuth();
  const router = useRouter();
  const [firmenname, setFirmenname] = useState('');
  const [betriebstyp, setBetriebstyp] = useState<Betriebstyp>('komplett');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [ref, setRef] = useState(''); // Empfehlungs-Code (aus ?ref= vorbefüllt)
  const [website, setWebsite] = useState(''); // Honeypot – bleibt bei Menschen leer
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Rechts-Zustimmung: einzelne Pflicht-Häkchen (NICHT vorangekreuzt). Der
  // „Annehmen"-Button ist erst aktiv, wenn alle drei gesetzt sind; „Ablehnen"
  // bricht die Registrierung ab (kein Konto, keine Daten) -> abgelehnt-Ansicht.
  const [agbOk, setAgbOk] = useState(false);
  const [dseOk, setDseOk] = useState(false);
  const [avvOk, setAvvOk] = useState(false);
  const [abgelehnt, setAbgelehnt] = useState(false);
  const alleZugestimmt = agbOk && dseOk && avvOk;

  // Vorauswahl von der Landingpage uebernehmen (/registrieren?typ=folierung).
  // Bewusst window.location statt useSearchParams: kein Suspense-Zwang beim
  // statischen Build, der Wert wird nur einmal beim Laden gelesen.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const typ = params.get('typ');
    if (typ && typ in BETRIEBSTYP_META) setBetriebstyp(typ as Betriebstyp);
    // Empfehlungs-Code aus ?ref= vorbefuellen (Grossbuchstaben, kurz gekappt).
    const r = params.get('ref');
    if (r) setRef(r.trim().toUpperCase().slice(0, 32));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen haben.');
      return;
    }
    // Zweite Verteidigungslinie (Button ist ohnehin deaktiviert): ohne vollständige
    // Zustimmung wird NICHT abgeschickt. Der Server erzwingt es zusätzlich hart.
    if (!alleZugestimmt) {
      setError(t('register.consent.required'));
      return;
    }
    setLoading(true);
    try {
      await register({
        firmenname,
        firstName,
        lastName,
        email,
        password,
        phone: phone.trim() || undefined,
        betriebstyp,
        ref: ref.trim() || undefined, // Empfehlungs-Code (nur wenn gesetzt)
        website: website || undefined, // Honeypot (nur wenn gefüllt)
        // Zustimmung als explizite Client-Entscheidung; Nachweis-Zeitpunkt setzt der Server.
        agbAkzeptiert: agbOk,
        datenschutzAkzeptiert: dseOk,
        avvAkzeptiert: avvOk,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  // „Ablehnen": Registrierung abbrechen. Es wird NICHTS abgeschickt/angelegt –
  // wir zeigen eine freundliche Meldung + den Weg zurück zur Startseite.
  function onAblehnen() {
    setError('');
    setAbgelehnt(true);
  }

  // Abgelehnt: kein Konto, keine Daten – freundliche Meldung + Weg zur Startseite.
  if (abgelehnt) {
    return (
      <PublicShell raster>
        <PublicBrandHeader
          backHref="/"
          title={<>{t('register.declined.title')}</>}
          subtitle={t('register.declined.subtitle')}
        />
        <div className="card space-y-5 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-copper-soft/30 text-copper-200 ring-1 ring-copper/25">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
          </div>
          <p className="text-sm text-chrome-300">{t('register.declined.message')}</p>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button type="button" onClick={() => setAbgelehnt(false)} className="btn-primary w-full sm:flex-1">
              {t('register.declined.back')}
            </button>
            <Link href="/" className="btn-ghost w-full sm:flex-1">
              {t('common.toStart')}
            </Link>
          </div>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell raster>
        <PublicBrandHeader
          backHref="/"
          title={<>Betrieb <span className="text-gradient">registrieren</span></>}
          subtitle="14 Tage kostenlos testen — keine Zahlungsdaten nötig"
        />

        <form onSubmit={onSubmit} className="card space-y-4">
          {/* Honeypot: fuer Menschen unsichtbar, nur Bots fuellen es aus. */}
          <div aria-hidden="true" className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden" style={{ opacity: 0 }}>
            <label htmlFor="reg-website">Website (bitte leer lassen)</label>
            <input id="reg-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="firmenname">Betriebsname</label>
            <input
              id="firmenname"
              type="text"
              className="input"
              value={firmenname}
              onChange={(e) => setFirmenname(e.target.value)}
              autoComplete="organization"
              placeholder="z. B. Muster Fahrzeugaufbereitung"
              required
            />
          </div>

          <div className="field">
            <span className="label">Womit arbeitet ihr hauptsächlich?</span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(BETRIEBSTYP_META) as Betriebstyp[]).map((typ) => {
                const meta = BETRIEBSTYP_META[typ];
                const txt = BETRIEBSTYP_LABEL_KEY[typ];
                const aktiv = betriebstyp === typ;
                return (
                  <button
                    key={typ}
                    type="button"
                    onClick={() => setBetriebstyp(typ)}
                    aria-pressed={aktiv}
                    className={`choice flex items-center gap-2 px-3 py-2 text-left text-xs font-medium ${aktiv ? 'choice-active' : ''}`}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full ring-1 ring-white/15"
                      style={{ background: meta.akzent }}
                      aria-hidden
                    />
                    {t(txt.label)}
                  </button>
                );
              })}
            </div>
            <p className="help mt-1.5">Bestimmt Look & vorbereitete Kalkulation – später jederzeit änderbar.</p>
            <div className="mt-2.5 rounded-xl border border-copper/25 bg-copper-soft/20 px-3.5 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-copper-300">
                {t('register.bundle.label')}
              </p>
              <p className="mt-1 text-xs text-chrome-300">{t(START_BUNDLE_KEY[betriebstyp])}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label className="label" htmlFor="firstName">Vorname</label>
              <input
                id="firstName"
                type="text"
                className="input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="lastName">Nachname</label>
              <input
                id="lastName"
                type="text"
                className="input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="email">E-Mail</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="phone">Telefon <span className="text-chrome-600">(optional)</span></label>
            <input
              id="phone"
              type="tel"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="ref">
              {t('affiliate.register.label')} <span className="text-chrome-600">({t('common.optional')})</span>
            </label>
            <input
              id="ref"
              type="text"
              className="input font-mono uppercase tracking-wider"
              value={ref}
              onChange={(e) => setRef(e.target.value.toUpperCase().slice(0, 32))}
              autoComplete="off"
              placeholder={t('affiliate.register.placeholder')}
              maxLength={32}
            />
            <p className="help mt-1.5">{t('affiliate.register.help')}</p>
          </div>

          <div className="field">
            <label className="label" htmlFor="password">Passwort</label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                className="input pr-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-chrome-400 hover:text-chrome-50"
                aria-label={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'}
              >
                {showPw ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.3M6.6 6.6A18 18 0 0 0 2 12s3 8 10 8a9 9 0 0 0 4.5-1.2M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-chrome-600">Mindestens 8 Zeichen.</p>
          </div>

          {/* Rechts-Zustimmung: einzelne Pflicht-Häkchen, NICHT vorangekreuzt. */}
          <fieldset className="field space-y-3 rounded-xl border border-ink-700 bg-ink-850/50 p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-chrome-400">
              {t('register.consent.title')}
            </legend>
            <p className="text-xs text-chrome-400">{t('register.consent.intro')}</p>

            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-chrome-300">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-copper"
                checked={agbOk}
                onChange={(e) => setAgbOk(e.target.checked)}
              />
              <span>
                {t('register.consent.agb.pre')}{' '}
                <Link href="/agb" target="_blank" className="font-medium text-copper-300 hover:text-copper-200">
                  {t('register.consent.agb.link')}
                </Link>{' '}
                {t('register.consent.agb.post')}
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-chrome-300">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-copper"
                checked={dseOk}
                onChange={(e) => setDseOk(e.target.checked)}
              />
              <span>
                {t('register.consent.dse.pre')}{' '}
                <Link href="/datenschutz" target="_blank" className="font-medium text-copper-300 hover:text-copper-200">
                  {t('register.consent.dse.link')}
                </Link>{' '}
                {t('register.consent.dse.post')}
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-chrome-300">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-copper"
                checked={avvOk}
                onChange={(e) => setAvvOk(e.target.checked)}
              />
              <span>
                {t('register.consent.avv.pre')}{' '}
                <Link href="/avv" target="_blank" className="font-medium text-copper-300 hover:text-copper-200">
                  {t('register.consent.avv.link')}
                </Link>{' '}
                {t('register.consent.avv.post')}
              </span>
            </label>

            <p className="text-[11px] leading-relaxed text-chrome-500">{t('register.consent.proof')}</p>
          </fieldset>

          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="submit"
              className="btn-primary w-full sm:flex-1"
              disabled={loading || !alleZugestimmt}
              aria-disabled={loading || !alleZugestimmt}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  {t('register.consent.creating')}
                </>
              ) : (
                t('register.consent.accept')
              )}
            </button>
            <button
              type="button"
              onClick={onAblehnen}
              className="btn-ghost w-full sm:flex-1"
              disabled={loading}
            >
              {t('register.consent.decline')}
            </button>
          </div>
          {!alleZugestimmt && (
            <p className="text-center text-[11px] text-chrome-500">{t('register.consent.hint')}</p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-chrome-400">
          Schon ein Konto?{' '}
          <Link href="/login" className="font-medium text-copper-300 hover:text-copper-200">
            Jetzt anmelden
          </Link>
        </p>
    </PublicShell>
  );
}
