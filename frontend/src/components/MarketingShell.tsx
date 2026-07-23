// Gemeinsame Huelle der oeffentlichen Inhalts-/Marketing-Seiten (News,
// Masterclass, Gruendung). Bewusst rein praesentational (keine Client-Hooks),
// damit sie sowohl von Server- als auch von Client-Seiten genutzt werden kann.
//
// Optik knuepft an den Landing-Stil an: dunkler Grund, treibende Kupfer-Glows,
// feines Raster (Token --grid-line), fixe Kopfleiste mit Marke + CTAs und ein
// dreispaltiger Footer. Alle Farben ueber Design-Tokens; Motion beschraenkt
// sich auf das reduced-motion-sichere `animate-fade-in` des Inhalts.

import Link from 'next/link';
import { BrandMark } from '@/components/brand';
import { LanguageSwitcher } from '@/lib/i18n';
import { SkipLink } from '@/components/SkipLink';

/** Cross-Navigation der Inhalts-Seiten (Marke fuehrt zur Startseite). */
const NAV = [
  { href: '/news', label: 'News' },
  { href: '/masterclass', label: 'Masterclass' },
  { href: '/gruendung', label: 'Gründung' },
] as const;

function MarketingHeader({ active }: { active?: string }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-ink-700/60 bg-ink-900/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-3.5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-copper-grad text-ink-950 shadow-glow">
            <BrandMark className="h-5 w-5" wheels />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            Detail<span className="text-gradient">ly</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active === n.href ? 'page' : undefined}
              className={`btn-subtle btn-sm !text-[13px] ${
                active === n.href ? '!text-copper-300' : ''
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Link href="/login" className="btn-ghost btn-sm">
            Anmelden
          </Link>
          <Link href="/registrieren" className="btn-primary btn-sm">
            Kostenlos testen
          </Link>
        </div>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="relative z-10 border-t border-ink-700/70">
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2">
              <BrandMark className="h-5 w-5 text-copper" wheels />
              <span className="font-display text-base font-bold">
                Detail<span className="text-gradient">ly</span>
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-chrome-500">
              Die Werkstatt-Software für Aufbereitung, Folierung und PPF. Eigenständig entwickelt in
              Deutschland.
            </p>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-chrome-500">Entdecken</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/news" className="link-muted">News</Link></li>
              <li><Link href="/masterclass" className="link-muted">Masterclass</Link></li>
              <li><Link href="/gruendung" className="link-muted">Gründung</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-chrome-500">Produkt</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/#funktionen" className="link-muted">Funktionen</Link></li>
              <li><Link href="/#branchen" className="link-muted">Für dein Gewerk</Link></li>
              <li><Link href="/registrieren" className="link-muted">Kostenlos testen</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-chrome-500">Konto &amp; Rechtliches</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/login" className="link-muted">Anmelden</Link></li>
              <li><Link href="/registrieren" className="link-muted">Registrieren</Link></li>
              <li><Link href="/impressum" className="link-muted">Impressum</Link></li>
              <li><Link href="/datenschutz" className="link-muted">Datenschutz</Link></li>
              <li><Link href="/agb" className="link-muted">AGB</Link></li>
              <li><Link href="/avv" className="link-muted">AV-Vertrag</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-ink-700/50 pt-5 text-center text-xs text-chrome-600">
          © {new Date().getFullYear()} Detailly · Alle Rechte vorbehalten
        </div>
      </div>
    </footer>
  );
}

/** Landing-naher Seitenrahmen fuer Inhalts-Seiten: Aurora-Grund, fixe Kopfleiste, Footer. */
export function MarketingShell({
  active,
  children,
}: {
  /** aktive Nav-Route (z. B. "/news") zum Hervorheben im Kopf. */
  active?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-ink-900">
      {/* Skip-Link: erstes fokussierbares Element -> ueberspringt die Kopfleiste. */}
      <SkipLink />
      {/* Aurora-Hintergrund + feines Raster – Farben ueber Tokens. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-24 h-[30rem] w-[30rem] rounded-full bg-copper-glow blur-[130px]" />
        <div className="absolute -right-32 top-40 h-[24rem] w-[24rem] rounded-full bg-copper-glow opacity-70 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
            maskImage: 'radial-gradient(1100px 620px at 50% 0%, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(1100px 620px at 50% 0%, black 40%, transparent 100%)',
          }}
        />
      </div>

      <MarketingHeader active={active} />

      <main
        id="hauptinhalt"
        tabIndex={-1}
        className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-5 pb-20 pt-28 focus:outline-none sm:px-8 sm:pt-32"
      >
        <div className="animate-fade-in">{children}</div>
      </main>

      <MarketingFooter />
    </div>
  );
}

/** Zentrierter Seitenkopf (Kicker, H1, optionale Unterzeile) fuer Inhalts-Seiten. */
export function MarketingHero({
  kicker,
  title,
  sub,
  badge,
}: {
  kicker: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** optionaler Status-Badge ueber dem Kicker (z. B. „Bald verfügbar"). */
  badge?: React.ReactNode;
}) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      {badge && <div className="mb-5">{badge}</div>}
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">{kicker}</span>
      <h1 className="mt-3 font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
        {title}
      </h1>
      {sub && <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-chrome-400">{sub}</p>}
    </div>
  );
}

/**
 * Deutlich markierter Hinweis, dass die Seite noch Beispiel-/Platzhalter-Inhalte
 * zeigt. Caution-Farbe wie in den Rechtstexten – vor dem Launch nicht uebersehen.
 */
export function PlatzhalterHinweis({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mx-auto mb-10 flex max-w-2xl items-start gap-3 rounded-xl border border-caution/30 bg-caution-soft px-4 py-3 text-sm text-caution">
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </svg>
      <p className="leading-relaxed">
        {children ?? (
          <>
            Beispiel-Inhalte: Diese Seite zeigt Platzhalter. Der Betreiber ersetzt sie vor dem Start
            durch echte Inhalte.
          </>
        )}
      </p>
    </div>
  );
}
