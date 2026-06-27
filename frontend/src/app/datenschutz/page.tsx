import { LegalShell, Abschnitt, Platzhalter } from '@/components/legal';

export const metadata = {
  title: 'Datenschutzerklärung · Detailly',
};

export default function DatenschutzPage() {
  return (
    <LegalShell title="Datenschutzerklärung" stand="Juni 2026">
      <Abschnitt title="1. Verantwortlicher">
        <p>
          Verantwortlich für die Datenverarbeitung im Sinne der Datenschutz-Grundverordnung (DSGVO)
          ist:
        </p>
        <p>
          Detailly UG (haftungsbeschränkt) i. G.
          <br />
          Finn Bellmann
          <br />
          <Platzhalter>[Straße und Hausnummer]</Platzhalter>
          <br />
          <Platzhalter>[PLZ und Ort]</Platzhalter>, Deutschland
          <br />
          E-Mail:{' '}
          <a href="mailto:info@detailly.de" className="text-copper hover:underline">
            info@detailly.de
          </a>
        </p>
        <p>
          Für Anliegen rund um den Datenschutz erreichen Sie uns unter{' '}
          <a href="mailto:privacy@detailly.de" className="text-copper hover:underline">
            privacy@detailly.de
          </a>
          .
        </p>
      </Abschnitt>

      <Abschnitt title="2. Datenschutzbeauftragter">
        <p>
          Wir sind gesetzlich nicht verpflichtet, einen Datenschutzbeauftragten zu bestellen. Bei
          Fragen wenden Sie sich bitte an die oben genannte Datenschutz-Adresse.
        </p>
      </Abschnitt>

      <Abschnitt title="3. Grundsätze der Verarbeitung">
        <p>
          Wir verarbeiten personenbezogene Daten nur, soweit dies für die Bereitstellung unseres
          Angebots erforderlich ist, und nach dem Grundsatz der Datensparsamkeit. Eine Weitergabe an
          Dritte erfolgt nur im nachfolgend beschriebenen Rahmen oder wenn wir gesetzlich dazu
          verpflichtet sind.
        </p>
      </Abschnitt>

      <Abschnitt title="4. Hosting und Server-Logfiles">
        <p>
          Unsere Anwendung wird bei einem Anbieter in Deutschland gehostet:{' '}
          <Platzhalter>[Hosting-Anbieter, Anschrift]</Platzhalter>. Der Anbieter verarbeitet Daten in
          unserem Auftrag auf Grundlage eines Auftragsverarbeitungsvertrags (Art. 28 DSGVO).
        </p>
        <p>
          Beim Aufruf der Anwendung werden technisch notwendige Server-Logfiles verarbeitet
          (insbesondere IP-Adresse, Datum und Uhrzeit des Zugriffs, aufgerufene Seite, übertragene
          Datenmenge, Browser-/Systeminformationen). Dies dient dem sicheren und stabilen Betrieb.
          Rechtsgrundlage ist unser berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
      </Abschnitt>

      <Abschnitt title="5. Registrierung und Nutzerkonto">
        <p>
          Für die Nutzung von Detailly legen Betriebe ein Konto an. Dabei verarbeiten wir die im
          Registrierungsformular angegebenen Daten (z. B. Betriebsname, Name der Ansprechperson,
          E-Mail-Adresse, optional Telefonnummer) sowie Stammdaten des Betriebs. Zweck ist die
          Bereitstellung und Abrechnung des Dienstes; Rechtsgrundlage ist die Vertragserfüllung
          (Art. 6 Abs. 1 lit. b DSGVO). Zur Bestätigung der E-Mail-Adresse versenden wir eine
          Verifizierungs-Mail. Die Angabe der für die Registrierung erforderlichen Daten ist für den
          Vertragsschluss notwendig; ohne sie können wir kein Nutzerkonto bereitstellen.
        </p>
      </Abschnitt>

      <Abschnitt title="6. Verarbeitung im Auftrag unserer Kunden (Auftragsverarbeitung)">
        <p>
          Soweit unsere Kunden (Betriebe) im Rahmen der Nutzung von Detailly personenbezogene Daten
          ihrer eigenen Kundinnen und Kunden verarbeiten (z. B. Kontakt-, Fahrzeug-, Auftrags- und
          Rechnungsdaten), handeln wir insoweit als Auftragsverarbeiter (Art. 28 DSGVO). Verantwortlich
          für diese Daten ist der jeweilige Betrieb; Grundlage ist ein Auftragsverarbeitungsvertrag
          zwischen uns und dem Betrieb. Sensible Datenfelder werden in unserer Datenbank verschlüsselt
          gespeichert.
        </p>
      </Abschnitt>

      <Abschnitt title="7. E-Mail-Versand">
        <p>
          Zum Versand von Belegen, Benachrichtigungen und systembezogenen E-Mails nutzen wir einen
          E-Mail-Dienstleister: <Platzhalter>[SMTP-/E-Mail-Anbieter]</Platzhalter>. Die Verarbeitung
          erfolgt zur Vertragserfüllung bzw. auf Grundlage unseres berechtigten Interesses an einer
          zuverlässigen Zustellung (Art. 6 Abs. 1 lit. b und lit. f DSGVO) und im Rahmen einer
          Auftragsverarbeitung.
        </p>
      </Abschnitt>

      <Abschnitt title="8. Online-Terminanfrage (Kundenportal)">
        <p>
          Über die öffentliche Buchungsseite eines Betriebs können Endkundinnen und Endkunden ohne
          Anmeldung eine Terminanfrage stellen. Dabei verarbeiten wir die freiwillig angegebenen Daten
          (Name, E-Mail-Adresse und/oder Telefonnummer, ausgewählte Leistung, Fahrzeugangabe,
          Wunschtermin, Nachricht). Zweck ist die Anbahnung und Bearbeitung des angefragten Termins;
          Rechtsgrundlage ist die Durchführung vorvertraglicher Maßnahmen bzw. unser berechtigtes
          Interesse an der effizienten Bearbeitung eingehender Terminanfragen und an der Abwehr von
          Missbrauch (Art. 6 Abs. 1 lit. b und lit. f DSGVO).
        </p>
        <p>
          Zur Abwehr von Missbrauch (Spam) wird die IP-Adresse ausschließlich in gekürzter,
          gehashter Form gespeichert. Nicht angenommene Anfragen werden nach spätestens 90 Tagen
          automatisch gelöscht. Wird eine Anfrage angenommen, werden die Daten in den Bestand des
          jeweiligen Betriebs überführt (siehe Ziffer 6).
        </p>
      </Abschnitt>

      <Abschnitt title="9. Cookies und lokale Speicherung">
        <p>
          Detailly setzt keine Tracking- oder Analyse-Cookies und bindet keine Werbe- oder
          Analysedienste Dritter ein. Für die Anmeldung wird ein technisch notwendiger Zugangs-Token
          im lokalen Speicher (localStorage) Ihres Browsers abgelegt. Diese Speicherung ist für den
          Betrieb der Anwendung unbedingt erforderlich (§ 25 Abs. 2 TDDDG); eine Einwilligung ist
          hierfür nicht erforderlich.
        </p>
      </Abschnitt>

      <Abschnitt title="10. Empfänger und Auftragsverarbeiter">
        <p>Personenbezogene Daten können an folgende Kategorien von Empfängern weitergegeben werden:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Hosting-/Infrastruktur-Anbieter (<Platzhalter>[Anbieter]</Platzhalter>, Deutschland)</li>
          <li>E-Mail-Dienstleister (<Platzhalter>[Anbieter]</Platzhalter>)</li>
          <li>
            Buchhaltungsdienst sevDesk – nur sofern ein Betrieb diese Anbindung aktiv nutzt
            (sevDesk GmbH, Deutschland)
          </li>
          <li>
            <Platzhalter>[weitere Dienstleister, sobald eingesetzt – z. B. Zahlungsdienst]</Platzhalter>
          </li>
        </ul>
        <p>
          Mit allen Auftragsverarbeitern bestehen Verträge nach Art. 28 DSGVO. Eine Übermittlung in
          Drittländer außerhalb der EU/des EWR findet derzeit nicht statt.
        </p>
      </Abschnitt>

      <Abschnitt title="11. Speicherdauer">
        <p>
          Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke
          erforderlich ist oder gesetzliche Aufbewahrungsfristen es vorsehen. Für steuer- und
          handelsrechtlich relevante Unterlagen (z. B. Rechnungen) gelten gesetzliche
          Aufbewahrungsfristen von bis zu zehn Jahren (§ 147 AO, § 257 HGB).
        </p>
      </Abschnitt>

      <Abschnitt title="12. Ihre Rechte">
        <p>Ihnen stehen nach der DSGVO folgende Rechte zu:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Auskunft über die zu Ihrer Person gespeicherten Daten (Art. 15)</li>
          <li>Berichtigung unrichtiger Daten (Art. 16)</li>
          <li>Löschung (Art. 17)</li>
          <li>Einschränkung der Verarbeitung (Art. 18)</li>
          <li>Datenübertragbarkeit (Art. 20)</li>
          <li>Widerspruch gegen die Verarbeitung (Art. 21)</li>
          <li>Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft (Art. 7 Abs. 3)</li>
        </ul>
        <p>
          Zudem haben Sie das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren
          (Art. 77 DSGVO) – insbesondere in dem Mitgliedstaat Ihres Aufenthaltsorts, Ihres
          Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes. Zur Wahrnehmung Ihrer Rechte
          genügt eine Nachricht an{' '}
          <a href="mailto:privacy@detailly.de" className="text-copper hover:underline">
            privacy@detailly.de
          </a>
          .
        </p>
      </Abschnitt>

      <Abschnitt title="13. Keine automatisierte Entscheidungsfindung">
        <p>
          Eine automatisierte Entscheidungsfindung einschließlich Profiling im Sinne des Art. 22 DSGVO
          findet nicht statt.
        </p>
      </Abschnitt>

      <Abschnitt title="14. Aktualität und Änderungen">
        <p>
          Wir passen diese Datenschutzerklärung an, sobald Änderungen der von uns durchgeführten
          Datenverarbeitung dies erforderlich machen. Es gilt jeweils die hier veröffentlichte
          aktuelle Fassung.
        </p>
      </Abschnitt>
    </LegalShell>
  );
}
