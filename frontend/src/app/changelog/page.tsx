'use client';

// Oeffentliche Seite "Was ist neu" (Route "/changelog"), ohne Login. Zeigt die
// Versionshistorie aus der pflegbaren Quelle `@/lib/changelog-data` als
// Timeline. UI-Rahmung (Kicker, Titel, Kategorie-Badges) laeuft ueber i18n;
// die Eintragstexte sind redaktioneller deutscher Inhalt. Statisch
// exportierbar (Client-Komponente, kein Fetch).

import Link from 'next/link';
import { MarketingShell, MarketingHero } from '@/components/MarketingShell';
import { useT } from '@/lib/i18n';
import { alleEintraege, formatChangelogDatum, type ChangelogKategorie } from '@/lib/changelog-data';

// Kategorie -> Badge-Klasse (Design-Tokens) + i18n-Key des Labels.
const KATEGORIE: Record<ChangelogKategorie, { badge: string; key: string }> = {
  neu: { badge: 'badge-positive', key: 'changelog.badge.neu' },
  verbessert: { badge: 'badge-info', key: 'changelog.badge.verbessert' },
  behoben: { badge: 'badge-neutral', key: 'changelog.badge.behoben' },
};

export default function ChangelogPage() {
  const t = useT();
  const eintraege = alleEintraege();

  return (
    <MarketingShell>
      <MarketingHero
        kicker={t('changelog.kicker')}
        title={t('changelog.title')}
        sub={t('changelog.subtitle')}
      />

      <ol className="relative mx-auto max-w-2xl">
        {/* Durchgehende Zeitachse hinter den Punkten */}
        <span
          aria-hidden
          className="absolute left-[7px] top-2 bottom-2 w-px bg-ink-700/70 sm:left-[calc(7rem+7px)]"
        />

        {eintraege.map((e) => {
          const kat = KATEGORIE[e.kategorie];
          return (
            <li key={e.slug} id={e.slug} className="relative scroll-mt-28 pb-8 pl-8 sm:pl-[9rem] last:pb-0">
              {/* Datum links (nur auf groesseren Screens neben der Achse) */}
              <time
                dateTime={e.datum}
                className="absolute left-0 top-0 hidden w-28 pr-4 text-right text-xs text-chrome-500 sm:block"
              >
                {formatChangelogDatum(e.datum)}
              </time>

              {/* Achsen-Punkt */}
              <span
                aria-hidden
                className="absolute left-0 top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-copper-grad shadow-glow ring-4 ring-ink-900 sm:left-[7rem]"
              />

              <article className="card transition-colors duration-220 ease-emphasized hover:border-copper/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={kat.badge}>{t(kat.key)}</span>
                  <span className="text-xs font-semibold text-copper-300">v{e.version}</span>
                  {/* Datum auf kleinen Screens inline */}
                  <time dateTime={e.datum} className="ml-auto text-xs text-chrome-500 sm:hidden">
                    {formatChangelogDatum(e.datum)}
                  </time>
                </div>
                <h2 className="mt-3 font-display text-base font-semibold text-chrome-50">{e.titel}</h2>
                <p className="mt-2 text-sm leading-relaxed text-chrome-400">{e.text}</p>
              </article>
            </li>
          );
        })}
      </ol>

      {/* Abschluss-CTA (wie auf den uebrigen Inhalts-Seiten) */}
      <div className="mx-auto mt-12 max-w-2xl">
        <div className="relative overflow-hidden rounded-3xl border border-copper/25 bg-ink-800/70 p-8 text-center shadow-card">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-copper-glow blur-[90px]" />
          <div className="relative z-10">
            <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{t('changelog.cta.title')}</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-chrome-300">{t('changelog.cta.sub')}</p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/registrieren" className="btn-primary px-6 py-3 text-base">
                {t('changelog.cta.action')}
              </Link>
              <Link href="/" className="btn-subtle px-6 py-3 text-base">
                {t('common.toStart')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
