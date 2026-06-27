import Link from 'next/link';

/**
 * Sichtbar markierter Platzhalter fuer noch fehlende Pflichtangaben (z. B. Adresse,
 * HRB-Nummer). Bewusst auffaellig (caution-Farbe), damit vor dem echten Go-Live
 * nichts uebersehen wird. Vor Veroeffentlichung ALLE Platzhalter ersetzen.
 */
export function Platzhalter({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 rounded bg-caution-soft px-1.5 py-0.5 text-caution ring-1 ring-inset ring-caution/30">
      {children}
    </span>
  );
}

/** Abschnitt mit Ueberschrift fuer Rechtstexte. */
export function Abschnitt({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-semibold text-chrome-50">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-chrome-300">{children}</div>
    </section>
  );
}

/** Gemeinsamer Rahmen fuer Impressum/Datenschutz (oeffentlich, ohne Auth-Gate). */
export function LegalShell({
  title,
  stand,
  children,
}: {
  title: string;
  stand: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-ink-900">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <Link href="/" className="link-muted inline-flex items-center gap-1.5 text-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5m6-6-6 6 6 6" />
          </svg>
          Zur Startseite
        </Link>

        <header className="mb-8 mt-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-chrome-50">{title}</h1>
          <p className="mt-2 text-sm text-chrome-500">Stand: {stand}</p>
        </header>

        <div className="space-y-7">{children}</div>
      </div>
    </main>
  );
}
