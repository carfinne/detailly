# Rechtstexte — ENTWURF (Impressum & Datenschutzerklärung)

> ## ⚠️ ENTWURF — keine Rechtsberatung
>
> Dieses Dokument ist ein **unverbindlicher Arbeitsentwurf** zur Vorbereitung durch den Betreiber.
> Es stellt **keine Rechtsberatung** dar.
>
> - Alle **[PLATZHALTER]** durch echte Betreiberdaten ersetzen.
> - Vor jeder Veröffentlichung durch **Betreiber + Fachanwalt (IT-Recht/Datenschutz)** prüfen und finalisieren lassen.
> - Besonders kritisch: **Detailly verarbeitet personenbezogene Daten Dritter** — nämlich der Endkundinnen und Endkunden der angeschlossenen Betriebe (Werkstätten/Aufbereiter). Detailly ist insoweit **Auftragsverarbeiter (Art. 28 DSGVO)**, der jeweilige Betrieb ist **Verantwortlicher**. Dafür ist zusätzlich ein **Auftragsverarbeitungsvertrag (AV-Vertrag) mit jedem Betrieb** erforderlich — dieser Entwurf deckt ihn NICHT ab.
>
> Stand des Entwurfs: 2026-07-07. Rechtsstand DE. Verweise auf Gesetze/Fristen sind anwaltlich zu verifizieren.

---

## 0. Hinweise zur Nutzung dieses Entwurfs

- Die produktiv ausgelieferten Seiten liegen bereits im Frontend:
  - `frontend/src/app/impressum/page.tsx`
  - `frontend/src/app/datenschutz/page.tsx`
  - gemeinsame Bausteine: `frontend/src/components/legal.tsx` (`LegalShell`, `Abschnitt`, `Platzhalter`)
- Dieser Entwurf ist die **inhaltliche Referenz**, in die der Betreiber die echten Angaben einträgt. Die freigegebenen Endtexte werden dann in die o. g. `page.tsx`-Dateien übernommen (Ticket **T-005**). Platzhalter werden dort über die `<Platzhalter>`-Komponente sichtbar markiert.
- Die Fundstelle jedes Platzhalters ist unten in der Tabelle in Abschnitt „Was der Betreiber liefern muss" aufgelistet.

---

# TEIL A — IMPRESSUM

Struktur nach § 5 Digitale-Dienste-Gesetz (DDG, vormals § 5 TMG) und § 18 Abs. 2 Medienstaatsvertrag (MStV).

## Angaben gemäß § 5 DDG

**[Firmenname / Rechtsform]**
*(z. B. „Detailly UG (haftungsbeschränkt)" — Zusatz „i. G." solange in Gründung)*

vertreten durch **[Vertretungsberechtigte(r) / Geschäftsführer(in)]**

**[Straße und Hausnummer]**
**[PLZ und Ort]**
Deutschland

## Kontakt

- E-Mail: **[Kontakt-E-Mail]**
- Telefon: **[Telefonnummer]**

## Handelsregister

*(nur falls eingetragen — sonst Hinweis „Eintragung beantragt / in Gründung")*

- Registergericht: **[Amtsgericht …]**
- Registernummer: **[HRB …]**

## Umsatzsteuer-Identifikationsnummer

Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: **[USt-IdNr.]**
*(falls nicht vorhanden: entsprechenden Hinweis aufnehmen — „liegt derzeit nicht vor")*

## Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV

**[Name der verantwortlichen Person]**
**[Anschrift — sofern abweichend, sonst „Anschrift wie oben"]**

## Verbraucherstreitbeilegung

Angabe, ob eine Bereitschaft/Verpflichtung zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle besteht (§ 36 VSBG). **[Formulierung durch Anwalt bestätigen lassen]**

## Haftung für Inhalte / Links / Urheberrecht

Standard-Klauseln (Diensteanbieterhaftung, keine Überwachungspflicht nach § 7 ff. DDG, Fremdinhalte, deutsches Urheberrecht). **[Vom Anwalt gegenprüfen lassen.]**

---

# TEIL B — DATENSCHUTZERKLÄRUNG

## 1. Verantwortlicher

Verantwortlich im Sinne der DSGVO **für die Website und den SaaS-Dienst Detailly** ist:

**[Firmenname / Rechtsform]**, **[Vertretungsberechtigte(r)]**
**[Straße und Hausnummer]**, **[PLZ und Ort]**, Deutschland
E-Mail: **[Kontakt-E-Mail]** · Datenschutz-Anliegen: **[Datenschutz-E-Mail]**

> **Wichtige Rollen-Abgrenzung:** Für die personenbezogenen Daten, die ein Betrieb über seine eigenen Endkundinnen und Endkunden in Detailly verarbeitet (Kontakt-, Fahrzeug-, Auftrags-, Rechnungs- und Inspektionsdaten), ist **der jeweilige Betrieb der Verantwortliche**; Detailly ist insoweit **Auftragsverarbeiter (Art. 28 DSGVO)**. Siehe Ziffer 6.

## 2. Datenschutzbeauftragter

**[DSB — falls benannt: Name + Kontakt; sonst Hinweis, dass keine Bestellpflicht besteht]**

## 3. Grundsätze der Verarbeitung

Datensparsamkeit; Verarbeitung nur soweit erforderlich; Weitergabe an Dritte nur im hier beschriebenen Rahmen oder bei gesetzlicher Pflicht.

## 4. Erhobene Daten, Zwecke & Rechtsgrundlagen

> Die folgende Übersicht beruht auf einer **Code-Analyse der tatsächlichen Datenverarbeitung** (Stand des Entwurfs). Sie ist bei jeder größeren Funktionsänderung zu aktualisieren.

### 4.1 Server-Logfiles (Hosting)
Beim Aufruf: IP-Adresse, Zeitpunkt, aufgerufene Ressource, übertragene Datenmenge, Browser-/Systeminformationen. Zweck: sicherer, stabiler Betrieb. **Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO** (berechtigtes Interesse).

### 4.2 Nutzerkonto der Betriebe (Tabelle `users`)
Verarbeitete Felder: **E-Mail, Passwort (nur als Hash), Vorname, Nachname, Telefon (optional), Rolle, letzter Login-Zeitpunkt, E-Mail-Bestätigungs-Status**. Interner Stundenlohn eines Mitarbeiters (`stundenlohn`) wird nur für die Lohnkosten-Auswertung der Betriebsleitung genutzt.
Zweck: Bereitstellung und Abrechnung des Dienstes, Zugriffskontrolle, E-Mail-Verifizierung (Double-Opt-in). **Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO** (Vertragserfüllung).

### 4.3 Stammdaten des Betriebs (Tabelle `tenants`)
Betriebsname, Slug, E-Mail, Telefon, Anschrift, Öffnungszeiten, Rechnungs-/Steuerangaben (**IBAN, Steuernummer, USt-IdNr., Bankverbindung — verschlüsselt gespeichert**), optionaler sevDesk-API-Token (verschlüsselt). **Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.**

### 4.4 Endkundendaten der Betriebe — Auftragsverarbeitung
Von den Betrieben über ihre eigenen Kunden erfasst (Detailly = Auftragsverarbeiter, siehe Ziffer 6):
- **Kunden (`customers`):** Typ (privat/geschäftlich), Vor-/Nachname, Firmenname, USt-Nr., E-Mail, Telefon, Mobil, Anschrift, Land, interne Notizen.
- **Fahrzeuge (`vehicles`):** Marke, Modell, Baujahr, Farbe, **Kennzeichen, Fahrgestellnummer (VIN)**, Maße, Notizen.
- **Aufträge / Termine / Annahmeprotokolle:** Leistungsdetails, interne Hinweise, Vorher-/Nachher-**Fotos**, Kilometer-/Tankstand, Schadensmarker.
- **Inspektionen (`damage_inspections`):** Schadenspositionen, **Fotos** (können Kennzeichen/VIN/Tacho zeigen), **digitale Unterschrift des Kunden (PNG)**, eingefrorener Einwilligungstext, Name des Unterzeichnenden.
- **Rechnungen (`invoices`) & Positionen:** Rechnungsnummer, Beträge, Datum, Empfängerdaten; sensible Freitext-/Empfängerfelder **verschlüsselt**.

### 4.5 Online-Terminanfrage (öffentliches Portal, Tabelle `booking_requests`)
Freiwillige Angaben von Endkunden **ohne Login**: Name, E-Mail und/oder Telefon, gewählte Leistung, Fahrzeugangabe, Wunschtermin, Nachricht. Zur Missbrauchsabwehr wird die Quell-**IP-Adresse ausschließlich gehasht** gespeichert (nie im Klartext). **Rechtsgrundlage: Art. 6 Abs. 1 lit. b** (vorvertraglich) **und lit. f** (Missbrauchsabwehr). Nicht angenommene Anfragen werden nach spätestens **[Aufbewahrungsfrist, z. B. 90 Tagen]** gelöscht.

### 4.6 Support (Tabellen `support_tickets`, `support_messages`)
Betreff, Kategorie, Nachrichtenverlauf, erstellender Nutzer. Zweck: Bearbeitung von Support-Anfragen. **Rechtsgrundlage: Art. 6 Abs. 1 lit. b und lit. f.**

### 4.7 Protokollierung / Audit (Tabelle `audit_logs`)
Wer/Was/Wann-Trail (Nutzer-ID, Aktion, Objektbezug, Zeitpunkt) zur Nachvollziehbarkeit und Rechenschaft. **Rechtsgrundlage: Art. 6 Abs. 1 lit. f i. V. m. Art. 5 Abs. 2 DSGVO** (Rechenschaftspflicht). Bei Löschung eines Kunden wird die personenbezogene Detail-Nutzlast redigiert.

### 4.8 Abo-Zahlung (nur SaaS-Abo der Betriebe, Stripe)
Zur Abwicklung des kostenpflichtigen Abonnements wird **Stripe** eingesetzt (Checkout, Kundenportal, Webhooks). Übermittelt werden **Betriebs-E-Mail und -Name**; Zahlungsdaten (Karten-/Kontodaten) werden **ausschließlich von Stripe** verarbeitet, nicht bei Detailly gespeichert. Betrifft **nur das SaaS-Abo**, nicht die Endkunden der Betriebe. **Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.**

## 5. Cookies / lokale Speicherung
Keine Tracking-/Analyse-/Werbe-Cookies, keine Dienste Dritter zu Analysezwecken. Für die Anmeldung wird ein technisch notwendiger Zugangs-Token im `localStorage` abgelegt (**§ 25 Abs. 2 TDDDG** — keine Einwilligung erforderlich). **[Anwaltlich bestätigen.]**

## 6. Verarbeitung im Auftrag unserer Kunden (Art. 28 DSGVO)
Soweit Betriebe personenbezogene Daten ihrer Endkunden in Detailly verarbeiten, ist Detailly **Auftragsverarbeiter**; verantwortlich ist der jeweilige Betrieb. Grundlage ist ein **Auftragsverarbeitungsvertrag** zwischen Detailly und dem Betrieb. Sensible Datenfelder werden **verschlüsselt** gespeichert (siehe Ziffer 9).

## 7. Empfänger & Auftragsverarbeiter

| Dienst | Zweck | Sitz / Serverstandort | Drittland | AV-Vertrag |
|---|---|---|---|---|
| **[Hosting-Anbieter — Anschrift]** (laut BUSINESS_CASE.md vorgesehen: Hetzner, DE) | Hosting/Infrastruktur, Server-Logs | Deutschland | nein | **[AV-Vertrag-Status]** |
| **[SMTP-/E-Mail-Anbieter]** | Versand von Belegen, Status-, System-Mails | **[Sitz]** | **[ja/nein]** | **[AV-Vertrag-Status]** |
| **Stripe Payments Europe, Ltd.** | Abwicklung des SaaS-Abos (nur Betriebe) | Irland (EU); Konzern USA | **[Drittlandtransfer prüfen — Stripe-DPA/SCC]** | **[AV-Vertrag-Status / Stripe-DPA]** |
| **sevDesk GmbH** | Buchhaltung/Rechnungsexport — **nur wenn ein Betrieb die Anbindung aktiv aktiviert** | Deutschland | nein | **[AV-Vertrag-Status]** |

Weitere Empfänger nur bei gesetzlicher Pflicht. **[Liste ergänzen, sobald weitere Dienste eingesetzt werden.]**

> Hinweis: **GiroCode** (QR-Code auf Rechnungen) wird lokal erzeugt und ist **kein** externer Dienst / keine Datenübermittlung.

## 8. Serverstandort & Drittlandübermittlung
Der SaaS-Dienst wird bei einem **Anbieter in Deutschland** gehostet (laut BUSINESS_CASE.md: Hetzner, Serverstandort DE). Eine Übermittlung personenbezogener Daten in Drittländer außerhalb der EU/des EWR ist für den Kernbetrieb **nicht vorgesehen**. Ausnahme prüfen: **Stripe** (US-Konzernmutter) — Transfer-Grundlage (Stripe-DPA / Standardvertragsklauseln) durch Betreiber/Anwalt bestätigen. **[Sobald ein weiterer Dienst mit Drittlandbezug eingesetzt wird, hier ergänzen.]**

## 9. Technische & organisatorische Maßnahmen (Sicherheit)
Belegbar aus dem Code:
- **Transportverschlüsselung (TLS/HTTPS)** für alle Verbindungen. **[Zertifikat/Erzwingung bestätigen.]**
- **Verschlüsselung sensibler Datenbankfelder (at-column):** u. a. Rechnungs-Hinweise & Empfänger-Snapshot, IBAN/Steuernummer/USt-IdNr./Bankdaten des Betriebs, sevDesk-Token (`encrypted-column`).
- **Passwörter** werden ausschließlich als **Hash** gespeichert; ein Passwort-Reset entwertet bestehende Sitzungen.
- **Tokens** (E-Mail-Bestätigung u. a.) werden **gehasht** gespeichert; öffentliche Zugriffstoken sind nicht erratbar und regenerierbar.
- **Quell-IP** öffentlicher Anfragen nur **gehasht**.
- **Strikte Mandantentrennung** (jede Abfrage ist auf den eigenen Betrieb `tenantId` beschränkt; kein betriebsübergreifender Zugriff).
- **Zugriffsprotokollierung** (Audit-Log).

## 10. Speicherdauer
Grundsatz: nur so lange wie zur Zweckerfüllung nötig. **Steuer-/handelsrechtlich relevante Unterlagen (insb. Rechnungen)** unterliegen gesetzlichen Aufbewahrungsfristen von **bis zu zehn Jahren (§ 147 AO, § 257 HGB; GoBD)**. Bei einer Löschung nach Art. 17 werden Kundenstammdaten deshalb **anonymisiert statt hart gelöscht**, wo eine Aufbewahrungspflicht besteht (der Rechnungs-Empfänger-Snapshot bleibt für § 14 UStG erhalten). Nicht angenommene Terminanfragen: **[z. B. 90 Tage]**. **[Konkrete Fristen je Datenart mit Anwalt/Steuerberater festlegen.]**

## 11. Betroffenenrechte
Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21), Widerruf von Einwilligungen (Art. 7 Abs. 3), Beschwerde bei einer Aufsichtsbehörde (Art. 77). Kontakt: **[Datenschutz-E-Mail]**.

> Detailly unterstützt Auskunft (Art. 15) und Löschung/Anonymisierung (Art. 17) technisch über eine eigene DSGVO-Funktion — die Betroffenenrechte der Endkunden nimmt jedoch der jeweilige **Betrieb als Verantwortlicher** wahr.

## 12. Keine automatisierte Entscheidungsfindung
Eine automatisierte Entscheidungsfindung einschließlich Profiling (Art. 22 DSGVO) findet nicht statt.

## 13. Aktualität
Es gilt die jeweils veröffentlichte Fassung; Anpassung bei Änderungen der Verarbeitung.

---

## Was der Betreiber liefern muss (Platzhalter-Checkliste)

Diese Platzhalter erscheinen im Frontend über die `<Platzhalter>`-Komponente (`frontend/src/components/legal.tsx`) und sind in `impressum/page.tsx` bzw. `datenschutz/page.tsx` einzusetzen (T-005).

| Platzhalter | Betrifft | Fundstelle |
|---|---|---|
| [Firmenname / Rechtsform] | Impressum + Datenschutz Ziffer 1 | beide Seiten |
| [Vertretungsberechtigte(r) / Geschäftsführer(in)] | Impressum § 5 DDG | impressum |
| [Straße und Hausnummer] | Anschrift | beide Seiten |
| [PLZ und Ort] | Anschrift | beide Seiten |
| [Kontakt-E-Mail] | Impressum Kontakt + Datenschutz | beide Seiten |
| [Telefonnummer] | Impressum Kontakt | impressum |
| [USt-IdNr.] | Impressum (§ 27a UStG) | impressum |
| [Amtsgericht …] / [HRB …] | Handelsregister (falls vorhanden) | impressum |
| [Name verantwortlich § 18 Abs. 2 MStV] | Impressum | impressum |
| [DSB — falls benannt] | Datenschutz Ziffer 2 | datenschutz |
| [Datenschutz-E-Mail] | Datenschutz Ziffer 1/11 | datenschutz |
| [Hosting-Anbieter, Anschrift] | Datenschutz Ziffer 7/8 | datenschutz |
| [SMTP-/E-Mail-Anbieter + Sitz] | Datenschutz Ziffer 7 | datenschutz |
| [AV-Vertrag-Status] je Dienst | Datenschutz Ziffer 7 | datenschutz |
| [Drittlandtransfer Stripe — Transfer-Grundlage] | Datenschutz Ziffer 7/8 | datenschutz |
| [Aufbewahrungsfristen je Datenart] | Datenschutz Ziffer 10 | datenschutz |
| [Verbraucherschlichtung — Bereitschaft] | Impressum | impressum |

**Zusätzlich (nicht im Frontend, aber vor Go-Live nötig):**
- **AV-Vertrag mit jedem Betrieb** (Detailly = Auftragsverarbeiter der Endkundendaten) — Muster durch Anwalt.
- **Stripe-DPA / Transfer-Grundlage** bestätigen (US-Konzernbezug).
- **Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)** — separat, nicht Teil dieser Texte.
