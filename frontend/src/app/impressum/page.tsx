import { LegalShell, Abschnitt, Platzhalter } from '@/components/legal';

export const metadata = {
  title: 'Impressum · Detailly',
};

export default function ImpressumPage() {
  return (
    <LegalShell title="Impressum" stand="Juni 2026">
      <Abschnitt title="Angaben gemäß § 5 DDG">
        <p>
          Detailly UG (haftungsbeschränkt) i. G.
          <br />
          vertreten durch den Geschäftsführer Finn Bellmann
        </p>
        <p>
          <Platzhalter>[Straße und Hausnummer]</Platzhalter>
          <br />
          <Platzhalter>[PLZ und Ort]</Platzhalter>
          <br />
          Deutschland
        </p>
        <p className="text-xs text-chrome-500">
          Hinweis: „i. G.“ = in Gründung. Die Gesellschaft befindet sich in Gründung; bis zur
          Eintragung im Handelsregister handelt es sich um eine Vor-Gesellschaft. Nach Eintragung
          entfällt der Zusatz „i. G.“.
        </p>
      </Abschnitt>

      <Abschnitt title="Kontakt">
        <p>
          E-Mail:{' '}
          <a href="mailto:info@detailly.de" className="text-copper hover:underline">
            info@detailly.de
          </a>
          <br />
          Telefon: <Platzhalter>[Telefonnummer folgt]</Platzhalter>
        </p>
        <p className="text-xs text-chrome-500">
          Bis zur Einrichtung einer Telefonnummer erreichen Sie uns für eine schnelle Kontaktaufnahme
          per E-Mail.
        </p>
      </Abschnitt>

      <Abschnitt title="Handelsregister">
        <p>
          Die Eintragung im Handelsregister ist beantragt. Registergericht und Registernummer werden
          nach erfolgter Eintragung ergänzt:
        </p>
        <p>
          Registergericht: <Platzhalter>[Amtsgericht …]</Platzhalter>
          <br />
          Registernummer: <Platzhalter>[HRB …]</Platzhalter>
        </p>
      </Abschnitt>

      <Abschnitt title="Umsatzsteuer-Identifikationsnummer">
        <p>
          Eine Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz liegt derzeit nicht
          vor. <Platzhalter>[USt-IdNr. ergänzen, sobald vorhanden]</Platzhalter>
        </p>
      </Abschnitt>

      <Abschnitt title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
        <p>
          Finn Bellmann
          <br />
          Anschrift wie oben
        </p>
      </Abschnitt>

      <Abschnitt title="Verbraucherstreitbeilegung / Universalschlichtungsstelle">
        <p>
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </Abschnitt>

      <Abschnitt title="Haftung für Inhalte">
        <p>
          Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen
          Gesetzen verantwortlich. Wir sind jedoch nicht verpflichtet, übermittelte oder gespeicherte
          fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine
          rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung
          von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.
        </p>
      </Abschnitt>

      <Abschnitt title="Haftung für Links">
        <p>
          Unser Angebot enthält ggf. Links zu externen Websites Dritter, auf deren Inhalte wir keinen
          Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
          Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
          Seiten verantwortlich.
        </p>
      </Abschnitt>

      <Abschnitt title="Urheberrecht">
        <p>
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen
          dem deutschen Urheberrecht. Beiträge Dritter sind als solche gekennzeichnet. Die
          Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
          Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw.
          Erstellers.
        </p>
      </Abschnitt>
    </LegalShell>
  );
}
