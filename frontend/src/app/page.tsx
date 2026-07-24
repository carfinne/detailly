'use client';

// Öffentliche Landingpage (Route "/") VOR dem Login.
//
// Landing-Design inspiriert von Hikari (antoineross/Hikari, MIT-Lizenz) —
// übernommen ist das LAYOUT-GEFÜHL, nicht der Code: zentrierte Hero-Choreografie
// mit Ankündigungs-Pille + großer, ruhiger Typo-Skala, ein asymmetrisches
// Bento-Showcase, großzügiger Sektions-Rhythmus in weichen, groß gerundeten
// Panels, eine saubere Feature-Bento-Fläche und ein aufgeräumtes FAQ-Akkordeon.
// KEIN Hikari-Code, KEINE Hikari-Abhängigkeiten (Supabase/Stripe/tRPC/shadcn/
// magicui/framer/lucide) — alles in unserem Stack (Next static export, Tailwind)
// mit unseren Design-Tokens und unseren deutschen Operator-Texten.
//
// Anti-AI-Kalibrierung bleibt bestehen: kein Partikel-/Ripple-/Aurora-Wust
// (Hikari nutzt das im Hero — bewusst NICHT übernommen), kein Fake-Dashboard,
// kein Count-up-Theater, keine fingierten Avatar/Star-Reihen. Unser Signature-
// Element bleibt das µm-Schichtdicken-Readout + der ruhig gestellte 3D-Annahme-
// Viewer; Beweis kommt aus echten Betrieben, Karte, News, FAQ. Der Branchen-
// Switcher färbt die GANZE Seite um (Kupfer → UV → Teal). Alle Farben über
// Design-Tokens, alle Bewegungen respektieren Reduced-Motion. Angemeldete Nutzer
// gehen direkt ins Dashboard.

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
import DeutschlandKarte, { GERMANY_PATH, VB_W, VB_H } from '@/components/landing/DeutschlandKarte';

// 3D-Showcase nur im Browser laden (WebGL, kein SSR/Static-Export-Prerender);
// bis dahin steht die 2D-Silhouette als Platzhalter — kein Layout-Sprung, die
// feste Höhe der 3D-Bühne gibt die Karte vor.
const LandingCar3D = dynamic(() => import('@/components/landing/LandingCar3D'), {
  ssr: false,
  loading: () => <InstrumentSkeleton />,
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

/**
 * Spotlight-Karte im Hikari-/magicui-Geist, aber mit UNSEREM Token (.spot-card
 * aus globals.css): ein weicher Kupfer-Lichtkegel folgt dem Cursor. Reduced
 * Motion / kein Zeiger: die Karte bleibt ruhig, der Glow sitzt zentriert (CSS
 * ::before mit --mx/--my-Default). Nur Deko — pointer-events der Schicht sind aus.
 */
function SpotCard({
  children,
  className = '',
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'article';
}) {
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!motionOk()) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  const Comp = as;
  return (
    <Comp onMouseMove={onMove} className={`card spot-card ${className}`}>
      {children}
    </Comp>
  );
}

/* ================================= Icons ================================== */
// Dünne Strich-Icons (stroke=currentColor), self-contained — kein Icon-Paket.

type IconProps = { className?: string };
const IconBase = ({ className = 'h-5 w-5', d }: IconProps & { d: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const IconDoc = (p: IconProps) => <IconBase {...p} d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6M9 9h1" />;
const IconShield = (p: IconProps) => <IconBase {...p} d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9.5 12l1.8 1.8 3.5-3.6" />;
const IconUsers = (p: IconProps) => <IconBase {...p} d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 20v-2a4 4 0 0 0-3-3.8M16 3.2A4 4 0 0 1 16 10.8" />;
const IconBoard = (p: IconProps) => <IconBase {...p} d="M4 4h6v16H4zM14 4h6v9h-6zM7 8h0M17 8h0" />;
const IconCalc = (p: IconProps) => <IconBase {...p} d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1M8 7h8M8 11h0M12 11h0M16 11h0M8 15h0M12 15h0M16 15v2" />;
const IconBook = (p: IconProps) => <IconBase {...p} d="M5 5a2 2 0 0 1 2-2h11v18H7a2 2 0 0 0-2 2zM5 19a2 2 0 0 0 2 2h11M9 7h6M9 11h5" />;
const IconBag = (p: IconProps) => <IconBase {...p} d="M6 8h12l-.8 11.2A2 2 0 0 1 15.2 21H8.8a2 2 0 0 1-2-1.8zM9 8V6.5a3 3 0 0 1 6 0V8" />;
const IconCube = (p: IconProps) => (
  <svg viewBox="0 0 24 24" className={p.className ?? 'h-5 w-5'} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.5l8 4.5v9l-8 4.5-8-4.5v-9z" />
    <path d="M12 2.5v19M4 7l8 4.5L20 7" />
  </svg>
);
const IconArrow = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

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

// Feature-Bento (Hikari-Stil): je Kachel Icon + i18n-Basis-Key (`.title`/`.desc`)
// + Spaltenbreite fürs asymmetrische Raster. Die 3D-Schadenserfassung ist die
// breite Anker-Kachel und wird separat mit Fahrzeug-Visual gerendert.
const BENTO: { base: string; icon: (p: IconProps) => JSX.Element; span: string }[] = [
  { base: 'landing.funktionen.rechnungen', icon: IconDoc, span: 'sm:col-span-2 lg:col-span-2' },
  { base: 'landing.funktionen.dsgvo', icon: IconShield, span: 'lg:col-span-1' },
  { base: 'landing.funktionen.kunden', icon: IconUsers, span: 'lg:col-span-1' },
  { base: 'landing.funktionen.auftraege', icon: IconBoard, span: 'lg:col-span-1' },
  { base: 'landing.funktionen.kalkulation', icon: IconCalc, span: 'lg:col-span-1' },
];

// Funktions-Datenblatt: je Zeile ein Label (i18n) und ein technischer Fakt
// (i18n). Ehrliche Fakten statt Icon-Kacheln — Label links, Fakt rechts.
const DATENBLATT: { labelKey: string; factKey: string }[] = [
  { labelKey: 'landing.datenblatt.kunden.label', factKey: 'landing.datenblatt.kunden.fact' },
  { labelKey: 'landing.datenblatt.auftraege.label', factKey: 'landing.datenblatt.auftraege.fact' },
  { labelKey: 'landing.datenblatt.schaden.label', factKey: 'landing.datenblatt.schaden.fact' },
  { labelKey: 'landing.datenblatt.dellen.label', factKey: 'landing.datenblatt.dellen.fact' },
  { labelKey: 'landing.datenblatt.rechnung.label', factKey: 'landing.datenblatt.rechnung.fact' },
  { labelKey: 'landing.datenblatt.zahlung.label', factKey: 'landing.datenblatt.zahlung.fact' },
  { labelKey: 'landing.datenblatt.kasse.label', factKey: 'landing.datenblatt.kasse.fact' },
  { labelKey: 'landing.datenblatt.buchhaltung.label', factKey: 'landing.datenblatt.buchhaltung.fact' },
  { labelKey: 'landing.datenblatt.kalkulation.label', factKey: 'landing.datenblatt.kalkulation.fact' },
  { labelKey: 'landing.datenblatt.shop.label', factKey: 'landing.datenblatt.shop.fact' },
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

/**
 * Großes, zentriertes Sektions-Kopfelement im Hikari-Stil: kleiner Kupfer-Kicker
 * über einer ruhig-großen Überschrift und einem gedämpften Untertitel. Die
 * Typo-Skala ist bewusst großzügig (bis ~text-5xl), bleibt aber tokentreu.
 */
const SectionHead = ({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) => (
  <div className="mx-auto mb-10 max-w-2xl text-center">
    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-copper-300">{kicker}</span>
    <h2 className="mt-3 font-display text-[1.7rem] font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-[2.6rem]">
      {title}
    </h2>
    {sub && <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-chrome-400 sm:text-base">{sub}</p>}
  </div>
);

/**
 * Ankündigungs-Pille (Hikari-Signatur, aber tokentreu): rund, Hairline-Rand,
 * dezenter Kupfer-Punkt links und Pfeil rechts, der bei Hover leicht nach rechts
 * wandert. Als Link auf den Feature-Anker.
 */
const Pill = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a
    href={href}
    className="group inline-flex items-center gap-2.5 rounded-full border border-ink-700/70 bg-ink-800/50 py-1.5 pl-2 pr-3.5 text-[13px] font-medium text-chrome-300 backdrop-blur-sm transition-colors hover:border-ink-600 hover:text-chrome-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
  >
    <span className="inline-flex h-5 items-center rounded-full bg-copper-soft px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-copper-300">
      Neu
    </span>
    <span>{children}</span>
    <IconArrow className="h-3.5 w-3.5 text-copper transition-transform duration-220 ease-emphasized group-hover:translate-x-0.5" />
  </a>
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
function SchichtdickeReadout({ className = 'mt-9 w-full max-w-md' }: { className?: string }) {
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
      className={`rounded-2xl border border-ink-700/70 bg-ink-850/60 p-5 shadow-card ${className}`}
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
        <div className="relative mx-auto max-w-2xl overflow-hidden rounded-[2rem] border border-ink-700/70 bg-ink-800/60 p-8 shadow-card sm:p-10">
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
                  <button type="submit" className="btn-primary shrink-0 rounded-full px-6" disabled={status === 'sending'}>
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
          <Link href="/login" className="btn-ghost btn-sm rounded-full">{t('landing.nav.login')}</Link>
          <Link href="/registrieren" className="btn-primary btn-sm rounded-full">{t('landing.nav.trial')}</Link>
        </div>
      </div>
    </header>
  );
}

/** Würdevoller Ladezustand des 3D-Viewers statt Cartoon-Silhouette: ein ruhiges
 *  Instrument-Panel, das „aufwärmt" — eine atmende Kupfer-Kachel mit Würfel-Icon
 *  über dezenten Skeleton-Balken. Dient als Lade-Platzhalter (dynamic) UND als
 *  Fallback ohne WebGL; das echte 3D-Fahrzeug im Viewer übernimmt, sobald es
 *  steht. Reduced Motion: Atmen/Shimmer werden in globals.css stillgestellt →
 *  ruhige Fläche statt totem „Lädt…". Füllt die 3D-Bühne (h-full). */
const InstrumentSkeleton = () => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-6" aria-hidden>
    <div className="relative grid h-16 w-16 place-items-center">
      <span className="dl-brand-breathe absolute inset-0 rounded-2xl bg-copper-soft" />
      <span className="relative grid h-12 w-12 place-items-center rounded-xl border border-ink-700/70 bg-ink-900/70 text-copper">
        <IconCube className="h-6 w-6" />
      </span>
    </div>
    <div className="w-full max-w-[220px] space-y-2.5">
      <div className="skeleton h-2.5 w-full rounded-full" />
      <div className="skeleton h-2.5 w-3/4 rounded-full" />
      <div className="skeleton h-2.5 w-1/2 rounded-full" />
    </div>
  </div>
);

/** Hero-Instrument: der ruhig gestellte 3D-Annahme-Viewer als Werkzeug auf der
 *  Werkbank (kein Tilt, kein Float, kein Glow-Blob). Echtes 3D-Fahrzeugmodell
 *  mit Scan-Choreografie und Schadens-Pins; ohne WebGL bleibt der neutrale
 *  Instrument-Ladezustand (InstrumentSkeleton) stehen — KEIN Cartoon-Auto. Das
 *  Schäden-Badge zählt live mit den Pins hoch. */
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
          <IconCube className="h-4 w-4" />
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
          fallback={<InstrumentSkeleton />}
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

/**
 * Hero-Showcase: die µm-Schichtdicken-Signature als ruhiger Mittelpunkt direkt
 * unter der zentrierten Headline, daneben das Annahme-Protokoll als Beweiskette.
 * Der EINE interaktive 3D-Viewer wandert bewusst in die eigene 3D-Schadens-
 * erfassungs-Highlight-Sektion (Performance: nur EIN WebGL-Canvas gesamt) —
 * dort trägt das Kern-Wow-Feature groß und interaktiv den Auftritt.
 */
function HeroShowcase() {
  const t = useT();
  const POINTS = ['landing.schaden.point1', 'landing.schaden.point2', 'landing.schaden.point3'];
  return (
    <div className="mx-auto max-w-4xl">
      <div className="grid gap-4 md:grid-cols-2">
        <SchichtdickeReadout className="w-full" />
        <div className="card">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-chrome-500">
            {t('landing.schaden.cardHeader')}
          </span>
          <ul className="mt-3 space-y-2.5">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm leading-relaxed text-chrome-300">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-copper" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {t(p)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Feature-Bento (Hikari-Signatur): eine groß gerundete, dezent getönte Fläche mit
 * asymmetrischem 3×2-Kachel-Raster. Jede Kachel ist eine Spot-Card (Kupfer-
 * Spotlight folgt dem Cursor). Darunter das technische Datenblatt (Label ↔ Fakt).
 * Die 3D-Schadenserfassung hat eine EIGENE Highlight-Sektion mit dem echten
 * Viewer (SchadenHighlight); Buchhaltung + Shop eine eigene Passage.
 */
function FeatureBento() {
  const t = useT();
  return (
    <section id="funktionen" className="scroll-mt-24 pb-24">
      <div className="rounded-[2.25rem] border border-ink-700/60 bg-ink-850/40 p-5 shadow-card sm:p-8 md:p-10">
        <Reveal>
          <SectionHead
            kicker={t('landing.funktionen.kicker')}
            title={t('landing.funktionen.title')}
            sub={t('landing.funktionen.sub')}
          />
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENTO.map(({ base, icon: Icon, span }, i) => (
            <Reveal key={base} delay={(i % 3) * 80} className={`h-full ${span}`}>
              <SpotCard className="h-full">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-ink-700/70 bg-ink-900/60 text-copper">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-chrome-50">{t(`${base}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-chrome-400">{t(`${base}.desc`)}</p>
              </SpotCard>
            </Reveal>
          ))}
        </div>

        {/* Technisches Datenblatt (unser Anti-AI-Beweis: Label ↔ Fakt). */}
        <Reveal>
          <div className="mt-6 overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900/40 shadow-card">
            <div className="flex items-center gap-2 border-b border-ink-700/60 px-5 py-3.5 sm:px-6">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-copper-300">
                {t('landing.datenblatt.kicker')}
              </span>
              <span className="text-xs text-chrome-500">· {t('landing.datenblatt.sub')}</span>
            </div>
            <dl className="grid sm:grid-cols-2">
              {DATENBLATT.map((row, i) => (
                <div
                  key={row.labelKey}
                  className={`flex items-baseline justify-between gap-4 px-5 py-3.5 sm:px-6 ${i >= 2 ? 'border-t border-ink-700/40' : ''} ${i % 2 === 1 ? 'sm:border-l sm:border-ink-700/40' : ''}`}
                >
                  <dt className="font-display text-sm font-semibold text-chrome-100">{t(row.labelKey)}</dt>
                  <dd className="text-right font-mono text-[12px] tabular-nums text-chrome-400">{t(row.factKey)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <p className="mt-4 text-center text-sm text-chrome-500">{t('landing.datenblatt.footnote')}</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ---- 3D-Schadenserfassung – Highlight mit dem EINEN interaktiven Viewer --- */

/**
 * Kern-Wow-Feature als eigene Highlight-Sektion: der EINE interaktive
 * LandingCar3D-Viewer (Scan-Choreografie, Marker-Puls am Modell, „Unterschrift
 * erfasst") steht hier groß rechts, links die Beweiskette (Schadenspunkte am
 * 3D-Modell, Fotos je Schaden, digitale Unterschrift). Es gibt weiterhin nur
 * EINEN WebGL-Canvas auf der Seite — er lebt ausschließlich hier.
 */
function SchadenHighlight({ branche }: { branche: Betriebstyp }) {
  const t = useT();
  const POINTS = ['landing.schaden.point1', 'landing.schaden.point2', 'landing.schaden.point3'];
  return (
    <section id="schadenserfassung" className="scroll-mt-24 pb-24">
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <Reveal>
          <div>
            <span className="badge-copper">{t('landing.schaden.kicker')}</span>
            <h2 className="mt-4 font-display text-[1.7rem] font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-[2.4rem]">
              {t('landing.schaden.title')}
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-chrome-300 sm:text-base">
              {t('landing.schaden.desc')}
            </p>
            <ul className="mt-6 space-y-3">
              {POINTS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm text-chrome-200">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-copper-soft text-copper">
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  {t(p)}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal variant="scale">
          <AnnahmeInstrument branche={branche} />
        </Reveal>
      </div>
    </section>
  );
}

/* ---- Buchhaltung + Shop: ausführlichere Feature-Passagen ------------------ */

/**
 * Zwei erklärende Feature-Passagen (über Datenblatt-Zeile + Bento hinaus):
 * Buchhaltung und Shop/Marktplatz mit konkreten App-Fakten und je einem
 * hervorgehobenen Nutzen-Satz. Hikari-Stil, keine neue Effekt-Ebene.
 */
function BuchhaltungShopSektion() {
  const t = useT();
  const CARDS: { icon: (p: IconProps) => JSX.Element; base: string; nutzen: string }[] = [
    { icon: IconBook, base: 'landing.funktionen.buchhaltung', nutzen: 'landing.finanzShop.buchhaltung.nutzen' },
    { icon: IconBag, base: 'landing.funktionen.shop', nutzen: 'landing.finanzShop.shop.nutzen' },
  ];
  return (
    <section className="pb-24">
      <Reveal>
        <SectionHead kicker={t('landing.finanzShop.kicker')} title={t('landing.finanzShop.title')} />
      </Reveal>
      <div className="grid gap-4 md:grid-cols-2">
        {CARDS.map(({ icon: Icon, base, nutzen }, i) => (
          <Reveal key={base} delay={i * 90} className="h-full">
            <div className="card h-full">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-ink-700/70 bg-ink-900/60 text-copper">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-chrome-50">{t(`${base}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-chrome-300">{t(`${base}.desc`)}</p>
              <p className="mt-4 flex items-start gap-2 border-t border-ink-700/50 pt-4 text-sm font-medium text-copper-300">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                {t(nutzen)}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---- Bundesweit: stilisierte Deutschlandkarte (Positionierung) ------------ */

// Dekorative, geografisch plausible Punkte (aus den realen Leitregion-Positionen
// der wiederverwendeten Karte). BEWUSST illustrativ/positionierend: keine echten
// Betriebsnamen, keine Adressen, KEINE erfundene Betriebszahl als Fakt. Der echte
// Social-Proof-Nachweis bleibt die datengetriebene Karte in der Mitglieder-
// Sektion (rendert nur mit echten, zustimmenden Betrieben).
const BUND_DOTS: [number, number][] = [
  [449, 279], [273, 187], [354, 673], [114, 421], [203, 497], [229, 616],
  [397, 387], [469, 414], [260, 295], [212, 231], [328, 556], [142, 372],
  [281, 119], [385, 140], [162, 689], [118, 576], [328, 420], [151, 332],
];

/**
 * „Bundesweit"-Sektion: die SELBE self-contained SVG-Silhouette wie die echte
 * Mitglieder-Karte (wiederverwendet über den Export), hier als ruhiges,
 * sekundäres Highlight mit dezent verteilten Punkten. Positionierend statt
 * behauptend — der Text nennt KEINE konkrete Betriebszahl. Keine Karten-Library,
 * keine externen Tiles. Punkte statisch (reduced-motion-sicher); der Auftritt
 * kommt aus dem Reveal.
 */
function BundesweitSektion() {
  const t = useT();
  return (
    <section className="pb-24">
      <Reveal>
        <SectionHead
          kicker={t('landing.bundesweit.kicker')}
          title={t('landing.bundesweit.title')}
          sub={t('landing.bundesweit.sub')}
        />
      </Reveal>
      <Reveal variant="scale">
        <div className="mx-auto max-w-[420px]">
          <div className="relative rounded-[2rem] border border-ink-700/60 bg-ink-850/40 p-6 shadow-card sm:p-8">
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              className="h-auto w-full"
              role="img"
              aria-label={t('landing.bundesweit.aria')}
            >
              <defs>
                <linearGradient id="dl-bund-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--ink-750))" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="rgb(var(--ink-850))" stopOpacity="0.7" />
                </linearGradient>
                <radialGradient id="dl-bund-glow" cx="52%" cy="42%" r="60%">
                  <stop offset="0%" stopColor="var(--copper-glow)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
              </defs>
              <path d={GERMANY_PATH} fill="url(#dl-bund-glow)" opacity="0.5" />
              <path
                d={GERMANY_PATH}
                fill="url(#dl-bund-fill)"
                stroke="rgb(var(--copper-500))"
                strokeOpacity="0.45"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              {BUND_DOTS.map(([x, y], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r="11" fill="var(--copper-glow)" opacity="0.5" />
                  <circle cx={x} cy={y} r="4.5" fill="rgb(var(--copper-500))" />
                  <circle cx={x} cy={y} r="4.5" fill="none" stroke="rgb(var(--copper-300))" strokeOpacity="0.6" strokeWidth="1" />
                </g>
              ))}
            </svg>
            <p className="mt-5 text-center text-xs leading-relaxed text-chrome-500">
              {t('landing.bundesweit.caption')}
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---- Dellenkalkulation (Smart Repair / PDR) – leichte SVG/CSS-Mini-Demo ---- */

// Illustrative Beispiel-Positionen + Beträge (siehe Note-Text: der Betrieb legt
// eigene Sätze fest). BEWUSST KEIN zweiter three.js/WebGL-Canvas — reines
// SVG/CSS/State, damit LCP/Bundle der Landing nicht leiden.
const DELLEN_DEMO: { key: string; preis: number; x: string; y: string }[] = [
  { key: 'landing.dellen.marker1', preis: 45, x: '30%', y: '58%' },
  { key: 'landing.dellen.marker2', preis: 60, x: '56%', y: '38%' },
  { key: 'landing.dellen.marker3', preis: 35, x: '76%', y: '64%' },
];

/**
 * Mini-Demo der 3D-Dellenkalkulation, LEICHTGEWICHTIG: auf einer abstrakten
 * Lack-Panel-Fläche werden beim Sichtbarwerden nacheinander 3 Dellen-Marker
 * „gesetzt" (Puls), rechts baut sich der Sofortpreis Posten für Posten auf.
 * Reduced Motion / kein IntersectionObserver: sofort alle Marker + Endsumme
 * (Standbild). Beträge sind Beispielwerte (Note-Text). Sekundäres Highlight —
 * das µm-Readout bleibt das eine Signature-Element.
 */
function DellenDemo() {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!motionOk() || typeof IntersectionObserver === 'undefined') {
      setPlaced(DELLEN_DEMO.length);
      return;
    }
    const timers: number[] = [];
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(el);
          DELLEN_DEMO.forEach((_, i) => {
            timers.push(window.setTimeout(() => setPlaced(i + 1), 450 + i * 780));
          });
        }),
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((tid) => window.clearTimeout(tid));
    };
  }, []);

  const summe = DELLEN_DEMO.slice(0, placed).reduce((s, d) => s + d.preis, 0);

  return (
    <section className="pb-24">
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <Reveal>
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-copper-300">
              {t('landing.dellen.kicker')}
            </span>
            <h2 className="mt-3 font-display text-[1.7rem] font-bold leading-[1.1] tracking-tight sm:text-4xl">
              {t('landing.dellen.title')}
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-chrome-300 sm:text-base">
              {t('landing.dellen.desc')}
            </p>
          </div>
        </Reveal>

        <Reveal variant="scale">
          <div ref={ref} className="card" role="img" aria-label={t('landing.dellen.aria')}>
            <div className="mb-4 flex items-center justify-between text-xs text-chrome-500">
              <span className="flex items-center gap-2 font-mono uppercase tracking-[0.1em]">
                <IconCube className="h-4 w-4" />
                {t('landing.dellen.cardHeader')}
              </span>
              <span className="badge-copper">{t('landing.dellen.priceLabel')}</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1.25fr_1fr]">
              {/* Abstrakte Lack-Panel-Fläche mit gesetzten Dellen-Markern */}
              <div
                className="relative h-44 overflow-hidden rounded-2xl border border-ink-700/70 sm:h-52"
                style={{
                  background:
                    'radial-gradient(120% 90% at 30% 20%, rgb(var(--ink-750)), rgb(var(--ink-900)) 70%)',
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{ backgroundImage: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 18px)' }}
                />
                {DELLEN_DEMO.map((d, i) => (
                  <span
                    key={d.key}
                    className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-emphasized"
                    style={{ left: d.x, top: d.y, opacity: placed > i ? 1 : 0, transform: `translate(-50%,-50%) scale(${placed > i ? 1 : 0.4})` }}
                  >
                    <span className="relative grid h-6 w-6 place-items-center">
                      <span className="absolute inset-0 rounded-full ring-1 ring-copper/40" />
                      <span className="absolute inset-1.5 rounded-full ring-1 ring-copper/25" />
                      <span className="h-2.5 w-2.5 rounded-full bg-copper-grad shadow-glow" />
                    </span>
                    <span className="absolute left-1/2 top-[-1.6rem] -translate-x-1/2 whitespace-nowrap rounded-full bg-ink-900/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-copper-300 ring-1 ring-copper/30">
                      +{d.preis} €
                    </span>
                  </span>
                ))}
              </div>

              {/* Posten-Aufbau + Summe */}
              <div className="flex flex-col">
                <ul className="space-y-2">
                  {DELLEN_DEMO.map((d, i) => (
                    <li
                      key={d.key}
                      className="flex items-center justify-between gap-3 text-sm transition-opacity duration-300"
                      style={{ opacity: placed > i ? 1 : 0.25 }}
                    >
                      <span className="text-chrome-300">
                        {t('landing.dellen.item')} · {t(d.key)}
                      </span>
                      <span className="font-mono tabular-nums text-chrome-200">
                        {placed > i ? `+${d.preis} €` : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-baseline justify-between border-t border-ink-700/60 pt-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-chrome-500">
                    {t('landing.dellen.priceLabel')}
                  </span>
                  <span className="font-mono text-2xl font-semibold tabular-nums text-copper">{summe} €</span>
                </div>
              </div>
            </div>

            <p className="mt-4 border-t border-ink-700/50 pt-3 text-[11px] leading-relaxed text-chrome-500">
              {t('landing.dellen.note')}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
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

      {/* Ruhiger Hintergrund (Anti-AI): KEINE Aurora-Blobs, KEINE Partikel, KEIN
          Ripple (Hikari nutzt das im Hero — bewusst nicht übernommen). Die Body-
          Vignette (globals.css) trägt die Tiefe; darüber nur eine statische
          Brushed-Metal-Mikrotextur ≤3 %. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        aria-hidden
        style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 1px, transparent 1px 4px)' }}
      />

      <Nav />

      <div id="hauptinhalt" tabIndex={-1} className="relative z-10 mx-auto w-full max-w-6xl px-5 focus:outline-none sm:px-8">
        {/* ---- Hero (zentriert, Hikari-Choreografie) ---- */}
        <section className="pb-10 pt-32 sm:pt-40">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center animate-fade-in">
            <Pill href="#funktionen">{t('landing.hero.badge')}</Pill>
            <h1 className="font-display text-[2.4rem] font-bold leading-[1.06] tracking-tight text-chrome-50 sm:text-5xl md:text-[3.75rem]">
              {t('landing.hero.headlinePre')}
              <span className="text-copper">{t('landing.hero.headlineEm')}</span>
              {t('landing.hero.headlinePost')}
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-chrome-300 sm:text-lg">
              {t('landing.hero.sub')}
            </p>
            <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
              <Link href="/registrieren" className="btn-primary rounded-full px-7 py-3 text-base">
                {t('landing.hero.ctaPrimary')}
              </Link>
              <a href="#funktionen" className="btn-ghost group rounded-full px-7 py-3 text-base">
                {t('landing.hero.ctaSecondary')}
                <IconArrow className="h-4 w-4 transition-transform duration-220 ease-emphasized group-hover:translate-x-0.5" />
              </a>
            </div>
            <p className="text-xs text-chrome-500">{t('landing.hero.trailer')}</p>
          </div>

          {/* Hero-Showcase: µm-Readout (Signature) + Annahme-Protokoll; der EINE
              3D-Viewer steht in der 3D-Schadenserfassungs-Highlight-Sektion. */}
          <Reveal variant="scale" delay={80} className="mt-14 block">
            <HeroShowcase />
          </Reveal>
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
                <div className="flex items-start gap-3 rounded-2xl border border-ink-700/60 bg-ink-800/40 p-4 transition-colors hover:border-ink-600">
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

        {/* ---- 3D-Schadenserfassung (Kern-Wow-Feature, DER eine Viewer) ---- */}
        <SchadenHighlight branche={branche} />

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
              <Link href={`/registrieren?typ=${branche}`} className="btn-primary rounded-full px-5">
                {t('landing.branchen.cta', { label: t(BETRIEBSTYP_LABEL_KEY[branche].label) })}
              </Link>
              <span className="text-sm text-chrome-500">
                {t('landing.branchen.complete')} <Link href="/registrieren?typ=komplett" className="link-action">{t('landing.branchen.completeCta')}</Link>
              </span>
            </div>
          </Reveal>
        </section>

        {/* ---- Bundesweit (stilisierte DE-Karte, Positionierung) ---- */}
        <BundesweitSektion />

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

        {/* ---- Funktionen als Feature-Bento + Datenblatt (Hikari-Kern) ---- */}
        <FeatureBento />

        {/* ---- Buchhaltung + Shop: ausführlichere Feature-Passagen ---- */}
        <BuchhaltungShopSektion />

        {/* ---- Dellenkalkulation (Smart Repair / PDR) – leichte Mini-Demo ---- */}
        <DellenDemo />

        {/* ---- Mitglieder (echte, zustimmende Betriebe · Opt-in) + Karte ---- */}
        <MitgliederSection />

        {/* ---- Warum Detailly (Positionierung) ---- */}
        <section className="pb-24">
          <Reveal>
            <div className="mx-auto max-w-3xl rounded-[2rem] border border-ink-700/60 bg-ink-800/40 p-8 text-center sm:p-12">
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
              <Link href="/news" className="btn-ghost rounded-full px-5">{t('landing.news.all')}</Link>
            </div>
          </Reveal>
        </section>

        {/* ---- FAQ (Hikari-Akkordeon, aber <details> für a11y/No-JS) ---- */}
        <section id="faq" className="scroll-mt-24 pb-24">
          <Reveal>
            <SectionHead kicker={t('landing.faq.kicker')} title={t('landing.faq.title')} />
          </Reveal>
          <div className="mx-auto max-w-2xl space-y-3">
            {FAQ_KEYS.map((k, i) => (
              <Reveal key={k} delay={(i % 3) * 70}>
                <details className="group overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-800/40 px-5 transition-colors hover:border-ink-600 open:border-ink-600 open:bg-ink-800/60 [&_summary]:list-none">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-left text-[15px] font-semibold text-chrome-100">
                    {t(`${k}.q`)}
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ink-700/70 bg-ink-900/60 text-copper">
                      <svg viewBox="0 0 24 24" className="faq-chev h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
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
            <div className="relative overflow-hidden rounded-[2rem] border border-copper/25 bg-ink-800/70 p-8 text-center shadow-card sm:p-14">
              <h2 className="mx-auto max-w-xl font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {t('landing.cta.title')}
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-chrome-300 sm:text-base">
                {t('landing.cta.sub')}
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/registrieren" className="btn-primary rounded-full px-7 py-3 text-base">
                  {t('landing.cta.primary')}
                </Link>
                <Link href="/login" className="btn-subtle rounded-full px-7 py-3 text-base">
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
