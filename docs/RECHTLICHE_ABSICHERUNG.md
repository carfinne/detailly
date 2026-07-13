# RECHTLICHE ABSICHERUNG — Detailly UG (haftungsbeschränkt) i. G.

**Master-Dokument zur rechtlichen Vorbereitung des SaaS-, Buchungsportal- und Marktplatz-Betriebs**

Stand: 13.07.2026 · Ersteller: Redaktion Rechts-Compliance (Detailly) · Version: 1.0 (Vor-Anwalts-Fassung)

---

## ⚠️ Haftungshinweis (bitte zuerst lesen)

**Dieses Dokument ist eine sorgfältige, quellenbasierte VORBEREITUNG und Recherche — es ist KEINE Rechtsberatung im Einzelfall.** Es fasst den per Websuche verifizierten Rechtsstand (Deutschland/EU) zum **13.07.2026** zusammen und enthält Entwurfstexte, Skelette und Prüfhinweise als Arbeitsgrundlage.

Sämtliche hier enthaltenen Vertrags-, Impressums-, Datenschutz- und AGB-Texte sind **Arbeitsfassungen mit Platzhaltern**. Sie dürfen **erst nach anwaltlicher Prüfung und Freigabe** sowie nach Einsetzen der echten Firmendaten produktiv eingesetzt werden. Alle im Text mit **„ANWALT PRÜFEN"** markierten Punkte sowie das konsolidierte **Anwalt-Pflicht-Register (Abschnitt 5)** sind zwingend vor Go-Live durch eine spezialisierte Kanzlei (Schwerpunkte: IT-/Plattform-, Datenschutz-, Zahlungsaufsichts- und Steuerrecht) final zu prüfen.

Besondere Vorsicht: Rechtstexte, die Detailly seinen Kundenbetrieben (Tenants) als „Muster/Vorlage" bereitstellt (z. B. Muster-Datenschutzerklärung, Muster-Impressum, Widerrufsbelehrung), können als **unerlaubte Rechtsdienstleistung (§ 2 RDG)** gewertet werden — nur als generische, ausdrücklich als unverbindlich gekennzeichnete Vorlagen mit Disclaimer ausliefern, idealerweise in Kanzlei-Kooperation.

---

## 1. Executive Summary — erforderliche Dokumente/Angaben

Legende Status: **E** = Entwurf/Skelett in diesem Dokument vorhanden · **F** = Firmendaten/Parameter fehlen (Platzhalter) · **A** = anwaltliche Finalprüfung zwingend · Priorität: **P0** = vor erstem echten Kunden · **P1** = vor Marktplatz-/Buchungsportal-Start · **P2** = mittelfristig/laufend.

| Dokument / Angabe | Rechtsgrundlage (Kern) | Status | Priorität |
|---|---|---|---|
| Impressum Detailly (Website + App) | § 5 DDG, § 18 MStV, § 2 DL-InfoV | E · F · A | P0 |
| DSA-Kontaktstellen Art. 11/12 (Behörden + Nutzer) | Art. 11, 12 DSA (VO 2022/2065) | E · F · A | P0 |
| Datenschutzerklärung Detailly | Art. 13/14 DSGVO, § 25 TDDDG | E · F · A | P0 |
| Cookie-/Speicher-Hinweis (nur technisch notwendig) | § 25 Abs. 2 Nr. 2 TDDDG | E | P0 |
| AVV (Auftragsverarbeitung) inkl. Anlagen 1–3 | Art. 28 DSGVO, Beschluss (EU) 2021/915 | E · F · A | P0 |
| Verzeichnis Verarbeitungstätigkeiten (Detailly, Art. 30 Abs. 2) | Art. 30 Abs. 2 DSGVO | F | P0 |
| Datenpannen-Runbook (72h / Meldekette an Tenant) | Art. 33/34 DSGVO | F · A | P0 |
| Schwellwertanalyse / ggf. DSFA | Art. 35 DSGVO | F · A | P1 |
| SaaS-Nutzungsbedingungen (B2B) | §§ 535, 305 ff. BGB, Data Act (VO 2023/2854) | E · F · A | P0 |
| Data-Act-Anlage „exportierbare Datenkategorien/Formate" | Art. 23–25 Data Act | F · A | P0 |
| Leistungsbeschreibung/Tarife + Preisliste | Transparenzgebot, § 307 BGB | F | P0 |
| Marktplatz-AGB Käufer (Betriebe) | §§ 145 ff. BGB, § 312i BGB, DSA | E · F · A | P1 |
| Händler-/Verkäufer-Rahmenvertrag | §§ 305 ff. BGB, P2B-Vorsorge | E · F · A | P1 |
| Provisions-/Gebührenordnung (Anlage) | § 307 BGB, P2B Art. 3–5 | F · A | P1 |
| Produkt-/Listungsrichtlinie (REACH/CLP/GPSR/Verbotsliste) | REACH, CLP, GPSR | F · A | P1 |
| KYB-/Onboarding-Checkliste Händler | § 22f UStG, §§ 14 ff. PStTG | E · F | P1 |
| DAC7-Informationsblatt (Händler) | § 22 PStTG | E · F | P1 |
| ZAG-Selbsteinschätzung / Geldfluss-Memo | § 1, § 2, § 63 ZAG | F · A | P1 |
| PStTG/DAC7-Meldeprozess + BZSt-Registrierung (DIP 2.x) | §§ 12 ff. PStTG | F · A | P1 |
| USt-IdNr.-Prüfprozess (§ 18e) + § 22f-Aufzeichnung | §§ 22f, 25e, 18e UStG | F · A | P1 |
| E-Rechnungs-Fähigkeit (Empfang jetzt, Ausstellung 2027/28) | § 14 UStG (Wachstumschancengesetz) | F · A | P0/P1 |
| GPSR-/VerpackG-/ElektroG-/BattDG-Marktplatzpflichten | VO 2023/988, § 7 Abs. 7 VerpackG, § 6 ElektroG, BattDG | F · A | P1 |
| Buchungsportal-Rechtstexte-Slots (Impressum/DSE/AGB/Widerruf/VSBG/BFSG) | §§ 312c ff. BGB, PAngV, VSBG, BFSG | E · F · A | P1 |
| Widerrufsbelehrung + Vertragsbestätigung (verbindlicher Flow) | §§ 312f, 356 Abs. 4, 357a BGB | E · F · A | P1 |
| Erklärung zur Barrierefreiheit (Buchungsportal) | BFSG, BFSGV, WCAG 2.1 AA | E · F | P1 |
| Berufshaftpflicht / IT-Haftpflicht (Angabe + Deckung) | § 2 DL-InfoV; Cap-Absicherung | F · A | P0 |

---

## 2. Platzhalter-Sammelliste (To-do des Betreibers)

Diese Liste konsolidiert **alle** in den Entwurfstexten verwendeten `[PLATZHALTER]`. Sie ist die zentrale Datenbeschaffungs-Checkliste. Ein einmal befülltes Feld ist in **allen** Dokumenten identisch einzusetzen (Konsistenz!).

**A. Firmenstammdaten**
- [ ] Vollständige Firma inkl. Rechtsformzusatz — bis Eintragung: „Detailly UG (haftungsbeschränkt) i. G."; nach Eintragung: „i. G." streichen
- [ ] Ladungsfähige Anschrift: Straße + Hausnummer, PLZ, Ort (kein Postfach)
- [ ] Geschäftsführer: Finn Bellmann (vollständiger Vor-/Nachname)
- [ ] Weitere Geschäftsführer (falls künftig mehrere → alle nennen, § 5 Abs. 1 Nr. 1 DDG, § 35a GmbHG)

**B. Register & Steuer**
- [ ] Registergericht (Amtsgericht …) — erst ab Eintragung
- [ ] HRB-Nummer — erst ab Eintragung
- [ ] USt-IdNr. (DE…) ODER W-IdNr. — sobald erteilt (NIEMALS Steuernummer als Ersatz)
- [ ] Stammkapital-Angabe: bewusst weglassen (freiwillig; wenn genannt, vollständig)

**C. Kontakt & Verantwortliche**
- [ ] Telefonnummer (dringend empfohlen als zweiter Kommunikationsweg, § 5 DDG)
- [ ] E-Mail geschäftlich: business.bellmann@posteo.de (ggf. legal@… / support@…)
- [ ] Support-/Weisungskanal (z. B. support@detailly.de)
- [ ] § 18 Abs. 2 MStV-Verantwortlicher (bei Blog/Ratgeber): Finn Bellmann + Anschrift
- [ ] DSA-Kontaktstelle Art. 11 (Behörden) + Art. 12 (Nutzer), Sprachen DE (ggf. EN)

**D. Behörden & Gerichtsstand**
- [ ] Zuständige Landesdatenschutzbehörde (Sitz-Bundesland) + Adresse
- [ ] Gerichtsstand (Sitz Detailly) — Klausel nur „sofern Kunde Kaufmann"
- [ ] BFSG-Marktüberwachungsbehörde (für Erklärung zur Barrierefreiheit)

**E. URLs / Feature-Slots**
- [ ] Domain(s) Website / App / Buchungsportal / Marktplatz
- [ ] URL Leistungsbeschreibung/Tarifübersicht
- [ ] URL Preisliste
- [ ] URL Data-Act-Wechsel-/Formate-Infoseite
- [ ] Portal-URL(s) je Tenant

**F. Fristen & Parameter (Vertragswerk)**
- [ ] Testphase-Dauer (z. B. 14 Tage)
- [ ] Abrechnungsintervall (monatlich/jährlich)
- [ ] Kündigungsfrist SaaS (max. 2 Monate — Data-Act-Grenze)
- [ ] Preisankündigungsfrist (z. B. 6 Wochen)
- [ ] AGB-Änderungsfrist (SaaS ≥ 6 Wochen; Marktplatz/P2B ≥ 15 Tage)
- [ ] Verfügbarkeitszusage (z. B. 99,0 % Monatsmittel) + Messpunkt
- [ ] Wartungsfenster (max. Stunden/Monat, Uhrzeitfenster, Vorankündigung 48 h)
- [ ] Servicezeiten + Reaktionszeit Support
- [ ] Server-Logfile-Speicherdauer (z. B. 7 Tage)
- [ ] Konto-Löschkarenz nach Vertragsende (z. B. 30 Tage)
- [ ] Haftungs-Cap-Höhe (falls gewünscht; an IT-Haftpflicht koppeln)

**G. AVV-Parameter**
- [ ] Breach-Meldefrist Detailly→Tenant (Empfehlung: 24 h, NICHT 48 h)
- [ ] Sub-Prozessor-Änderungs-Vorankündigung (z. B. 30 Tage)
- [ ] Audit-Vorankündigung (z. B. 14 Tage) + Häufigkeit (z. B. 1×/Jahr)
- [ ] Datenexport-Frist nach Vertragsende (z. B. 30 Tage) + Backup-Löschfrist (z. B. 90 Tage)
- [ ] SMTP-Provider (Anbieter + Anschrift + AVV-Status)

**H. Marktplatz / Händler / Zahlung**
- [ ] Provisionssatz (% + Bezugsgröße brutto/netto, inkl./exkl. Versand)
- [ ] Käufer-Gebührenmodell (i. d. R. „unentgeltlich für Käufer")
- [ ] Bestellannahmefrist Händler (z. B. 5 Werktage)
- [ ] Button-Beschriftung (z. B. „zahlungspflichtig bestellen/buchen")
- [ ] Zugelassene Händler-Sitzländer (DE / EU)
- [ ] Abgelehnte-Bewerber-Löschfrist (Empfehlung: 6 Monate)
- [ ] Stripe-Vertragsentität + Charge-Modell (Direct vs. Destination — s. Abschnitt 4.7/5)
- [ ] Abrechnungsmodell Provision (Rechnung vs. Gutschrift § 14 Abs. 2 S. 5 UStG)

---

## 3. Rechtsdimensionen im Detail

> Struktur je Dimension: **Pflichtangaben** · **Entwurfstext/Skelett** · **Haftungsfallen**. Dubletten über Dimensionen hinweg (DDG↔TMG, ODR-Abschaltung, P2B, DSA, ZAG, DPF, E-Rechnung) sind konsolidiert und werden nicht mehrfach ausgeführt; siehe dazu **3.9 Querschnittsthemen**.

### 3.1 Impressum / Anbieterkennzeichnung

**Rechtsrahmen 2026:** Die Impressumspflicht steht seit 14.05.2024 in **§ 5 DDG** (Digitale-Dienste-Gesetz), nicht mehr in § 5 TMG — nirgends „TMG" schreiben (auch nicht in Tenant-Vorlagen). Redaktionelle DDG-Anpassung durch Art. 5 ProdSG-ÄndG (BGBl. I 2026 Nr. 29, in Kraft 19.02.2026) — keine neuen materiellen Pflichten.

**Pflichtangaben Detailly-Website (§ 5 Abs. 1 DDG):**
1. Firma exakt mit Rechtsformzusatz „UG (haftungsbeschränkt)" (nicht zu „UG" abkürzbar, § 5a GmbHG); bis Eintragung Zusatz **„i. G."**
2. Ladungsfähige Anschrift (kein Postfach)
3. Vertretungsberechtigte: Geschäftsführer Finn Bellmann
4. E-Mail **und** zweiter schneller Kommunikationsweg — Telefon ist die abmahnsichere Wahl (Kontaktformular nur nach EuGH C-298/07 mit realistischer Antwortzeit 30–60 Min.)
5. Registergericht + HRB — **erst ab Eintragung**
6. USt-IdNr. (§ 27a UStG) **oder** W-IdNr. — „soweit vorhanden"; niemals die Steuernummer
7. Liquidations-/Auflösungsangabe — falls je einschlägig
- Aufsichtsbehörde (Nr. 3) und Kammer/Berufsrecht (Nr. 5): für SaaS nicht einschlägig.

**§ 18 MStV:** Abs. 1 („kleines Impressum") durch dasselbe Impressum erfüllt. Abs. 2 (**inhaltlich Verantwortlicher** mit Name + Anschrift) greift, sobald journalistisch-redaktionelle Inhalte (Blog/Ratgeber/News) online sind. Person muss Wohnsitz DE, voll geschäftsfähig, unbeschränkt strafrechtlich verfolgbar sein.

**§ 2 DL-InfoV (oft vergessen!):** Als Dienstleister muss Detailly zusätzlich stets verfügbar machen: u. a. **Berufshaftpflichtversicherung, soweit vorhanden** (Versicherer + Anschrift + räumlicher Geltungsbereich), verwendete AGB, Rechtswahl-/Gerichtsstandsklauseln. Für eine SaaS-UG mit (empfohlener) IT-/Vermögensschadenhaftpflicht ist die Versicherungsangabe eine abmahnfähige Pflichtangabe. Gleiches gilt für Tenants (Feld im Onboarding-Formular).

**DSA-Kontaktstellen (Art. 11/12 DSA) — gelten SCHON JETZT:** Detailly speichert von Tenants bereitgestellte Inhalte (Buchungsseiten, Marktplatz-Profile) → sehr wahrscheinlich **Hosting-Dienst (Art. 3 lit. g DSA)**. Die Kontaktstellen-Pflichten (Art. 11 Behörden, Art. 12 Nutzer) gelten für **alle** Vermittlungs-/Hosting-Dienste, B2B wie B2C, **ohne KMU-Ausnahme** (die Ausnahmen der Art. 19/29 DSA betreffen nur die Plattform-Zusatzpflichten). Umsetzung: eigener Impressum-Abschnitt „Kontaktstelle gemäß Art. 11/12 DSA" (E-Mail + Sprachenangabe, nicht rein automatisiert), dazu Art. 14 (Moderations-Angaben in AGB) und Art. 16 (Melde-/Abhilfeverfahren).

**Erreichbarkeit:** Footer-Link „Impressum" auf **jeder** Seite (auch in der eingeloggten App und auf öffentlichen Buchungsseiten), max. zwei Klicks (BGH I ZR 228/03), maschinenlesbar (kein PDF/Bild), auch auf Social-Media-Profilen. **Sanktion:** bis 50.000 € (§ 33 Abs. 2 Nr. 1 DDG) + UWG-Abmahnung.

**UG i. G.:** Vor-UG firmiert als „UG (haftungsbeschränkt) i. G." in Impressum, Rechnungen, E-Mail-Signaturen, Geschäftsbriefen. Handelndenhaftung: **§ 11 Abs. 2 GmbHG gilt unmittelbar** (über § 5a GmbHG; nicht „analog"). Sofort nach Eintragung: Registergericht + HRB ergänzen, „i. G." streichen; **§ 35a GmbHG** (Geschäftsbriefe = auch E-Mails/Angebote/Rechnungen: Firma+Rechtsform, Sitz, Registergericht, HRB, alle GF mit Familien- + ausgeschriebenem Vornamen) beachten.

**Tenant-Buchungsseiten:** Jeder Tenant ist **selbst** Diensteanbieter (§ 5 DDG) und braucht ein **eigenes** Impressum (nicht das von Detailly). Detailly ist Hosting-/Plattformanbieter — keine unmittelbare Bußgeldhaftung für fehlende Tenant-Impressen, aber Reputations-/Störerhaftungs-Restrisiko bei Kenntnis. **Produkt-Empfehlung:** strukturiertes Pflichtformular (Rechtsform-Auswahl steuert Pflichtfelder), Veröffentlichungs-Gate, automatischer Footer-Link; AGB-Klausel „Tenant allein verantwortlich".

#### Entwurfstext Impressum (Website + App-Footer)

```markdown
# Impressum

## Angaben gemäß § 5 DDG

Detailly UG (haftungsbeschränkt) i. G.
[PLATZHALTER: Straße Hausnummer]
[PLATZHALTER: PLZ Ort]
Deutschland

**Vertreten durch:**
Geschäftsführer: Finn Bellmann
<!-- Bei mehreren Geschäftsführern: ALLE namentlich nennen -->

**Kontakt:**
Telefon: [PLATZHALTER: Telefonnummer — dringend empfohlen]
E-Mail: business.bellmann@posteo.de

**Registereintrag:**
<!-- Bis zur Eintragung diesen Block WEGLASSEN; „i. G." im Firmennamen genügt. Ab Eintragung: -->
Registergericht: [PLATZHALTER: Amtsgericht …]
Registernummer: HRB [PLATZHALTER]
<!-- Gleichzeitig oben „i. G." entfernen! -->

**Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:**
<!-- Nur aufnehmen, sobald erteilt. NIEMALS die Steuernummer eintragen. -->
[PLATZHALTER: DE…]

**Berufshaftpflichtversicherung (§ 2 DL-InfoV):**
[PLATZHALTER: Versicherer, Anschrift, räumlicher Geltungsbereich]

**Kontaktstelle gemäß Art. 11/12 der Verordnung (EU) 2022/2065 (DSA):**
E-Mail: [PLATZHALTER: dsa-kontakt@…] · Sprachen: Deutsch (ggf. Englisch)

**Verantwortlich für journalistisch-redaktionelle Inhalte gemäß § 18 Abs. 2 MStV:**
<!-- Nur nötig, sobald Blog/Ratgeber/News online sind. -->
Finn Bellmann, [PLATZHALTER: Anschrift wie oben]

## Streitbeilegung
Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren
vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).
<!-- KEINEN EU-ODR-Link mehr aufnehmen — Plattform seit 20.07.2025 abgeschaltet. -->
```

**Skelett Tenant-Impressum (strukturiertes Pflichtformular):** Rechtsform-Auswahl steuert Pflichtfelder — Einzelunternehmen (Vor-/Nachname, Anschrift, Kontakt, USt-IdNr. falls vorhanden, Kleinunternehmer-Flag) · GbR/**eGbR** (alle Gesellschafter; eGbR zusätzlich Registergericht + Registernr.) · **e. K.** (Registergericht + HRA) · GmbH/UG (Firma lt. HR, GF, Anschrift, Kontakt, Registergericht, HRB, USt-IdNr.) · Handwerksrolle-Flag → Kammer + Berufsbezeichnung + verleihender Staat · Liquidationsangabe für Kapitalgesellschaften · **Berufshaftpflicht-Feld (DL-InfoV)** · optionales VSBG-Feld. Pflicht-Gate: keine Veröffentlichung ohne vollständiges Impressum; automatischer Footer-Link.

**Haftungsfallen:** „§ 5 TMG"-Reste entfernen · Telefon angeben (sonst abmahnanfällig) · nie Steuernummer statt USt-IdNr. · „i. G." nicht vergessen / nach Eintragung streichen · veralteten ODR-Link entfernen · pauschale „Haftung für Links"-Disclaimer weglassen (wertlos, ggf. § 309 Nr. 7 BGB-Risiko) · Tenant-Impressen nur als strukturiertes Formular, nie Freitext · **DSA-Einordnung** (Hosting-Dienst) klären.

---

### 3.2 Datenschutzerklärung (DSGVO)

**Wichtigste strukturelle Erkenntnis — zwei Ebenen (häufigster teurer Fehler):**

| Ebene | Detaillys Rolle | Dokument |
|---|---|---|
| Eigene Website, Registrierung, Abrechnung der Betriebe, Marktplatz-Vermittlung, KYB | **Verantwortlicher** (Art. 4 Nr. 7) | Datenschutzerklärung (dieser Entwurf) |
| Daten, die Betriebe IN der Plattform speichern (deren Endkunden, Fahrzeuge, Rechnungen, Buchungen) | **Auftragsverarbeiter** (Art. 28) | AVV — Abschnitt 3.3 |

Die DSE des öffentlichen **Buchungsportals** muss der **Betrieb** stellen (er ist Verantwortlicher). Detailly liefert dafür einen Mustertext (RDG-Disclaimer!) und weist im Portal-Footer nur auf seine Rolle als Auftragsverarbeiter hin.

**Pflichtinhalte Art. 13/14 DSGVO** (Verantwortlicher; Zwecke + Rechtsgrundlagen; berechtigtes Interesse bei lit. f; Empfänger/Kategorien: Hetzner, Stripe, Mail-Provider, Anthropic, **plus** Steuerberater/Buchhaltung, ggf. Inkasso, Behörden/Finanzamt (PStTG), ggf. Error-Tracking; Drittlandtransfer + Garantie; Speicherdauer; Betroffenenrechte; Widerruf; Beschwerderecht Art. 77; Erforderlichkeit + Folgen; **keine** automatisierte Entscheidungsfindung; Widerspruchsrecht Art. 21 hervorgehoben). **Art. 14** (Daten aus Drittquelle) prüfen, wo Ansprechpartner-/Gegenparteidaten nicht direkt beim Betroffenen erhoben werden.

**Cookies/§ 25 TDDDG:** Einwilligungspflicht für jeden nicht-notwendigen Endgerätezugriff; Ausnahme § 25 Abs. 2 Nr. 2 (Session/Auth/CSRF/Warenkorb/Consent-Speicherung, Spracheinstellung bei aktiver Nutzerwahl). **Nur technisch notwendige Cookies ⇒ kein Banner** — für Detailly der empfohlene Weg und Verkaufsargument. Bußgeld bis **300.000 €** (§ 28 TDDDG; Durchsetzung BNetzA/BfDI, nicht Landes-DSB). EinwV (seit 01.04.2025) optional.

**Newsletter/§ 7 Abs. 2 Nr. 2 UWG** (auch B2B!): vorherige ausdrückliche Einwilligung, Double-Opt-in (BGH I ZR 164/09), protokollieren. Transaktions-/Systemmails sind keine Werbung.

**Hintergrundpflichten (nicht Teil der DSE, aber zwingend):** VVT Art. 30 (Detailly als Verantwortlicher **Art. 30 Abs. 1**; als Auftragsverarbeiter **eigenes Verzeichnis Art. 30 Abs. 2**); AVV mit allen Prozessoren; **Datenpannen-Runbook Art. 33/34** (72 h an Aufsicht; als Auftragsverarbeiter unverzüglich an Betrieb, Art. 33 Abs. 2); **Schwellwertanalyse/ggf. DSFA Art. 35** (Multi-Tenant + KYB-Ausweisdokumente + KI); TOM-Dokumentation Art. 32.

#### Entwurfstext / Skelett (Auszug der tragenden Abschnitte)

```markdown
# Datenschutzerklärung   ·   Stand: [PLATZHALTER: Datum]

## 1. Verantwortlicher
Detailly UG (haftungsbeschränkt) [PLATZHALTER: „i. G." bis Eintragung]
[PLATZHALTER: Anschrift] · Geschäftsführer: Finn Bellmann
E-Mail: business.bellmann@posteo.de · [PLATZHALTER: Telefon]
Ein Datenschutzbeauftragter ist nicht benannt, da die Voraussetzungen (§ 38 BDSG)
nicht vorliegen. [ANWALT/DSB PRÜFEN: jährlich neu bewerten]

## 2. Unsere Rolle: Zwei Verarbeitungsebenen
(1) Für Website-Besuch, Registrierung und Nutzung sind wir Verantwortlicher.
(2) Für Daten, die Nutzerbetriebe über ihre eigenen Kunden in der Plattform
speichern, ist der jeweilige Betrieb Verantwortlicher; wir verarbeiten diese
Daten ausschließlich als Auftragsverarbeiter nach Art. 28 DSGVO. Betroffenen-
anfragen hierzu richten Sie bitte an den jeweiligen Betrieb.

## 3. Hosting/Logfiles — Hetzner Online GmbH (Rechenzentren in Deutschland),
AVV nach Art. 28. Logfiles (IP, Zeit, URL, Referrer, Browser/OS); Art. 6 Abs. 1
lit. f; Speicherdauer [PLATZHALTER: z. B. 7 Tage].

## 4. Cookies (§ 25 TDDDG): ausschließlich technisch notwendige Speicherung
(Login-Session, Sicherheits-Token, Spracheinstellung). Kein Tracking, kein Banner.
[ANWALT + TECHNISCH VERIFIZIEREN: gilt nur solange kein Analytics eingebaut wird]

## 5. Registrierung/Nutzerkonto · 5a. Kontaktaufnahme (Support/Demo-Formular:
Art. 6 Abs. 1 lit. b/f, Löschung nach Erledigung)
## 6. Zahlungsabwicklung Stripe (Stripe Technology Europe Ltd., Dublin; Übermittlung
an Stripe Inc. USA). Kartendaten liegen uns nie vor. Stripe teils eigener
Verantwortlicher (Betrugsprävention/Regulatorik). Drittland: primär EU-US Data
Privacy Framework (Angemessenheitsbeschluss 10.07.2023), ergänzend SCC (Art. 46).
## 7. E-Mail-Versand · 8. Newsletter (Double-Opt-in, § 7 UWG) · 9. Marktplatz-KYB
(Gewerbeanmeldung, USt-IdNr.; Art. 6 Abs. 1 lit. b/c/f; PStTG) · 10. KI-Funktionen
(Anthropic; AVV+SCC, DPF; keine Trainingsnutzung von API-Daten) · 11. Datensicherheit
(Art. 32) · 12. Speicherdauer (Buchungsbelege/Rechnungen 8 Jahre, § 147 Abs. 3 AO
i. d. F. BEG IV seit 01.01.2025; Bücher/Handelsbriefe 6/10 Jahre) · 13. Rechte
· 14. Beschwerderecht [PLATZHALTER: zuständige Landes-DSB] · 15. Keine automatisierte
Entscheidungsfindung · 16. Änderungen.
```

Zusätzlich separat zu liefern: AVV + Subprozessorenliste, DSE-Mustertext für Buchungsportale (RDG-Disclaimer), internes VVT, Datenpannen-Runbook.

**Haftungsfallen:** **DPF-Wording:** nie DPF als alleinige Garantie, immer „DPF **und** ergänzend SCC"; Bestandsbewertung (Trump v. Slaughter 29.06.2026 kippte Humphrey's Executor; DPF-Folge **umstritten**, IAPP: DPF gilt weiter) nur intern, nicht in der veröffentlichten DSE; Formulierung „Bestand wird von der EU-Kommission überprüft", nicht „auf der Kippe"; TIA für Stripe/Anthropic. · Rollenvermischung Controller/Processor vermeiden (Abschnitt 2 tragend). · „Nur technisch notwendige Cookies" nur haltbar ohne Analytics/Tracking/Font-CDN/Map-Embed. · § 7 UWG auch B2B; keine vorangekreuzte Newsletter-Checkbox, kein Kopplung an Registrierung (Art. 7 Abs. 4 DSGVO, § 305c BGB). · KYB-Uploads: Schwärzungsoption, Zugriffsbeschränkung, Löschkonzept. · **Die DSE sichert Detailly NICHT ab** — Haftungsbegrenzung gehört in AGB + AVV, nicht in die DSE (dort § 305c BGB-unwirksam). · **RDG-Risiko** der Muster-DSE für Betriebe: nur generisch + Disclaimer. · 8-Jahres-Frist statt „10 Jahre" (BEG IV).

---

### 3.3 Auftragsverarbeitung (AVV, Art. 28 DSGVO)

**Rolle:** Für das SaaS-Kernprodukt ist Detailly **Auftragsverarbeiter**, der Tenant **Verantwortlicher**. **Abgrenzung:** Für Tenant-Stammdaten, Abrechnung, Marktplatz-Vermittlung, KYB ist Detailly **eigenständiger Verantwortlicher** (→ DSE, nicht AVV). Diese Trennung muss im AVV ausdrücklich stehen.

**Pflichtinhalte Art. 28 Abs. 3 lit. a–h** (Gegenstand/Dauer; Art/Zweck; Datenkategorien; betroffene Personen; Weisungsrecht; Vertraulichkeit; TOMs; Sub-AV-Regeln; Unterstützung Betroffenenrechte; Unterstützung Art. 32–36; Löschung/Rückgabe; Nachweise/Audits). **Hinweispflicht bei rechtswidriger Weisung** steht in Art. 28 Abs. 3 **Satz 2**, nicht in lit. h. **Form:** elektronisch genügt (Art. 28 Abs. 9) → Klick/Checkbox beim Onboarding zulässig.

**Bereitstellung:** Detailly stellt den AVV als vorformulierte Anlage bereit und schließt ihn automatisch mit Vertragsbeginn; PDF im Dashboard zum Download (Tenants brauchen ihn für ihr **Art. 30 Abs. 1**-Verzeichnis). AVV als **eigenständige Anlage** mit Vorrangklausel für Datenschutzfragen — nicht in die AGB einweben. Bußgeldrahmen bei AVV-Defiziten: bis 10 Mio. € / 2 % (Art. 83 Abs. 4).

**Sub-Prozessoren (Anlage 2):** Hetzner (DE; Detailly muss den Hetzner-AVV aktiv im Kundenkonto abschließen — nicht automatisch, **vor** Prod-Golive) · Stripe (**Doppelrolle:** Kernzahlungsabwicklung = eigenständig verantwortlich, nur Teilfunktionen Prozessor) · Anthropic (DPA in Commercial Terms; nur aufnehmen, wenn personenbezogene Tenant-Daten an die API gehen — sonst pseudonymisieren) · SMTP-Provider [PLATZHALTER]. **Genehmigungsmodell:** allgemeine schriftliche Genehmigung mit Änderungs-Info + Widerspruchsrecht (Art. 28 Abs. 2).

#### Skelett Detailly-AVV (Kernparagraphen)

```markdown
# Auftragsverarbeitung gemäß Art. 28 DSGVO — Anlage [X] zum Nutzungsvertrag
zwischen Kunde (Verantwortlicher) und Detailly UG (haftungsbeschränkt) [PLATZHALTER]
(Auftragsverarbeiter).

§1 Gegenstand/Dauer/Rangfolge — Laufzeit = Nutzungsvertrag; AVV geht bei Widerspruch
in Datenschutzfragen vor; NICHT Gegenstand: Verarbeitungen, für die der Auftragnehmer
eigenständig Verantwortlicher ist (Abrechnung, Marktplatz, KYB).
§2 Art/Zweck/Datenkategorien/Betroffene (→ Anlage 1). Keine Art.-9-Daten
bestimmungsgemäß; der Verantwortliche verpflichtet sich, solche nicht einzustellen.
[ANWALT PRÜFEN: Freitext/Fotos können faktisch Art.-9-Daten enthalten]
§2a GARANTIE-/FREISTELLUNGSKLAUSEL (Schutz Detailly): Der Verantwortliche garantiert
die Rechtmäßigkeit (gültige Rechtsgrundlage Art. 6, Informationspflichten Art. 13/14,
ggf. Einwilligungen) aller eingestellten Daten und Weisungen und stellt Detailly von
Ansprüchen Dritter/Betroffener und Bußgeldern frei, die aus rechtswidrigen Weisungen
oder unrechtmäßig eingestellten Daten resultieren. [ANWALT PRÜFEN: § 307 BGB-feste
Reichweite; Art. 82 Außenhaftung bleibt unberührt]
§3 Weisungsrecht — Plattformnutzung gilt als Weisung; Individualweisung an [PLATZHALTER:
support@detailly.de]. §3a Behördliche Auskunftsersuchen: Detailly informiert den
Auftraggeber unverzüglich vorab, soweit rechtlich zulässig.
§4 Vertraulichkeit · §5 TOMs (→ Anlage 3; NUR tatsächlich umgesetzte Maßnahmen —
keine „2FA sobald verfügbar"-Zusagen in verbindlichem Katalog).
§6 Unterauftragsverarbeiter (→ Anlage 2; allgemeine Genehmigung; Änderungs-Info ≥
[30] Tage + Widerspruch + Kündigungsoption; gleiche Pflichten weitergeben, Art. 28 Abs. 4).
§7 Drittland — primär DPF, hilfsweise SCC + TIA; je Dienst korrekt zuordnen (Adequacy
vs. SCC), nicht pauschal „SCC".
§8 Unterstützung — Betroffenenrechte via Export-/Lösch-Funktionen; Breach-Meldung an
Auftraggeber unverzüglich, spätestens [24 Stunden] nach Kenntnis (NICHT 48 h) mit
Art.-33-Abs.-3-Angaben; Meldung an Aufsicht obliegt Auftraggeber.
§9 Nachweise/Audits — vorrangig Testate; Vor-Ort-Audits nach [14 Tagen] Ankündigung,
max. [1×/Jahr] außer bei Anlass. [ANWALT PRÜFEN: Audit-Kosten]
§10 Löschung/Rückgabe — Export [30] Tage, Löschung inkl. Backups nach [90] Tagen;
gesetzliche Aufbewahrung liegt beim VERANTWORTLICHEN (§ 257 HGB/§ 147 AO), Detailly
löscht/sperrt nach dessen Weisung.
§11 Haftung — Art. 82 DSGVO + Nutzungsvertrag; Innenausgleich/Freistellung regeln,
Außenhaftung nicht abdingbar. [ANWALT PRÜFEN: Abstimmung mit AGB-Cap]
Anlage 1 (Gegenstand) · Anlage 2 (Sub-AV: Hetzner/Stripe[Rollenhinweis]/Anthropic/SMTP)
· Anlage 3 (TOMs: Vertraulichkeit/Integrität/Verfügbarkeit/Überprüfung).
```

**Empfehlung:** AVV auf **EU-Standardvertragsklauseln nach Art. 28 Abs. 7 (Durchführungsbeschluss (EU) 2021/915)** aufbauen → Vermutung der Angemessenheit, reduziertes §§-305-ff.-Risiko. Eigenklauseln (Audit-Kosten, Freistellung, Fristen) kollisionsfrei einbetten.

**Haftungsfallen:** Sub-AV-Klausel ohne echtes Widerspruchs-/Kündigungsrecht (Art. 28 Abs. 2 zwingend) · Audit-Totalausschluss unzulässig · Vergütung nur für exzessive Unterstützung · keine pauschale Haftungsfreizeichnung · Eigennutzungs-/Anonymisierungsklausel = **Art. 28 Abs. 10-Risiko** (Detailly würde selbst Verantwortlicher) · Stripe korrekt als Doppelrolle einordnen · Anthropic-Prompts pseudonymisieren · **Sub-AV-Kette tatsächlich schließen** (Hetzner-AVV aktiv, Anthropic/Stripe-DPA archivieren) · Backup-Löschfristen ehrlich angeben. **Zitatkorrektur:** Tenant-Verzeichnis ist Art. 30 **Abs. 1**, Detaillys eigenes Art. 30 **Abs. 2**. **Cross-Ref:** EU-KI-VO Art. 50 (ab 02.08.2026) betrifft KI-Kennzeichnung — gehört in Produktdoku/DSE, nicht in den AVV.

---

### 3.4 SaaS-Nutzungsbedingungen (B2B)

**Rechtsnatur:** SaaS = **Mietvertrag** (BGH XII ZR 120/04), §§ 535 ff. BGB. Gefährlich: § 536a Abs. 1 (verschuldensunabhängige Garantiehaftung für anfängliche Mängel), § 536a Abs. 2 (Selbstvornahme) — in AGB soweit zulässig modifizieren.

**AGB-Recht auch B2B:** §§ 308/309 gelten nicht unmittelbar (§ 310 Abs. 1), wirken aber über § 307 mit **Indizwirkung**. Verbot geltungserhaltender Reduktion → moderat + wirksam statt aggressiv + nichtig. AGB-Reform-B2B (Koalitionsvertrag 05/2025) ist **noch nicht Gesetz** — strenge BGH-Linie gilt.

**EU Data Act (VO 2023/2854), seit 12.09.2025 anwendbar, KEINE KMU-Ausnahme in Kap. VI:** Detailly = Datenverarbeitungsdienst. Zwingend nach Art. 25 Abs. 2 (vorvertraglich): Wechselrecht (max. Kündigungsfrist **2 Monate**), Übergangszeitraum **max. 30 Tage**, **≥ 30 Tage Retention** zum Export, vollständige Löschung danach, erschöpfende Liste exportierbarer Datenkategorien + Formate. **Wechselentgelte:** reduziert (kostendeckend) im Fenster **11.01.2024–12.01.2027** (Art. 29 Abs. 2; **Datum 11.01.2024**, nicht 12.01.2024) + vorvertragliche Info (Art. 29 Abs. 3); ab **12.01.2027 vollständig verboten** → Wechsel/Standard-Export kostenlos stellen. Wechselbehindernde Klauseln nichtig.

**Zweite, parallele Klauselkontrolle — Data Act Art. 13:** Seit 12.09.2025 unterliegen Klauseln „über Datenzugang/-nutzung oder Haftung/Rechtsbehelfe bei datenbezogenen Pflichten" **zusätzlich** der Missbrauchskontrolle des Art. 13 (Schwarze/Graue Liste, Beweislast beim Verwender). Trifft §§ zu Wechsel/Export/Löschung, Rechte an Kundendaten, Haftung für Datenverlust/Portabilität — kann unwirksam sein, **auch** wenn die BGH-AGB-Linie eingehalten ist.

**Weiteres:** § 312i BGB (E-Commerce, auch B2B: Fehlerkorrektur, Zugangsbestätigung, Abrufbarkeit; teils abdingbar); Kündigungsbutton § 312k nur B2C (hier nicht Pflicht, aber für Buchungsportale relevant); Preisklauselgesetz + § 307 für Preisanpassung; § 38 ZPO (Gerichtsstand nur ggü. Kaufleuten!); § 288 Abs. 2/5 BGB (Verzug B2B 9 %-Punkte, 40 € Pauschale). **AI Act (VO 2024/1689):** ab 02.08.2026 Transparenzpflichten Art. 50 für die KI-Funktion (§ 2 Abs. 4).

#### Skelett SaaS-AGB (Kernparagraphen, ausformuliert)

```markdown
AGB für die Nutzung der Detailly-Software (B2B) — Detailly UG (haftungsbeschränkt)
[PLATZHALTER: i.G./Anschrift/HRB], vertreten durch Finn Bellmann.

§1 Geltungsbereich; ausschließlich Unternehmer (§14 BGB) — Verbraucher ausgeschlossen;
Abwehrklausel gegen Kunden-AGB.
§2 Vertragsgegenstand — SaaS (Kunden/Fahrzeuge/Aufträge/Rechnungen inkl. XRechnung/
Termine/Buchungsportal); Übergabepunkt = Routerausgang Rechenzentrum; Server in DE
[PLATZHALTER: /EU]; (4) KI-Funktionen erzeugen nur Vorschläge, Prüfpflicht des Kunden;
(5) inhaltliche/steuerliche Rechnungsrichtigkeit trägt der Kunde.
§3 Vertragsschluss; Testphase [PLATZHALTER: 14 Tage], endet automatisch; in der Testphase
Haftung nur Vorsatz/grobe Fahrlässigkeit + unbeschränkt nach §10 Abs.1. [ANWALT PRÜFEN]
§4 Tarife/Entgelte/Zahlung (Stripe); Sperrung erst nach Mahnung + Ankündigung; (4)
Aufrechnung nur unbestritten/rechtskräftig; (5) Preisanpassung NUR zur nächsten
Verlängerungsperiode, ≥[6] Wochen Vorlauf + Kündigungsrecht (keine laufzeitinterne
Erhöhung, keine Zustimmungsfiktion). [ANWALT PRÜFEN]
§5 Laufzeit/Kündigung — Frist [max. 2 Monate — Data Act]; §9-Rechte unberührt.
§6 Verfügbarkeit [PLATZHALTER: 99,0% Monatsmittel am Übergabepunkt] + begrenzte,
angekündigte Wartungsfenster; KEIN „keine Gewähr", keine Service-Credits als
ausschließlicher Rechtsbehelf. SLA-Verletzung ausdrücklich ins Minderungs-Rückforderungs-
regime (§11 Abs.3) einbinden, Schadensersatz nur über §10.
§7 Pflichten des Kunden; (3) Rechtskonformität ggü. Endkunden; (5) verschuldensabhängige
Freistellung.
§8 Nutzungsrechte — einfach, nicht übertragbar; §§69d/69e UrhG unberührt.
§9 Anbieterwechsel/Datenexport/Löschung (Art. 23 ff. Data Act) — Pflichtbaustein:
Ankündigungsfrist ≤2 Monate; Übergang ≤30 Tage (verlängerbar bis [7 Monate] bei
technischer Unmöglichkeit); Export ≥30 Tage nach Übergang, unentgeltlich; Löschung danach;
Infoseite [PLATZHALTER: URL].
§10 Haftung — unbeschränkt bei Vorsatz/grober Fahrlässigkeit, Körperschäden, ProdHaftG,
Arglist, Garantie; bei einfacher Fahrlässigkeit wesentlicher Vertragspflichten begrenzt
auf vertragstypisch vorhersehbaren Schaden [OPTION Cap: ANWALT PRÜFEN, an IT-Haftpflicht
koppeln]; §536a Abs.1 Alt.1 (anfängliche Mängel) ausgeschlossen. Datenverlust NICHT auf
Kunden-Backup abwälzen — verbindliche Backup-Zusage (RPO/RTO) in die Leistungsbeschreibung/
als Nebenpflicht.
§11 Mängelrechte (Mietrecht); §536a Abs.2 ausgeschlossen; Minderung nur als Rückforderung.
§12 Vertraulichkeit/Datenschutz (AVV vorrangig)/Referenz nur mit Zustimmung.
§13 Änderungen — eng, nur Nebenabreden, ≥[6] Wochen, Widerspruch + Kündigung, Hinweis-
pflicht; Zustimmungsfiktion restriktiv (Begründung: Indizwertung, KEINE direkte B2B-Rspr.
— BGH XI ZR 26/20 ist eine B2C-Entscheidung).
§14 Schluss — deutsches Recht, CISG ausgeschlossen; Gerichtsstand [PLATZHALTER] nur
„sofern Kaufmann"; Textform; Erhaltungsklausel OHNE Ersetzungsautomatik.
§14(x) RANGFOLGE-/VORRANGKLAUSEL: Individualabrede → AGB → AVV (Datenschutz vorrangig)
→ Leistungsbeschreibung → Preisliste.
§15 HÖHERE GEWALT — befristete Leistungssuspendierung, Kündigungsrecht bei Dauer.
Anlagen: Leistungsbeschreibung/Tarife · Preisliste · AVV + Subprozessoren · Data-Act-Anlage
exportierbare Datenkategorien/Formate · ggf. SLA-Detailblatt.
```

**Haftungsfallen:** „Kardinalpflicht" ohne Definition = intransparent (OLG Celle) · Cap nur haltbar, wenn er den vertragstypischen Schaden abdeckt (bei Voll-Auftragsverwaltung kann Datenverlust/Betriebsstillstand das Jahresentgelt weit übersteigen) · Datenverlust ist Anbieterpflicht · Verfügbarkeit konkret + Messpunkt · § 536a Abs. 2 abbedingbar, Minderung nur als Rückforderung · Preisanpassung nur zur Verlängerung · Änderungsvorbehalt eng · **Data Act nicht ignorieren** (Art. 13 + Kap. VI) · **P2B-VO für Buchungskomponente** (s. 3.5/3.6) · Gerichtsstand nur ggü. Kaufleuten · keine Verjährungsverkürzung ohne Ausnahmenkatalog · **B2B-only technisch durchsetzen** (Checkbox „Ich handle als Unternehmer" + Pflichtfeld Firma/Gewerbe — sonst kollabiert die B2B-Statik) · keine salvatorische Ersetzungsklausel · Battle-of-forms abwehren.

---

### 3.5 Marktplatz-AGB (Käuferseite / kaufende Betriebe)

**Einordnung:** Detailly = **reiner Vermittler**; Kaufvertrag ausschließlich Händler↔Betrieb. Käufer = Unternehmer (§ 14 BGB) → **kein** Verbraucher-Widerruf/Button-Pflicht (§ 312 Abs. 1 BGB); **aber** § 312i BGB (auch B2B, teils abdingbar) und Impressum § 5 DDG.

**EU-Plattformrecht:** **P2B-VO 2019/1150 nicht anwendbar** (reine B2B-Vermittlung, ErwG 11). **DSA** gilt auch B2B: Art. 11 (Behörden-Kontaktstelle), Art. 12 (Nutzer-Kontaktstelle, **zwei getrennte Pflichten**, nicht rein automatisiert), Art. 14 (Moderations-Angaben in AGB), Art. 16/17 (Melde-/Abhilfeverfahren + Begründung). Kleinst-/Kleinunternehmen von Kap.-III-Abschnitt-3-Zusatzpflichten befreit; Art. 30–32 (Trader-Traceability) nur B2C → KYB freiwillig, nicht als „Garantie" formulieren.

**Zahlung/ZAG:** Marktplatzbetreiber darf keine Käufergelder vereinnahmen (Finanztransfergeschäft, § 1 Abs. 1 S. 2 Nr. 6 ZAG). Lösung Stripe Connect: Zahlung an Händler, Detailly nur `application_fee`. AGB-Pflicht: Stripe ist Zahlungsdienstleister, Detailly nie Empfänger/Verwahrer, schuldbefreiende Zahlung an Händler-PSP.

**FEHLENDE Betreiberpflichten (nicht per AGB abwälzbar!):**
- **GPSR (VO 2023/988), seit 13.12.2024** — Art. 20–22: Kontaktstelle für Marktüberwachung UND Verbraucher zu Produktsicherheit, Safety-Gate-Registrierung, Notice-and-Action, KYB der Händler. **Nicht auf B2C beschränkt** („Verbraucherprodukte" = auch für Verbraucher wahrscheinlich nutzbar) — Autopflege-Chemie ist marktüblich auch Verbraucherprodukt. GPSR verdrängt ProdSG in weiten Teilen.
- **VerpackG § 7 Abs. 7 (seit 01.07.2022) + ElektroG § 6 Abs. 2 S. 2 (seit 01.07.2023) + BattDG:** Marktplatz-**Prüf-/Angebotsverbotspflicht** — Verkauf nur bei LUCID-/stiftung-ear-/Batterie-Registrierung des Händlers. Bußgeld bis 100.000 € (Bußgeldnorm VerpackG: **§ 36**; ElektroG bis 100.000 €). Gehört in KYB-Onboarding + Delisting-Recht.

#### Skelett Marktplatzbedingungen Käufer (Kernparagraphen)

```markdown
§1 Geltungsbereich/Begriffe — Detailly UG (haftungsbeschränkt) i.G. [PLATZHALTER],
nur Unternehmer (§14 BGB); Abwehrklausel.
§2 Rolle: reine Vermittlung — Kaufverträge ausschließlich Händler↔Käufer; Detailly nie
Vertragspartei/Kommissionär; Händler verantwortlich für Angebote, Produktsicherheit, SDB.
§3 Registrierung; Unternehmereigenschaft (Nachweis Gewerbe/USt-IdNr.); verschuldens-
abhängige Freistellung bei Falschangabe. [ANWALT PRÜFEN]
§4 Händlerzulassung; KEINE Beschaffenheitsgarantie (Prüfung ≠ Garantie). [ANWALT PRÜFEN:
Konsistenz mit „verifizierte Händler"-Werbung]
§5 Bestellprozess/Vertragsschluss — invitatio; Button [PLATZHALTER]; Zugangsbestätigung
≠ Annahme; Vertrag mit Händler-Annahme binnen [5 Werktagen]; kein Widerrufsrecht (B2B).
§6 Preise/Zahlung über Stripe [PLATZHALTER: Entität]; Detailly nimmt keine Gelder entgegen,
schuldbefreiende Zahlung; Provision zahlt der Händler; Käufer-Nutzung [PLATZHALTER:
unentgeltlich]; Rechnung/E-Rechnung durch Händler.
§7 Lieferung/Gewährleistung/Produktverantwortung = Händler; §377 HGB-Hinweis; SDB nach
Art. 31 REACH stellt der Händler; GPSR-Kontaktstelle/Meldeweg.
§8 Pflichten des Käufers; Inhaltsmoderation (Art. 14 DSA); Kontaktstellen Art. 11 (Behörden)
UND Art. 12 (Nutzer) getrennt benennen, Sprache DE.
§9 Verfügbarkeit; Haftung (unbeschränkt Vorsatz/grobe Fahrl./Körper/ProdHaftG; einfache
Fahrl. nur wesentliche Vertragspflichten, Kardinalpflicht definiert); nicht für Händler-
Pflichtverletzungen.
§10 Laufzeit/Sperrung/Kündigung [PLATZHALTER: Kopplung an SaaS-Abo klären].
§11 Änderungen [PLATZHALTER: ≥6 Wochen] — keine uneingeschränkte Zustimmungsfiktion.
§12 Schluss — deutsches Recht, CISG-Ausschluss; Gerichtsstand [PLATZHALTER] „soweit
zulässig"; keine ODR-Plattform-Verweisung.
```

**Haftungsfallen:** **Rechtsschein als Eigenhändler** (Kernrisiko) — Vermittlerrolle im gesamten UI durchgängig ausweisen („Verkauf und Versand durch [Händler]"), sonst Vertragspartner-Zurechnung trotz Klausel · „verifizierte Händler"-Werbung vs. Freizeichnung konsistent (§ 5 UWG) · Haftungsklausel B2B über § 307 (§§ 308/309 Indiz) · nur fremde, nicht eigene Pflichtverletzungen ausschließen (DSA Art. 6 Privileg nur bei Unkenntnis + zügigem Handeln) · Freistellung verschuldensabhängig · keine Umgehungs-/Provisionsklausel gegen Käufer (kartell-/AGB-riskant) · B2B-Gate technisch dicht · Stripe-Charge-Modell dokumentieren (ZAG) · **GPSR/VerpackG/ElektroG/BattDG als Betreiberpflicht** · DSA Art. 11/12 trennen · E-Rechnung-Fristen präzise (s. 3.9).

---

### 3.6 Händler-/Verkäufervertrag + P2B-VO

**Kernbefund:** P2B-VO 2019/1150 in der aktuellen reinen B2B-Konstruktion **nicht anwendbar** (kein P2B2C). **Trotzdem P2B-konform bauen** (Zukunftssicherung + § 307-Schutz + Marktstandard). Bei Anwendbarkeit wäre Detailly als Kleinunternehmen von internem Beschwerdemanagement (Art. 11 Abs. 5) und Mediatoren (Art. 12 Abs. 7) befreit; AGB-Transparenz (Art. 3–5, 8) gilt größenunabhängig.

**Zwingende Pflichten kommen aus anderen Gesetzen** — siehe Zahlungs-/Steuer-Dimension 3.7 (PStTG/DAC7, §§ 22f/25e UStG, § 7 Abs. 7 VerpackG, § 6 Abs. 2 ElektroG, BattDG, REACH Art. 31, ZAG).

**Händler-Pflichten, die der Vertrag absichert:** SDB (Art. 31 REACH, deutsch, aktuell, Anhang II i. d. F. VO 2020/878, aktive Übermittlung + rückwirkende Nachlieferung an Abnehmer der letzten 12 Monate) · CLP-Kennzeichnung · PAngV (nur ggü. Verbrauchern — **„offener Katalog"-Falle**: öffentlich sichtbare Preise können Verbraucheransprache sein → Login-Gate oder PAngV-konform) · eigenes Impressum § 5 DDG · Gewerbeanmeldung/USt-IdNr. · LUCID/ear/Batterie-Registrierung · Gefahrgutversand (ADR) · GPSR (VO 2023/988, nicht nur „Vorsorge").

#### Skelett Händler-Rahmenvertrag (Kernparagraphen)

```markdown
§1 Vertragsgegenstand; Detailly = reiner Vermittler (Kaufvertrag Händler↔Betrieb).
§2 Zulassung/KYB/Mitwirkung — Onboarding: Gewerbe/HR, USt-IdNr., Steuer-ID, HR-Nummer,
LUCID-Nr., WEEE-Nr. (ElektroG), ggf. Batterie-Reg., Anschrift, Vertretung; Aktualisierung
≤14 Tage; qualifizierte USt-IdNr.-Prüfung (§18e); Stripe-Connect-Onboarding Voraussetzung.
§3 Angebots-/Produktpflichten — wahrheitsgemäße Angaben (§§3,5 UWG); PAngV falls
verbrauchersichtbar; SDB-Upload VOR Freischaltung + Übermittlung; CLP; LUCID-Nachweis
(Detailly muss nach §7 Abs.7 VerpackG sperren); Gefahrgut; eigenes Impressum §5 DDG.
§4 Vertragsschluss/Abwicklung — Bearbeitung [PLATZHALTER: X Werktage]; §377 HGB;
Rechnung/E-Rechnung durch Händler.
§5 Zahlung über Stripe; Detailly nimmt keine Gelder entgegen; Chargebacks/Refunds trägt
Händler. [ANWALT PRÜFEN: Erfüllungswirkung + Charge-Typ]
§6 Provision [PLATZHALTER: %] zzgl. USt via application_fee; monatliche Abrechnung mit
USt-Ausweis; Storno-Erstattung [PLATZHALTER: Ausnahmen bei Händlerverschulden]. [STB PRÜFEN:
Rechnung vs. Gutschrift §14 Abs.2 S.5 UStG]
§7 Ranking (P2B-Vorsorge) — Hauptparameter offenlegen; Provision beeinflusst Ranking nicht
[falls doch: offenlegen, Art.5]; Selbstbevorzugung transparent (Art.7).
§8 Aussetzung/Sperrung (P2B-konform) — Gründe-Katalog inkl. fehlendes SDB/LUCID/WEEE,
KYB-/Stripe-Fehler, §23-PStTG-Fall, Betrug; Begründung spätestens mit Wirksamwerden;
Beendigung mit 30-Tage-Frist (außer gesetzliche Sofortsperre).
§9 Laufzeit/Kündigung — [30 Tage], außerordentlich §314 BGB; Datenexport nach Ende [90 Tage].
§10 Steuer (DAC7/PStTG/§22f) — Erhebung/Verifikation/Meldung; §23-Sperre nach 60/180 Tagen;
§22-Information.
§11 Freistellung — verschuldensabhängig (§§3,10 + §25e UStG soweit zu vertreten). [ANWALT PRÜFEN]
§12 Haftung Detailly (Kardinalpflicht definiert); Verfügbarkeit [PLATZHALTER] mit klarer
Rechtsfolge + Ausnahmen (Wartung/höhere Gewalt/Drittausfall Stripe/Hosting).
§13 Änderungen ≥15 Tage (P2B); Provisionsänderung NUR aktive Zustimmung ODER nur für
Neubestellungen + Sonderkündigung (keine bloße Fiktion). [ANWALT PRÜFEN]
§14 Datenschutz — getrennt Verantwortliche; Zweckbindung. [ANWALT PRÜFEN: Art.26]
§14a Rechte an Produktdaten/Bildern — einfaches Nutzungsrecht + Rechtekette-Garantie
+ Freistellung.
§15 Schluss — deutsches Recht/CISG-Ausschluss; Gerichtsstand nur ggü. Kaufleuten (§38 ZPO);
Textform; salvatorisch.
Anlagen: Provisionsordnung · Produkt-/Listungsrichtlinie · DAC7-Infoblatt · Stripe-Verweis.
```

**Haftungsfallen:** Sperrklauseln nur mit Gründen/Frist · Provisions-/AGB-Änderung nicht per Fiktion (Äquivalenzverschiebung) · Freistellungen/Vertragsstrafen verschuldensabhängig + gedeckelt · nie Kardinalpflichten/Vorsatz/Körper/ProdHaftG ausschließen · Bestpreis-/Paritätsklauseln kartellrechtlich riskant (Vertikal-GVO 2022/720) · **ZAG-Falle** (Charge-Typ, s. u.) · § 25e UStG-Prüfprozess · VerpackG/ElektroG-**aktive** Prüfpflicht (Registerabgleich, nicht nur Zusicherung) · PAngV-Login-Gate-Entscheidung · Vermittlerstellung konsistent (Rechtsschein) · **Bußgeld-Präzisierung:** § 25 PStTG gestaffelt (bis 50.000/30.000/5.000 €), VerpackG-Bußgeld in § 36 · **§ 38 ZPO/§ 377 HGB setzen Kaufmann voraus** (Kleingewerbe = Unternehmer, aber kein Kaufmann → Gerichtsstandklausel ggf. unwirksam).

---

### 3.7 Zahlungsabwicklung (Stripe Connect) + KYB + Steuer-Meldepflichten

**ZAG — keine BaFin-Erlaubnis, wenn Struktur stimmt.** Ausgangsrisiko: Finanztransfergeschäft (§ 1 Abs. 1 S. 2 Nr. 6 ZAG); unerlaubter Betrieb strafbar (§ 63 ZAG, bis 5 Jahre + Einziehung §§ 73 ff. StGB). **Verteidigungslinie 1 (Fundament):** Detailly nimmt nie Gelder an. Anforderungen: **Direct Charges** auf den Connected Account des Händlers (Händler = Merchant of Record); jeder Händler schließt das **Stripe Connected Account Agreement** direkt mit Stripe; kein Treuhand-/Sammelkonto bei Detailly; Kaufvertrag direkt Händler↔Betrieb; AGB dokumentieren das. **Wichtig (Widerspruch auflösen):** Bei **Destination Charges** berührt der Betrag kurz die Detailly-Balance — für die ZAG-Argumentation sind **Direct Charges** die sauberere Konfiguration (Klauseltext „Detailly nimmt nie Gelder entgegen" muss zur tatsächlichen Charge-Art passen). **Verteidigungslinie 2 (nur Rückfall):** Handelsvertreterausnahme § 2 Abs. 1 Nr. 2 ZAG — eng, unter PSD3/PSR (Einigung 23.04.2026, OJ ~Q2/2026, Anwendung ~2028) weiter eingeschränkt → nicht darauf bauen.

**KYB:** Keine eigene GwG-KYB-Pflicht Detaillys, aber Rechtsgründe: § 22f UStG (Name/Anschrift/USt-IdNr.), § 17 PStTG (Firma/Anschrift/Steuer-ID/USt-IdNr./HR-Nr./Betriebsstätte/IBAN), DSGVO. Upload-Prozess: Zweckbindung, Datenminimierung (Schwärzung), Speicherfristen (§ 22f Abs. 4 UStG **10 Jahre** — lex specialis; § 24 PStTG; § 147 AO 8 Jahre Belege seit BEG IV), Verschlüsselung, Zugriffsbeschränkung, Audit-Log; abgelehnte Bewerber löschen [6 Monate]. **DSA Art. 30** nur B2C → derzeit nicht Pflicht; B2B-Gate festschreiben.

**§ 25e UStG (Marktplatzhaftung für Händler-USt):** Befreiung bei gültiger, vom BZSt nach § 27a erteilter **USt-IdNr.** des Händlers zum Lieferzeitpunkt (Papierbescheinigung entfällt seit 01.07.2021). Rückausnahme bei Kennenmüssen/Finanzamts-Mitteilung (§ 25e Abs. 4). Prozess: § 18e-Bestätigung **ereignisgetrieben** (spätestens bei Bestellannahme, nicht nur quartalsweise) + Speicherung je Transaktion; Sperr-Workflow. Aufzeichnung § 22f (10 Jahre). § 3 Abs. 3a UStG (Lieferkettenfiktion Drittland) durch Zulassung nur DE/EU-Händler + kein Verkauf an Nichtunternehmer vermeiden. **Kleinunternehmer** (§ 19; seit 01.01.2025 25.000/100.000 €) ohne USt-IdNr. brechen den Safe-Harbor → ohne USt-IdNr. keine Zulassung (Kleinunternehmer können USt-IdNr. nach § 27a beantragen).

**DAC7/PStTG:** Detailly = meldender Plattformbetreiber; Warenverkauf = relevante Tätigkeit (auch B2B). Registrierung beim BZSt; Erhebung § 17 (inkl. IBAN, HR-Nr.); Überprüfung § 18; **Meldung bis 31.01. des Folgejahres** über **DIP 2.x** (seit 01.01.2026; alte Schnittstelle abgelehnt); Information der Anbieter § 22; § 23-Durchsetzung (nach zweifacher Erinnerung 60/spätestens 180 Tage sperren/einbehalten); Aufzeichnung § 24; Bußgeld gestaffelt bis 50.000 € (§ 25). Freistellung § 4 Abs. 5 Nr. 4 (< 30 Verkäufe UND < 2.000 €) greift bei B2B-Großhändlern praktisch nie. Meldepflicht nicht an Stripe delegierbar.

**GwG:** Detailly regelmäßig **kein Verpflichteter** (kein Güterhändler, kein Zahlungsinstitut — Zahlungsdienste bei Stripe). Einordnung einmal dokumentieren; AMLR (VO 2024/1624, ab 10.07.2027) beobachten; bei Wallet/Escrow/Gutschein neu prüfen.

**E-Rechnung (§ 14 UStG, Wachstumschancengesetz) — größte materielle Lücke:** Detaillys **Provisions-/SaaS-Rechnungen an Händler/Tenants** sind inländische B2B-Umsätze. **Empfangspflicht seit 01.01.2025 ohne Übergangsfrist** (bei Gutschriftverfahren muss Detailly strukturierte E-Rechnungen EN 16931/XRechnung/ZUGFeRD empfangen/verarbeiten). **Ausstellungspflicht:** ab 01.01.2027 bei Vorjahresumsatz > 800.000 €, **ausnahmslos ab 01.01.2028**. § 19-Kleinunternehmer greift für skalierende UG nicht dauerhaft.

#### Entwurfstexte (Auszug)

Kernklauseln Händler-AGB (Vermittlerrolle, Stripe-Pflicht, keine Geldannahme, Provision via application_fee, KYB inkl. gültiger USt-IdNr. + § 18e-Prüfung, PStTG-Mitwirkung + § 23-Sperre) sind mit den Skeletten in **3.5/3.6** identisch und werden dort nicht wiederholt. DSE-Baustein „Händler-Verifizierung & Steuer-Meldungen" ist in **3.2** (Abschnitt 9) integriert.

**Interner Compliance-Kalender (Skelett):** laufend — § 18e-Erstvalidierung + ereignisgetriebene Re-Prüfung, § 22f-Aufzeichnung je Transaktion, **E-Rechnungs-Empfang**; bis 31.12. — § 17-Datensatz vollständig, § 23-Eskalationen, § 4-Abs.-5-Freistellungsprüfung; bis 31.01. — BZSt-Meldung DIP 2.x, § 22-Information, § 24-Protokolle; einmalig vor Launch — BZSt-Registrierung, Stripe auf Direct Charges + application_fee, ZAG-Memo, AGB/DSE live, E-Rechnung-Ausstellung spätestens 2028.

**Haftungsfallen:** **ZAG-Strukturbruch durch Feature-Creep** (Wallet/Gutschein/Escrow/Sammelrechnung → potenziell strafbar; vor jedem Payment-Feature prüfen) · Charge-Typ (Direct vs. Destination) · § 25e „Kennenmüssen" (Red-Flag-Prozess) · AGB-Kontrolle (keine pauschale Freizeichnung/Sperrung; Regress nur verschuldensabhängig) · DSGVO-Gewerbeanmeldungs-Upload (Schwärzung/Löschung) · PStTG-Detailfehler (Meldung/IBAN/DIP-2.x/§-23-Mechanik) · GwG-Scheinsicherheit · B2B-Fiktion absichern · **Gefahrstoff-/Gefahrgut-Dimension** (CLP/GefStoffV/ADR — Händler-Zusicherung + Vermittler-/Störerhaftung prüfen) · Stripe-DPA + VVT-Eintrag.

---

### 3.8 Endkunden-/Buchungsportal-Recht (Betriebe ↔ Verbraucher)

**Rollenklärung:** Im Buchungsportal ist der **Betrieb** Anbieter ggü. dem Verbraucher, Detailly ist technischer Dienstleister/Auftragsverarbeiter. B2C-Pflichten (Impressum, Widerruf, PAngV, VSBG, BFSG) treffen primär den Betrieb; Detailly muss die **technische Erfüllbarkeit** liefern. Solange pro Betrieb (White-Label, kein Verzeichnis), ist Detailly **kein** Online-Marktplatz i. S. § 312k BGB/Art. 246d EGBGB.

**Pflichten des Betriebs (Detailly stellt Slots bereit):** Impressum (§ 5 DDG) · DSE (Art. 13) · **Gesamtpreis inkl. USt / Preisspanne** (PAngV) · Widerrufsbelehrung + Muster-Widerrufsformular, wenn verbindlicher Fernabsatzvertrag (§§ 312g, 355, 356 Abs. 4 BGB, Art. 246a EGBGB) — Aufbereitung fällt **nicht** unter § 312g Abs. 2 Nr. 9; sauberste Architektur: Standardbuchung als **unverbindliche Anfrage** · Button „zahlungspflichtig buchen" (§ 312j) · VSBG-Hinweis (§§ 36, 37; ≤ 10 MA-Ausnahme für § 36, § 37 gilt für alle) · AGB (§ 305 Abs. 2) · **Barrierefreiheit BFSG** (seit 28.06.2025, WCAG 2.1 AA; Kleinstunternehmer-Ausnahme < 10 MA **und** ≤ 2 Mio. € — kumulativ; Detailly liefert den Code → de facto Produktpflicht + Verkaufsargument; Bußgeld bis 100.000 €, § 37 BFSG).

**Zusätzliche B2C-Pflichten im verbindlichen Flow:** **§ 312i BGB** (Eingabefehler-Korrektur, Info über Vertragsschluss-Schritte, unverzügliche Zugangsbestätigung, Abrufbarkeit) · **§ 312f BGB** (Vertragsbestätigung auf dauerhaftem Datenträger inkl. Pflichtinfos + Widerrufsbelehrung — sonst Widerrufsbelehrung nicht wirksam erteilt).

**Weitere:** PAngV im Materialmarktplatz nur B2C → Nettopreise zulässig bei dichtem B2B-Gate, klar „Nettopreise, nur für Gewerbetreibende". Cookie/§ 25 TDDDG: kein Banner bei nur technisch Notwendigem. Haftungs-/Link-Disclaimer weitgehend wirkungslos → Notice-and-Takedown-Prozess; eigene/KI-Fachinhalte = volle Inhaltshaftung („keine Gewähr, Herstellerangaben/SDB maßgeblich"). **P2B-VO** kann für das Buchungsportal (P2B2C!) **schon jetzt** greifen (transparente Betriebs-AGB, 15-Tage-Änderungsfrist, Sperr-Begründung, ggf. Ranking) — ANWALT PRÜFEN. **ZAG/Stripe** auch hier je nach Geldfluss (s. 3.7). Vorausschau: betriebsübergreifende Suche → Art. 246d EGBGB + § 5b UWG.

#### Entwurfstexte (Auszug)

```markdown
Rechtstexte-Slots je Tenant (Produkt-Anforderung, im Footer/Buchungs-Flow):
[ ] Impressum (Pflicht vor Aktivierung) · [ ] DSE (Detailly-Muster, RDG-Disclaimer)
[ ] AGB (optional; Link+Checkbox vor Abschluss) · [ ] VSBG-Hinweis (Auswahlvariante)
[ ] Widerrufsbelehrung (nur bei verbindlicher Buchung; Muster Art. 246a Anlage 1)
[ ] Flow-Schalter: „unverbindliche Anfrage" (Default) vs. „verbindliche Buchung"
[ ] Button-Text „zahlungspflichtig buchen" (verbindlich+zahlungspflichtig)
[ ] Preis brutto + „ab"-Kennzeichnung + „inkl. MwSt." · [ ] Eingabekorrektur + Zugangs-
    bestätigung (§312i) · [ ] Vertragsbestätigung dauerhafter Datenträger (§312f)
[ ] Erklärung zur Barrierefreiheit (Detailly-generiert)

Datenschutz-Kurzhinweis über dem Absenden-Button (KEINE Einwilligungs-Checkbox für die
Buchung — Rechtsgrundlage Vertrag, Art. 6 Abs. 1 lit. b): „Ihre Angaben werden von
[PLATZHALTER: Firma/Anschrift des Betriebs] als Verantwortlichem verarbeitet …;
technischer Dienstleister ist die Detailly UG als Auftragsverarbeiter (Hosting in DE).“
Optionale Checkbox NUR für Werbung (Double-Opt-in, Art. 6 Abs. 1 lit. a).

Anfrage-Bestätigung: „… Mit dieser Anfrage kommt noch kein Vertrag zustande. [Betrieb]
bestätigt den Termin separat.“
VSBG-Standard: „[Firma] ist zur Teilnahme an Verbraucherstreitbeilegung weder verpflichtet
noch bereit.“ (KEIN EU-ODR-Link.)
Cookie-Hinweis: „Ausschließlich technisch notwendige Speicherung (§25 Abs.2 Nr.2 TDDDG);
kein Tracking, kein Banner.“
Erklärung zur Barrierefreiheit: Geltungsbereich/BFSG+BFSGV/EN 301 549/WCAG 2.1 AA/Stand/
Feedback/Marktüberwachungsbehörde/Datum.
```

**Haftungsfallen:** Buchungs-Flow-Qualifikation (verbindlich vs. Anfrage) entscheidet das ganze Pflichtenprogramm — falsche Einordnung: Widerrufsfrist 12 Monate + 14 Tage (§ 356 Abs. 3), **kein Wertersatz** bei fehlender Belehrung (**§ 357a Abs. 2 BGB** — nicht § 357 Abs. 8, das ist die Vor-Reform-Nummerierung), Vertrag ohne Button unwirksam (§ 312j Abs. 4) · Rollenabgrenzung in Detaillys AGB (keine Total-Freizeichnung für code-erzwungene Darstellung, § 307) · erzwungene Datenschutz-Checkbox = Eigentor · PAngV „ab"-Preise transparent · B2B-Gate dicht · ODR-Altlasten entfernen · Disclaimer-Illusion · **BFSG-Verantwortungslücke** (Betrieb schuldet, Detailly liefert Code → AGB-Regelung; Zusicherung „WCAG 2.1 AA angestrebt", **keine harte Garantie**, § 443 BGB) · VSBG-Ausnahme jährlich neu prüfen · § 37 VSBG gilt immer · **Freistellungs- + Änderungsklausel** zugunsten Detaillys ergänzen.

---

### 3.9 Querschnittsthemen (dimensionsübergreifend, einmal konsolidiert)

- **DDG statt TMG:** Impressum seit 14.05.2024 § 5 DDG; Cookies/Tracking § 25 TDDDG (vormals TTDSG). In **allen** Bausteinen/Tenant-Vorlagen kein „TMG"/„TTDSG" mehr.
- **EU-ODR-Plattform abgeschaltet 20.07.2025** (VO 2024/3228 hebt ODR-VO auf). Kein OS-/ODR-Link mehr; Altbestände in Tenant-Impressen/Mail-Footern/AGB-Vorlagen entfernen (irreführungs-/abmahnfähig).
- **DSA (VO 2022/2065):** Art. 11/12-Kontaktstellen gelten schon jetzt für alle Hosting-/Vermittlungsdienste (B2B/B2C, keine KMU-Ausnahme); Art. 14/16 in AGB/Prozessen. Art. 30–32 nur B2C.
- **P2B-VO (2019/1150):** nicht für reine B2B-Vermittlung (Material-Marktplatz); **aber** für das **Buchungsportal (P2B2C)** ernsthaft prüfen — betrifft Detailly↔Betrieb-AGB (15-Tage-Änderungsfrist, Sperr-Begründung, Ranking-Transparenz).
- **Data Act (2023/2854):** Kap. VI (Wechsel/Export) + Art. 13 (Klauselkontrolle) für das SaaS-Kernprodukt, ohne KMU-Ausnahme.
- **ZAG/Stripe:** durchgängig „Detailly nimmt nie Gelder an" + Direct Charges; jede Geldverwahrung/Feature-Änderung neu prüfen (§ 63 ZAG strafbewehrt).
- **DPF + SCC:** stets „primär DPF, hilfsweise SCC + TIA" für Stripe/Anthropic (US-Transfers); Bestand nur intern bewerten (Latombe T-553/23 abgewiesen 03.09.2025, EuGH-Revision seit 31.10.2025 anhängig).
- **E-Rechnung (§ 14 UStG):** Empfangspflicht seit 01.01.2025; Ausstellung ab 01.01.2027 (> 800.000 €) / ausnahmslos 01.01.2028 — betrifft Detaillys Provisions-/SaaS-Rechnungen **und** Tenant-Rechnungs-Templates.
- **AI Act (2024/1689):** Transparenzpflichten Art. 50 ab 02.08.2026 für nutzersichtbare KI-Funktionen.
- **Aufbewahrungsfristen:** Buchungsbelege/Rechnungen 8 Jahre (§ 147 Abs. 3 AO, BEG IV, seit 01.01.2025); § 22f Abs. 4 UStG 10 Jahre (lex specialis Marktplatz).
- **§ 35a GmbHG:** nach Eintragung Pflichtangaben auf allen Geschäftsbriefen/E-Mails/Rechnungen/Mahnungen.

---

## 4. Anwalt-Pflicht-Register (zwingende Finalprüfung)

Konsolidierte, dedublizierte Liste aller Punkte, die vor Go-Live zwingend anwaltlich (bzw. steuerlich/zahlungsaufsichtsrechtlich) final zu prüfen sind. Priorität: **P0** vor erstem Kunden, **P1** vor Marktplatz-/Buchungsportal-Start.

**Impressum / Anbieterrecht**
1. Finaler Impressumstext nach HR-Eintragung mit echten Daten (P0) — Registerdaten, DL-InfoV-Versicherungsangabe, § 18-MStV-Verantwortlicher.
2. **DSA-Einordnung** (Hosting-/Vermittlungsdienst; Art. 11/12/14/16, ggf. Art. 30/31) (P0/P1) — gilt schon jetzt, nicht erst bei Plattform-Einstufung.
3. AGB-Klausel zur Tenant-Verantwortung für Impressum/Inhalte (Klauselkontrolle, § 305c/307) (P1).

**Datenschutz / AVV**
4. Gesamte DSE vor Livegang, insb. Rollenabgrenzung + Stripe/KYB/KI-Abschnitte (P0).
5. AVV inkl. Subprozessorenliste + TOM-Anlage; Aufbau auf SCC (EU) 2021/915 (P0).
6. **Art. 33/34-Meldekette** Detailly↔Betrieb (AVV + Incident-Runbook) (P0).
7. **Schwellwertanalyse / ggf. DSFA (Art. 35)** — KYB-Dokumente + KI + umfangreiche Auftragsverarbeitung (P1).
8. **Art. 82-Haftungsverteilung + Freistellung im AVV** (Innenregress) (P0).
9. **RDG-Konformität** der Muster-DSE/-Rechtstexte für Betriebe (P1).
10. **TIA** Stripe/Anthropic (DPF-Fallback „primär DPF, hilfsweise SCC"), laufend aktuell halten (P0).
11. Tenant-eigener SMTP: bleibt Detailly Prozessor? (P1).
12. KI-Funktion: gehen personenbezogene Endkundendaten an Anthropic? → Subprozessorenliste + Anzeige an Betriebe (P1).
13. PStTG/DAC7-Umfang für Speicherdauer der KYB-Uploads (P1).

**SaaS-AGB (B2B)**
14. § 10 Haftung komplett + Cap-Höhe (an IT-Haftpflicht koppeln) (P0).
15. § 4 Abs. 5 Preisanpassung + § 13 Änderungsmechanik/Zustimmungsfiktion (Begründung: keine direkte B2B-Rspr.) (P0).
16. § 11 Mängelrechte (Minderungs-Rückforderung, § 536a-Abbedingung) (P0).
17. § 9 Data-Act-Baustein + Art. 13-Klauselkontrolle gegen finales Durchführungsgesetz/BNetzA (P0).
18. § 3 Testphasen-Haftungsmaßstab + § 7 Abs. 5 Freistellung (P0).
19. Rangfolgeklausel + Konsistenz AGB↔AVV↔Leistungsbeschreibung↔Preisliste↔Marktplatz-AGB (P0).
20. AI Act Art. 50 — Rolle Detailly (Betreiber/Deployer), KI-Transparenz (P1).

**Marktplatz / Händler / P2B**
21. Gesamter Marktplatz-/Händler-AGB-Werk gegen §§ 305 ff. BGB **und** P2B-VO (Sperrung, Freistellung, Haftung, Änderung) (P1).
22. **GPSR (VO 2023/988)** — Produkt-Scope-Analyse „professional-only vs. verbraucherfähig" + Umfang der Marktplatzpflichten (Art. 22) (P1).
23. **VerpackG § 7 Abs. 7 (Bußgeld § 36) / ElektroG § 6 Abs. 2 / BattDG** — Marktplatz-Prüf-/Sperrpflichten, Registerabgleich als Onboarding-Gate (P1).
24. Rechtsschein-Konsistenz gesamter Bestell-Flow (UI/Belege) (P1).
25. „verifizierte Händler"-Werbung vs. Haftungsfreizeichnung (UWG) (P1).
26. **§ 38 ZPO / § 377 HGB** — Kaufmanns-Voraussetzung; Gerichtsstandklausel „soweit zulässig" (P1).

**Zahlung / Steuer**
27. **ZAG-Struktur-Memo** inkl. Charge-Typ (Direct vs. Destination) + Chargeback-Regress (zahlungsaufsichtsrechtlich spezialisierte Kanzlei; ggf. informelle BaFin-Anfrage; erneut bei jedem Payment-Feature und nach finalem PSR/PSD3-Text) (P1).
28. **Steuerliche Abstimmung (Steuerberater):** USt auf Provision, Abrechnung Rechnung vs. Gutschrift (§ 14 Abs. 2 S. 5), § 22f-Aufzeichnung, § 25e-Prüfprozess, PStTG-Registrierung/Meldung (DIP 2.x), Kleinunternehmer-USt-IdNr.-Zulassungsregel (P1).
29. **E-Rechnungs-Prozess** der Provisions-/SaaS-Abrechnung (Empfang jetzt, Ausstellung 2027/28) (P0/P1).
30. PAngV-/Zugangs-Designentscheidung (offener Katalog vs. Login-Gate) + UWG-Absicherung (P1).
31. **Gefahrstoff-/Gefahrgutrecht** (CLP/GefStoffV/ADR) — Vermittler-/Störerhaftung + Händler-Zusicherungen (P1).

**Endkunden / Buchungsportal**
32. Buchungs-Flow-Einordnung (verbindlich vs. Anfrage) + Widerrufsbelehrungs-/§ 312f-Bestätigungsmuster (P1).
33. Detailly-AGB-Klauseln: Rollenabgrenzung, Haftung, **BFSG-Zusicherungsniveau** (keine Garantie), Freistellung, Änderungsvorbehalt (P1).
34. B2B-Gate-Konstruktion des Materialmarktplatzes (PAngV/BFSG/Fernabsatz-Freiheit hängen daran) (P1).
35. **P2B-Anwendbarkeit** des Buchungsportals + Betreiberpflichten in Detailly↔Betrieb-AGB (P1).
36. **ZAG/Stripe Connect** für Buchungsportal-Zahlungen (Geldfluss) (P1).

---

## 5. Go-Live-Rechts-Checkliste (priorisiert)

### Stufe P0 — vor dem ersten echten SaaS-Kunden
1. **Firmenstammdaten** final (Abschnitt 2 A–D befüllt); UG-Gründung/Eintragung koordinieren, „i. G."-Handhabung.
2. **Impressum + DSA-Kontaktstellen + DL-InfoV-Versicherungsangabe** live (§ 5 DDG), Footer-Link überall; kein TMG/ODR.
3. **Datenschutzerklärung** live; nur technisch notwendige Cookies (kein Banner) verifiziert; VVT (Art. 30 Abs. 1 + Abs. 2) angelegt.
4. **AVV** als Anlage + automatischer Abschluss beim Onboarding; **Sub-AV-Kette geschlossen** (Hetzner-AVV aktiv, Stripe-/Anthropic-DPA archiviert); Subprozessorenliste + TOM-Anlage (nur Ist-Maßnahmen).
5. **Datenpannen-Runbook** (72 h / 24-h-Meldekette Detailly↔Tenant).
6. **SaaS-AGB (B2B)** + Leistungsbeschreibung + Preisliste + **Data-Act-§ 9 + Export-Feature (CSV/JSON/XRechnung)** + Data-Act-Infoseite.
7. **B2B-only technisch erzwungen** (Unternehmer-Checkbox + Firmen-/Gewerbefeld).
8. **IT-/Vermögensschaden-Haftpflicht** abgeschlossen; Haftungs-Cap daran ausgerichtet.
9. **E-Rechnungs-Empfang** (EN 16931) technisch möglich.
10. **§ 35a GmbHG** in E-Mail-Signaturen/Rechnungs-Templates (ab Eintragung).
11. Anwalt-Register P0-Punkte abgearbeitet/freigegeben.

### Stufe P1 — vor Buchungsportal- und Marktplatz-Start
12. **ZAG-Struktur** final: Stripe auf **Direct Charges + application_fee**, kein Detailly-Geldfluss; ZAG-Memo; Chargeback-Regressklausel.
13. **KYB-Onboarding** mit Register-Gates: Gewerbe/HR, gültige **USt-IdNr. (§ 18e-Prüfung)**, **LUCID**, **WEEE (ear)**, ggf. Batterie-Registrierung; Schwärzungs-/Lösch-/Zugriffskonzept.
14. **PStTG/DAC7**: BZSt-Registrierung + DIP-2.x-Anbindung + § 23-Sperrmechanik (60/180 Tage) + § 22-Information; DAC7-Infoblatt.
15. **§ 25e-Prozess** (ereignisgetriebene USt-IdNr.-Prüfung + Speicherung + Finanzamts-Sperr-Workflow); § 22f-Aufzeichnung je Transaktion.
16. **Marktplatz-AGB (Käufer) + Händler-Rahmenvertrag** + Provisionsordnung + Produkt-/Listungsrichtlinie (REACH/CLP/GPSR/Verbotsliste) — P2B-konform gebaut.
17. **GPSR-/VerpackG-/ElektroG-Betreiberpflichten** umgesetzt (Kontaktstelle, Safety-Gate, Registerabgleich, Delisting-Recht); Rechtsschein-Konsistenz im Bestell-Flow.
18. **PAngV-Entscheidung** Materialmarktplatz (Login-Gate vs. konforme Anzeige); B2B-Gate dicht.
19. **Buchungsportal-Rechtstexte-Slots** (Impressum/DSE/AGB/VSBG/Widerruf/§ 312f-Bestätigung/Button) + **Erklärung zur Barrierefreiheit / WCAG 2.1 AA**.
20. **P2B-Prüfung Buchungsportal** + entsprechende Detailly↔Betrieb-AGB-Klauseln (15-Tage-Frist, Sperr-Begründung).
21. **E-Rechnungs-Ausstellung** vorbereitet (spätestens 2027/28); Tenant-Rechnungs-Templates § 14 UStG/§ 35a-konform.
22. Anwalt-Register P1-Punkte abgearbeitet/freigegeben.

### Stufe P2 — laufend / mittelfristig
23. DPF-/SCC-TIA laufend aktuell; PSR/PSD3 nach OJ-Veröffentlichung neu bewerten; AMLR (07/2027) beobachten.
24. AI Act Art. 50 (ab 02.08.2026) umsetzen; VSBG-Ausnahmen der Tenants jährlich (Stichtag 31.12.) neu abfragen; § 38-BDSG-DSB-Schwelle bei Teamwachstum prüfen; Post-Eintragungs-Update (Register/USt-IdNr./„i. G.") ausrollen.

---

## 6. Quellen (Auswahl, alle abgerufen 13.07.2026)

Vollständige Einzelnachweise sind in den geprüften Dimensions-Recherchen dokumentiert. Kernquellen je Themenblock:

**Impressum/DDG/DSA:** § 5 DDG & § 33 DDG (gesetze-im-internet.de); BGBl. I 2026 Nr. 29 (recht.bund.de); BGH I ZR 228/03; § 18 MStV (res-media.net, NLM); W-IdNr./USt-IdNr. (IT-Recht-Kanzlei, TCI Law); DL-InfoV (eRecht24, IT-Recht-Kanzlei, dr-datenschutz.de); DSA Art. 11/12 (rickert.law, dr-bahr.com, gesetz-digitale-dienste.de); § 11 Abs. 2 GmbHG (firma.de).

**Datenschutz/TDDDG/DPF:** EU-US DPF (eRecht24; Stripe DPF Policy; Compound Law Anthropic); Trump v. Slaughter / DPF-Bewertung (RA Ferner, IAPP); EuG Latombe T-553/23 (IAPP) + EuGH-Revision (WilmerHale); TDDDG § 25/§ 28 (eRecht24, cortina-consult); EinwV (Haufe, Projekt 29); § 147 Abs. 3 AO / BEG IV.

**AVV:** Art. 28 DSGVO-Leitfaden (externer-datenschutzbeauftragter-dresden.de, legiscope.com); EDSA-Leitlinien 07/2020; Bayerisches LDA; Hetzner DPA; Durchführungsbeschluss (EU) 2021/915 (EUR-Lex CELEX 32021D0915); Stripe/Anthropic DPA (av-vertrag.org, compound.law).

**SaaS-AGB/Data Act:** BGH XII ZR 120/04; OLG Celle „Kardinalpflicht" (damm-legal.de); Data Act Art. 13/25/29 (data-act-law.eu, Bundesnetzagentur, Hogan Lovells, Latham & Watkins); IT-Recht-Kanzlei (Data Act Hosting/SaaS); Bird & Bird (Preiserhöhungen Online-Abos); SZA/EY (AGB-Reform B2B).

**Marktplatz/Händler/P2B/DSA:** P2B-VO (Taylor Wessing, HÄRTING, IHK Köln, Noerr, BNetzA); DSA Art. 30 (gesetz-digitale-dienste.de, Menold Bezler); GPSR VO 2023/988 (BMUKN-FAQ, e-recht24, HEIN, Taylor Wessing); VerpackG § 7 Abs. 7/§ 36 (shopbetreiber-blog, Deutsche Recycling); ElektroG § 6 Abs. 2 (IT-Recht-Kanzlei, Heuking); REACH Art. 31 (reachonline.eu, BAuA); PAngV 2022 (gesetze-im-internet.de, Plutte).

**Zahlung/KYB/Steuer:** BaFin-Merkblatt ZAG; § 63 ZAG; Handelsvertreterausnahme (FIN LAW, PayTechLaw); PSD3/PSR (mzs-recht, GÖRG, EC1 Partners); Stripe Connected Account Agreement / Direct Charges (stripe.com); § 25e/§ 22f UStG (buzer, Haufe, UStAE 22f.1); PStTG (gesetze-im-internet.de, BZSt-FAQ, KMLZ, Ecovis, Haufe § 25); GwG-Auslegungshinweise der Länder; AMLR VO 2024/1624; E-Rechnung § 14 UStG (BMF-FAQ, IHK/ADVISORI).

**Endkunden/Buchungsportal:** § 25 TDDDG/§ 28 (dejure.org, IHK Köln); §§ 36/37 VSBG (BfJ); PAngV (IHK Regensburg); BFSG/BFSGV (Bundesfachstelle Barrierefreiheit, IHK Berlin, HÄRTING, Händlerbund); OS-Plattform-Abschaltung VO (EU) 2024/3228 (Wettbewerbszentrale, BRAK, IT-Recht-Kanzlei); §§ 356/357a/312f/312i BGB (gesetze-im-internet.de, dejure.org); P2B-VO (Taylor Wessing, Wettbewerbszentrale).

---

*Ende des Dokuments. Alle Entwurfstexte sind Arbeitsfassungen; produktive Nutzung erst nach anwaltlicher Freigabe und Einsetzen der echten Firmendaten (siehe Abschnitte 2, 4 und 5).*