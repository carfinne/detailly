import { LegalShell, Abschnitt, Platzhalter } from '@/components/legal';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Allgemeine Geschäftsbedingungen',
  description:
    'Die Allgemeinen Geschäftsbedingungen für die Nutzung der Detailly-Werkstattsoftware für Aufbereitung, Folierung und PPF.',
  path: '/agb/',
});

/**
 * Deutlich markierter Hinweis, dass es sich um einen ungeprueften Entwurf handelt.
 * Caution-Farbe wie die <Platzhalter>-Komponente – vor dem Launch nicht uebersehen.
 */
function EntwurfHinweis({ children }: { children: React.ReactNode }) {
  return (
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
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

export default function AgbPage() {
  return (
    <LegalShell title="Allgemeine Geschäftsbedingungen" stand="Entwurf – Juli 2026">
      <EntwurfHinweis>
        <strong className="font-semibold">Entwurf – anwaltliche Prüfung ausstehend.</strong> Diese
        Fassung ist ein unverbindlicher Arbeitsentwurf und stellt keine Rechtsberatung dar. Sie ist
        vor jeder produktiven Nutzung durch eine auf IT-Recht spezialisierte Kanzlei zu prüfen und
        freizugeben. Alle gelb markierten Angaben sind Platzhalter und vor Nutzung durch echte
        Angaben zu ersetzen.
      </EntwurfHinweis>

      <Abschnitt title="Anbieter und Geltungsbereich">
        <p>
          Anbieter der Detailly-Software (Software as a Service) ist die Detailly UG
          (haftungsbeschränkt) i. G., vertreten durch den Geschäftsführer Finn Bellmann
          (nachfolgend „Detailly“). Kunde ist der die Software nutzende Betrieb.
        </p>
        <p>
          Diese Bedingungen gelten ausschließlich für die Nutzung durch <strong>Unternehmer</strong>{' '}
          im Sinne des § 14 BGB. <strong>Verbraucher sind ausgeschlossen.</strong> Der Kunde
          bestätigt bei Vertragsschluss, als Unternehmer zu handeln. Abweichenden Bedingungen des
          Kunden wird widersprochen.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 1 Vertragsgegenstand">
        <p>
          Detailly stellt eine webbasierte Werkstattsoftware für Fahrzeugaufbereitung, Folierung und
          Lackschutz (PPF) über das Internet bereit. Der Funktionsumfang umfasst unter anderem
          Kunden- und Fahrzeugverwaltung, Auftrags- und Terminplanung, Fahrzeugannahme und
          3D-Schadenserfassung, Kalkulation und Angebote, Rechnungen (inkl. XRechnung/ZUGFeRD) und
          Mahnwesen, ein öffentliches Buchungsportal sowie Auswertungen und Buchhaltungs-Export.
        </p>
        <p>
          Der konkrete Umfang richtet sich nach dem gebuchten Tarif. Übergabepunkt der Leistung ist
          der Routerausgang des Rechenzentrums; die Server stehen in{' '}
          <Platzhalter>[Standort Rechenzentrum, Deutschland]</Platzhalter>. KI-Funktionen erzeugen
          lediglich Vorschläge; deren inhaltliche Prüfung obliegt dem Kunden. Für die inhaltliche und
          steuerliche Richtigkeit von Belegen und Rechnungen ist der Kunde verantwortlich.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 2 Vertragsschluss und Testphase">
        <p>
          Der Vertrag kommt mit der Freischaltung des Kontos zustande. Eine kostenlose Testphase von{' '}
          <Platzhalter>[14 Tagen]</Platzhalter> endet automatisch. Mit Vertragsschluss werden der
          Auftragsverarbeitungsvertrag und die Datenschutzhinweise einbezogen.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 3 Tarife, Entgelte und Zahlung">
        <p>
          Es gelten die Entgelte der jeweils gültigen Preisliste. Preise verstehen sich netto
          zzgl. gesetzlicher Umsatzsteuer. Die Abrechnung erfolgt{' '}
          <Platzhalter>[monatlich/jährlich]</Platzhalter> über{' '}
          <Platzhalter>[Zahlungsdienstleister]</Platzhalter>. Bei Zahlungsverzug kann Detailly nach
          Mahnung und Ankündigung den Zugang sperren.
        </p>
        <p>
          Eine Preisanpassung erfolgt nur zur nächsten Verlängerungsperiode mit einem Vorlauf von{' '}
          <Platzhalter>[mindestens 6 Wochen]</Platzhalter> und einem Sonderkündigungsrecht des
          Kunden. Eine laufzeitinterne Erhöhung findet nicht statt.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 4 Laufzeit und Kündigung">
        <p>
          Laufzeit und Verlängerung richten sich nach dem gebuchten Tarif. Die ordentliche
          Kündigungsfrist beträgt höchstens <Platzhalter>[2 Monate]</Platzhalter>. Das Recht zur
          außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Die Datenexport-Rechte
          bleiben von der Kündigung unberührt.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 5 Verfügbarkeit und Wartung">
        <p>
          Detailly bemüht sich um eine Verfügbarkeit von{' '}
          <Platzhalter>[99,0 % im Monatsmittel]</Platzhalter> am Übergabepunkt; ausgenommen sind
          angekündigte Wartungsfenster und Fälle höherer Gewalt. Wartungsfenster werden nach
          Möglichkeit mit Vorlauf angekündigt.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 6 Pflichten des Kunden">
        <p>
          Der Kunde hält seine Zugangsdaten geheim und sichert Konten angemessen ab (Zwei-Faktor-
          Authentifizierung verfügbar). Er ist für die Rechtmäßigkeit der von ihm eingestellten
          Daten und für seine eigene Rechtsgrundlage gegenüber seinen Endkunden verantwortlich
          (insbesondere Informationspflichten nach Art. 13/14 DSGVO und ggf. Einwilligungen).
        </p>
        <p>
          Für ein eigenes Impressum und eine eigene Datenschutzerklärung seiner öffentlichen
          Buchungsseite ist der Kunde selbst verantwortlich; Detailly stellt hierfür nur die
          technischen Bereiche und ein unverbindliches Muster bereit.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 7 Nutzungsrechte">
        <p>
          Der Kunde erhält ein einfaches, nicht übertragbares und auf die Vertragslaufzeit
          beschränktes Nutzungsrecht an der Software.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 8 Anbieterwechsel, Datenexport und Löschung">
        <p>
          Der Kunde kann seine Daten jederzeit in einem gängigen Format exportieren (z. B. CSV/JSON,
          Rechnungen inkl. XRechnung); die entsprechenden Funktionen sind im Produkt vorhanden. Nach
          Vertragsende besteht eine Export-Karenz von{' '}
          <Platzhalter>[mindestens 30 Tagen]</Platzhalter>, danach werden die Daten gemäß
          Auftragsverarbeitungsvertrag gelöscht. Wechselbehindernde Klauseln oder unangemessene
          Entgelte für den Standard-Export bestehen nicht.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 9 Haftung">
        <p>
          Detailly haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit, für Schäden aus der
          Verletzung von Leben, Körper oder Gesundheit, nach dem Produkthaftungsgesetz, bei Arglist
          und im Umfang einer übernommenen Garantie.
        </p>
        <p>
          Bei einfacher Fahrlässigkeit haftet Detailly nur bei Verletzung einer wesentlichen
          Vertragspflicht und begrenzt auf den vertragstypisch vorhersehbaren Schaden. Eine
          verbindliche Sicherung der Kundendaten (Backup) ist Leistungsbestandteil; Datenverlust
          wird nicht pauschal auf ein Kunden-Backup abgewälzt.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 10 Mängelrechte">
        <p>
          Es gilt Mietrecht (§§ 535 ff. BGB). Das Recht zur Selbstvornahme nach § 536a Abs. 2 BGB
          wird ausgeschlossen; eine Minderung erfolgt nur im Wege der Rückforderung.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 11 Datenschutz und Auftragsverarbeitung">
        <p>
          Soweit Detailly personenbezogene Daten im Auftrag des Kunden verarbeitet, gilt der{' '}
          <a href="/avv" className="link-action">
            Auftragsverarbeitungsvertrag (AVV)
          </a>{' '}
          vorrangig. Für eigene Verarbeitungen (Konto und Abrechnung) gilt die{' '}
          <a href="/datenschutz" className="link-action">
            Datenschutzerklärung
          </a>{' '}
          von Detailly. Eine Nennung des Kunden als Referenz erfolgt nur mit dessen Zustimmung.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 12 Änderungen dieser Bedingungen">
        <p>
          Änderungen werden dem Kunden mit einem Vorlauf von{' '}
          <Platzhalter>[mindestens 6 Wochen]</Platzhalter> in Textform mitgeteilt; der Kunde kann
          widersprechen oder kündigen. Der Änderungsvorbehalt ist auf Nebenabreden beschränkt.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 13 Schlussbestimmungen">
        <p>
          Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts (CISG). Gerichtsstand ist{' '}
          <Platzhalter>[Sitz Detailly]</Platzhalter>, sofern der Kunde Kaufmann ist (§ 38 ZPO). Es
          gilt folgende Rangfolge: Individualabrede, diese Bedingungen, der AVV (in Datenschutzfragen
          vorrangig), die Leistungsbeschreibung und die Preisliste. Sollte eine Bestimmung unwirksam
          sein, bleibt der Vertrag im Übrigen wirksam.
        </p>
      </Abschnitt>

      <Abschnitt title="Abgrenzung">
        <p>
          Diese Bedingungen betreffen das SaaS-Kernprodukt (B2B). Für einen etwaigen
          Material-Marktplatz und für die Zahlungsabwicklung von Buchungen gelten gesonderte
          Bedingungen und weitere gesetzliche Pflichten, die nicht Teil dieser Fassung sind.
        </p>
        <p className="text-xs text-chrome-500">
          Vollständige Entwurfsfassung: <code>docs/compliance/AGB.md</code> — vor Produktivnutzung
          anwaltlich freizugeben.
        </p>
      </Abschnitt>
    </LegalShell>
  );
}
