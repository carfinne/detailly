'use client';

// Öffentliche Landingpage (Route "/") VOR dem Login. Richtung A „Messtechnik /
// Ehrlich" (docs/LANDING_REDESIGN_KONZEPT.md): die Seite BEWEIST statt zu
// behaupten. Kein Aurora-/Raster-Hintergrund, kein Fake-Dashboard, kein
// Count-up-Theater, keine Icon-Kachel-Grids. Stattdessen: links-bündiges Hero
// mit einem µm-Schichtdicken-Readout als Signature (misst einmal, settelt auf
// Grün) + der ruhig gestellte 3D-Annahme-Viewer als Instrument, ein
// Funktions-Datenblatt (Label ↔ Fakt), der Branchen-Switcher (färbt die GANZE
// Seite um) und ehrliche Beweis-Sektionen (echte Betriebe, News, FAQ). Alle
// Farben über Design-Tokens, alle Bewegungen respektieren Reduced-Motion.
// Angemeldete Nutzer gehen direkt ins Dashboard.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useT, LanguageSwitcher } from '@/lib/i18n';
import { BETRIEBSTYP_META, BETRIEBSTYP_LABEL_KEY, type Betriebstyp } from '@/lib/branche';
import { BrandMark as BrandMarkBase } from '@/components/brand';
import { neuesteNews, formatNewsDatum } from '@/lib/news';
import { motionOk } from '@/lib/motion';
import { SkipLink } from '@/components/SkipLink';
import DeutschlandKarte from '@/components/landing/DeutschlandKarte';

// 3D-Showcase nur im Browser laden (WebGL, kein SSR/Static-Export-Prerender);
// bis dahin steht die 2D-Silhouette als Platzhalter — kein Layout-Sprung, die
// feste Höhe der 3D-Bühne gibt die Karte vor.
const LandingCar3D = dynamic(() => import('@/components/landing/LandingCar3D'), {
  ssr: false,
  loading: () => <CarFallback2D />,
});

/* ============================== Motion-Helfer ============================== */

/** Scroll-Reveal: blendet Kinder ein, sobald sie in den Viewport kommen. */
function Reveal({
  children,
  delay = 0,
  variant = 'up',
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  variant?: 'up' | 'scale';
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add('is-visible');
            io.unobserve(el);
          }
        }),
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`${variant === 'scale' ? 'reveal-scale' : 'reveal'} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/** Setzt .grown, sobald das Element sichtbar wird (Instrument-Panels). */
function useGrown() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('grown');
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add('grown');
            io.unobserve(el);
          }
        }),
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/* ================================= Inhalte ================================= */

// Landing nutzt die Logo-Variante mit Radkreisen (geteilte Quelle in brand.tsx).
const BrandMark = ({ className = 'h-7 w-7' }: { className?: string }) => (
  <BrandMarkBase className={className} wheels />
);

// Übersetzbare Landing-Inhalte referenzieren i18n-Keys; der sichtbare Text wird
// erst beim Rendern per useT() aufgelöst.
const TRUST_KEYS = [
  'landing.trust.dsgvo',
  'landing.trust.gobd',
  'landing.trust.madeInGermany',
  'landing.trust.encrypted',
  'landing.trust.noInstall',
];

const PROBLEM_KEYS = [
  'landing.problem.p1',
  'landing.problem.p2',
  'landing.problem.p3',
  'landing.problem.p4',
];

// Schritt-Nummer + i18n-Basis-Key (`.title`/`.desc`).
const STEPS: { n: string; base: string }[] = [
  { n: '01', base: 'landing.ablauf.step1' },
  { n: '02', base: 'landing.ablauf.step2' },
  { n: '03', base: 'landing.ablauf.step3' },
];

// Funktions-Datenblatt: je Zeile ein Label (i18n) und ein technischer Fakt
// (i18n). Ehrliche Fakten statt Icon-Kacheln — Label links, Fakt rechts.
const DATENBLATT: { labelKey: string; factKey: string }[] = [
  { labelKey: 'landing.datenblatt.kunden.label', factKey: 'landing.datenblatt.kunden.fact' },
  { labelKey: 'landing.datenblatt.auftraege.label', factKey: 'landing.datenblatt.auftraege.fact' },
  { labelKey: 'landing.datenblatt.schaden.label', factKey: 'landing.datenblatt.schaden.fact' },
  { labelKey: 'landing.datenblatt.rechnung.label', factKey: 'landing.datenblatt.rechnung.fact' },
  { labelKey: 'landing.datenblatt.zahlung.label', factKey: 'landing.datenblatt.zahlung.fact' },
  { labelKey: 'landing.datenblatt.kasse.label', factKey: 'landing.datenblatt.kasse.fact' },
  { labelKey: 'landing.datenblatt.kalkulation.label', factKey: 'landing.datenblatt.kalkulation.fact' },
  { labelKey: 'landing.datenblatt.datenschutz.label', factKey: 'landing.datenblatt.datenschutz.fact' },
  { labelKey: 'landing.datenblatt.sprachen.label', factKey: 'landing.datenblatt.sprachen.fact' },
  { labelKey: 'landing.datenblatt.zugriff.label', factKey: 'landing.datenblatt.zugriff.fact' },
];

// Branchen-Karten: Reihenfolge + i18n-Keys der typischen Leistungen je Gewerk.
const BRANCHEN: { typ: Betriebstyp; leistungen: string[] }[] = [
  { typ: 'aufbereitung', leistungen: ['landing.branchen.aufbereitung.l1', 'landing.branchen.aufbereitung.l2', 'landing.branchen.aufbereitung.l3'] },
  { typ: 'folierung', leistungen: ['landing.branchen.folierung.l1', 'landing.branchen.folierung.l2', 'landing.branchen.folierung.l3'] },
  { typ: 'ppf', leistungen: ['landing.branchen.ppf.l1', 'landing.branchen.ppf.l2', 'landing.branchen.ppf.l3'] },
];

// FAQ: i18n-Basis-Keys (`.q`/`.a`).
const FAQ_KEYS = [
  'landing.faq.q1',
  'landing.faq.q2',
  'landing.faq.q3',
  'landing.faq.q4',
  'landing.faq.q5',
  'landing.faq.q6',
];

/* ============================== Bausteine ================================= */

const SectionHead = ({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) => (
  <div className="mb-10 text-center">
    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">{kicker}</span>
    <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
    {sub && <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-chrome-400">{sub}</p>}
  </div>
);

/* ---- Signature A: µm-Schichtdicken-Readout ------------------------------- */

/**
 * Signature-Element (Richtung A): ein Messgerät-Readout wie an der Annahme. Beim
 * Sichtbarwerden fährt der Messwert EINMAL hoch, der Balken füllt sich (die helle
 * Kante ist die Messlinie), dann rastet alles auf Grün („in Toleranz"). Reduced
 * Motion / kein IntersectionObserver: sofort im gesettelten Endzustand. Ehrlich:
 * µm-Messung ist die Annahme-Realität, KEIN Detailly-Feature — die Caption zieht
 * nur die Analogie „gemessen statt behauptet".
 */
function SchichtdickeReadout() {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState(0);
  const [settled, setSettled] = useState(false);
  const ZIEL = 112; // µm — illustrativer Klarlack-Wert, siehe Caption

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Ohne erlaubte Bewegung / ohne IO: direkt in den Endzustand.
    if (!motionOk() || typeof IntersectionObserver === 'undefined') {
      setVal(ZIEL);
      setSettled(true);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(el);
          const t0 = performance.now();
          const dauer = 1200;
          const tick = (now: number) => {
            const p = Math.min(1, (now - t0) / dauer);
            const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
            setVal(Math.round(ZIEL * eased));
            if (p < 1) raf = requestAnimationFrame(tick);
            else setSettled(true);
          };
          raf = requestAnimationFrame(tick);
        }),
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const pct = Math.min(100, (val / ZIEL) * 100);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={t('landing.messwert.aria')}
      className="mt-9 w-full max-w-md rounded-2xl border border-ink-700/70 bg-ink-850/60 p-5 shadow-card"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-chrome-500">
          {t('landing.messwert.label')}
        </span>
        <span className={`transition-colors ${settled ? 'badge-positive' : 'badge-neutral'}`}>
          {settled ? (
            <>
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {t('landing.messwert.status')}
            </>
          ) : (
            t('landing.messwert.measuring')
          )}
        </span>
      </div>

      <div className="mt-3 flex items-end gap-1.5">
        <span
          className={`font-mono text-4xl font-semibold leading-none tracking-tight tabular-nums transition-colors ${settled ? 'text-positive' : 'text-chrome-50'}`}
        >
          {val}
        </span>
        <span className="mb-0.5 font-mono text-sm text-copper">{t('landing.messwert.unit')}</span>
      </div>

      {/* Lackfläche mit Mess-Skala: der Balken füllt sich beim Messen, die helle
          Kante ist die Messlinie. Reduced-Motion: sofort voll + grün. */}
      <div
        className="relative mt-4 h-2.5 w-full overflow-hidden rounded-full bg-ink-900"
        style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 24px)' }}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-150 ease-linear ${settled ? 'bg-positive' : 'bg-copper'}`}
          style={{ width: `${pct}%` }}
        />
        {!settled && pct > 0 && (
          <span className="absolute top-0 h-full w-px bg-chrome-50/80" style={{ left: `${pct}%` }} />
        )}
      </div>

      <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-chrome-600">
        <span>{t('landing.messwert.surface')}</span>
        <span className="tabular-nums">0–150 µm</span>
      </div>

      <p className="mt-4 border-t border-ink-700/50 pt-3 text-[11px] leading-relaxed text-chrome-500">
        {t('landing.messwert.caption')}
      </p>
    </div>
  );
}

/* ---- Mitgliederliste (Social Proof, nur Opt-in-Betriebe) ------------------ */

// Oeffentliche Mitglieds-Karte (spiegelt PublicMitglied im Backend). Enthaelt
// bewusst nur PII-arme, zur Veroeffentlichung freigegebene Felder.
type PublicMitglied = {
  firmenname: string;
  betriebstyp: Betriebstyp;
  stadt: string | null;
  kurzbeschreibung: string | null;
  webseite: string | null;
  logoUrl: string | null;
  initiale: string;
  // Grobe PLZ-Leitregion (2-stellig) – nur fuer aktiv zahlende Betriebe gesetzt,
  // sonst null. Speist die Deutschlandkarte (plottet nur Eintraege mit plzRegion).
  plzRegion: string | null;
};

/** Monogramm/Logo-Avatar der Karte, eingefaerbt im Branchen-Akzent. */
function MitgliedAvatar({ m }: { m: PublicMitglied }) {
  const meta = BETRIEBSTYP_META[m.betriebstyp] ?? BETRIEBSTYP_META.komplett;
  if (m.logoUrl) {
    // Nur absolute http/https-URLs erreichen das Frontend (Backend-Whitelist);
    // dekorativ, daher leeres alt (der Firmenname steht daneben).
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-ink-500" />;
  }
  return (
    <span
      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-base font-bold text-white ring-1 ring-ink-500"
      style={{ background: `linear-gradient(135deg, ${meta.akzent}, ${meta.akzent}99)` }}
      aria-hidden
    >
      {m.initiale}
    </span>
  );
}

/** Eine Betriebs-Karte; klickbar zur Webseite, falls hinterlegt. */
function MitgliedKarte({ m }: { m: PublicMitglied }) {
  const t = useT();
  const meta = BETRIEBSTYP_META[m.betriebstyp] ?? BETRIEBSTYP_META.komplett;
  const label = t(BETRIEBSTYP_LABEL_KEY[m.betriebstyp]?.label ?? BETRIEBSTYP_LABEL_KEY.komplett.label);
  const inner = (
    <>
      <div className="flex items-center gap-3">
        <MitgliedAvatar m={m} />
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-semibold text-chrome-50">{m.firmenname}</h3>
          {m.stadt && <p className="truncate text-xs text-chrome-500">{m.stadt}</p>}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1"
          style={{ color: meta.akzent, background: `${meta.akzent}1a`, borderColor: `${meta.akzent}40` }}
        >
          {label}
        </span>
      </div>
      {m.kurzbeschreibung && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-chrome-400">{m.kurzbeschreibung}</p>
      )}
    </>
  );
  if (m.webseite) {
    return (
      <a
        href={m.webseite}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="card h-full transition-colors hover:border-ink-600"
      >
        {inner}
      </a>
    );
  }
  return <div className="card h-full">{inner}</div>;
}

/**
 * Startseiten-Sektion „Diese Betriebe arbeiten mit Detailly". Laedt die Liste
 * clientseitig nach dem Mount (statisch-export-sicher). EHRLICHKEIT/Empty-State:
 * Die Sektion rendert NUR, wenn mind. 3 zustimmende Betriebe vorliegen – sonst
 * gar nicht (kein leeres Grid, keine Platzhalter, keine erfundenen Eintraege).
 */
function MitgliederSection() {
  const t = useT();
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [liste, setListe] = useState<PublicMitglied[]>([]);

  useEffect(() => {
    let aktiv = true;
    api
      .get<PublicMitglied[]>('/public/mitglieder')
      .then((r) => {
        if (!aktiv) return;
        setListe(Array.isArray(r) ? r : []);
        setStatus('ready');
      })
      .catch(() => {
        // Kein Blocker fuer die Landingpage: bei Fehler bleibt die Sektion aus.
        if (aktiv) setStatus('ready');
      });
    return () => {
      aktiv = false;
    };
  }, []);

  // Ladezustand: dezente animierte Skeletons (nie totes „Lädt…").
  if (status === 'loading') {
    return (
      <section className="pb-24">
        <SectionHead
          kicker={t('landing.mitglieder.kicker')}
          title={t('landing.mitglieder.title')}
          sub={t('landing.mitglieder.sub')}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-full animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 shrink-0 rounded-xl bg-ink-700/70" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 rounded bg-ink-700/70" />
                  <div className="h-2.5 w-1/3 rounded bg-ink-700/50" />
                </div>
              </div>
              <div className="mt-3 h-5 w-24 rounded-full bg-ink-700/50" />
              <div className="mt-3 h-3 w-full rounded bg-ink-700/40" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Ehrlichkeit: unter 3 zustimmenden Betrieben rendert die Sektion GAR NICHT.
  if (liste.length < 3) return null;

  return (
    <>
      {/* Deutschlandkarte (Qualitaetssiegel) – SELBE Datenquelle, EIN Fetch.
          Self-gating: rendert nur bei >= 3 Betrieben mit Leitregion (zahlend). */}
      <DeutschlandKarte betriebe={liste} />

      <section className="pb-24">
        <Reveal>
          <SectionHead
            kicker={t('landing.mitglieder.kicker')}
            title={t('landing.mitglieder.title')}
            sub={t('landing.mitglieder.sub')}
          />
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {liste.map((m, i) => (
            <Reveal key={`${m.firmenname}-${i}`} delay={(i % 3) * 80} className="h-full">
              <MitgliedKarte m={m} />
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}

/* ---- Newsletter-Anmeldung (Double-Opt-in, § 7 UWG) ----------------------- */

/**
 * Dezente Newsletter-Sektion vor dem Footer. Rechtssicher: unter dem Feld steht
 * der Pflicht-Hinweis (Einwilligung, jederzeitige Abmeldung, Link auf
 * /datenschutz). Nach dem Absenden erscheint der Double-Opt-in-Hinweis „Postfach
 * prüfen und bestätigen"; Fehler folgen der ErrorBox-Konvention.
 */
function NewsletterSection() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot – bleibt bei Menschen leer
  const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    // Einfache Client-Validierung; die eigentliche Prüfung macht das Backend (IsEmail).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('landing.newsletter.invalidEmail'));
      return;
    }
    setStatus('sending');
    try {
      await api.post('/public/newsletter/anmelden', {
        email: email.trim(),
        website: website || undefined, // Honeypot (nur wenn gefüllt)
      });
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('idle');
      setError(t('landing.newsletter.error'));
    }
  }

  return (
    <section id="newsletter" className="scroll-mt-24 pb-24">
      <Reveal variant="scale">
        <div className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl border border-ink-700/70 bg-ink-800/60 p-8 shadow-card sm:p-10">
          <div className="relative z-10 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">
              {t('landing.newsletter.kicker')}
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {t('landing.newsletter.title')}
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-chrome-400">
              {t('landing.newsletter.sub')}
            </p>

            {status === 'success' ? (
              <div className="mx-auto mt-7 max-w-md rounded-2xl border border-positive/30 bg-positive/10 p-5 text-left">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-positive/15 text-positive">
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m4 12 5 5L20 6" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-chrome-50">{t('landing.newsletter.successTitle')}</p>
                    <p className="mt-1 text-sm text-chrome-300">{t('landing.newsletter.success')}</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <form onSubmit={onSubmit} className="mx-auto mt-7 flex max-w-md flex-col gap-2.5 sm:flex-row">
                  {/* Honeypot: fuer Menschen unsichtbar, nur Bots fuellen es aus. */}
                  <div aria-hidden="true" className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden" style={{ opacity: 0 }}>
                    <label htmlFor="nl-website">Website (bitte leer lassen)</label>
                    <input id="nl-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                  </div>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className="input flex-1"
                    placeholder={t('landing.newsletter.placeholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-label={t('landing.newsletter.placeholder')}
                    required
                  />
                  <button type="submit" className="btn-primary shrink-0 px-6" disabled={status === 'sending'}>
                    {status === 'sending' ? (
                      <>
                        <span className="spinner" />
                        {t('landing.newsletter.sending')}
                      </>
                    ) : (
                      t('landing.newsletter.button')
                    )}
                  </button>
                </form>

                {error && (
                  <div role="alert" className="mx-auto mt-3 flex max-w-md items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-left text-sm text-danger">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v4m0 4h.01" />
                    </svg>
                    {error}
                  </div>
                )}

                <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-chrome-400">
                  {t('landing.newsletter.consentPre')}
                  <Link href="/datenschutz" className="text-copper-300 underline-offset-2 hover:underline">
                    {t('landing.newsletter.consentLink')}
                  </Link>
                  {t('landing.newsletter.consentPost')}
                </p>
              </>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** Fixe Kopfleiste: transparent über dem Hero, ab Scroll mit Blur + Hairline. */
function Nav() {
  const t = useT();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const anchors = [
    { href: '#branchen', labelKey: 'landing.nav.branchen' },
    { href: '#ablauf', labelKey: 'landing.nav.ablauf' },
    { href: '#funktionen', labelKey: 'landing.nav.funktionen' },
    { href: '#faq', labelKey: 'landing.nav.faq' },
  ];
  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-220 ease-emphasized ${
        scrolled ? 'border-b border-ink-700/60 bg-ink-900/85 backdrop-blur-md' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-copper-grad text-ink-950 shadow-glow">
            <BrandMark className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            Detail<span className="text-gradient">ly</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {anchors.map((a) => (
            <a key={a.href} href={a.href} className="btn-subtle btn-sm !text-[13px]">
              {t(a.labelKey)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Link href="/login" className="btn-ghost btn-sm">{t('landing.nav.login')}</Link>
          <Link href="/registrieren" className="btn-primary btn-sm">{t('landing.nav.trial')}</Link>
        </div>
      </div>
    </header>
  );
}

/** Seitliche Sportwagen-Silhouette — komplett über Design-Tokens gefärbt. */
const CarSilhouette = () => (
  <svg viewBox="0 0 240 78" className="w-full overflow-visible">
    <defs>
      <linearGradient id="dlBody" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'rgb(var(--copper-300))' }} />
        <stop offset="0.5" style={{ stopColor: 'rgb(var(--copper-500))' }} />
        <stop offset="1" style={{ stopColor: 'rgb(var(--copper-700))' }} />
      </linearGradient>
      <radialGradient id="dlLamp" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" style={{ stopColor: 'rgb(var(--copper-50))' }} />
        <stop offset="1" style={{ stopColor: 'rgb(var(--copper-300))', stopOpacity: 0 }} />
      </radialGradient>
    </defs>

    {/* Bodenschatten */}
    <ellipse cx="120" cy="71" rx="96" ry="4.5" style={{ fill: 'rgb(var(--copper-500))' }} opacity="0.16" />

    {/* Speed-Linien hinter dem Wagen */}
    <g style={{ stroke: 'rgb(var(--copper-500))' }} strokeWidth="2.4" strokeLinecap="round">
      <line x1="-28" y1="30" x2="6" y2="30" opacity="0.5" />
      <line x1="-40" y1="44" x2="0" y2="44" opacity="0.36" />
      <line x1="-24" y1="56" x2="8" y2="56" opacity="0.46" />
    </g>

    {/* Karosserie – tiefliegender Sportwagen */}
    <path
      d="M24,52 C24,46 30,44 38,43 L55,42 C63,34 77,30 105,30 L127,31 C147,32 159,37 199,45 L215,48 C222,49 224,52 220,53 L24,52 Z"
      fill="url(#dlBody)"
    />
    {/* Fensterband */}
    <path d="M70,42 C78,33 92,30 106,30 L122,31 L115,42 Z" style={{ fill: 'rgb(var(--ink-950))' }} opacity="0.9" />
    {/* Glanzkante Dach */}
    <path d="M67,43 C78,32 94,30 107,30" fill="none" style={{ stroke: 'rgb(var(--copper-50))' }} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    {/* untere Sicke */}
    <path d="M40,49 L208,49" style={{ stroke: 'rgb(var(--copper-700))' }} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />

    {/* Scheinwerfer-Glow */}
    <circle cx="216" cy="49" r="10" fill="url(#dlLamp)" />
    <circle cx="215" cy="49" r="2.4" style={{ fill: 'rgb(var(--copper-50))' }} />

    {/* Räder mit drehender Felge */}
    {[64, 178].map((cx) => (
      <g key={cx}>
        <circle cx={cx} cy="56" r="14" style={{ fill: 'rgb(var(--ink-950))' }} />
        <circle cx={cx} cy="56" r="14" fill="none" style={{ stroke: 'rgb(var(--ink-600))' }} strokeWidth="1.5" />
        <g className="dl-wheel" style={{ transformOrigin: `${cx}px 56px`, stroke: 'rgb(var(--copper-500))' }} strokeWidth="2" strokeLinecap="round">
          <line x1={cx} y1="47" x2={cx} y2="65" />
          <line x1={cx - 9} y1="56" x2={cx + 9} y2="56" />
          <line x1={cx - 6.4} y1="49.6" x2={cx + 6.4} y2="62.4" />
          <line x1={cx - 6.4} y1="62.4" x2={cx + 6.4} y2="49.6" />
        </g>
        <circle cx={cx} cy="56" r="3.4" style={{ fill: 'rgb(var(--copper-300))' }} />
      </g>
    ))}
  </svg>
);

/** Schadens-Pin mit Radar-Ping fürs Schadenserfassungs-Showcase. */
const DamagePin = ({ left, top, delay = 0 }: { left: string; top: string; delay?: number }) => (
  <span className="gpin absolute" style={{ left, top, transitionDelay: `${delay}ms` }}>
    <span className="relative grid h-5 w-5 place-items-center">
      <span className="dl-ping absolute inset-0 rounded-full bg-copper-glow" style={{ animationDelay: `${delay}ms` }} />
      <span className="relative h-2.5 w-2.5 rounded-full bg-copper-grad shadow-glow" />
    </span>
  </span>
);

/** 2D-Ebene fürs 3D-Showcase: Silhouette + Pins wie zuvor — dient als
 *  Lade-Platzhalter und als Fallback ohne WebGL. Füllt die 3D-Bühne (h-full). */
const CarFallback2D = () => (
  <div className="flex h-full w-full items-center justify-center px-4">
    <div className="relative w-full max-w-md">
      <CarSilhouette />
      <DamagePin left="30%" top="38%" delay={200} />
      <DamagePin left="62%" top="24%" delay={480} />
    </div>
  </div>
);

/** Hero-Instrument: der ruhig gestellte 3D-Annahme-Viewer als Werkzeug auf der
 *  Werkbank (kein Tilt, kein Float, kein Glow-Blob). Echtes 3D-Fahrzeugmodell
 *  mit Scan-Choreografie und Schadens-Pins; ohne WebGL bleibt die 2D-Silhouette
 *  (CarFallback2D) stehen. Das Schäden-Badge zählt live mit den Pins hoch. */
function AnnahmeInstrument({ branche }: { branche: Betriebstyp }) {
  const t = useT();
  const ref = useGrown();
  // Start bei 2 (wie die 2D-Fallback-Pins). Übernimmt die 3D-Szene, meldet sie
  // erst 0 und zählt dann kausal 1→2→3 hoch, sobald die Scanlinie die
  // Schadenspunkte passiert. Fällt die Szene auf 2D zurück, springt das Badge
  // auf die 2 sichtbaren Fallback-Pins zurück.
  const [schaeden, setSchaeden] = useState(2);
  return (
    <div ref={ref} className="card-flush relative p-6">
      <div className="mb-4 flex items-center justify-between text-xs text-chrome-500">
        <span className="flex items-center gap-2 font-mono uppercase tracking-[0.1em]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.5l8 4.5v9l-8 4.5-8-4.5v-9z" /><path d="M12 2.5v19M4 7l8 4.5L20 7" />
          </svg>
          {t('landing.schaden.cardHeader')}
        </span>
        <span className="badge-copper">
          {t(schaeden === 1 ? 'landing.showcase.badgeOne' : 'landing.showcase.badgeMany', { count: schaeden })}
        </span>
      </div>
      {/* 3D-Bühne mit fester Höhe: kein Layout-Sprung zwischen Platzhalter,
          Fallback und Canvas. */}
      <div className="relative h-[340px] sm:h-[400px]">
        <LandingCar3D
          branche={branche}
          fallback={<CarFallback2D />}
          onPings={setSchaeden}
          onFehler={() => setSchaeden(2)}
          pinLabels={[t('landing.showcase.pin1'), t('landing.showcase.pin2'), t('landing.showcase.pin3')]}
          ariaLabel={t('landing.showcase.aria')}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="badge-neutral">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M9 6l1.2-2h3.6L15 6" />
          </svg>
          {t('landing.schaden.cardPhotos')}
        </span>
        <span className="badge-positive">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17c3-4 5-2 7 0s4 2 7-3" /><path d="M14 20h7" />
          </svg>
          {t('landing.schaden.cardSignature')}
        </span>
      </div>
    </div>
  );
}

/* ================================= Seite ================================== */

export default function HomePage() {
  const { user, loading } = useAuth();
  const t = useT();
  const router = useRouter();
  // Aktive Branche färbt die GANZE Landingpage über die Theme-Tokens um
  // (data-branche auf dem Wrapper, Selektoren aus globals.css greifen darunter).
  const [branche, setBranche] = useState<Betriebstyp>('aufbereitung');

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-ink-900"
      data-branche={branche === 'folierung' || branche === 'ppf' ? branche : undefined}
    >
      <noscript>
        <style>{`.reveal,.reveal-scale{opacity:1!important;transform:none!important}.gpin{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      {/* Skip-Link: erstes fokussierbares Element -> ueberspringt die Kopfleiste. */}
      <SkipLink />

      {/* Ruhiger Hintergrund (Richtung A): KEINE Aurora-Blobs, KEIN Raster.
          Die Body-Vignette (globals.css) trägt die Tiefe; darüber nur eine
          statische Brushed-Metal-Mikrotextur ≤4 % — kein driftender Glow. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        aria-hidden
        style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 1px, transparent 1px 4px)' }}
      />

      <Nav />

      <div id="hauptinhalt" tabIndex={-1} className="relative z-10 mx-auto w-full max-w-6xl px-5 focus:outline-none sm:px-8">
        {/* ---- Hero (links-bündig, Messtechnik-Haltung) ---- */}
        <section className="pb-16 pt-32 sm:pt-40">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
            <div className="animate-fade-in">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-chrome-500">
                {t('landing.hero.eyebrow')}
              </p>
              <h1 className="mt-5 max-w-xl font-display text-[2.1rem] font-bold leading-[1.1] tracking-tight text-chrome-50 sm:text-[2.65rem]">
                {t('landing.hero.headlinePre')}
                <span className="text-copper">{t('landing.hero.headlineEm')}</span>
                {t('landing.hero.headlinePost')}
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-chrome-300">
                {t('landing.hero.sub')}
              </p>
              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Link href="/registrieren" className="btn-primary px-6 py-3 text-base">
                  {t('landing.hero.ctaPrimary')}
                </Link>
                <span className="text-xs text-chrome-500">{t('landing.hero.trailer')}</span>
              </div>

              {/* Signature A: µm-Schichtdicken-Readout */}
              <SchichtdickeReadout />
            </div>

            {/* 3D-Annahme-Viewer, ruhig als Instrument präsentiert */}
            <Reveal variant="scale" delay={80} className="w-full">
              <AnnahmeInstrument branche={branche} />
            </Reveal>
          </div>
        </section>

        {/* ---- Vertrauens-Leiste (Hairline-Fakten) ---- */}
        <Reveal>
          <div className="mb-20 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 border-y border-ink-700/60 py-4">
            {TRUST_KEYS.map((k) => (
              <span key={k} className="flex items-center gap-1.5 text-xs font-medium text-chrome-400">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-copper" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {t(k)}
              </span>
            ))}
          </div>
        </Reveal>

        {/* ---- Problem ---- */}
        <section className="pb-24">
          <Reveal>
            <SectionHead
              kicker={t('landing.problem.kicker')}
              title={t('landing.problem.title')}
              sub={t('landing.problem.sub')}
            />
          </Reveal>
          <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
            {PROBLEM_KEYS.map((k, i) => (
              <Reveal key={k} delay={(i % 2) * 80}>
                <div className="flex items-start gap-3 rounded-xl border border-ink-700/60 bg-ink-800/40 p-4">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-chrome-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" />
                  </svg>
                  <p className="text-sm leading-relaxed text-chrome-300">{t(k)}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <p className="mx-auto mt-7 max-w-xl text-center text-base text-chrome-200">
              {t('landing.problem.summaryPre')}
              <span className="font-semibold text-copper">{t('landing.problem.summaryEm')}</span>
              {t('landing.problem.summaryPost')}
            </p>
          </Reveal>
        </section>

        {/* ---- Branchen-Switcher (Signature-Interaktion, färbt die Seite um) ---- */}
        <section id="branchen" className="scroll-mt-24 pb-24">
          <Reveal>
            <SectionHead
              kicker={t('landing.branchen.kicker')}
              title={t('landing.branchen.title')}
              sub={t('landing.branchen.sub')}
            />
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {BRANCHEN.map(({ typ, leistungen }, i) => {
              const meta = BETRIEBSTYP_META[typ];
              const txt = BETRIEBSTYP_LABEL_KEY[typ];
              const aktiv = branche === typ;
              return (
                <Reveal key={typ} delay={i * 90} className="h-full">
                  <button
                    type="button"
                    onClick={() => setBranche(typ)}
                    onMouseEnter={() => setBranche(typ)}
                    onFocus={() => setBranche(typ)}
                    className={`choice h-full w-full p-6 text-left ${aktiv ? 'choice-active' : ''}`}
                    aria-pressed={aktiv}
                  >
                    <span className="flex items-center justify-between">
                      {/* Punkt zeigt bewusst den festen Branchen-Akzent aus der
                          gemeinsamen Meta-Quelle (Vorschau der Umfärbung). */}
                      <span className="h-3 w-3 rounded-full shadow-glow" style={{ background: meta.akzent }} />
                      {aktiv && <span className="badge-copper">{t('landing.branchen.selected')}</span>}
                    </span>
                    <span className="mt-4 block font-display text-lg font-semibold text-chrome-50">{t(txt.label)}</span>
                    <span className="mt-0.5 block text-xs font-semibold uppercase tracking-[0.1em] text-copper-300">{t(txt.claim)}</span>
                    <ul className="mt-4 space-y-2">
                      {leistungen.map((l) => (
                        <li key={l} className="flex items-center gap-2 text-sm text-chrome-300">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-copper" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                          {t(l)}
                        </li>
                      ))}
                    </ul>
                  </button>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={150}>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 text-center sm:flex-row">
              <Link href={`/registrieren?typ=${branche}`} className="btn-primary px-5">
                {t('landing.branchen.cta', { label: t(BETRIEBSTYP_LABEL_KEY[branche].label) })}
              </Link>
              <span className="text-sm text-chrome-500">
                {t('landing.branchen.complete')} <Link href="/registrieren?typ=komplett" className="link-action">{t('landing.branchen.completeCta')}</Link>
              </span>
            </div>
          </Reveal>
        </section>

        {/* ---- So funktioniert's ---- */}
        <section id="ablauf" className="scroll-mt-24 pb-24">
          <Reveal>
            <SectionHead kicker={t('landing.ablauf.kicker')} title={t('landing.ablauf.title')} />
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 110} className="h-full">
                <div className="card h-full">
                  <div className="font-display text-3xl font-bold text-gradient">{s.n}</div>
                  <h3 className="mt-3 font-display text-lg font-semibold text-chrome-50">{t(`${s.base}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-chrome-400">{t(`${s.base}.desc`)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---- Funktionen als Datenblatt (Label ↔ Fakt) ---- */}
        <section id="funktionen" className="scroll-mt-24 pb-24">
          <Reveal>
            <div className="mb-8">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-copper-300">
                {t('landing.datenblatt.kicker')}
              </span>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {t('landing.datenblatt.title')}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-chrome-400">
                {t('landing.datenblatt.sub')}
              </p>
            </div>
          </Reveal>
          <Reveal>
            <div className="overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-850/50 shadow-card">
              <dl>
                {DATENBLATT.map((row, i) => (
                  <div
                    key={row.labelKey}
                    className={`flex items-baseline justify-between gap-4 px-5 py-4 sm:px-6 ${i > 0 ? 'border-t border-ink-700/50' : ''}`}
                  >
                    <dt className="font-display text-sm font-semibold text-chrome-100 sm:text-[15px]">
                      {t(row.labelKey)}
                    </dt>
                    <dd className="text-right font-mono text-[12px] tabular-nums text-chrome-300 sm:text-[13px]">
                      {t(row.factKey)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-5 text-sm text-chrome-500">
              {t('landing.datenblatt.footnote')}
            </p>
          </Reveal>
        </section>

        {/* ---- Mitglieder (echte, zustimmende Betriebe · Opt-in) + Karte ---- */}
        <MitgliederSection />

        {/* ---- Warum Detailly (Positionierung) ---- */}
        <section className="pb-24">
          <Reveal>
            <div className="mx-auto max-w-3xl rounded-3xl border border-ink-700/60 bg-ink-800/40 p-8 text-center sm:p-12">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">{t('landing.warum.kicker')}</span>
              <h2 className="mx-auto mt-4 max-w-2xl font-display text-2xl font-bold leading-snug tracking-tight sm:text-[1.7rem]">
                {t('landing.warum.title')}
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-chrome-300">
                {t('landing.warum.body')}
              </p>
            </div>
          </Reveal>
        </section>

        {/* ---- Neuigkeiten (Teaser) ---- */}
        <section id="news" className="scroll-mt-24 pb-24">
          <Reveal>
            <SectionHead
              kicker={t('landing.news.kicker')}
              title={t('landing.news.title')}
              sub={t('landing.news.sub')}
            />
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {neuesteNews(3).map((n, i) => (
              <Reveal key={n.slug} delay={i * 90} className="h-full">
                <article className="card h-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge-copper">{n.kategorie}</span>
                    <time dateTime={n.datum} className="ml-auto text-xs text-chrome-500">
                      {formatNewsDatum(n.datum)}
                    </time>
                  </div>
                  <h3 className="mt-3 font-display text-base font-semibold text-chrome-50">{n.titel}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-chrome-400">{n.kurztext}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <div className="mt-6 text-center">
              <Link href="/news" className="btn-ghost px-5">{t('landing.news.all')}</Link>
            </div>
          </Reveal>
        </section>

        {/* ---- FAQ ---- */}
        <section id="faq" className="scroll-mt-24 pb-24">
          <Reveal>
            <SectionHead kicker={t('landing.faq.kicker')} title={t('landing.faq.title')} />
          </Reveal>
          <div className="mx-auto max-w-2xl space-y-3">
            {FAQ_KEYS.map((k, i) => (
              <Reveal key={k} delay={(i % 3) * 70}>
                <details className="group rounded-xl border border-ink-700/60 bg-ink-800/40 px-5 transition-colors hover:border-ink-600 [&_summary]:list-none">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-left text-[15px] font-semibold text-chrome-100">
                    {t(`${k}.q`)}
                    <svg viewBox="0 0 24 24" className="faq-chev h-4 w-4 shrink-0 text-copper" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </summary>
                  <p className="pb-5 text-sm leading-relaxed text-chrome-400">{t(`${k}.a`)}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---- Abschluss-CTA ---- */}
        <section className="pb-16">
          <Reveal variant="scale">
            <div className="rounded-3xl border border-copper/25 bg-ink-800/70 p-8 text-center shadow-card sm:p-14">
              <h2 className="mx-auto max-w-xl font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {t('landing.cta.title')}
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-chrome-300 sm:text-base">
                {t('landing.cta.sub')}
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/registrieren" className="btn-primary px-6 py-3 text-base">
                  {t('landing.cta.primary')}
                </Link>
                <Link href="/login" className="btn-subtle px-6 py-3 text-base">
                  {t('landing.cta.secondary')}
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---- Newsletter-Anmeldung (Double-Opt-in) ---- */}
        <NewsletterSection />

        {/* ---- Footer ---- */}
        <footer className="border-t border-ink-700/70 py-10">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <BrandMark className="h-5 w-5 text-copper" />
                <span className="font-display text-base font-bold">
                  Detail<span className="text-gradient">ly</span>
                </span>
              </div>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-chrome-500">
                {t('landing.footer.tagline')}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-chrome-500">{t('landing.footer.discover')}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/news" className="link-muted">{t('landing.footer.news')}</Link></li>
                <li><Link href="/changelog" className="link-muted">{t('landing.footer.changelog')}</Link></li>
                <li><Link href="/masterclass" className="link-muted">{t('landing.footer.masterclass')}</Link></li>
                <li><Link href="/gruendung" className="link-muted">{t('landing.footer.gruendung')}</Link></li>
                <li><Link href="/grosshaendler" className="link-muted">{t('landing.footer.grosshaendler')}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-chrome-500">{t('landing.footer.product')}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li><a href="#funktionen" className="link-muted">{t('landing.footer.features')}</a></li>
                <li><a href="#branchen" className="link-muted">{t('landing.footer.branchen')}</a></li>
                <li><a href="#faq" className="link-muted">{t('landing.footer.faq')}</a></li>
                <li><Link href="/registrieren" className="link-muted">{t('landing.footer.trial')}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-chrome-500">{t('landing.footer.account')}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/login" className="link-muted">{t('landing.footer.login')}</Link></li>
                <li><Link href="/registrieren" className="link-muted">{t('landing.footer.register')}</Link></li>
                <li><Link href="/impressum" className="link-muted">{t('landing.footer.impressum')}</Link></li>
                <li><Link href="/datenschutz" className="link-muted">{t('landing.footer.datenschutz')}</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-ink-700/50 pt-5 text-center text-xs text-chrome-600">
            {t('landing.footer.copyright', { year: new Date().getFullYear() })}
          </div>
        </footer>
      </div>
    </div>
  );
}
