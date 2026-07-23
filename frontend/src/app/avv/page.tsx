import { LegalShell, Abschnitt, Platzhalter } from '@/components/legal';

export const metadata = {
  title: 'Auftragsverarbeitungsvertrag (AVV) · Detailly',
};

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

export default function AvvPage() {
  return (
    <LegalShell title="Auftragsverarbeitungsvertrag (AVV)" stand="Entwurf – Juli 2026">
      <EntwurfHinweis>
        <strong className="font-semibold">Entwurf – anwaltliche Prüfung ausstehend.</strong> Diese
        Fassung ist ein unverbindlicher Arbeitsentwurf und stellt keine Rechtsberatung dar. Sie ist
        vor jeder produktiven Nutzung durch eine auf Datenschutzrecht spezialisierte Kanzlei zu
        prüfen und freizugeben. Alle gelb markierten Angaben sind Platzhalter und vor Nutzung durch
        echte Betreiberdaten zu ersetzen.
      </EntwurfHinweis>

      <Abschnitt title="Parteien und Rollen">
        <p>
          Dieser Auftragsverarbeitungsvertrag nach Art. 28 DSGVO wird geschlossen zwischen dem die
          Software nutzenden Betrieb als <strong>Verantwortlichem</strong> (
          <Platzhalter>[Firma, Anschrift, Vertretung des Betriebs]</Platzhalter>) und der Detailly UG
          (haftungsbeschränkt) i. G., vertreten durch Finn Bellmann, als{' '}
          <strong>Auftragsverarbeiter</strong> (nachfolgend „Detailly“).
        </p>
        <p>
          Der AVV ist Anlage zum Nutzungsvertrag (AGB) und geht diesem in Datenschutzfragen vor. Er
          kann elektronisch geschlossen werden (Art. 28 Abs. 9 DSGVO, z. B. per Bestätigung beim
          Onboarding).
        </p>
      </Abschnitt>

      <Abschnitt title="§ 1 Gegenstand, Dauer und Rangfolge">
        <p>
          Gegenstand ist die Verarbeitung personenbezogener Daten durch Detailly im Auftrag des
          Verantwortlichen im Rahmen der Nutzung der Detailly-Werkstattsoftware für
          Fahrzeugaufbereitung, Folierung und Lackschutz (PPF). Die Laufzeit entspricht der des
          Nutzungsvertrags; die Pflichten zur Löschung und Rückgabe (§ 8) gelten nach dessen Ende
          fort. Bei Widersprüchen in Datenschutzfragen geht dieser AVV vor.
        </p>
        <p>
          Nicht Gegenstand sind Verarbeitungen, für die Detailly eigenständig verantwortlich ist
          (insbesondere Abrechnung des Abos, eigene Website, Registrierung/Konto, Support); hierfür
          gilt die <a href="/datenschutz" className="link-action">Datenschutzerklärung</a> von
          Detailly.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 2 Gegenstand, Datenkategorien und betroffene Personen">
        <p>
          <strong>Zweck:</strong> Bereitstellung und Betrieb der Software zur Abwicklung der
          Geschäftsprozesse des Betriebs (Kunden- und Fahrzeugverwaltung, Aufträge, Terminplanung,
          Fahrzeugannahme und Gutachten, Rechnungen, Mahnwesen, Online-Terminbuchung).
        </p>
        <p>
          <strong>Kategorien betroffener Personen:</strong> Endkundinnen und Endkunden des Betriebs
          (privat und geschäftlich), deren Ansprechpartner sowie Interessenten über das öffentliche
          Buchungsportal.
        </p>
        <p>
          <strong>Kategorien personenbezogener Daten:</strong>
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Kundenstammdaten (Name, Firma, USt-Nr., Kontaktdaten, Anschrift, interne Notizen)</li>
          <li>Fahrzeugdaten (Marke, Modell, Farbe, Kennzeichen, Fahrgestellnummer, Notizen)</li>
          <li>Auftrags- und Termindaten (Leistungsdetails, Vorher-/Nachher-Fotos, Terminzeiten)</li>
          <li>
            Inspektionen und Gutachten (Schadenspositionen, Fotos, digitale Unterschrift des Kunden,
            eingefrorener Einwilligungstext)
          </li>
          <li>Rechnungsdaten (Rechnungsnummer, Positionen, Beträge, Empfängerdaten – sensible Felder verschlüsselt)</li>
          <li>Online-Terminanfragen (Name, Kontakt, Leistung, Wunschtermin; Quell-IP nur gehasht)</li>
        </ul>
        <p>
          Besondere Datenkategorien nach Art. 9 DSGVO sind bestimmungsgemäß nicht Gegenstand. Der
          Verantwortliche verpflichtet sich, keine derartigen Daten einzustellen.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 3 Weisungsrecht">
        <p>
          Detailly verarbeitet die Daten ausschließlich auf dokumentierte Weisung des
          Verantwortlichen; die bestimmungsgemäße Nutzung der Software gilt als Weisung.
          Individualweisungen richtet der Verantwortliche an{' '}
          <Platzhalter>[support@detailly.de]</Platzhalter>. Hält Detailly eine Weisung für
          rechtswidrig, informiert es den Verantwortlichen unverzüglich und darf die Ausführung bis
          zur Bestätigung aussetzen. Behördliche Auskunftsersuchen beantwortet Detailly nicht
          selbständig, sondern informiert den Verantwortlichen vorab, soweit rechtlich zulässig.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 4 Vertraulichkeit">
        <p>
          Detailly setzt zur Verarbeitung nur Personen ein, die zur Vertraulichkeit verpflichtet
          sind oder einer angemessenen gesetzlichen Verschwiegenheitspflicht unterliegen, und stellt
          sicher, dass diese die Daten nur weisungsgemäß verarbeiten.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 5 Technische und organisatorische Maßnahmen (TOM)">
        <p>
          Detailly trifft technische und organisatorische Maßnahmen nach Art. 32 DSGVO (u. a.
          verschlüsselte Übertragung, Verschlüsselung sensibler Datenfelder, Zugriffs- und
          Berechtigungskonzept, Mandantentrennung, Protokollierung, Backups). Ausdrücklich benannt
          sind auch die durch Betreiber und Hoster sicherzustellenden Maßnahmen (z. B.
          At-Rest-Verschlüsselung des Speichers, verschlüsselte Offsite-Backups). Die vollständige
          Übersicht ist Anlage 3 dieses Vertrags.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 6 Unterauftragsverarbeiter">
        <p>
          Der Verantwortliche erteilt eine allgemeine schriftliche Genehmigung zur Beauftragung der
          in Anlage 2 genannten Unterauftragsverarbeiter. Detailly informiert über beabsichtigte
          Änderungen mit einer Frist von <Platzhalter>[30]</Platzhalter> Tagen; der Verantwortliche
          kann aus wichtigem Grund widersprechen und bei berechtigtem Widerspruch außerordentlich
          kündigen. Jeder Unterauftragsverarbeiter wird auf mindestens dieselben Datenschutzpflichten
          verpflichtet (Art. 28 Abs. 4 DSGVO).
        </p>
        <p>
          Eine Übermittlung in Drittländer erfolgt nur, soweit in Anlage 2 ausgewiesen, und dann auf
          Grundlage eines Angemessenheitsbeschlusses oder hilfsweise der Standardvertragsklauseln
          (Art. 46 DSGVO). Der Kernbetrieb (Hosting, Endkundendaten) findet in Deutschland bzw. der
          EU statt.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 7 Unterstützung des Verantwortlichen und Datenpanne">
        <p>
          <strong>Betroffenenrechte (Art. 12–23 DSGVO):</strong> Detailly unterstützt den
          Verantwortlichen durch geeignete technische Maßnahmen. Umgesetzt ist ein DSGVO-Cockpit mit
          Datenauskunft/Export (Art. 15) und Löschung/Anonymisierung (Art. 17) je Kunde. Die
          Wahrnehmung der Rechte gegenüber den Endkunden obliegt dem Verantwortlichen; direkt an
          Detailly gerichtete Anfragen werden weitergereicht.
        </p>
        <p>
          <strong>Datenpanne (Art. 33/34 DSGVO):</strong> Detailly meldet dem Verantwortlichen eine
          bekannt gewordene Verletzung des Schutzes personenbezogener Daten unverzüglich, spätestens
          innerhalb von <Platzhalter>[24]</Platzhalter> Stunden nach Kenntnis. Die Meldung an die
          Aufsichtsbehörde (72 Stunden) und ggf. an Betroffene obliegt dem Verantwortlichen. Detailly
          unterstützt zudem bei Datensicherheit, Datenschutz-Folgenabschätzung und vorheriger
          Konsultation im Rahmen des Verfügbaren.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 8 Löschung, Rückgabe und Kontrollrechte">
        <p>
          Nach Ende des Nutzungsvertrags stellt Detailly einen Datenexport bereit (
          <Platzhalter>[30]</Platzhalter> Tage Karenz) und löscht die Daten anschließend,
          einschließlich in Sicherungskopien, nach spätestens <Platzhalter>[90]</Platzhalter> Tagen.
          Gesetzliche Aufbewahrungspflichten (z. B. § 257 HGB, § 147 AO/GoBD für Rechnungen) trägt
          der Verantwortliche; Detailly löscht bzw. sperrt nach dessen Weisung.
        </p>
        <p>
          Detailly stellt die zum Nachweis der Einhaltung erforderlichen Informationen bereit
          (vorrangig diese Anlagen, ggf. Testate). Vor-Ort-Kontrollen sind nach Ankündigung von{' '}
          <Platzhalter>[14]</Platzhalter> Tagen zu üblichen Geschäftszeiten möglich, höchstens{' '}
          <Platzhalter>[einmal jährlich]</Platzhalter>, außer bei besonderem Anlass.
        </p>
      </Abschnitt>

      <Abschnitt title="§ 9 Haftung und Schlussbestimmungen">
        <p>
          Es gelten Art. 82 DSGVO und die Haftungsregeln des Nutzungsvertrags; die Außenhaftung nach
          Art. 82 DSGVO ist nicht abdingbar. Änderungen bedürfen der Textform. Sollte eine Bestimmung
          unwirksam sein, bleibt der Vertrag im Übrigen wirksam. Es gilt deutsches Recht.
        </p>
      </Abschnitt>

      <Abschnitt title="Anlagen">
        <p>Bestandteil dieses Vertrags sind folgende Anlagen:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Anlage 1 – Gegenstand, Datenkategorien und betroffene Personen (siehe § 2)</li>
          <li>Anlage 2 – Unterauftragsverarbeiter</li>
          <li>Anlage 3 – Technische und organisatorische Maßnahmen (Art. 32 DSGVO)</li>
        </ul>
        <p>
          Siehe auch die <a href="/agb" className="link-action">Allgemeinen Geschäftsbedingungen</a>{' '}
          als übergeordneten Nutzungsvertrag.
        </p>
        <p className="text-xs text-chrome-500">
          Vollständige Entwurfsfassung: <code>docs/compliance/AVV.md</code> (nebst Anlagen{' '}
          <code>SUBPROZESSOREN.md</code> und <code>TOMS.md</code>) — vor Produktivnutzung anwaltlich
          freizugeben.
        </p>
      </Abschnitt>
    </LegalShell>
  );
}
