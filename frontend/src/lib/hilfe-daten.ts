/**
 * Durchsuchbare Wissensdatenbank fuer den Hilfe-Bereich. Deckt alle Funktionen
 * ab; `stichworte` verbessern die Treffer bei umgangssprachlichen Suchen.
 * Pflege: Eintraege hier ergaenzen – die Hilfe-Seite gruppiert nach `thema`.
 */
export interface QA {
  frage: string;
  antwort: string;
  thema: string;
  stichworte?: string[];
}

export const HILFE_QA: QA[] = [
  // --- Erste Schritte & Bedienung ---
  {
    thema: 'Erste Schritte & Bedienung',
    frage: 'Wie finde ich schnell einen Kunden, Auftrag oder eine Rechnung?',
    antwort:
      'Mit der globalen Suche: oben auf „Suchen…" klicken oder Strg+K (Mac: ⌘K) drücken. Sie findet Kunden, Fahrzeuge (auch per Kennzeichen), Aufträge, Rechnungen und Termine – Treffer anklicken und du bist direkt in der Akte.',
    stichworte: ['suche', 'strg+k', 'cmd+k', 'kennzeichen', 'finden'],
  },
  {
    thema: 'Erste Schritte & Bedienung',
    frage: 'Was bedeutet die Glocke oben rechts?',
    antwort:
      'Das sind deine Hinweise: überfällige Rechnungen, heutige Termine und Material unter Mindestbestand. Ein Klick auf einen Hinweis führt direkt zur passenden Seite. Der Zähler aktualisiert sich beim Seitenwechsel.',
    stichworte: ['glocke', 'benachrichtigung', 'hinweise', 'erinnerung'],
  },
  {
    thema: 'Erste Schritte & Bedienung',
    frage: 'Kann ich zwischen Hell- und Dunkel-Modus wechseln?',
    antwort:
      'Ja – unter Einstellungen → Darstellung wählst du Dunkel oder Hell. Die Einstellung gilt pro Gerät/Browser. Dort kannst du auch „Animationen reduzieren" aktivieren.',
    stichworte: ['dark mode', 'light mode', 'theme', 'design', 'farbschema'],
  },
  {
    thema: 'Erste Schritte & Bedienung',
    frage: 'Ich habe mein Passwort vergessen – was nun?',
    antwort:
      'Auf der Anmeldeseite „Passwort vergessen" wählen und deine E-Mail eingeben – du bekommst einen Link zum Zurücksetzen. Alternativ kann dein Inhaber/Manager dir unter „Mitarbeiter" ein neues Passwort setzen.',
    stichworte: ['passwort', 'login', 'anmelden', 'reset', 'zurücksetzen'],
  },

  // --- Aufträge ---
  {
    thema: 'Aufträge',
    frage: 'Wie lege ich einen Auftrag an?',
    antwort:
      'Unter „Aufträge" → „Neuer Auftrag": Kunde und (optional) Fahrzeug wählen, Positionen erfassen – Preise kannst du per Klick aus deinen Leistungen übernehmen. Netto, MwSt und Brutto rechnet Detailly automatisch.',
    stichworte: ['auftrag', 'anlegen', 'neuer auftrag', 'kalkulation', 'positionen'],
  },
  {
    thema: 'Aufträge',
    frage: 'Welche Auftrags-Status gibt es und wie wechsle ich sie?',
    antwort:
      'Der Workflow: Angefragt → Kalkuliert → Bestätigt → In Arbeit → Qualitätskontrolle → Fertig → Abgerechnet (Storno jederzeit bis „Fertig"). Auf der Auftragsseite zeigt die Status-Karte immer die erlaubten nächsten Schritte – einfach anklicken.',
    stichworte: ['status', 'workflow', 'in arbeit', 'fertig', 'storno', 'stornieren'],
  },
  {
    thema: 'Aufträge',
    frage: 'Wie dokumentiere ich Vorher-/Nachher-Fotos?',
    antwort:
      'Im Auftrag unter „Fotos": Bilder für Vorher und Nachher hochladen (max. 40 pro Auftrag, je 5 MB). Die Fotos werden geschützt gespeichert – nur angemeldete Nutzer deines Betriebs sehen sie.',
    stichworte: ['fotos', 'bilder', 'vorher', 'nachher', 'dokumentation'],
  },
  {
    thema: 'Aufträge',
    frage: 'Wo trage ich Folien-/PPF-/Keramik-Details ein?',
    antwort:
      'Im Auftrag unter „Leistungsdetails": je nach Leistungsart (Folierung, PPF, Aufbereitung) gibt es passende Felder wie Folie/Hersteller, Quadratmeter, Schichten oder Garantiejahre – gut für Nachweis und Garantie.',
    stichworte: ['ppf', 'folie', 'keramik', 'garantie', 'leistungsdetails'],
  },
  {
    thema: 'Aufträge',
    frage: 'Was zeigt die Karte „Wirtschaftlichkeit" am Auftrag?',
    antwort:
      'Den Deckungsbeitrag: Auftragswert (netto) minus Lohnkosten (erfasste Stunden × Stundenlohn) minus Materialkosten (Verbrauch × Einkaufspreis) = Marge in € und %. Nur für Inhaber und Manager sichtbar.',
    stichworte: ['marge', 'gewinn', 'deckungsbeitrag', 'wirtschaftlichkeit', 'lohnt sich'],
  },

  // --- Rechnungen & Buchhaltung ---
  {
    thema: 'Rechnungen & Buchhaltung',
    frage: 'Wie wird aus einem Auftrag eine Rechnung?',
    antwort:
      'Im Auftrag rechts unter „Belege": MwSt-Satz wählen (19/7/0 %) und „Rechnung erstellen" – die Positionen werden übernommen. Alternativ zuerst ein Angebot erzeugen.',
    stichworte: ['rechnung erstellen', 'angebot', 'beleg', 'mwst'],
  },
  {
    thema: 'Rechnungen & Buchhaltung',
    frage: 'Warum hat meine Rechnung noch keine Nummer?',
    antwort:
      'Rechnungen starten als Entwurf ohne Nummer. Die fortlaufende Nummer wird erst beim Festsetzen (Entwurf → Offen) vergeben – so bleibt der Nummernkreis lückenlos (GoBD-konform), auch wenn du Entwürfe verwirfst.',
    stichworte: ['nummer', 'entwurf', 'gobd', 'rechnungsnummer', 'festsetzen'],
  },
  {
    thema: 'Rechnungen & Buchhaltung',
    frage: 'Wie sende ich eine Rechnung per E-Mail?',
    antwort:
      'In der Rechnungsliste „Per E-Mail" klicken – der Kunde bekommt das PDF als Anhang (er braucht dafür eine hinterlegte E-Mail-Adresse). Der Versandzeitpunkt wird als „Gesendet"-Badge angezeigt.',
    stichworte: ['email', 'senden', 'versenden', 'pdf'],
  },
  {
    thema: 'Rechnungen & Buchhaltung',
    frage: 'Wie funktioniert das Mahnen?',
    antwort:
      'Überfällige offene Rechnungen zeigen ein rotes „Überfällig"-Badge und einen „Mahnen"-Knopf: er erhöht die Mahnstufe (Zahlungserinnerung → 1. Mahnung → 2. Mahnung) und sendet das Mahn-PDF per E-Mail an den Kunden.',
    stichworte: ['mahnung', 'überfällig', 'zahlungserinnerung', 'fällig'],
  },
  {
    thema: 'Rechnungen & Buchhaltung',
    frage: 'Kann mein Kunde seine Rechnung ohne Login herunterladen?',
    antwort:
      'Ja: bei offenen/bezahlten Belegen erzeugt „Link" in der Rechnungsliste einen geheimen Download-Link, den du dem Kunden schickst. Er sieht Eckdaten + PDF-Download – ohne Konto. Der Link ist jederzeit neu erzeugbar (alter wird ungültig).',
    stichworte: ['download', 'link', 'kunde', 'ohne login', 'pdf teilen'],
  },
  {
    thema: 'Rechnungen & Buchhaltung',
    frage: 'Wie exportiere ich Rechnungen für den Steuerberater?',
    antwort:
      'Unter „Buchhaltung": Zeitraum wählen und als universelles CSV oder DATEV-Buchungsstapel (EXTF) exportieren. Für DATEV hinterlegst du Berater-/Mandantennummer und Konten unter Einstellungen → Betrieb.',
    stichworte: ['datev', 'export', 'steuerberater', 'csv', 'buchhaltung'],
  },

  // --- Kunden & Fahrzeuge ---
  {
    thema: 'Kunden & Fahrzeuge',
    frage: 'Wo sehe ich alles zu einem Kunden auf einen Blick?',
    antwort:
      'In der Kunden-Akte: in der Kundenliste auf den Namen klicken. Dort stehen Kontakt, Kennzahlen (offene Aufträge, offene/bezahlte Rechnungen), alle Fahrzeuge, Termine, Aufträge und Belege – überall direkt verlinkt.',
    stichworte: ['kundenakte', 'kunde', '360', 'übersicht'],
  },
  {
    thema: 'Kunden & Fahrzeuge',
    frage: 'Wie erfülle ich eine DSGVO-Auskunft oder -Löschung?',
    antwort:
      'Im Kunden-Bearbeiten-Dialog unter „Datenschutz (DSGVO)": „Daten exportieren" liefert alle Daten als JSON; „Daten löschen/anonymisieren" entfernt den Personenbezug unwiderruflich. Rechnungen bleiben aus gesetzlichen Gründen (GoBD, 10 Jahre) erhalten – aber ohne Personenbezug.',
    stichworte: ['dsgvo', 'löschen', 'auskunft', 'anonymisieren', 'datenschutz'],
  },
  {
    thema: 'Kunden & Fahrzeuge',
    frage: 'Was passiert beim Löschen eines Fahrzeugs?',
    antwort:
      'Fahrzeuge werden nur ausgeblendet (Soft-Delete): die Historie und alte Aufträge bleiben vollständig erhalten. Die Fahrzeugakte zeigt alle Aufträge zum Fahrzeug.',
    stichworte: ['fahrzeug', 'löschen', 'historie', 'fahrzeugakte'],
  },

  // --- Kundenportal ---
  {
    thema: 'Kundenportal',
    frage: 'Wie kann mein Kunde den Status seines Autos verfolgen?',
    antwort:
      'Im Auftrag unter „Kunden-Tracking" einen Link erzeugen und dem Kunden schicken (z. B. per WhatsApp/E-Mail). Er sieht darüber ohne Login die Status-Timeline (angenommen → in Arbeit → fertig), Fahrzeug und geplante Termine. „Neu erzeugen" macht den alten Link ungültig.',
    stichworte: ['tracking', 'wo ist mein auto', 'status', 'kunde', 'link'],
  },
  {
    thema: 'Kundenportal',
    frage: 'Wie funktioniert die Online-Terminbuchung?',
    antwort:
      'Deine Kunden buchen über deinen öffentlichen Link (/buchen?b=dein-betrieb) – ohne Login. Anfragen landen im Bereich „Anfragen", wo du sie annimmst (erstellt Termin + optional Kunde) oder ablehnst. Der Kunde kann den Stand seiner Anfrage über seine Referenz verfolgen.',
    stichworte: ['buchung', 'online', 'termin', 'anfrage', 'booking'],
  },
  {
    thema: 'Kundenportal',
    frage: 'Kann ich meine Termine in Apple/Google Kalender sehen?',
    antwort:
      'Ja – unter Einstellungen → Kalender-Abo findest du deine geheime iCal-URL. In Apple Kalender („Abo") oder Google Kalender („Über URL hinzufügen") eintragen, fertig. Bei Bedarf kannst du die URL neu erzeugen.',
    stichworte: ['ical', 'kalender', 'apple', 'google', 'abo', 'sync'],
  },

  // --- Termine & Plantafel ---
  {
    thema: 'Termine & Plantafel',
    frage: 'Wie plane und verschiebe ich Termine?',
    antwort:
      'Die Plantafel bietet Tag-, Wochen- und Monatsansicht. Klick in eine freie Zeile legt einen Termin an; Ziehen verschiebt ihn (auch über Tage), am unteren Rand ziehen ändert die Dauer. Im Termin-Dialog springst du direkt zu Kunde, Fahrzeug oder Auftrag.',
    stichworte: ['plantafel', 'kalender', 'termin', 'verschieben', 'drag'],
  },

  // --- Zeiterfassung & Lohn ---
  {
    thema: 'Zeiterfassung & Lohn',
    frage: 'Wie stempeln Mitarbeiter Kommen und Gehen?',
    antwort:
      'Unter „Zeiterfassung" mit einem Klick auf Kommen/Gehen (optional mit Standort). Jeder sieht seine eigene Historie; Inhaber/Manager sehen alle Einträge und können sie korrigieren – Korrekturen werden markiert.',
    stichworte: ['stempeln', 'kommen', 'gehen', 'stempeluhr', 'anwesenheit'],
  },
  {
    thema: 'Zeiterfassung & Lohn',
    frage: 'Wie buche ich Arbeitszeit auf einen Auftrag?',
    antwort:
      'Im Auftrag unter „Arbeitszeit" → „Zeit erfassen": Datum + Dauer (+ Notiz). Jeder bucht nur seine EIGENE Zeit; ändern und löschen darf nur die Leitung – das schützt vor nachträglicher Manipulation. Die Leitung sieht daraus die Lohnkosten.',
    stichworte: ['arbeitszeit', 'stunden', 'auftrag', 'zeit buchen', 'job costing'],
  },
  {
    thema: 'Zeiterfassung & Lohn',
    frage: 'Wo hinterlege ich Stundenlöhne?',
    antwort:
      'Unter „Mitarbeiter" → Bearbeiten → Feld „Stundenlohn". Er ist nur für Inhaber/Manager sichtbar und dient der Lohnkosten-Berechnung je Auftrag. Mitarbeiter sehen weder Löhne noch Lohnkosten.',
    stichworte: ['stundenlohn', 'lohn', 'gehalt', 'kosten'],
  },
  {
    thema: 'Zeiterfassung & Lohn',
    frage: 'Wie exportiere ich Zeiten fürs Lohnbüro?',
    antwort:
      'In der Zeiterfassung gibt es den Lohn-Export: Zeitraum wählen, CSV herunterladen – mit Stunden je Mitarbeiter und (für die Leitung) Lohnkosten. Direkt ans Lohnbüro oder den Steuerberater weitergeben.',
    stichworte: ['lohnexport', 'lohnbüro', 'csv', 'zeiten export'],
  },

  // --- Lager & Material ---
  {
    thema: 'Lager & Material',
    frage: 'Wie warnt mich Detailly bei knappem Material?',
    antwort:
      'Pflege bei deinen Produkten (Shop & Lager) einen Mindestbestand. Fällt der Bestand darauf oder darunter, erscheint die Warnung „Material wird knapp" auf dem Dashboard und in der Glocke – mit Direktlink ins Lager.',
    stichworte: ['mindestbestand', 'knapp', 'nachbestellen', 'lager', 'warnung'],
  },
  {
    thema: 'Lager & Material',
    frage: 'Wie erfasse ich Materialverbrauch am Auftrag?',
    antwort:
      'Im Auftrag unter „Material": Produkt und Menge wählen, „Buchen" – der Lagerbestand sinkt automatisch. Löschen (nur Leitung) bucht die Menge exakt zurück. So pflegt sich dein Lager beim Arbeiten von selbst.',
    stichworte: ['material', 'verbrauch', 'bestand', 'buchen', 'folie verbraucht'],
  },

  // --- Marktplatz ---
  {
    thema: 'Marktplatz',
    frage: 'Wie finde ich im Marktplatz schnell das richtige Produkt?',
    antwort:
      'Dreistufig: 1) Bereich wählen (Folierung, Aufbereitung, PPF & Lackschutz), 2) optional eine Marke anklicken (3M, Koch Chemie …), 3) oder direkt ins Suchfeld tippen – die Ergebnisse filtern sofort.',
    stichworte: ['marktplatz', 'produkt finden', 'marke', 'bereich', 'suche'],
  },
  {
    thema: 'Marktplatz',
    frage: 'Was ist der Unterschied zwischen „In den Warenkorb" und „Zum Angebot"?',
    antwort:
      '„In den Warenkorb" bestellt direkt in Detailly: dein Korb wird je Händler in Bestellungen aufgeteilt, den Status siehst du unter „Meine Bestellungen". „Zum Angebot ↗" führt zum Shop des Händlers – dort kaufst du direkt bei ihm.',
    stichworte: ['warenkorb', 'bestellen', 'affiliate', 'händler', 'kaufen'],
  },
  {
    thema: 'Marktplatz',
    frage: 'Wo sehe ich meine Marktplatz-Bestellungen?',
    antwort:
      'Im Marktplatz oben rechts auf „Meine Bestellungen": dort stehen alle Bestellungen mit Status (eingegangen → bestätigt → versendet). Der Händler wickelt Lieferung und Rechnung ab.',
    stichworte: ['bestellung', 'lieferstatus', 'versendet', 'bestellt'],
  },

  // --- Auswertungen ---
  {
    thema: 'Auswertungen',
    frage: 'Welche Auswertungen gibt es für meinen Betrieb?',
    antwort:
      'Unter „Auswertungen" (Inhaber/Manager): Zeitraum wählen und du siehst Auftragsvolumen, Anzahl, ⌀ Auftragswert, bezahlten Umsatz, Umsatz nach Leistungsart und deine Top-Kunden. Die Marge je Auftrag steht direkt am Auftrag.',
    stichworte: ['auswertung', 'bericht', 'umsatz', 'statistik', 'kennzahlen'],
  },

  // --- Team & Rollen ---
  {
    thema: 'Team & Rollen',
    frage: 'Welche Rollen gibt es und was dürfen sie?',
    antwort:
      'Inhaber (Admin): alles, inkl. Abo und Rollen. Manager: Betriebsleitung inkl. Auswertungen, Löhnen und Korrekturen – ohne Abo/Rollenvergabe. Techniker: Werkstatt (Aufträge, Zeiten, Material). Rezeption: Annahme, Termine, Belege. Niemand aus deinem Team kann Detailly-Plattformrechte erhalten.',
    stichworte: ['rollen', 'rechte', 'berechtigungen', 'inhaber', 'manager', 'techniker'],
  },
  {
    thema: 'Team & Rollen',
    frage: 'Wie lege ich einen Mitarbeiter an?',
    antwort:
      'Unter „Mitarbeiter" → „Neuer Mitarbeiter": Name, E-Mail, Start-Passwort und Rolle (+ optional Stundenlohn). Der Mitarbeiter meldet sich mit E-Mail + Passwort an; das Passwort kannst du dort jederzeit neu setzen. Deaktivieren sperrt den Zugang, löscht aber nichts.',
    stichworte: ['mitarbeiter', 'anlegen', 'benutzer', 'account', 'deaktivieren'],
  },

  // --- Abo & Tarif ---
  {
    thema: 'Abo & Tarif',
    frage: 'Wie wechsle oder kündige ich meinen Tarif?',
    antwort:
      'Unter „Abo & Tarif" (nur Inhaber): Tarif wählen und über den sicheren Stripe-Checkout zahlen; im Kundenportal von Stripe verwaltest du Zahlungsmittel, Rechnungen und Kündigung. Nach einer Kündigung läuft das Abo bis zum Ende der bezahlten Periode.',
    stichworte: ['abo', 'tarif', 'kündigen', 'zahlung', 'stripe', 'upgrade'],
  },
  {
    thema: 'Abo & Tarif',
    frage: 'Mein Abo ist gesperrt – was kann ich noch tun?',
    antwort:
      'Bei abgelaufenem/gesperrtem Abo ist die App eingeschränkt, aber „Hilfe & Support" bleibt IMMER erreichbar – stell uns einfach eine Anfrage (Kategorie „Abrechnung"), wir helfen beim Reaktivieren.',
    stichworte: ['gesperrt', 'abgelaufen', 'bezahlen', 'reaktivieren'],
  },

  // --- Sicherheit & Daten ---
  {
    thema: 'Sicherheit & Daten',
    frage: 'Wie sicher sind meine Daten?',
    antwort:
      'Jeder Betrieb ist strikt getrennt (Mandantentrennung) – kein anderer Betrieb sieht deine Daten. Sensible Felder wie Rechnungsempfänger und interne Notizen sind zusätzlich verschlüsselt gespeichert. Öffentliche Links (Tracking, Beleg-Download) nutzen geheime, jederzeit erneuerbare Token.',
    stichworte: ['sicherheit', 'verschlüsselung', 'datenschutz', 'mandant', 'getrennt'],
  },
  {
    thema: 'Sicherheit & Daten',
    frage: 'Wer sieht die Support-Anfragen meines Betriebs?',
    antwort:
      'Alle Nutzer deines Betriebs sehen die Anfragen des Betriebs – und auf Detailly-Seite ausschließlich das Support-Team. Andere Betriebe sehen sie nie.',
    stichworte: ['support', 'ticket', 'privat', 'sichtbar'],
  },
];
