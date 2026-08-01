// Oeffentliche Gruender-Hilfe (Route "/gruendung"), ohne Login. Fuehrt in
// Schritten durch die Gruendung eines Aufbereitungs-/Folier-/PPF-Betriebs und
// verweist auf Detailly als Werkzeug. Server-Komponente mit Metadata.
// MVP: alle Schritte sind klar markierte Platzhalter.

import Link from 'next/link';
import { MarketingShell, MarketingHero, PlatzhalterHinweis } from '@/components/MarketingShell';
import { buildMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { jsonLdGraph, articleNode, organizationNode } from '@/lib/structured-data';

const TITLE = 'Gründung – dein Weg zum eigenen Betrieb';
const DESCRIPTION =
  'Schritt für Schritt zum eigenen Aufbereitungs-, Folier- oder PPF-Betrieb – mit Detailly als Werkzeug für den digitalen Start.';

export const metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: '/gruendung/' });

// PLATZHALTER-Schritte: Struktur/Reihenfolge stehen, Inhalte sind Beispiele.
const SCHRITTE: { titel: string; text: string; detailly?: boolean }[] = [
  {
    titel: 'Beispiel: Geschäftsidee & Positionierung schärfen',
    text: 'Platzhalter. Beispiel-Text: Welchen Schwerpunkt setzt du – Aufbereitung, Folierung, PPF oder alles aus einer Hand? Definiere Zielgruppe, Region und dein Alleinstellungsmerkmal.',
  },
  {
    titel: 'Beispiel: Anmeldung & Rechtsform klären',
    text: 'Platzhalter. Beispiel-Text: Gewerbeanmeldung, Rechtsform (z. B. Einzelunternehmen oder UG), Finanzamt, Versicherungen und ggf. Handwerkskammer – hier später mit konkreten Hinweisen.',
  },
  {
    titel: 'Beispiel: Werkstatt & Ausstattung einrichten',
    text: 'Platzhalter. Beispiel-Text: Standort, Fläche, Strom/Wasser/Absaugung, Maschinen und Verbrauchsmaterial – eine Checkliste, was du für den Start wirklich brauchst.',
  },
  {
    titel: 'Beispiel: Preise kalkulieren & erste Kunden gewinnen',
    text: 'Platzhalter. Beispiel-Text: Stundensatz und Leistungspreise sauber kalkulieren, Angebote erstellen und über Empfehlungen, lokale Sichtbarkeit und Social Media die ersten Aufträge holen.',
  },
  {
    titel: 'Beispiel: Abläufe von Anfang an digitalisieren',
    text: 'Platzhalter. Beispiel-Text: Kunden, Fahrzeuge, Aufträge, Termine und Rechnungen von Tag eins an sauber organisieren – genau dafür ist Detailly gebaut.',
    detailly: true,
  },
];

export default function GruendungPage() {
  return (
    <MarketingShell active="/gruendung">
      <JsonLd
        data={jsonLdGraph([
          articleNode({
            headline: TITLE,
            description: DESCRIPTION,
            path: '/gruendung/',
            datePublished: '2026-07-07',
          }),
          organizationNode(),
        ])}
      />
      <MarketingHero
        kicker="Gründerhilfe"
        title="Vom Handwerk zum eigenen Betrieb"
        sub="Du kannst dein Handwerk – wir helfen beim Drumherum. Ein strukturierter Leitfaden für den Start in die Selbstständigkeit mit Aufbereitung, Folierung oder PPF."
      />

      <PlatzhalterHinweis>
        Beispiel-Inhalte: Die folgenden Schritte sind Platzhalter und ersetzen keine Rechts- oder
        Steuerberatung. Der Betreiber ergänzt hier später ausführliche, geprüfte Anleitungen.
      </PlatzhalterHinweis>

      <ol className="mx-auto max-w-2xl space-y-4">
        {SCHRITTE.map((s, i) => (
          <li key={s.titel}>
            <div className="card flex gap-5 transition-colors duration-220 ease-emphasized hover:border-copper/40">
              <span
                aria-hidden="true"
                className="font-display text-3xl font-bold leading-none text-gradient"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold text-chrome-50">{s.titel}</h2>
                <p className="mt-2 text-sm leading-relaxed text-chrome-400">{s.text}</p>
                {s.detailly && (
                  <Link href="/registrieren" className="link-action mt-3 inline-flex items-center gap-1.5 text-sm">
                    Detailly 14 Tage kostenlos testen
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mx-auto mt-12 max-w-2xl">
        <div className="relative overflow-hidden rounded-3xl border border-copper/25 bg-ink-800/70 p-8 text-center shadow-card">
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-copper-glow blur-[90px]" />
          <div className="relative z-10">
            <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              Detailly – deine Software vom ersten Auftrag an
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-chrome-300">
              Kunden, Fahrzeuge, Aufträge, Plantafel und GoBD-konforme Rechnungen in einer Software.
              In Minuten startklar – ideal für den Betriebsstart.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/registrieren" className="btn-primary px-6 py-3 text-base">
                Kostenlos testen
              </Link>
              <Link href="/#funktionen" className="btn-subtle px-6 py-3 text-base">
                Funktionen ansehen
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
