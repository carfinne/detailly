# Änderungsverlauf

Alle nennenswerten Änderungen an Detailly werden hier festgehalten – in einfacher Sprache, damit auch Nicht-Techniker den Fortschritt nachvollziehen können.

Das Format orientiert sich lose an [Keep a Changelog](https://keepachangelog.com/de/).

---

## [Unveröffentlicht] – Next-Gen Phase 3+4

> **Hinweis zum Stand:** Die folgenden Änderungen stammen aus den Pull Requests **#102 bis #108** und sind **inzwischen auf `main` gemergt**. Diese Liste dokumentiert für das Team, was dieser Missionsabschnitt gebracht hat.

Diese Phase hebt Detailly von einem funktionierenden internen Werkzeug zu einem verkaufsfähigen SaaS-Produkt: Der Anbieter verdient mit den Tarifen tatsächlich Geld, Endkunden werden automatisch informiert, der Kern-Arbeitsfluss vom Auftrag bis zur Zahlung wird durchgängig, und die Oberfläche bekommt einen sichtbaren Premium-Sprung.

### Hinzugefügt

- **Automatische Statusmails an Endkunden:** Kunden erhalten Terminbestätigung und den Track-Link jetzt automatisch per E-Mail, statt dass der Betrieb anrufen muss. (T-003, PR #103)
- **Anfrage mit einem Klick in einen Auftrag verwandeln:** „Annehmen" übernimmt Leistung, Fahrzeug und Kunde direkt in einen fertigen Auftrag samt Track-Link – statt 12–16 Klicks Neuerfassung über mehrere Seiten. (T-004, PR #104)
- **Online-Zahlung auf der Belegseite:** Endkunden können ihre Rechnung per GiroCode-QR und eigenem Zahlungslink direkt begleichen – schnelleres Geld, weniger Mahnläufe. (T-006, PR #105)
- **CSV-Import für Kunden und Fahrzeuge:** Neue Betriebe bringen ihren Bestandskunden-Stamm mit Vorschau in Minuten ins System statt in Tagen. (T-007, PR #105)
- **Onboarding-Checkliste auf dem Dashboard:** Ein neuer Betrieb sieht auf dem leeren Dashboard sofort die nächsten Schritte samt direkter Aktions-Buttons statt einer toten Seite. (T-008, PR #108)
- **Suche und Filter für Aufträge und Fahrzeuge:** Ein Auftrag oder Fahrzeug lässt sich in Sekunden finden statt durch endloses Scrollen. (T-021, PR #108)
- **Schnellaktionen in der Kundenakte:** Aus der Kundenakte heraus lassen sich „Neuer Auftrag" und „Fahrzeug hinzufügen" mit vorbelegten Daten starten. (T-017, PR #108)
- **Einheitlicher Pflichtfeld-Standard:** Formulare zeigen Pflichtfelder und Fehler jetzt einheitlich an, sodass der Anwender vor dem Absenden sieht, was fehlt. (T-011, PR #107)
- **Design-System-Fundament:** Wiederverwendbare Bausteine (Bestätigungsdialog, Erfolgsmeldungen, Kennzahlen-Kacheln) als neuer Standard für die gesamte Oberfläche. (T-012, PR #101)
- **Zahlungslink- und Kunden-Mail-Schalter in den Einstellungen:** Der Betrieb steuert im Betrieb-Tab selbst, welche Endkunden-Mails versendet werden und welcher Zahlungslink gilt. (T-006/T-003, PR #107)

### Geändert

- **Tarife bringen jetzt echten Umsatz:** Plan-Limits (Mitarbeiter, Standorte, Kunden) und Funktionsumfang werden serverseitig durchgesetzt – Pro-Kunden erhalten mehr, Starter genau den bezahlten Umfang. (T-002, PR #102)
- **Weltklasse-Politur der Oberfläche:** Destruktive Aktionen fragen über ein sauberes Modal nach (statt OS-Dialog), Umlaut- und Textfehler in Navigation und Titeln sind bereinigt, Kennzahlen-Kacheln und Fokus-Ringe vereinheitlicht. (T-012/T-014, PR #101)
- **3D-Ansicht und Public-Seiten folgen dem Thema:** Die 3D-Schadenserfassung und öffentliche Seiten respektieren jetzt Hell-Thema und Branchen-Akzent wie der Rest der App. (T-015, PR #107)
- **Modal-Formulare auf dem Handy nutzbar:** Auftrags-, Kunden- und Plantafel-Dialoge brechen auf kleinen Bildschirmen sauber um – wichtig für die Arbeit am Fahrzeug in der Halle. (T-016, PR #107)
- **Duplikate im Code zusammengeführt:** Öffentliche Hülle, Logo, Rollen und Bereichs-Labels liegen jetzt an einer Stelle – künftige Änderungen brauchen einen Edit statt zehn. (T-018, PR #107)
- **Klarere Benennung der Annahme-Wege:** Die Navigation benennt die verschiedenen Fahrzeugannahme-Wege eindeutig, mit Querverweisen zwischen 2D- und 3D-Erfassung und Protokoll-Liste. (T-019/T-008, PR #107/#108)
- **Schnellere Listen bei wachsendem Datenbestand:** Ungebremste Listen erhalten Deckel bzw. Paginierung und die Auswertung wird schonender berechnet, damit die App auch bei vielen Datensätzen flüssig bleibt. (T-009, PR #106)
- **Dezente Micro-Interactions:** Modale, Karten, Navigation und Checkliste bekommen ruhige Animationen, die „Bewegung reduzieren"-Einstellungen respektieren. (PR #108)

### Behoben

- **Kundenliste bei ungültigem Limit repariert:** Ein `limit=0` oder negativer Wert liefert keine leere Kundenliste mehr; die Begrenzung ist an einer zentralen Stelle vereinheitlicht. (T-010, PR #106)
- **Wettlauf-Situationen entschärft:** Beim Annehmen von Anfragen, beim Versand von Statusmails und in der Auftragssuche können parallele Klicks bzw. verspätete Antworten keine falschen Ergebnisse mehr erzeugen. (T-004/T-003/T-021, PR #103/#104/#108)
- **Korrekte Zeitzone in Kundenmails:** Terminangaben in E-Mails nutzen jetzt die Berliner Zeitzone, außerdem werden E-Mail-Adressen vor dem Versand geprüft. (T-003, PR #103)
- **Robuste Formular-Aktualisierung:** Teil-Updates funktionieren auch gegen ältere Backend-Stände, Pflichtangaben werden nur bei Neuanlage erzwungen. (T-011, PR #107)

### Sicherheit

- **Abo-Sperre schließt jetzt sicher (fail-closed):** Ein fehlender oder vergessener Abo-Datensatz führt nicht mehr zu unbemerkter Gratisnutzung, sondern sperrt vorsorglich. (T-020, PR #102)
- **CSV-Import gegen Manipulation gehärtet:** Beim Import werden Formel-Einschleusungen entschärft, die BIC/IBAN-Eingabe validiert und Audit-Einträge ohne sensible Dateinamen geführt. (T-007/T-006, PR #105)
