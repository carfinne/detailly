'use client';

// Öffentliche Landingpage (Route "/") VOR dem Login. Kompakte Produkt-Vorstellung
// von Detailly mit Call-to-Action zu Anmeldung / kostenloser Registrierung.
// Bereits angemeldete Nutzer werden direkt ins Dashboard geleitet (die Landing
// ist für Interessenten). Statisch exportierbar, kein Backend nötig.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

const BrandMark = ({ className = 'h-7 w-7' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
    <path d="M5 11h14a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1M5 11a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h1" />
    <circle cx="7.5" cy="16.5" r="1.1" />
    <circle cx="16.5" cy="16.5" r="1.1" />
  </svg>
);

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
  { title: 'An jedem Gerät', desc: 'Desktop, Tablet und Smartphone — in der Werkstatt wie im Büro.' },
  { title: 'In Minuten startklar', desc: 'Betrieb registrieren, loslegen. Keine Installation, keine IT nötig.' },
  { title: 'Made in Germany', desc: 'Entwickelt für deutsche Aufbereiter — DSGVO & GoBD von Grund auf.' },
];

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Angemeldete Nutzer gehören in die App, nicht auf die Marketing-Seite.
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-900">
      {/* Atmosphärischer Hintergrund (wie Login) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-copper-glow blur-[130px]" />
        <div className="absolute -right-40 top-[40rem] h-[26rem] w-[26rem] rounded-full bg-copper-glow opacity-60 blur-[140px]" />
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
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-copper-grad text-ink-950 shadow-glow">
              <BrandMark className="h-6 w-6" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">
              Detail<span className="text-gradient">ly</span>
            </span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="btn-ghost btn-sm">
              Anmelden
            </Link>
            <Link href="/registrieren" className="btn-primary btn-sm">
              Kostenlos testen
            </Link>
          </nav>
        </header>

        {/* ---- Hero ---- */}
        <section className="animate-fade-in pb-16 pt-12 text-center sm:pt-20">
          <span className="badge-copper mx-auto">
            <span className="dot bg-copper" />
            Für Aufbereitung, Folierung &amp; PPF
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
            Die ganze Werkstatt.
            <br className="hidden sm:block" /> <span className="text-gradient">Eine Software.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-chrome-300 sm:text-lg">
            Kunden, Fahrzeuge, Aufträge, Plantafel, Rechnungen und digitale Schadenserfassung —
            alles an einem Ort, DSGVO-konform und auf jedem Gerät. Schluss mit Zettelwirtschaft.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/registrieren" className="btn-primary w-full px-6 py-3 text-base sm:w-auto">
              14 Tage kostenlos testen
            </Link>
            <Link href="/login" className="btn-ghost w-full px-6 py-3 text-base sm:w-auto">
              Zur Anmeldung
            </Link>
          </div>
          <p className="mt-4 text-xs text-chrome-500">
            Keine Kreditkarte nötig · In Minuten startklar
          </p>
        </section>

        {/* ---- Funktionen ---- */}
        <section className="pb-16">
          <div className="mb-8 text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Alles, was dein Betrieb braucht
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-chrome-400">
              Ein durchgängiger Ablauf — von der Fahrzeugannahme bis zur bezahlten Rechnung.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card transition-colors hover:border-copper/40">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl border border-copper/25 bg-copper-soft text-copper-300">
                  {f.icon}
                </div>
                <h3 className="font-display text-base font-semibold text-chrome-50">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-chrome-400">{f.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-sm text-chrome-500">
            Plus: blitzschnelle globale Suche (<kbd className="rounded border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[11px] text-chrome-300">⌘K</kbd>),
            mobile Navigation und mehrere Mitarbeiter pro Betrieb.
          </p>
        </section>

        {/* ---- Vorteile ---- */}
        <section className="pb-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="panel p-5">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-copper" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <h3 className="mt-3 font-display text-base font-semibold text-chrome-50">{b.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-chrome-400">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Abschluss-CTA ---- */}
        <section className="pb-16">
          <div className="relative overflow-hidden rounded-3xl border border-copper/25 bg-ink-800/70 p-8 text-center shadow-card sm:p-12">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-copper-glow blur-[100px]" />
            <div className="relative z-10">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Bereit, Ordnung in den Betrieb zu bringen?
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-chrome-300 sm:text-base">
                Registriere deinen Betrieb in wenigen Minuten und teste Detailly 14 Tage kostenlos.
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
        </section>

        {/* ---- Footer ---- */}
        <footer className="flex flex-col items-center justify-between gap-4 border-t border-ink-700/70 py-8 text-sm text-chrome-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <BrandMark className="h-4 w-4 text-copper" />
            <span>
              Detail<span className="text-gradient">ly</span> · Eigenständige Detailing-Software
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/login" className="link-muted">Anmelden</Link>
            <Link href="/registrieren" className="link-muted">Registrieren</Link>
            <span className="text-chrome-600">© {new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
