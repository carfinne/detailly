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
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { BETRIEBSTYP_META, type Betriebstyp } from '@/lib/branche';
import { BrandMark as BrandMarkBase } from '@/components/brand';
import { neuesteNews, formatNewsDatum } from '@/lib/news';

/* ============================== Motion-Helfer ============================== */

/** true, wenn Animationen erwünscht sind (System + persönliche Einstellung). */
function motionOk() {
  if (typeof window === 'undefined') return false;
  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    !document.documentElement.classList.contains('dl-reduce-motion')
  );
}

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

/**
 * Zahl zählt beim ersten Sichtbarwerden hoch. Server rendert den Endwert
 * (No-JS/SEO-sicher); mit JS + erlaubter Bewegung wird ab 0 animiert.
 */
function CountUp({ to, duration = 1300 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !motionOk() || typeof IntersectionObserver === 'undefined') return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(el);
          const t0 = performance.now();
          const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / duration);
            const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
            el.textContent = String(Math.round(to * eased));
            if (p < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }),
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);
  return (
    <span ref={ref} className="tnum">
      {to}
    </span>
  );
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

const TRUST = ['DSGVO-konform', 'GoBD-konforme Rechnungen', 'Made in Germany', 'Daten verschlüsselt', 'Keine Installation'];

const MARQUEE = [
  'Innenaufbereitung', 'Keramikversiegelung', 'Vollfolierung', 'PPF Frontpaket', 'Politur', 'Farbwechsel',
  'Steinschlagschutz', 'Leasingrückgabe', 'Teilfolierung', 'Lederpflege', 'Scheibentönung', 'Komplettschutz',
];

const PROBLEMS = [
  'Die Fahrzeughistorie liegt verteilt auf Ordnern, Zetteln und im Kopf.',
  'Rechnungen bleiben liegen — und kosten dich bares Geld.',
  'Schäden bei der Annahme lassen sich später kaum noch nachweisen.',
  'Fünf verschiedene Tools, die nicht miteinander reden.',
];

type Step = { n: string; title: string; desc: string };
const STEPS: Step[] = [
  { n: '01', title: 'Annehmen', desc: 'Kunde, Fahrzeug und Schäden in Minuten erfasst — mit 3D-Markierung, Fotos und digitaler Unterschrift.' },
  { n: '02', title: 'Abwickeln', desc: 'Leistungen kalkulieren, Termine auf der Plantafel planen, den Fortschritt jederzeit im Blick behalten.' },
  { n: '03', title: 'Abrechnen', desc: 'Aus dem Auftrag wird per Klick die GoBD-konforme Rechnung als PDF — inklusive Fälligkeiten und Mahnwesen.' },
];

type Feature = { title: string; desc: string; icon: React.ReactNode };
const ICON = 'h-5 w-5';
const FEATURES: Feature[] = [
  {
    title: 'Kunden & Fahrzeuge',
    desc: 'Stammdaten, Fahrzeugakte und komplette Historie pro Fahrzeug — sofort auffindbar.',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5" /><path d="M14 18l1-3h5l1 3M13.5 18h9v2.5h-9zM15 21v1M21 21v1" />
      </svg>
    ),
  },
  {
    title: 'Aufträge & Plantafel',
    desc: 'Vom Angebot bis zur Abnahme. Wochenplanung mit Terminen — alles im Blick.',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 9h16M8 3v4M16 3v4M8 13h3M8 17h6" />
      </svg>
    ),
  },
  {
    title: 'Rechnungen & Belege',
    desc: '§14- & GoBD-konforme Rechnungen und Angebote als PDF, inkl. Fälligkeiten und Mahnwesen.',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12v18l-3-1.6L12 21l-3-1.6L6 21z" /><path d="M9 8h6M9 12h6M9 16h3" />
      </svg>
    ),
  },
  {
    title: '3D-Schadenserfassung',
    desc: 'Schäden direkt am Fahrzeugmodell markieren, mit Fotos dokumentieren und digital unterschreiben lassen.',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.5l8 4.5v9l-8 4.5-8-4.5v-9z" /><path d="M12 2.5v19M4 7l8 4.5L20 7" />
      </svg>
    ),
  },
  {
    title: 'Kalkulation je Gewerk',
    desc: 'Leistungskataloge und Preislogik für Aufbereitung, Folierung und PPF — passend zu deinem Schwerpunkt.',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v4M8 19h.01M12 19h.01" />
      </svg>
    ),
  },
  {
    title: 'DSGVO & Sicherheit',
    desc: 'Sensible Daten verschlüsselt, strikt pro Betrieb getrennt, mit Datenexport und Löschung auf Knopfdruck.',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
];

const GROWTH_POINTS: Feature[] = [
  {
    title: 'Echtzeit-Überblick',
    desc: 'Umsatz, offene Aufträge und Termine live im Dashboard — du siehst sofort, wo es läuft und wo es hakt.',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-6" />
      </svg>
    ),
  },
  {
    title: 'Mehrere Standorte',
    desc: 'Filialen unter einem Dach verwalten — sauber getrennt und trotzdem zentral im Blick. Ausbaufähig, wann immer du wächst.',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 11h.01M15 11h.01" />
      </svg>
    ),
  },
  {
    title: 'Team, Rollen & Rechte',
    desc: 'Mitarbeiter einladen und Rollen vergeben — jeder sieht genau das, was er soll. Sauber überwacht und dokumentiert.',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 3.5a3 3 0 0 1 0 5.8M18 20c0-2.6-1.3-4.4-3.3-5.2" />
      </svg>
    ),
  },
];

// Branchen-Karten: Reihenfolge + typische Leistungen je Gewerk. Label/Claim/
// Beschreibung kommen aus der gemeinsamen Quelle BETRIEBSTYP_META.
const BRANCHEN: { typ: Betriebstyp; leistungen: string[] }[] = [
  { typ: 'aufbereitung', leistungen: ['Innen- & Außenaufbereitung', 'Politur & Keramikversiegelung', 'Leasingrückgabe-Checks'] },
  { typ: 'folierung', leistungen: ['Voll- & Teilfolierung', 'Farbwechsel & Design', 'Werbebeschriftung'] },
  { typ: 'ppf', leistungen: ['Front- & Komplettschutz', 'Steinschlagschutz-Pakete', 'Präzise Zuschnitte'] },
];

// Stimmen aus dem Pilotbetrieb. PLATZHALTER-Zitate ohne Namen — vor dem
// öffentlichen Launch durch echte, freigegebene Kundenstimmen ersetzen.
const QUOTES = [
  { text: 'Endlich sehe ich morgens auf einen Blick, was heute in der Halle passiert. Die Zettelwirtschaft ist weg.', who: 'Inhaber · Aufbereitungs-Studio', typ: 'aufbereitung' as Betriebstyp },
  { text: 'Die 3D-Schadenserfassung bei der Annahme hat uns schon zweimal vor teuren Diskussionen bewahrt.', who: 'Geschäftsführer · Folierungs-Betrieb', typ: 'folierung' as Betriebstyp },
  { text: 'Aus dem fertigen Auftrag wird in Sekunden die Rechnung. Das hat früher den Feierabend gekostet.', who: 'Werkstattleitung · PPF-Studio', typ: 'ppf' as Betriebstyp },
];

const FAQ = [
  {
    q: 'Brauche ich technisches Wissen oder eine Installation?',
    a: 'Nein. Du registrierst deinen Betrieb und legst direkt im Browser los — auf Computer, Tablet oder Smartphone. Es gibt nichts zu installieren und nichts einzurichten.',
  },
  {
    q: 'Ich mache Aufbereitung UND Folierung — was wähle ich?',
    a: 'Dann bist du Komplett-Anbieter: Bei der Registrierung wählst du einfach „Komplett-Anbieter" und bekommst alle Leistungskataloge und Kalkulationen zusammen.',
  },
  {
    q: 'Wie sicher sind meine Kundendaten?',
    a: 'Sensible Daten werden verschlüsselt gespeichert und sind strikt von anderen Betrieben getrennt. Kundendaten kannst du jederzeit exportieren oder löschen — komplett DSGVO-konform.',
  },
  {
    q: 'Was passiert nach den 14 Tagen?',
    a: 'Du testest ohne Kreditkarte und ohne Risiko. Nach der Testphase wählst du den Tarif, der zu deinem Betrieb passt. Endet die Testphase, entstehen dir keine Kosten.',
  },
  {
    q: 'Läuft das auch auf dem Tablet in der Werkstatt?',
    a: 'Ja. Detailly ist für jedes Gerät gebaut — vom Büro-PC bis zum Tablet an der Fahrzeugannahme. Die Bedienung passt sich automatisch an.',
  },
  {
    q: 'Kann ich meine Daten wieder mitnehmen?',
    a: 'Jederzeit. Deine Daten gehören dir — ein Export ist auf Knopfdruck möglich, ohne dass du jemanden fragen musst.',
  },
];

/* ============================== Bausteine ================================= */

const SectionHead = ({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) => (
  <div className="mb-10 text-center">
    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">{kicker}</span>
    <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
    {sub && <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-chrome-400">{sub}</p>}
  </div>
);

/** Fixe Kopfleiste: transparent über dem Hero, ab Scroll mit Blur + Hairline. */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const anchors = [
    { href: '#branchen', label: 'Branchen' },
    { href: '#ablauf', label: 'So funktioniert’s' },
    { href: '#funktionen', label: 'Funktionen' },
    { href: '#faq', label: 'FAQ' },
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
              {a.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="btn-ghost btn-sm">Anmelden</Link>
          <Link href="/registrieren" className="btn-primary btn-sm">Kostenlos testen</Link>
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

/** Verspieltes Band: ein Sportwagen fährt langsam hindurch. */
function CarBand() {
  return (
    <div className="relative mb-6 h-28 overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-800/30">
      <div className="dl-float pointer-events-none absolute -bottom-10 left-1/2 h-32 w-72 -translate-x-1/2 rounded-full bg-copper-glow opacity-50 blur-[80px]" />
      <span className="absolute left-1/2 top-3.5 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-[0.16em] text-chrome-600">
        Volle Fahrt voraus
      </span>
      <div className="absolute bottom-[20px] left-6 right-6 h-px bg-gradient-to-r from-transparent via-ink-600 to-transparent" />
      <div className="dl-car">
        <CarSilhouette />
      </div>
    </div>
  );
}

/** Schadens-Pin mit Radar-Ping fürs Schadenserfassungs-Showcase. */
const DamagePin = ({ left, top, delay = 0 }: { left: string; top: string; delay?: number }) => (
  <span className="gpin absolute" style={{ left, top, transitionDelay: `${delay}ms` }}>
    <span className="relative grid h-5 w-5 place-items-center">
      <span className="dl-ping absolute inset-0 rounded-full bg-copper-glow" style={{ animationDelay: `${delay}ms` }} />
      <span className="relative h-2.5 w-2.5 rounded-full bg-copper-grad shadow-glow" />
    </span>
  </span>
);

/** Wachstums-Diagramm: Balken wachsen hoch + Standort-Pins ploppen herein. */
function GrowthChart() {
  const ref = useGrown();
  const bars = [26, 34, 30, 46, 58, 70, 90];
  return (
    <div ref={ref} className="card-flush p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-chrome-200">Auftragsvolumen</span>
        <span className="badge-positive">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 17l6-6 4 4 6-7" /><path d="M20 8h-4M20 8v4" />
          </svg>
          wächst
        </span>
      </div>
      <div className="flex h-36 items-end gap-2">
        {bars.map((h, i) => (
          <div key={i} className="gbar flex-1 rounded-t-md bg-copper-grad" style={{ height: `${h}%`, transitionDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <div className="mt-5 border-t border-ink-700/60 pt-4">
        <div className="mb-2.5 flex items-center justify-between text-xs text-chrome-500">
          <span>Standorte</span>
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
              Die Werkstatt-Software für Aufbereitung, Folierung &amp; PPF
            </span>
          </div>
          <Headline
            lines={[
              { text: 'Dein Handwerk ist Präzision.' },
              { text: 'Deine Software jetzt auch.', gradient: true },
            ]}
          />
          <Reveal delay={450}>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-chrome-300 sm:text-lg">
              Detailly bündelt Kunden, Fahrzeuge, Aufträge, Plantafel, 3D-Schadenserfassung und
              GoBD-konforme Rechnungen in einer Software — DSGVO-konform, auf jedem Gerät.
              Schluss mit Zettelwirtschaft.
            </p>
          </Reveal>
          <Reveal delay={550}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/registrieren" className="btn-primary w-full px-6 py-3 text-base sm:w-auto">
                14 Tage kostenlos testen
              </Link>
              <a href="#funktionen" className="btn-ghost w-full px-6 py-3 text-base sm:w-auto">
                Funktionen ansehen
              </a>
            </div>
          </Reveal>
          <Reveal delay={620}>
            <p className="mt-4 text-xs text-chrome-500">Keine Kreditkarte nötig · In Minuten startklar · Monatlich kündbar</p>
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
            {TRUST.map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-xs font-medium text-chrome-400">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-copper" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {t}
              </span>
            ))}
          </div>
        </Reveal>

        {/* ---- Problem ---- */}
        <section className="pb-24">
          <Reveal>
            <SectionHead
              kicker="Kennst du das?"
              title="Der Betrieb läuft — die Verwaltung bremst."
              sub="Während die Arbeit am Fahrzeug Präzision verlangt, versinkt das Drumherum im Papierkram."
            />
          </Reveal>
          <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
            {PROBLEMS.map((p, i) => (
              <Reveal key={p} delay={(i % 2) * 80}>
                <div className="flex items-start gap-3 rounded-xl border border-ink-700/60 bg-ink-800/40 p-4">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-chrome-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" />
                  </svg>
                  <p className="text-sm leading-relaxed text-chrome-300">{p}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <p className="mx-auto mt-7 max-w-xl text-center text-base text-chrome-200">
              Detailly bringt all das in <span className="text-gradient font-semibold">ein</span> System — übersichtlich, schnell, an jedem Gerät.
            </p>
          </Reveal>
        </section>

        {/* ---- Branchen-Switcher (Signature-Interaktion) ---- */}
        <section id="branchen" className="scroll-mt-24 pb-10">
          <Reveal>
            <SectionHead
              kicker="Für dein Gewerk gebaut"
              title="Eine Software, die dein Gewerk spricht"
              sub="Beim Start wählst du deinen Schwerpunkt — Detailly stellt Leistungskatalog, Kalkulation und sogar den Look darauf ein. Probier es aus: Wähle dein Gewerk und sieh zu, wie sich die Seite umfärbt."
            />
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {BRANCHEN.map(({ typ, leistungen }, i) => {
              const meta = BETRIEBSTYP_META[typ];
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
                      {aktiv && <span className="badge-copper">Ausgewählt</span>}
                    </span>
                    <span className="mt-4 block font-display text-lg font-semibold text-chrome-50">{meta.label}</span>
                    <span className="mt-0.5 block text-xs font-semibold uppercase tracking-[0.1em] text-copper-300">{meta.claim}</span>
                    <ul className="mt-4 space-y-2">
                      {leistungen.map((l) => (
                        <li key={l} className="flex items-center gap-2 text-sm text-chrome-300">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-copper" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                          {l}
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
                Als {BETRIEBSTYP_META[branche].label} starten
              </Link>
              <span className="text-sm text-chrome-500">
                Alles aus einer Hand? <Link href="/registrieren?typ=komplett" className="link-action">Als Komplett-Anbieter starten</Link>
              </span>
            </div>
          </Reveal>
        </section>

        {/* ---- Leistungs-Marquee ---- */}
        <div className="relative mb-24 overflow-hidden py-3" aria-hidden="true">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-ink-900 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-ink-900 to-transparent" />
          <div className="dl-marquee">
            {[0, 1].map((half) => (
              <div key={half} className="flex shrink-0 items-center">
                {MARQUEE.map((m) => (
                  <span key={`${half}-${m}`} className="mx-3 flex items-center gap-3 whitespace-nowrap text-sm font-medium text-chrome-500">
                    <span className="dot bg-copper opacity-60" />
                    {m}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ---- So funktioniert's ---- */}
        <section id="ablauf" className="scroll-mt-24 pb-24">
          <Reveal>
            <SectionHead kicker="So einfach geht's" title="In drei Schritten zum sauberen Ablauf" />
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
                  <h3 className="mt-3 font-display text-lg font-semibold text-chrome-50">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-chrome-400">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---- Funktionen ---- */}
        <section id="funktionen" className="scroll-mt-24 pb-24">
          <Reveal>
            <SectionHead
              kicker="Alle Werkzeuge"
              title="Alles, was dein Betrieb braucht"
              sub="Ein durchgängiger Ablauf — von der Fahrzeugannahme bis zur bezahlten Rechnung."
            />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80} className="h-full">
                <div onMouseMove={spotlight} className="card spot-card group h-full transition-all duration-220 ease-emphasized hover:-translate-y-1 hover:border-copper/40">
                  <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl border border-copper/25 bg-copper-soft text-copper-300 transition-transform duration-220 ease-emphasized group-hover:scale-110">
                    {f.icon}
                  </div>
                  <h3 className="font-display text-base font-semibold text-chrome-50">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-chrome-400">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <p className="mt-6 text-center text-sm text-chrome-500">
              Plus: blitzschnelle globale Suche (<kbd className="rounded border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[11px] text-chrome-300">⌘K</kbd>),
              mobile Navigation und mehrere Mitarbeiter pro Betrieb.
            </p>
          </Reveal>
        </section>

        {/* ---- 3D-Schadenserfassung (Showcase) ---- */}
        <section className="pb-24">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <Reveal>
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">Das Highlight</span>
                <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  Schäden festhalten, bevor sie zum Streit werden
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-chrome-400 sm:text-base">
                  Bei der Annahme markierst du Kratzer, Dellen und Steinschläge direkt am Fahrzeugmodell —
                  mit Fotos und digitaler Unterschrift des Kunden. Wenn später Fragen kommen, hast du die
                  Beweise. Schwarz auf weiß.
                </p>
                <ul className="mt-6 space-y-3">
                  {['Schadenspunkte direkt am 3D-Modell setzen', 'Fotos je Schaden — automatisch zugeordnet', 'Digitale Unterschrift bei Annahme und Abnahme'].map((t) => (
                    <li key={t} className="flex items-center gap-3 text-sm text-chrome-200">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-copper/25 bg-copper-soft">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-copper" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal variant="scale" delay={100}>
              <DamageShowcase />
            </Reveal>
          </div>
        </section>

        {/* ---- Wachstum ---- */}
        <section className="pb-24">
          <Reveal>
            <SectionHead
              kicker="Skalierbar"
              title="Wachstum durch Überblick"
              sub="Wer organisiert ist und seine Zahlen kennt, trifft bessere Entscheidungen — vom Einzelbetrieb bis zur Kette."
            />
          </Reveal>
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <Reveal>
              <ul className="space-y-5">
                {GROWTH_POINTS.map((g) => (
                  <li key={g.title} className="flex gap-4">
                    <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-copper/25 bg-copper-soft text-copper-300">
                      {g.icon}
                    </span>
                    <div>
                      <h3 className="font-display text-base font-semibold text-chrome-50">{g.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-chrome-400">{g.desc}</p>
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
                <div className="font-display text-4xl font-bold text-gradient"><CountUp to={3} /> Min.</div>
                <p className="mt-2 text-sm text-chrome-400">von der Annahme bis zum fertigen Auftrag</p>
              </div>
              <div>
                <div className="font-display text-4xl font-bold text-gradient"><CountUp to={14} /> Tage</div>
                <p className="mt-2 text-sm text-chrome-400">kostenlos testen — ohne Kreditkarte</p>
              </div>
              <div>
                <div className="font-display text-4xl font-bold text-gradient"><CountUp to={100} /> %</div>
                <p className="mt-2 text-sm text-chrome-400">DSGVO- und GoBD-konform</p>
              </div>
              <div>
                <div className="font-display text-4xl font-bold text-gradient">5 → 1</div>
                <p className="mt-2 text-sm text-chrome-400">ein System statt fünf Insellösungen</p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---- Stimmen aus Pilotbetrieben ---- */}
        <section className="pb-24">
          <Reveal>
            <SectionHead kicker="Aus der Praxis" title="Was Pilotbetriebe sagen" />
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {QUOTES.map((q, i) => (
              <Reveal key={q.who} delay={i * 90} className="h-full">
                <figure className="panel flex h-full flex-col p-6">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-copper/60" fill="currentColor">
                    <path d="M10 8c-3 0-5 2.2-5 5.2 0 2.3 1.6 3.8 3.6 3.8 1.8 0 3.1-1.3 3.1-3 0-1.6-1.1-2.8-2.7-2.8-.3 0-.6 0-.8.1.4-1.4 1.7-2.5 3.2-2.9L10 8zm9 0c-3 0-5 2.2-5 5.2 0 2.3 1.6 3.8 3.6 3.8 1.8 0 3.1-1.3 3.1-3 0-1.6-1.1-2.8-2.7-2.8-.3 0-.6 0-.8.1.4-1.4 1.7-2.5 3.2-2.9L19 8z" />
                  </svg>
                  <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-chrome-200">{q.text}</blockquote>
                  <figcaption className="mt-4 flex items-center gap-2 text-xs text-chrome-500">
                    <span className="h-2 w-2 rounded-full" style={{ background: BETRIEBSTYP_META[q.typ].akzent }} />
                    {q.who}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---- Warum Detailly (Positionierung) ---- */}
        <section className="pb-24">
          <Reveal>
            <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-ink-700/60 bg-ink-800/40 p-8 text-center sm:p-12">
              <div className="dl-float pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-copper-glow opacity-60 blur-[110px]" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">Warum Detailly</span>
              <h2 className="mx-auto mt-4 max-w-2xl font-display text-2xl font-bold leading-snug tracking-tight sm:text-[1.7rem]">
                Software für die Werkstatt — nicht fürs Autohaus.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-chrome-300">
                Aufbereiter, Folierer und PPF-Studios liefern Präzisionsarbeit und verdienen Software, die genauso
                sauber arbeitet. Die meisten Werkstatt-Programme sind für große Autohäuser gebaut: überladen,
                kompliziert und teuer. Detailly ist bewusst anders — schlank, auf eure Abläufe zugeschnitten und in
                Minuten startklar. Eigenständig entwickelt, in Deutschland, mit Datenschutz von Grund auf.
              </p>
            </div>
          </Reveal>
        </section>

        {/* ---- Neuigkeiten (Teaser) ---- */}
        <section id="news" className="scroll-mt-24 pb-24">
          <Reveal>
            <SectionHead
              kicker="Detailly News"
              title="Was sich gerade tut"
              sub="Produkt-Updates und Neuigkeiten rund um Detailly. (Beispiel-Einträge — bald mit echten Meldungen.)"
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
              <Link href="/news" className="btn-ghost px-5">Alle News ansehen</Link>
            </div>
          </Reveal>
        </section>

        {/* ---- FAQ ---- */}
        <section id="faq" className="scroll-mt-24 pb-24">
          <Reveal>
            <SectionHead kicker="Häufige Fragen" title="Was du wissen willst, bevor du startest" />
          </Reveal>
          <div className="mx-auto max-w-2xl space-y-3">
            {FAQ.map((item, i) => (
              <Reveal key={item.q} delay={(i % 3) * 70}>
                <details className="group rounded-xl border border-ink-700/60 bg-ink-800/40 px-5 transition-colors hover:border-ink-600 [&_summary]:list-none">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-left text-[15px] font-semibold text-chrome-100">
                    {item.q}
                    <svg viewBox="0 0 24 24" className="faq-chev h-4 w-4 shrink-0 text-copper" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </summary>
                  <p className="pb-5 text-sm leading-relaxed text-chrome-400">{item.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---- Abschluss: Drive-by + CTA ---- */}
        <section className="pb-16">
          <Reveal delay={60}>
            <CarBand />
          </Reveal>
          <Reveal variant="scale">
            <div className="relative overflow-hidden rounded-3xl border border-copper/25 bg-ink-800/70 p-8 text-center shadow-card sm:p-14">
              <div className="dl-drift pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-copper-glow blur-[100px]" />
              <div className="dl-drift pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-copper-glow opacity-60 blur-[110px]" style={{ animationDelay: '-12s' }} />
              <div className="relative z-10">
                <h2 className="mx-auto max-w-xl font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  Bring Ordnung in deinen Betrieb — ab heute.
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-sm text-chrome-300 sm:text-base">
                  Registriere deinen Betrieb in wenigen Minuten und teste Detailly 14 Tage kostenlos. Ohne Kreditkarte, ohne Risiko.
                </p>
                <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link href="/registrieren" className="btn-primary px-6 py-3 text-base">
                    Jetzt kostenlos starten
                  </Link>
                  <Link href="/login" className="btn-subtle px-6 py-3 text-base">
                    Ich habe schon ein Konto
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

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
                Die Werkstatt-Software für Aufbereitung, Folierung und PPF. Eigenständig entwickelt in Deutschland.
              </p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-chrome-500">Entdecken</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/news" className="link-muted">News</Link></li>
                <li><Link href="/masterclass" className="link-muted">Masterclass</Link></li>
                <li><Link href="/gruendung" className="link-muted">Gründung</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-chrome-500">Produkt</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li><a href="#funktionen" className="link-muted">Funktionen</a></li>
                <li><a href="#branchen" className="link-muted">Für dein Gewerk</a></li>
                <li><a href="#faq" className="link-muted">Häufige Fragen</a></li>
                <li><Link href="/registrieren" className="link-muted">Kostenlos testen</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-chrome-500">Konto &amp; Rechtliches</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/login" className="link-muted">Anmelden</Link></li>
                <li><Link href="/registrieren" className="link-muted">Registrieren</Link></li>
                <li><Link href="/impressum" className="link-muted">Impressum</Link></li>
                <li><Link href="/datenschutz" className="link-muted">Datenschutz</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-ink-700/50 pt-5 text-center text-xs text-chrome-600">
            © {new Date().getFullYear()} Detailly · Alle Rechte vorbehalten
          </div>
        </footer>
      </div>
    </div>
  );
}

/** Showcase-Karte: Fahrzeug-Silhouette mit pulsierenden Schadens-Pins. */
function DamageShowcase() {
  const ref = useGrown();
  return (
    <div ref={ref} className="card-flush relative p-6">
      <div className="mb-4 flex items-center justify-between text-xs text-chrome-500">
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.5l8 4.5v9l-8 4.5-8-4.5v-9z" /><path d="M12 2.5v19M4 7l8 4.5L20 7" />
          </svg>
          Fahrzeugannahme · Schadenserfassung
        </span>
        <span className="badge-copper">2 Schäden</span>
      </div>
      <div className="relative px-2 pb-2 pt-6">
        <CarSilhouette />
        <DamagePin left="30%" top="38%" delay={200} />
        <DamagePin left="62%" top="24%" delay={480} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="badge-neutral">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M9 6l1.2-2h3.6L15 6" />
          </svg>
          4 Fotos dokumentiert
        </span>
        <span className="badge-positive">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17c3-4 5-2 7 0s4 2 7-3" /><path d="M14 20h7" />
          </svg>
          Unterschrift erfasst
        </span>
      </div>
    </div>
  );
}
