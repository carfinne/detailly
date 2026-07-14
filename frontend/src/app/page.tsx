'use client';

// Öffentliche Landingpage (Route "/") VOR dem Login. Premium, konversions-
// orientierte Produkt-Story: Hero (Wort-Reveal + Aurora + Produkt-Mockup mit
// Tilt) -> Vertrauen -> Problem -> Branchen-Switcher (färbt die GANZE Seite
// über die Branchen-Themes um) -> Ablauf -> Funktionen (Spotlight-Karten) ->
// 3D-Schadenserfassung -> Wachstum -> Zahlen (Count-up) -> Stimmen -> Warum ->
// FAQ -> CTA. Alle Farben über Design-Tokens (CSS-Variablen), alle Animationen
// respektieren Reduced-Motion. Angemeldete Nutzer gehen direkt ins Dashboard.

import { Fragment, useEffect, useRef, useState } from 'react';
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
import { CountUp } from '@/components/CountUp';
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

/** Setzt .grown, sobald das Element sichtbar wird (Diagramm/Pins). */
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

/** Hero-Headline: Wörter steigen gestaffelt aus einer Maske auf. */
function Headline({ lines }: { lines: { text: string; gradient?: boolean }[] }) {
  let wordIndex = 0;
  return (
    <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-[3.6rem]">
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.text.split(' ').map((word) => {
            const delay = wordIndex++ * 85;
            return (
              <Fragment key={`${word}-${delay}`}>
                <span className="hero-line">
                  <span
                    className={`hero-word ${line.gradient ? 'text-gradient' : ''}`}
                    style={{ animationDelay: `${delay}ms` }}
                  >
                    {word}
                  </span>
                </span>{' '}
              </Fragment>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

/** Sanfter Cursor-Tilt für das Produkt-Mockup (nur bei erlaubter Bewegung). */
function useTilt() {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || !motionOk()) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--ry', `${(px * 4).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${(-py * 3).toFixed(2)}deg`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };
  return { ref, onMove, onLeave };
}

/** Dezente Scroll-Parallax (Hero-Glows schweben langsamer als der Inhalt). */
function useParallax(factor: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !motionOk()) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translateY(${(window.scrollY * factor).toFixed(1)}px)`;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [factor]);
  return ref;
}

/** Spotlight-Position auf Feature-Karten nachführen. */
function spotlight(e: React.MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - r.left}px`);
  el.style.setProperty('--my', `${e.clientY - r.top}px`);
}

/* ================================= Inhalte ================================= */

// Landing nutzt die Logo-Variante mit Radkreisen (geteilte Quelle in brand.tsx).
const BrandMark = ({ className = 'h-7 w-7' }: { className?: string }) => (
  <BrandMarkBase className={className} wheels />
);

// Übersetzbare Landing-Inhalte referenzieren i18n-Keys; der sichtbare Text wird
// erst beim Rendern per useT() aufgelöst (Icons/Struktur bleiben hier statisch).
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

type Feature = { base: string; icon: React.ReactNode };
const ICON = 'h-5 w-5';
const FEATURES: Feature[] = [
  {
    base: 'landing.funktionen.kunden',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5" /><path d="M14 18l1-3h5l1 3M13.5 18h9v2.5h-9zM15 21v1M21 21v1" />
      </svg>
    ),
  },
  {
    base: 'landing.funktionen.auftraege',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 9h16M8 3v4M16 3v4M8 13h3M8 17h6" />
      </svg>
    ),
  },
  {
    base: 'landing.funktionen.rechnungen',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12v18l-3-1.6L12 21l-3-1.6L6 21z" /><path d="M9 8h6M9 12h6M9 16h3" />
      </svg>
    ),
  },
  {
    base: 'landing.funktionen.schaden3d',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.5l8 4.5v9l-8 4.5-8-4.5v-9z" /><path d="M12 2.5v19M4 7l8 4.5L20 7" />
      </svg>
    ),
  },
  {
    base: 'landing.funktionen.kalkulation',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v4M8 19h.01M12 19h.01" />
      </svg>
    ),
  },
  {
    base: 'landing.funktionen.dsgvo',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
];

const GROWTH_POINTS: Feature[] = [
  {
    base: 'landing.wachstum.echtzeit',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-6" />
      </svg>
    ),
  },
  {
    base: 'landing.wachstum.standorte',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 11h.01M15 11h.01" />
      </svg>
    ),
  },
  {
    base: 'landing.wachstum.team',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 3.5a3 3 0 0 1 0 5.8M18 20c0-2.6-1.3-4.4-3.3-5.2" />
      </svg>
    ),
  },
];

// Branchen-Karten: Reihenfolge + i18n-Keys der typischen Leistungen je Gewerk.
// Label/Claim kommen als i18n-Keys aus BETRIEBSTYP_LABEL_KEY (t()), Akzent aus BETRIEBSTYP_META.
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
 * prüfen und bestätigen"; Fehler folgen der ErrorBox-Konvention. Die Antwort des
 * Backends ist enumeration-sicher (immer identisch).
 */
function NewsletterSection() {
  const t = useT();
  const [email, setEmail] = useState('');
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
      await api.post('/public/newsletter/anmelden', { email: email.trim() });
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
          <div className="dl-drift pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-copper-glow blur-[100px]" />
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
                  <div className="mx-auto mt-3 flex max-w-md items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-left text-sm text-danger">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v4m0 4h.01" />
                    </svg>
                    {error}
                  </div>
                )}

                <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-chrome-600">
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

/** Schwebender Info-Chip am Produkt-Mockup. */
const FloatChip = ({
  className = '',
  delay = 0,
  children,
}: {
  className?: string;
  delay?: number;
  children: React.ReactNode;
}) => (
  <div
    className={`dl-float pointer-events-none absolute z-10 hidden items-center gap-2 rounded-xl border border-ink-700/70 bg-ink-800/90 px-3 py-2 text-xs font-medium text-chrome-200 shadow-pop backdrop-blur-sm lg:flex ${className}`}
    style={{ animationDelay: `${delay}s`, animationDuration: '11s' }}
  >
    {children}
  </div>
);

/** Produkt-Mockup: stilisiertes App-Fenster (Dashboard + Plantafel-Ausschnitt). */
function AppMockup() {
  return (
    <div className="card-flush overflow-hidden text-left">
      {/* Fenster-Kopf */}
      <div className="flex items-center gap-2 border-b border-ink-700/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-ink-600" />
        <span className="h-2.5 w-2.5 rounded-full bg-ink-600" />
        <span className="h-2.5 w-2.5 rounded-full bg-ink-600" />
        <span className="ml-3 flex items-center gap-1.5 text-[11px] font-medium text-chrome-500">
          <span className="dot bg-positive" /> app.detailly.de · Dashboard
        </span>
      </div>
      <div className="flex">
        {/* Mini-Sidebar */}
        <div className="hidden w-36 shrink-0 flex-col gap-1 border-r border-ink-700/60 p-3 sm:flex">
          {['Dashboard', 'Aufträge', 'Plantafel', 'Kunden', 'Rechnungen'].map((n, i) => (
            <span
              key={n}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${i === 0 ? 'bg-copper-soft text-copper-300' : 'text-chrome-500'}`}
            >
              {n}
            </span>
          ))}
        </div>
        {/* Hauptfläche */}
        <div className="min-w-0 flex-1 p-4">
          <div className="mb-3 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-ink-900/60 p-3.5">
              <div className="kpi-label">Offene Aufträge</div>
              <div className="kpi-value mt-1">12</div>
            </div>
            <div className="rounded-xl bg-ink-900/60 p-3.5">
              <div className="kpi-label">Umsatz · Monat</div>
              <div className="kpi-value mt-1">8.450 <span className="text-base text-chrome-400">€</span></div>
            </div>
            <div className="rounded-xl bg-ink-900/60 p-3.5">
              <div className="kpi-label">Termine heute</div>
              <div className="kpi-value mt-1">5</div>
            </div>
          </div>
          {/* Plantafel-Ausschnitt */}
          <div className="mb-3 rounded-xl bg-ink-900/60 p-3.5">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-chrome-500">
              <span>Plantafel · Heute</span>
              <span className="text-copper-300">KW 27</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-10 text-[10px] tnum text-chrome-600">09:00</span>
                <span className="h-5 flex-1 rounded-md bg-copper-soft ring-1 ring-inset ring-copper/30" style={{ maxWidth: '58%' }} />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-10 text-[10px] tnum text-chrome-600">11:30</span>
                <span className="ml-[14%] h-5 flex-1 rounded-md bg-info-soft ring-1 ring-inset ring-info/30" style={{ maxWidth: '34%' }} />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-10 text-[10px] tnum text-chrome-600">14:00</span>
                <span className="ml-[30%] h-5 flex-1 rounded-md bg-positive-soft ring-1 ring-inset ring-positive/30" style={{ maxWidth: '44%' }} />
              </div>
            </div>
          </div>
          {/* Auftrag + Rechnung */}
          <div className="mb-2 flex items-center justify-between rounded-lg bg-ink-900/50 px-3 py-2.5 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-chrome-200">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-copper" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3h6l5 5v13H5V5a2 2 0 0 1 2-2z" /><path d="M14 3v5h5" />
              </svg>
              <span className="truncate">AU-2026-0412 · BMW M3 Competition</span>
            </span>
            <span className="badge-copper shrink-0">In Arbeit</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-ink-900/50 px-3 py-2.5 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-chrome-200">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-copper" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h12v18l-3-1.6L12 21l-3-1.6L6 21z" /><path d="M9 8h6M9 12h6" />
              </svg>
              <span className="truncate">RE-2026-0188 · Folierung Komplett</span>
            </span>
            <span className="badge-positive shrink-0">Bezahlt</span>
          </div>
        </div>
      </div>
    </div>
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

/** Wachstums-Diagramm: Balken wachsen hoch + Standort-Pins ploppen herein. */
function GrowthChart() {
  const t = useT();
  const ref = useGrown();
  const bars = [26, 34, 30, 46, 58, 70, 90];
  return (
    <div ref={ref} className="card-flush p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-chrome-200">{t('landing.wachstum.chartVolume')}</span>
        <span className="badge-positive">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 17l6-6 4 4 6-7" /><path d="M20 8h-4M20 8v4" />
          </svg>
          {t('landing.wachstum.chartGrowing')}
        </span>
      </div>
      <div className="flex h-36 items-end gap-2">
        {bars.map((h, i) => (
          <div key={i} className="gbar flex-1 rounded-t-md bg-copper-grad" style={{ height: `${h}%`, transitionDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <div className="mt-5 border-t border-ink-700/60 pt-4">
        <div className="mb-2.5 flex items-center justify-between text-xs text-chrome-500">
          <span>{t('landing.wachstum.chartLocations')}</span>
          <span className="font-medium text-copper-300">1 → 5</span>
        </div>
        <div className="flex items-center justify-between px-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="gpin" style={{ transitionDelay: `${650 + i * 120}ms` }}>
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-copper" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" />
              </svg>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================= Seite ================================== */

export default function HomePage() {
  const { user, loading } = useAuth();
  const t = useT();
  const router = useRouter();
  const tilt = useTilt();
  const glowParallax = useParallax(0.12);
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
        <style>{`.reveal,.reveal-scale{opacity:1!important;transform:none!important}.gbar{transform:scaleY(1)!important}.gpin{opacity:1!important;transform:none!important}.draw-x{transform:scaleX(1)!important}`}</style>
      </noscript>

      {/* Aurora-Hintergrund: treibende Akzent-Glows + feines Raster, mit
          dezenter Scroll-Parallax. Farben über Tokens -> Branchen-Umfärbung. */}
      <div className="pointer-events-none absolute inset-0">
        <div ref={glowParallax}>
          <div className="dl-drift absolute -left-40 -top-24 h-[30rem] w-[30rem] rounded-full bg-copper-glow blur-[130px]" />
          <div className="dl-drift absolute -right-32 top-40 h-[24rem] w-[24rem] rounded-full bg-copper-glow opacity-70 blur-[140px]" style={{ animationDelay: '-8s' }} />
          <div className="dl-drift absolute -right-40 top-[52rem] h-[26rem] w-[26rem] rounded-full bg-copper-glow opacity-50 blur-[150px]" style={{ animationDelay: '-15s' }} />
        </div>
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
            maskImage: 'radial-gradient(1100px 620px at 50% 0%, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(1100px 620px at 50% 0%, black 40%, transparent 100%)',
          }}
        />
      </div>

      <Nav />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* ---- Hero ---- */}
        <section className="pb-10 pt-32 text-center sm:pt-40">
          <div className="animate-fade-in">
            <span className="badge-copper">
              <span className="dot bg-copper" />
              {t('landing.hero.badge')}
            </span>
          </div>
          <Headline
            lines={[
              { text: t('landing.hero.title1') },
              { text: t('landing.hero.title2'), gradient: true },
            ]}
          />
          <Reveal delay={450}>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-chrome-300 sm:text-lg">
              {t('landing.hero.sub')}
            </p>
          </Reveal>
          <Reveal delay={550}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/registrieren" className="btn-primary w-full px-6 py-3 text-base sm:w-auto">
                {t('landing.hero.ctaPrimary')}
              </Link>
              <a href="#funktionen" className="btn-ghost w-full px-6 py-3 text-base sm:w-auto">
                {t('landing.hero.ctaSecondary')}
              </a>
            </div>
          </Reveal>
          <Reveal delay={620}>
            <p className="mt-4 text-xs text-chrome-500">{t('landing.hero.trailer')}</p>
          </Reveal>
        </section>

        {/* ---- Produkt-Mockup mit Tilt + schwebenden Chips ---- */}
        <section className="pb-16">
          <Reveal variant="scale" delay={120}>
            <div className="relative mx-auto max-w-3xl">
              <FloatChip className="-left-24 top-10" delay={0.8}>
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-copper" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 9h16M8 3v4M16 3v4" />
                </svg>
                Termin 09:30 · PPF Frontpaket
              </FloatChip>
              <FloatChip className="-right-20 top-24" delay={2.2}>
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-positive" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Rechnung RE-2026-0188 bezahlt
              </FloatChip>
              <FloatChip className="-left-16 bottom-16" delay={3.6}>
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-copper" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 17l6-6 4 4 6-7" />
                </svg>
                Umsatz +18 % zum Vormonat
              </FloatChip>
              <div ref={tilt.ref} onMouseMove={tilt.onMove} onMouseLeave={tilt.onLeave} className="tilt">
                <AppMockup />
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---- Vertrauens-Leiste ---- */}
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
              <span className="text-gradient font-semibold">{t('landing.problem.summaryEm')}</span>
              {t('landing.problem.summaryPost')}
            </p>
          </Reveal>
        </section>

        {/* ---- Branchen-Switcher (Signature-Interaktion) ---- */}
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
          <Reveal>
            {/* Verbinder-Linie zieht sich beim Reveal von links auf */}
            <div className="draw-x mx-auto mb-6 hidden h-px w-2/3 bg-hairline md:block" />
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

        {/* ---- Funktionen ---- */}
        <section id="funktionen" className="scroll-mt-24 pb-24">
          <Reveal>
            <SectionHead
              kicker={t('landing.funktionen.kicker')}
              title={t('landing.funktionen.title')}
              sub={t('landing.funktionen.sub')}
            />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.base} delay={(i % 3) * 80} className="h-full">
                <div onMouseMove={spotlight} className="card spot-card group h-full transition-all duration-220 ease-emphasized hover:-translate-y-1 hover:border-copper/40">
                  <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl border border-copper/25 bg-copper-soft text-copper-300 transition-transform duration-220 ease-emphasized group-hover:scale-110">
                    {f.icon}
                  </div>
                  <h3 className="font-display text-base font-semibold text-chrome-50">{t(`${f.base}.title`)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-chrome-400">{t(`${f.base}.desc`)}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <p className="mt-6 text-center text-sm text-chrome-500">
              {t('landing.funktionen.footnotePre')}<kbd className="rounded border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[11px] text-chrome-300">⌘K</kbd>{t('landing.funktionen.footnotePost')}
            </p>
          </Reveal>
        </section>

        {/* ---- 3D-Schadenserfassung (Showcase) ---- */}
        <section className="pb-24">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <Reveal>
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">{t('landing.schaden.kicker')}</span>
                <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  {t('landing.schaden.title')}
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-chrome-400 sm:text-base">
                  {t('landing.schaden.desc')}
                </p>
                <ul className="mt-6 space-y-3">
                  {['landing.schaden.point1', 'landing.schaden.point2', 'landing.schaden.point3'].map((k) => (
                    <li key={k} className="flex items-center gap-3 text-sm text-chrome-200">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-copper/25 bg-copper-soft">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-copper" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </span>
                      {t(k)}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal variant="scale" delay={100}>
              {/* branche durchreichen: die 3D-Szene liest die Akzent-Tokens am
                  eigenen Container und färbt sich beim Branchenwechsel live um. */}
              <DamageShowcase branche={branche} />
            </Reveal>
          </div>
        </section>

        {/* ---- Wachstum ---- */}
        <section className="pb-24">
          <Reveal>
            <SectionHead
              kicker={t('landing.wachstum.kicker')}
              title={t('landing.wachstum.title')}
              sub={t('landing.wachstum.sub')}
            />
          </Reveal>
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <Reveal>
              <ul className="space-y-5">
                {GROWTH_POINTS.map((g) => (
                  <li key={g.base} className="flex gap-4">
                    <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-copper/25 bg-copper-soft text-copper-300">
                      {g.icon}
                    </span>
                    <div>
                      <h3 className="font-display text-base font-semibold text-chrome-50">{t(`${g.base}.title`)}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-chrome-400">{t(`${g.base}.desc`)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal variant="scale" delay={80}>
              <GrowthChart />
            </Reveal>
          </div>
        </section>

        {/* ---- Zahlen (Count-up) ---- */}
        <section className="pb-24">
          <Reveal>
            <div className="grid gap-4 rounded-3xl border border-ink-700/60 bg-ink-800/40 p-8 text-center sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="font-display text-4xl font-bold text-gradient"><CountUp to={4} /> {t('landing.zahlen.stat1.unit')}</div>
                <p className="mt-2 text-sm text-chrome-400">{t('landing.zahlen.stat1.label')}</p>
              </div>
              <div>
                <div className="font-display text-4xl font-bold text-gradient"><CountUp to={14} /> {t('landing.zahlen.stat2.unit')}</div>
                <p className="mt-2 text-sm text-chrome-400">{t('landing.zahlen.stat2.label')}</p>
              </div>
              <div>
                <div className="font-display text-4xl font-bold text-gradient">{t('landing.zahlen.stat3.value')}</div>
                <p className="mt-2 text-sm text-chrome-400">{t('landing.zahlen.stat3.label')}</p>
              </div>
              <div>
                <div className="font-display text-4xl font-bold text-gradient">{t('landing.zahlen.stat4.value')}</div>
                <p className="mt-2 text-sm text-chrome-400">{t('landing.zahlen.stat4.label')}</p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Testimonials erst wieder mit echten, namentlich freigegebenen
            Kundenstimmen — Platzhalter-Zitate sind wettbewerbsrechtlich riskant
            und wirken unglaubwürdig. Bewusst entfernt, bis belastbare, benannte
            Stimmen vorliegen. */}

        {/* ---- Mitglieder (echte, zustimmende Betriebe · Opt-in) ---- */}
        <MitgliederSection />

        {/* ---- Warum Detailly (Positionierung) ---- */}
        <section className="pb-24">
          <Reveal>
            <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-ink-700/60 bg-ink-800/40 p-8 text-center sm:p-12">
              <div className="dl-float pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-copper-glow opacity-60 blur-[110px]" />
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
            <div className="relative overflow-hidden rounded-3xl border border-copper/25 bg-ink-800/70 p-8 text-center shadow-card sm:p-14">
              <div className="dl-drift pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-copper-glow blur-[100px]" />
              <div className="dl-drift pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-copper-glow opacity-60 blur-[110px]" style={{ animationDelay: '-12s' }} />
              <div className="relative z-10">
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

/** Showcase-Karte: echtes 3D-Fahrzeugmodell mit Scan-Choreografie und
 *  Schadens-Pins; ohne WebGL bleibt die 2D-Silhouette (CarFallback2D) stehen.
 *  Das Schäden-Badge zählt live mit den Pins der 3D-Szene hoch (onPings). */
function DamageShowcase({ branche }: { branche: Betriebstyp }) {
  const t = useT();
  const ref = useGrown();
  // Start bei 2 (wie die 2D-Fallback-Pins). Übernimmt die 3D-Szene, meldet
  // sie erst 0 und zählt dann kausal 1→2→3 hoch, sobald die Scanlinie die
  // Schadenspunkte passiert — kein Rückwärtssprung von 2 auf 1. Fällt die
  // Szene endgültig auf 2D zurück (Watchdog/Context-Lost), springt das Badge
  // auf die 2 sichtbaren Fallback-Pins zurück.
  const [schaeden, setSchaeden] = useState(2);
  return (
    <div ref={ref} className="card-flush relative p-6">
      <div className="mb-4 flex items-center justify-between text-xs text-chrome-500">
        <span className="flex items-center gap-2">
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
