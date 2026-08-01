// Oeffentliche News-/Update-Seite (Route "/news"), ohne Login. Listet die
// Eintraege aus der pflegbaren Quelle `@/lib/news` (MVP: Platzhalter). Server-
// Komponente mit eigener Metadata fuer den Seitentitel.

import Link from 'next/link';
import { MarketingShell, MarketingHero, PlatzhalterHinweis } from '@/components/MarketingShell';
import { neuesteNews, formatNewsDatum } from '@/lib/news';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'News & Updates',
  description:
    'Neuigkeiten und Produkt-Updates rund um Detailly – die Werkstatt-Software für Aufbereitung, Folierung und PPF.',
  path: '/news/',
});

export default function NewsPage() {
  const eintraege = neuesteNews();

  return (
    <MarketingShell active="/news">
      <MarketingHero
        kicker="Detailly News"
        title="Was sich gerade tut"
        sub="Produkt-Updates, Verbesserungen und Ankündigungen rund um Detailly – gebündelt an einem Ort."
      />

      <PlatzhalterHinweis>
        Beispiel-Inhalte: Die folgenden Einträge sind Platzhalter. Hier erscheinen später echte
        Produkt-News des Betreibers.
      </PlatzhalterHinweis>

      <div className="mx-auto max-w-2xl space-y-4">
        {eintraege.map((n) => (
          <article
            key={n.slug}
            id={n.slug}
            className="card scroll-mt-28 transition-colors duration-220 ease-emphasized hover:border-copper/40"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge-copper">{n.kategorie}</span>
              {n.platzhalter && <span className="badge-caution">Beispiel</span>}
              <time dateTime={n.datum} className="ml-auto text-xs text-chrome-500">
                {formatNewsDatum(n.datum)}
              </time>
            </div>
            <h2 className="mt-3 font-display text-lg font-semibold text-chrome-50">{n.titel}</h2>
            <p className="mt-2 text-sm leading-relaxed text-chrome-400">{n.kurztext}</p>
          </article>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-2xl">
        <div className="relative overflow-hidden rounded-3xl border border-copper/25 bg-ink-800/70 p-8 text-center shadow-card">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-copper-glow blur-[90px]" />
          <div className="relative z-10">
            <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              Noch nicht dabei?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-chrome-300">
              Teste Detailly 14 Tage kostenlos und bring Ordnung in deinen Betrieb – ohne
              Kreditkarte, ohne Risiko.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/registrieren" className="btn-primary px-6 py-3 text-base">
                Kostenlos testen
              </Link>
              <Link href="/" className="btn-subtle px-6 py-3 text-base">
                Zur Startseite
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
