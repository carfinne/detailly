'use client';

// Öffentliche Landingpage (Route "/") VOR dem Login. Erzählende, conversion-
// orientierte Produkt-Vorstellung von Detailly: Hero -> Produktvorschau ->
// Problem -> So funktioniert's -> Funktionen -> Warum Detailly -> FAQ -> CTA.
// Gestaffelte Scroll-Animationen (Apple/Anthropic-Stil). Angemeldete Nutzer
// werden direkt ins Dashboard geleitet.

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

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

const BrandMark = ({ className = 'h-7 w-7' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
    <path d="M5 11h14a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1M5 11a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h1" />
    <circle cx="7.5" cy="16.5" r="1.1" />
    <circle cx="16.5" cy="16.5" r="1.1" />
  </svg>
);

const TRUST = ['DSGVO-konform', 'GoBD-konforme Rechnungen', 'Made in Germany', 'Daten verschlüsselt', 'Keine Installation'];

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
    title: 'Zeiterfassung',
    desc: 'Kommen/Gehen und Projektzeiten je Mitarbeiter — sauber dokumentiert.',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
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

const BENEFITS = [
  { title: 'Alles an einem Ort', desc: 'Ein System statt fünf Tools, die nicht zusammenspielen. Vom Kunden bis zur Rechnung.' },
  { title: 'In Minuten startklar', desc: 'Betrieb registrieren, loslegen. Keine Installation, kein IT-Aufwand, keine Schulung.' },
  { title: 'Rechtssicher abrechnen', desc: '§14- und GoBD-konforme Belege — sauber dokumentiert, falls das Finanzamt fragt.' },
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

const FAQ = [
  {
    q: 'Brauche ich technisches Wissen oder eine Installation?',
    a: 'Nein. Du registrierst deinen Betrieb und legst direkt im Browser los — auf Computer, Tablet oder Smartphone. Es gibt nichts zu installieren und nichts einzurichten.',
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

function DashboardPreview() {
  return (
    <div className="card-flush mx-auto max-w-3xl p-5 text-left">
      <div className="mb-4 flex items-center gap-2 text-xs text-chrome-500">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
        Dashboard
      </div>
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
      <div className="mb-2 flex items-center justify-between rounded-lg bg-ink-900/50 px-3 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-chrome-200">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-copper" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3h6l5 5v13H5V5a2 2 0 0 1 2-2z" /><path d="M14 3v5h5" />
          </svg>
          AU-2026-0412 · BMW M3 Competition
        </span>
        <span className="badge-copper">In Arbeit</span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-ink-900/50 px-3 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-chrome-200">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-copper" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3h12v18l-3-1.6L12 21l-3-1.6L6 21z" /><path d="M9 8h6M9 12h6" />
          </svg>
          RE-2026-0188 · Folierung Komplett
        </span>
        <span className="badge-positive">Bezahlt</span>
      </div>
    </div>
  );
}

// Wachstums-Diagramm: Balken wachsen hoch + Standort-Pins ploppen rein, sobald
// die Karte in den Viewport scrollt (eigener Observer setzt .grown).
function GrowthChart() {
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

const CarSilhouette = () => (
  <svg viewBox="0 0 200 64" className="w-full overflow-visible">
    {/* Speed-Linien hinter dem Wagen */}
    <g stroke="#e8923b" strokeWidth="2.2" strokeLinecap="round">
      <line x1="-30" y1="26" x2="-6" y2="26" opacity="0.55" />
      <line x1="-40" y1="36" x2="-10" y2="36" opacity="0.4" />
      <line x1="-24" y1="46" x2="-4" y2="46" opacity="0.5" />
    </g>
    {/* Karosserie */}
    <path d="M10,50 C10,44 16,41 24,40 C28,30 42,26 64,25 L116,25 C138,25 150,31 168,36 L186,40 C194,41 196,45 195,50 Z" fill="#e8923b" />
    {/* Fensterband */}
    <path d="M70,27 L112,27 L128,33 L66,33 Z" fill="#0c0f15" opacity="0.85" />
    {/* Glanzkante */}
    <path d="M30,40 C40,30 54,27 72,27" fill="none" stroke="#ffce8a" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    {/* Räder */}
    <circle cx="56" cy="50" r="11" fill="#0c0f15" />
    <circle cx="156" cy="50" r="11" fill="#0c0f15" />
    <circle cx="56" cy="50" r="4.5" fill="#e8923b" />
    <circle cx="156" cy="50" r="4.5" fill="#e8923b" />
  </svg>
);

// Verspieltes Band: ein Sportwagen fährt langsam hindurch.
function CarBand() {
  return (
    <div className="relative mt-6 h-28 overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-800/30">
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

const SectionHead = ({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) => (
  <div className="mb-10 text-center">
    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">{kicker}</span>
    <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
    {sub && <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-chrome-400">{sub}</p>}
  </div>
);

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-900">
      <noscript>
        <style>{`.reveal,.reveal-scale{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      <div className="pointer-events-none absolute inset-0">
        <div className="dl-float absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-copper-glow blur-[130px]" />
        <div className="dl-float absolute -right-40 top-[44rem] h-[26rem] w-[26rem] rounded-full bg-copper-glow opacity-60 blur-[140px]" style={{ animationDelay: '5s' }} />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* ---- Navigation ---- */}
        <header className="flex animate-fade-in items-center justify-between py-5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-copper-grad text-ink-950 shadow-glow">
              <BrandMark className="h-6 w-6" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">
              Detail<span className="text-gradient">ly</span>
            </span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="btn-ghost btn-sm">Anmelden</Link>
            <Link href="/registrieren" className="btn-primary btn-sm">Kostenlos testen</Link>
          </nav>
        </header>

        {/* ---- Hero ---- */}
        <section className="pb-8 pt-12 text-center sm:pt-20">
          <Reveal>
            <span className="badge-copper">
              <span className="dot bg-copper" />
              Die Werkstatt-Software für Aufbereitung, Folierung &amp; PPF
            </span>
          </Reveal>
          <Reveal delay={90}>
            <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              Die ganze Werkstatt.
              <br className="hidden sm:block" /> <span className="text-gradient">Eine Software.</span>
            </h1>
          </Reveal>
          <Reveal delay={170}>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-chrome-300 sm:text-lg">
              Kunden, Fahrzeuge, Aufträge, Plantafel, Rechnungen und digitale Schadenserfassung —
              alles an einem Ort, DSGVO-konform und auf jedem Gerät. Schluss mit Zettelwirtschaft.
            </p>
          </Reveal>
          <Reveal delay={250}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/registrieren" className="btn-primary w-full px-6 py-3 text-base sm:w-auto">
                14 Tage kostenlos testen
              </Link>
              <Link href="/login" className="btn-ghost w-full px-6 py-3 text-base sm:w-auto">
                Zur Anmeldung
              </Link>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <p className="mt-4 text-xs text-chrome-500">Keine Kreditkarte nötig · In Minuten startklar</p>
          </Reveal>
        </section>

        {/* ---- Vertrauens-Leiste ---- */}
        <Reveal>
          <div className="mb-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 border-y border-ink-700/60 py-4">
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

        {/* ---- Produktvorschau ---- */}
        <section className="pb-20">
          <Reveal variant="scale" delay={80}>
            <DashboardPreview />
          </Reveal>
        </section>

        {/* ---- Problem ---- */}
        <section className="pb-20">
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

        {/* ---- So funktioniert's ---- */}
        <section className="pb-20">
          <Reveal>
            <SectionHead kicker="So einfach geht's" title="In drei Schritten zum sauberen Ablauf" />
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90} className="h-full">
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
        <section className="pb-20">
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
                <div className="card h-full transition-colors hover:border-copper/40">
                  <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl border border-copper/25 bg-copper-soft text-copper-300">
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

        {/* ---- Skalierung / Wachstum ---- */}
        <section className="pb-20">
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
          <Reveal delay={60}>
            <CarBand />
          </Reveal>
        </section>

        {/* ---- Warum Detailly (Positionierung / Voice) ---- */}
        <section className="pb-20">
          <Reveal>
            <div className="relative mx-auto max-w-3xl rounded-3xl border border-ink-700/60 bg-ink-800/40 p-8 text-center sm:p-12">
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

        {/* ---- Vorteile ---- */}
        <section className="pb-20">
          <div className="grid gap-4 sm:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <Reveal key={b.title} delay={i * 90} className="h-full">
                <div className="panel h-full p-5">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-copper" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <h3 className="mt-3 font-display text-base font-semibold text-chrome-50">{b.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-chrome-400">{b.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---- FAQ ---- */}
        <section className="pb-20">
          <Reveal>
            <SectionHead kicker="Häufige Fragen" title="Was du wissen willst, bevor du startest" />
          </Reveal>
          <div className="mx-auto max-w-2xl space-y-3">
            {FAQ.map((item, i) => (
              <Reveal key={item.q} delay={(i % 3) * 70}>
                <details className="group rounded-xl border border-ink-700/60 bg-ink-800/40 px-5 [&_summary]:list-none">
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

        {/* ---- Abschluss-CTA ---- */}
        <section className="pb-16">
          <Reveal variant="scale">
            <div className="relative overflow-hidden rounded-3xl border border-copper/25 bg-ink-800/70 p-8 text-center shadow-card sm:p-14">
              <div className="dl-float pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-copper-glow blur-[100px]" />
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
        <footer className="flex flex-col items-center justify-between gap-4 border-t border-ink-700/70 py-8 text-sm text-chrome-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <BrandMark className="h-4 w-4 text-copper" />
            <span>
              Detail<span className="text-gradient">ly</span> · Eigenständige Detailing-Software
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/impressum" className="link-muted">Impressum</Link>
            <Link href="/datenschutz" className="link-muted">Datenschutz</Link>
            <Link href="/login" className="link-muted">Anmelden</Link>
            <Link href="/registrieren" className="link-muted">Registrieren</Link>
            <span className="text-chrome-600">© {new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
