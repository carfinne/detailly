// Oeffentliche Info-/Tipps-Seite zur Kleinunternehmerregelung (§ 19 UStG) und zur
// Rechtsform (Route "/kleinunternehmer"), ohne Login. Bewusst DEUTSCH (nicht i18n),
// da rechtlich-steuerliche Inhalte fuer den deutschen Markt. Server-Komponente mit
// Metadata; Optik ueber MarketingShell (wie /gruendung).
//
// WICHTIG: allgemeine Information, KEINE Steuer-/Rechtsberatung. Der prominente
// Disclaimer (PlatzhalterHinweis-Konvention) steht ganz oben und wird wiederholt.

import Link from 'next/link';
import { MarketingShell, MarketingHero, PlatzhalterHinweis } from '@/components/MarketingShell';
import { buildMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { jsonLdGraph, articleNode, organizationNode } from '@/lib/structured-data';

const TITLE = 'Kleinunternehmer (§ 19 UStG) & Rechtsform – verständlich erklärt';
const DESCRIPTION =
  'Kleinunternehmerregelung nach § 19 UStG, Umsatzgrenzen, Vor- und Nachteile, E-Rechnung und Rechtsform-Grundlagen – verständlich erklärt für Aufbereitung, Folierung und PPF. Allgemeine Information, keine Steuerberatung.';

export const metadata = buildMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/kleinunternehmer/',
});

// Abschnitt der Info-Seite (Titel + ein oder mehrere Absaetze/Listen).
type Abschnitt = {
  titel: string;
  absaetze?: string[];
  liste?: string[];
};

const ABSCHNITTE: Abschnitt[] = [
  {
    titel: 'Was bedeutet die Kleinunternehmerregelung (§ 19 UStG)?',
    absaetze: [
      'Als Kleinunternehmer weist du auf deinen Rechnungen keine Umsatzsteuer (Mehrwertsteuer) aus und führst auch keine an das Finanzamt ab. Seit der Reform 2025 gilt das als echte Steuerbefreiung – deine Leistungen sind von der Umsatzsteuer befreit, nicht nur „nicht erhoben".',
      'Für Endkunden (Privatkunden) ist das oft ein Vorteil: Dein Preis ist der Endpreis, ohne die 19 % obendrauf. Für Geschäftskunden, die selbst Vorsteuer ziehen, spielt es meist keine Rolle.',
    ],
  },
  {
    titel: 'Die Umsatzgrenzen: 25.000 € und 100.000 €',
    absaetze: [
      'Du kannst die Regelung nutzen, wenn dein Umsatz im vorangegangenen Kalenderjahr 25.000 € nicht überschritten hat und im laufenden Jahr voraussichtlich 100.000 € nicht übersteigt.',
      'Wichtig: Überschreitest du im laufenden Jahr die Grenze von 100.000 €, wechselst du sofort – ab genau dem Umsatz, der die Grenze reißt – in die Regelbesteuerung. Ab diesem Zeitpunkt musst du Umsatzsteuer ausweisen. Es gibt hier keine Schonfrist bis zum Jahresende.',
    ],
  },
  {
    titel: 'Der große Nachteil: kein Vorsteuerabzug',
    absaetze: [
      'Weil du keine Umsatzsteuer ausweist, darfst du im Gegenzug auch keine Vorsteuer aus deinen Einkäufen ziehen. Die Umsatzsteuer auf Maschinen, Werkzeuge, Folien und Material bleibt für dich ein echter Kostenbestandteil.',
      'Gerade beim Start mit hohen Investitionen (Absaugung, Poliermaschinen, Folien-/PPF-Material) kann die Regelbesteuerung günstiger sein, weil du dir dort die Vorsteuer zurückholst. Rechne beide Varianten für deinen Fall durch – am besten mit deinem Steuerberater.',
    ],
  },
  {
    titel: 'Rechnungen als Kleinunternehmer – Detailly macht das automatisch',
    absaetze: [
      'Kleinunternehmer-Rechnungen brauchen einen Hinweis auf die Steuerbefreiung und kommen mit vereinfachten Pflichtangaben aus (§ 34a UStDV). Eine Umsatzsteuer wird nicht ausgewiesen.',
      'In Detailly hinterlegst du den Kleinunternehmer-Status einmal in den Einstellungen. Danach erstellt die Software neue Angebote und Rechnungen automatisch mit 0 %, blendet die MwSt-Zeile aus und druckt den Befreiungshinweis – du musst an nichts denken.',
    ],
  },
  {
    titel: 'E-Rechnung: Empfang ist Pflicht, Ausstellung (noch) nicht',
    absaetze: [
      'Seit 2025 muss jedes Unternehmen im B2B-Bereich strukturierte E-Rechnungen empfangen können – das gilt auch für Kleinunternehmer. Ein einfaches E-Mail-Postfach genügt dafür in der Regel.',
      'Die verpflichtende Ausstellung strukturierter E-Rechnungen wird für die meisten Betriebe schrittweise eingeführt; Kleinunternehmer sind hier zunächst erleichtert. Detailly kann XRechnungen ohnehin erzeugen und empfangen – du bist also auf beiden Seiten vorbereitet.',
    ],
  },
  {
    titel: 'Wechsel und Verzicht',
    absaetze: [
      'Du kannst freiwillig auf die Kleinunternehmerregelung verzichten und zur Regelbesteuerung optieren – zum Beispiel, wenn du viel investierst und die Vorsteuer nutzen willst. An diesen Verzicht bist du dann für fünf Kalenderjahre gebunden.',
      'Umgekehrt kannst du bei sinkenden Umsätzen unter den Grenzen wieder in die Kleinunternehmerregelung zurückwechseln. Die Details und Fristen bespricht du am besten mit deinem Steuerberater.',
    ],
  },
  {
    titel: 'Kurz erwähnt: § 19a UStG (EU-Kleinunternehmer)',
    absaetze: [
      'Seit 2025 gibt es eine EU-weite Kleinunternehmerregelung (§ 19a UStG). Sie ermöglicht es, die Befreiung unter bestimmten Voraussetzungen auch für Umsätze in anderen EU-Staaten zu nutzen. Für einen rein lokal tätigen Aufbereitungs-/Folierbetrieb ist das meist nicht relevant – gut zu wissen ist es trotzdem.',
    ],
  },
  {
    titel: 'Rechtsform-Grundlagen',
    absaetze: [
      'Die Kleinunternehmerregelung ist unabhängig von deiner Rechtsform – sie gilt für Einzelunternehmen genauso wie für eine UG oder GmbH, solange die Umsatzgrenzen eingehalten werden.',
      'Ein grober Überblick über die häufigsten Formen:',
    ],
    liste: [
      'Einzelunternehmen: einfachste Form, keine Mindesteinlage, du haftest persönlich mit deinem Privatvermögen.',
      'GbR: für zwei oder mehr Gründer, ebenfalls persönliche Haftung der Gesellschafter.',
      'UG (haftungsbeschränkt): „kleine GmbH", ab 1 € Stammkapital, Haftung beschränkt, aber mehr Formalitäten (Handelsregister, Bilanz).',
      'GmbH: 25.000 € Stammkapital, Haftungsbeschränkung, höherer Verwaltungsaufwand.',
    ],
  },
  {
    titel: 'Gewerbesteuer-Freibetrag: 24.500 €',
    absaetze: [
      'Einzelunternehmen und Personengesellschaften (z. B. GbR) haben bei der Gewerbesteuer einen Freibetrag von 24.500 € pro Jahr. Erst der Gewerbeertrag darüber wird mit Gewerbesteuer belastet. Kapitalgesellschaften (UG, GmbH) haben diesen Freibetrag nicht.',
      'Auch das ist ein Baustein bei der Wahl der Rechtsform – die passende Entscheidung hängt von deiner konkreten Situation ab.',
    ],
  },
];

export default function KleinunternehmerPage() {
  return (
    <MarketingShell active="/kleinunternehmer">
      <JsonLd
        data={jsonLdGraph([
          articleNode({
            headline: TITLE,
            description: DESCRIPTION,
            path: '/kleinunternehmer/',
            datePublished: '2026-07-13',
          }),
          organizationNode(),
        ])}
      />
      <MarketingHero
        kicker="Steuer & Rechtsform"
        title="Kleinunternehmer nach § 19 UStG – verständlich erklärt"
        sub="Was die Kleinunternehmerregelung für deinen Aufbereitungs-, Folier- oder PPF-Betrieb bedeutet: Umsatzgrenzen, Vor- und Nachteile, E-Rechnung und ein Überblick über die Rechtsformen."
      />

      <PlatzhalterHinweis>
        Allgemeine Information, keine Steuer- oder Rechtsberatung. Steuerliche und rechtliche
        Entscheidungen hängen von deiner konkreten Situation ab – bitte kläre sie mit deinem
        Steuerberater oder deiner IHK / Handwerkskammer ab.
      </PlatzhalterHinweis>

      <div className="mx-auto max-w-2xl space-y-4">
        {ABSCHNITTE.map((abschnitt) => (
          <section key={abschnitt.titel} className="card">
            <h2 className="font-display text-lg font-semibold text-chrome-50">{abschnitt.titel}</h2>
            {abschnitt.absaetze?.map((text, i) => (
              <p key={i} className="mt-2 text-sm leading-relaxed text-chrome-400">
                {text}
              </p>
            ))}
            {abschnitt.liste && (
              <ul className="mt-3 space-y-1.5">
                {abschnitt.liste.map((punkt, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-chrome-400">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-copper" />
                    <span>{punkt}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-2xl">
        <div className="flex items-start gap-3 rounded-xl border border-caution/30 bg-caution-soft px-4 py-3 text-sm text-caution">
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
            Dieser Überblick ersetzt keine individuelle Beratung. Für verbindliche Auskünfte wende
            dich an einen Steuerberater oder deine IHK / Handwerkskammer.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-2xl">
        <div className="relative overflow-hidden rounded-3xl border border-copper/25 bg-ink-800/70 p-8 text-center shadow-card">
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-copper-glow blur-[90px]" />
          <div className="relative z-10">
            <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              Detailly stellt deine Belege §19-konform aus
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-chrome-300">
              Kleinunternehmer-Status einmal in den Einstellungen hinterlegen – neue Angebote und
              Rechnungen entstehen automatisch mit 0 %, ohne MwSt-Zeile und mit Befreiungshinweis.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/registrieren" className="btn-primary px-6 py-3 text-base">
                Kostenlos testen
              </Link>
              <Link href="/gruendung" className="btn-subtle px-6 py-3 text-base">
                Zur Gründerhilfe
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
