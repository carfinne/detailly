> ## ⚠️ ENTWURF — anwaltliche Prüfung vor Produktivnutzung zwingend
>
> Unverbindlicher Arbeitsentwurf, **keine Rechtsberatung**, nicht anwaltlich erstellt/geprüft.
> Vor jeder produktiven Nutzung durch eine auf Datenschutzrecht spezialisierte Kanzlei prüfen und
> freigeben lassen. Alle `<PLATZHALTER: …>` vor Nutzung durch echte Betreiberdaten ersetzen. Die
> Verweise auf umgesetzte Technik (Anlage 3 / TOM) sind gegen den Code belegt. Empfehlung:
> auf den EU-Standardvertragsklauseln nach Art. 28 Abs. 7 (Durchführungsbeschluss (EU) 2021/915)
> aufbauen. Rechtsstand-Recherche siehe `docs/RECHTLICHE_ABSICHERUNG.md`.

# Auftragsverarbeitungsvertrag (AVV) gemäß Art. 28 DSGVO

**zwischen**

dem Betrieb — im Folgenden **„Verantwortlicher"** —
`<PLATZHALTER: Firma, Anschrift, Vertretungsberechtigte(r) des Betriebs>`

**und**

`<PLATZHALTER: Detailly UG (haftungsbeschränkt) i. G., Anschrift, vertreten durch Finn Bellmann>` — im Folgenden **„Auftragsverarbeiter"** (Detailly) —

gemeinsam die „Parteien".

Dieser AVV ist **Anlage zum Nutzungsvertrag** (SaaS-AGB) und geht diesem in Datenschutzfragen vor. Er kann elektronisch geschlossen werden (Art. 28 Abs. 9; z. B. per Checkbox beim Onboarding).

---

## § 1 Gegenstand, Dauer, Rangfolge
1. Gegenstand ist die Verarbeitung personenbezogener Daten durch Detailly **im Auftrag** des Verantwortlichen im Rahmen der Nutzung der Detailly-Werkstattsoftware (SaaS) für Fahrzeugaufbereitung, Folierung und Lackschutz (PPF).
2. Die **Laufzeit** entspricht der Laufzeit des Nutzungsvertrags. Der AVV endet mit dessen Beendigung; die Pflichten aus § 10 (Löschung/Rückgabe) gelten nach.
3. **Rangfolge:** Bei Widersprüchen in Datenschutzfragen geht dieser AVV dem Nutzungsvertrag vor.
4. **Nicht** Gegenstand dieses AVV sind Verarbeitungen, für die Detailly **eigenständig Verantwortlicher** ist (insbesondere die Abrechnung des SaaS-Abos, die eigene Website, Registrierung/Konto der Betriebe, Support). Hierfür gilt die Datenschutzerklärung von Detailly.

## § 2 Art, Zweck, Datenkategorien und betroffene Personen (Anlage 1)
1. **Zweck:** Bereitstellung und Betrieb der Software zur Abwicklung der Geschäftsprozesse des Betriebs (Kunden-/Fahrzeugverwaltung, Aufträge, Terminplanung, Fahrzeugannahme/Gutachten, Rechnungen, Mahnwesen, Online-Terminbuchung).
2. **Art der Verarbeitung:** Erheben, Erfassen, Organisieren, Speichern, Anzeigen, Verändern, Auslesen, Übermitteln (an die in Anlage 2 genannten Unterauftragsverarbeiter), Löschen/Anonymisieren.
3. **Kategorien betroffener Personen:** Endkundinnen und Endkunden des Betriebs (privat und geschäftlich), deren Ansprechpartner, ggf. Interessenten über das öffentliche Buchungsportal.
4. **Kategorien personenbezogener Daten** (abgeleitet aus dem tatsächlichen Datenmodell):
   - **Kundenstammdaten** (`customers`): Typ (privat/geschäftlich), Vor-/Nachname, Firmenname, USt-Nr., Leitweg-ID (B2G), E-Mail, Telefon, Mobil, Anschrift, Land, interne Notizen.
   - **Fahrzeugdaten** (`vehicles`): Marke, Modell, Baujahr, Farbe, **Kennzeichen**, **Fahrgestellnummer (VIN)**, Maße, Notizen.
   - **Auftrags-/Termindaten** (`orders`, `appointments`): Leistungsdetails, interne Hinweise, **Vorher-/Nachher-Fotos**, Kilometer-/Tankstand, Schadensmarker, Terminzeiten.
   - **Inspektionen/Gutachten** (`damage_inspections` inkl. Positionen/Fotos): Schadenspositionen, **Fotos** (können Kennzeichen/VIN/Tacho zeigen), **digitale Unterschrift des Kunden (PNG)**, eingefrorener Einwilligungstext, Name des Unterzeichnenden.
   - **Rechnungsdaten** (`invoices`): Rechnungsnummer, Positionen, Beträge, Datum, Empfängerdaten (sensible Freitext-/Empfängerfelder verschlüsselt).
   - **Online-Terminanfragen** (`booking_requests`): Name, E-Mail und/oder Telefon, Leistung, Fahrzeugangabe, Wunschtermin, Nachricht; Quell-IP **nur gehasht**.
   - **Vermietungen, Zeiterfassung, Support** (soweit personenbezogen).
5. **Besondere Datenkategorien (Art. 9):** sind bestimmungsgemäß **nicht** Gegenstand. Der Verantwortliche verpflichtet sich, keine Art.-9-Daten einzustellen. *[ANWALT PRÜFEN: Freitext/Fotos können faktisch Art.-9-Daten enthalten.]*

## § 2a Garantie und Freistellung durch den Verantwortlichen
Der Verantwortliche garantiert die **Rechtmäßigkeit** der eingestellten Daten und erteilten Weisungen (gültige Rechtsgrundlage nach Art. 6, Erfüllung der Informationspflichten Art. 13/14, ggf. Einwilligungen) und stellt Detailly von Ansprüchen Dritter/Betroffener und Bußgeldern frei, die aus **rechtswidrigen Weisungen** oder **unrechtmäßig eingestellten Daten** resultieren. *[ANWALT PRÜFEN: § 307 BGB-feste Reichweite; die Außenhaftung nach Art. 82 DSGVO bleibt unberührt.]*

## § 3 Weisungsrecht
1. Detailly verarbeitet die Daten **ausschließlich auf dokumentierte Weisung** des Verantwortlichen. Die bestimmungsgemäße Nutzung der Software gilt als Weisung.
2. **Individualweisungen** richtet der Verantwortliche an `<PLATZHALTER: support@detailly.de>`.
3. Hält Detailly eine Weisung für **rechtswidrig**, informiert es den Verantwortlichen unverzüglich (Art. 28 Abs. 3 Satz 2) und darf die Ausführung bis zur Bestätigung aussetzen.
4. **Behördliche Auskunftsersuchen** zu Daten des Verantwortlichen beantwortet Detailly nicht selbständig, sondern informiert den Verantwortlichen unverzüglich vorab, soweit rechtlich zulässig.

## § 4 Vertraulichkeit
Detailly setzt zur Verarbeitung nur Personen ein, die zur **Vertraulichkeit** verpflichtet sind oder einer angemessenen gesetzlichen Verschwiegenheitspflicht unterliegen, und stellt sicher, dass diese die Daten nur weisungsgemäß verarbeiten.

## § 5 Technische und organisatorische Maßnahmen (TOM)
1. Detailly trifft die in **Anlage 3 (`TOMS.md`)** beschriebenen technischen und organisatorischen Maßnahmen nach **Art. 32 DSGVO**. Anlage 3 nennt ausdrücklich auch die Maßnahmen, die durch **Betreiber/Hoster** sicherzustellen sind (z. B. At-Rest-Verschlüsselung des Speichers, Backup-Verschlüsselung/Offsite).
2. Die Maßnahmen unterliegen dem technischen Fortschritt; Detailly darf sie fortentwickeln, solange das Schutzniveau nicht unterschritten wird.

## § 6 Unterauftragsverarbeiter
1. Der Verantwortliche erteilt eine **allgemeine schriftliche Genehmigung** zur Beauftragung der in **Anlage 2 (`SUBPROZESSOREN.md`)** genannten Unterauftragsverarbeiter.
2. Detailly informiert über beabsichtigte **Änderungen** (Aufnahme/Austausch) mit einer Frist von `<PLATZHALTER: 30>` Tagen; der Verantwortliche kann aus wichtigem Grund **widersprechen** und bei berechtigtem Widerspruch **außerordentlich kündigen**.
3. Detailly verpflichtet jeden Unterauftragsverarbeiter vertraglich auf mindestens dieselben Datenschutzpflichten (Art. 28 Abs. 4).

## § 7 Drittlandübermittlung
Eine Übermittlung in Drittländer erfolgt nur, soweit in Anlage 2 ausgewiesen (derzeit ggf. **Anthropic/Stripe**, USA), und dann auf Grundlage eines **Angemessenheitsbeschlusses** (primär EU-US Data Privacy Framework) und **hilfsweise Standardvertragsklauseln (Art. 46) nebst Transfer-Folgenabschätzung**. Der Kernbetrieb (Hosting, Endkundendaten) findet in Deutschland/der EU statt.

## § 8 Unterstützung des Verantwortlichen
1. **Betroffenenrechte (Art. 12–23):** Detailly unterstützt den Verantwortlichen durch geeignete technische Maßnahmen. Umgesetzt sind ein **DSGVO-Cockpit** mit **Datenauskunft/Export (Art. 15)** und **Löschung/Anonymisierung (Art. 17)** je Kunde (siehe `TOMS.md` §5 und `backend/src/gdpr/gdpr.service.ts`). Die **Wahrnehmung** der Betroffenenrechte gegenüber den Endkunden obliegt dem Verantwortlichen; Detailly reicht direkt an ihn gerichtete Anfragen weiter.
2. **Datenpanne (Art. 33/34):** Detailly meldet dem Verantwortlichen eine ihm bekannt gewordene **Verletzung des Schutzes personenbezogener Daten** unverzüglich, spätestens innerhalb von `<PLATZHALTER: 24>` Stunden nach Kenntnis, mit den nach Art. 33 Abs. 3 verfügbaren Angaben. Die Meldung an die Aufsichtsbehörde (72 h) und ggf. an Betroffene obliegt dem Verantwortlichen. Ablauf: siehe **`DATENPANNEN_RUNBOOK.md`**.
3. **Art. 32, 35, 36:** Detailly unterstützt bei Datensicherheit, Datenschutz-Folgenabschätzung und vorheriger Konsultation im Rahmen des Verfügbaren.

## § 9 Nachweise und Kontrollrechte (Audits)
1. Detailly stellt dem Verantwortlichen die zum Nachweis der Einhaltung erforderlichen Informationen zur Verfügung (vorrangig diese Anlagen, ggf. Testate/Berichte).
2. **Vor-Ort-Kontrollen** sind nach Ankündigung von `<PLATZHALTER: 14>` Tagen zu üblichen Geschäftszeiten möglich, höchstens `<PLATZHALTER: 1×/Jahr>`, außer bei besonderem Anlass. Der Betrieb des Rechenzentrums bleibt ungestört. *[ANWALT PRÜFEN: Kostenregelung für aufwändige/anlasslose Audits.]*

## § 10 Löschung und Rückgabe bei Vertragsende
1. Nach Ende des Nutzungsvertrags stellt Detailly dem Verantwortlichen einen **Datenexport** bereit (`<PLATZHALTER: 30>` Tage Karenz) und **löscht** die Daten anschließend, einschließlich in Sicherungskopien nach spätestens `<PLATZHALTER: 90>` Tagen (Data-Act-Vorgaben zum Anbieterwechsel bleiben unberührt, siehe AGB).
2. Der Export nutzt die im Produkt vorhandenen **Export-/Löschfunktionen** (Kunden-Export, Buchhaltungs-/Rechnungsexport) — siehe `TOMS.md` §5.
3. **Gesetzliche Aufbewahrungspflichten** (z. B. § 257 HGB, § 147 AO/GoBD für Rechnungen) trägt der **Verantwortliche**; Detailly löscht/sperrt nach dessen Weisung und behält den steuerlich erforderlichen Rechnungs-Empfänger-Snapshot, wie im Löschkonzept beschrieben.

## § 11 Haftung
Es gelten Art. 82 DSGVO und die Haftungsregeln des Nutzungsvertrags. Die Außenhaftung nach Art. 82 ist nicht abdingbar; der Innenausgleich/die Freistellung richtet sich nach § 2a und dem Nutzungsvertrag. *[ANWALT PRÜFEN: Abstimmung mit dem Haftungs-Cap der AGB.]*

## § 12 Schlussbestimmungen
Änderungen bedürfen der Textform. Sollte eine Bestimmung unwirksam sein, bleibt der Vertrag im Übrigen wirksam. Es gilt deutsches Recht.

---

## Anlagenverzeichnis
- **Anlage 1** — Gegenstand/Datenkategorien/betroffene Personen: siehe § 2 dieses AVV.
- **Anlage 2** — Unterauftragsverarbeiter: **`SUBPROZESSOREN.md`**.
- **Anlage 3** — Technische und organisatorische Maßnahmen (Art. 32): **`TOMS.md`**.

## Anwalt-/Betreiber-To-do
- [ ] AVV auf **SCC nach Art. 28 Abs. 7 (Beschluss (EU) 2021/915)** aufsetzen und Eigenklauseln (§ 2a, § 9, Fristen) kollisionsfrei einbetten.
- [ ] Fristen in §§ 6/8/9/10 final festlegen (Breach 24 h empfohlen, **nicht** 48 h).
- [ ] Firmierung/Vertretung/Anschrift beider Parteien einsetzen.
- [ ] Unterauftragsverarbeiter-Kette tatsächlich schließen (siehe `SUBPROZESSOREN.md` §5).
- [ ] Elektronischen Abschluss beim Onboarding technisch verankern (Zustimmungserfassung — siehe `COMPLIANCE_TRACKING.md`, Lücke 1).
