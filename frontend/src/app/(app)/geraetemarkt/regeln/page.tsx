// Geraete-Gebrauchtmarkt · Marktplatz-Regeln & Rechtshinweise.
//
// Statische Informations-Seite im App-Kontext (verlinkt aus dem Inserat-Formular
// und der Detailseite). Bewusst NEUTRAL und NICHT rechtsberatend formuliert:
// beschreibt, WIE der Marktplatz funktioniert (nur Ausruestung/keine Chemie,
// gewerblicher B2B-Verkauf, Abwicklung ausserhalb von Detailly). Die verbindliche
// Haftungs-/Gewaehrleistungsklausel ist NICHT eingebacken – dafuer steht ein
// leerer Anwalt-Slot (Platzhalter), der vor dem Go-Live durch Rechtsberatung
// gefuellt wird (gleiches Muster wie Impressum/Datenschutz).

import Link from 'next/link';
import { Abschnitt, Platzhalter } from '@/components/legal';

export const metadata = {
  title: 'Marktplatz-Regeln & Rechtshinweise · Detailly',
};

export default function GeraetemarktRegelnPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <Link
          href="/geraetemarkt"
          className="inline-flex items-center gap-1.5 text-sm text-chrome-400 transition-colors hover:text-copper"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Zurück zum Gebrauchtmarkt
        </Link>
      </div>

      <header className="mb-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-chrome-50">
          Marktplatz-Regeln &amp; Rechtshinweise
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-chrome-400">
          Der Gebrauchtmarkt richtet sich ausschließlich an gewerbliche Betriebe, die gebrauchte
          Geräte und Ausrüstung untereinander anbieten und kaufen. Die folgenden Hinweise erklären,
          wie der Marktplatz funktioniert – sie stellen keine Rechtsberatung dar.
        </p>
      </header>

      <div className="space-y-7">
        <Abschnitt title="Nur Geräte & Ausrüstung – keine Chemie">
          <p>
            Angeboten werden dürfen ausschließlich Geräte, Maschinen und Werkzeuge für Aufbereitung,
            Folierung und Lackschutz – zum Beispiel Poliermaschinen, Sauger, Plotter, Trockner,
            Hebebühnen oder Messtechnik.
          </p>
          <p>
            <strong className="text-chrome-100">Nicht erlaubt</strong> sind Chemie- und
            Verbrauchsstoffe wie Poliermittel, Versiegelungen, Reiniger, Klebstoffe oder sonstige
            Gefahr-/Verbrauchsstoffe. Solche Inserate werden entfernt.
          </p>
        </Abschnitt>

        <Abschnitt title="Gewerblicher Verkauf zwischen Betrieben (B2B)">
          <p>
            Der Marktplatz ist ein reiner B2B-Bereich: Anbieter sind verifizierte Gewerbebetriebe,
            und auch die Käuferseite handelt gewerblich. Es findet kein Verkauf an Verbraucherinnen
            und Verbraucher statt.
          </p>
          <p>
            Mit dem Einstellen eines Inserats bestätigen Sie, dass Sie gewerblich handeln und Ihre
            Angaben korrekt sind.
          </p>
        </Abschnitt>

        <Abschnitt title="Abwicklung & Zahlung laufen direkt zwischen den Betrieben">
          <p>
            Detailly vermittelt ausschließlich den Kontakt zwischen den Betrieben. Kauf, Übergabe,
            Versand und Bezahlung wickeln die beteiligten Betriebe eigenständig und direkt
            miteinander ab.
          </p>
          <p>
            <strong className="text-chrome-100">Über Detailly läuft kein Zahlungsverkehr</strong> –
            es gibt keine Bezahlfunktion, keinen Treuhandservice und keine Kaufabwicklung innerhalb
            der App.
          </p>
        </Abschnitt>

        <Abschnitt title="Haftung & Gewährleistung">
          <p>
            Der jeweilige Kaufvertrag kommt unmittelbar zwischen den beteiligten Betrieben zustande.
            Detailly ist nicht Vertragspartei und übernimmt keine Prüfung der angebotenen Geräte.
            Fragen zu Zustand, Gewährleistung, Rückgabe oder Haftung klären die Betriebe direkt
            miteinander. Dieser Hinweis ist neutral gehalten und stellt keine Rechtsberatung dar.
          </p>
          {/* Anwalt-Slot: verbindliche Klausel wird vor dem Go-Live durch
              Rechtsberatung eingesetzt – hier bewusst KEINE eingebackene Klausel. */}
          <div className="rounded-xl border border-caution/30 bg-caution-soft/40 p-4">
            <p className="text-sm">
              <Platzhalter>
                [Verbindliche Regelung zu Haftung und Gewährleistung – vor Veröffentlichung durch
                Rechtsberatung einsetzen]
              </Platzhalter>
            </p>
          </div>
        </Abschnitt>

        <Abschnitt title="Verstöße melden">
          <p>
            Wenn ein Inserat gegen diese Regeln verstößt – etwa Chemie/Verbrauchsstoffe, Spam oder
            unseriöse Angebote –, können Sie es über die Schaltfläche „Melden" auf der Detailseite
            an das Detailly-Team weitergeben. Wir prüfen jede Meldung und können betroffene Inserate
            verbergen oder entfernen.
          </p>
        </Abschnitt>
      </div>
    </div>
  );
}
