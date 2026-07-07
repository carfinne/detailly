// Oeffentliche "Coming soon"-Seite fuer die Detailly Masterclass (Route
// "/masterclass"). Server-Komponente mit Metadata; das "Benachrichtige mich"-
// Feld ist eine kleine Client-Komponente (reines UI ohne Backend).

import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell, MarketingHero, PlatzhalterHinweis } from '@/components/MarketingShell';
import { NotifyForm } from './NotifyForm';

export const metadata: Metadata = {
  title: 'Masterclass – bald verfügbar',
  description:
    'Die Detailly Masterclass: Praxiswissen für Aufbereitung, Folierung und PPF. Bald verfügbar – jetzt vormerken.',
};

const ICON = 'h-5 w-5';

// PLATZHALTER-Module: Titel/Beschreibung sind Beispiele fuer das spaetere Angebot.
const MODULE: { titel: string; text: string; icon: React.ReactNode }[] = [
  {
    titel: 'Beispiel: Politur & Keramikversiegelung',
    text: 'Platzhalter. Beispiel-Modul: von der Lackanalyse über die richtige Politur bis zur langlebigen Keramikversiegelung.',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6 6l1.5 1.5M18 18l-1.5-1.5" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    titel: 'Beispiel: Folierung ohne Blasen',
    text: 'Platzhalter. Beispiel-Modul: Vorbereitung, Zuschnitt und saubere Verlegung – Techniken für ein makelloses Ergebnis.',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M8 5v14" />
      </svg>
    ),
  },
  {
    titel: 'Beispiel: PPF wie ein Profi',
    text: 'Platzhalter. Beispiel-Modul: Steinschlagschutz präzise zuschneiden und spannungsfrei anlegen – Front- bis Komplettpaket.',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    titel: 'Beispiel: Betrieb & Kalkulation',
    text: 'Platzhalter. Beispiel-Modul: Preise sauber kalkulieren, Abläufe organisieren und mit Detailly digital abwickeln.',
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v4" />
      </svg>
    ),
  },
];

export default function MasterclassPage() {
  return (
    <MarketingShell active="/masterclass">
      <MarketingHero
        badge={
          <span className="badge-copper">
            <span className="dot bg-copper" />
            Bald verfügbar
          </span>
        }
        kicker="Detailly Masterclass"
        title="Handwerk lernen. Betrieb meistern."
        sub="Praxiswissen für Aufbereitung, Folierung und PPF – kompakt aufbereitet vom Team hinter Detailly. Wir arbeiten daran. Trag dich ein und erfahre als Erste:r, wenn es losgeht."
      />

      <PlatzhalterHinweis>
        Beispiel-Inhalte: Die Module unten sind Platzhalter und zeigen, wie das Angebot aussehen
        könnte. Der Betreiber ersetzt sie vor dem Start durch echte Inhalte.
      </PlatzhalterHinweis>

      {/* Was die Masterclass bietet (Platzhalter-Module) */}
      <div className="grid gap-4 sm:grid-cols-2">
        {MODULE.map((m) => (
          <div key={m.titel} className="card h-full">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl border border-copper/25 bg-copper-soft text-copper-300">
              {m.icon}
            </div>
            <h2 className="font-display text-base font-semibold text-chrome-50">{m.titel}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-chrome-400">{m.text}</p>
          </div>
        ))}
      </div>

      {/* Benachrichtigung (reines UI ohne Backend) */}
      <div className="mx-auto mt-12 max-w-xl">
        <div className="relative overflow-hidden rounded-3xl border border-copper/25 bg-ink-800/70 p-8 text-center shadow-card">
          <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-copper-glow blur-[90px]" />
          <div className="relative z-10">
            <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              Benachrichtige mich zum Start
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-chrome-300">
              Kein Spam – nur eine Nachricht, sobald die Masterclass verfügbar ist.
            </p>
            <div className="mx-auto mt-6 max-w-md text-left">
              <NotifyForm />
            </div>
            <p className="mt-3 text-xs text-chrome-600">
              Beispiel-Formular ohne Anmeldung – aktuell wird nichts gespeichert oder gesendet.
            </p>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-8 max-w-xl text-center text-sm text-chrome-500">
        Schon startklar für deinen Betrieb?{' '}
        <Link href="/registrieren" className="link-action">
          Detailly 14 Tage kostenlos testen
        </Link>
      </p>
    </MarketingShell>
  );
}
