> ## ⚠️ ENTWURF — anwaltliche Prüfung vor Produktivnutzung zwingend
>
> Unverbindlicher Arbeitsentwurf, **keine Rechtsberatung**, nicht anwaltlich erstellt/geprüft.
> Vor jeder produktiven Nutzung durch eine auf IT-Recht spezialisierte Kanzlei prüfen und
> freigeben lassen. Alle `<PLATZHALTER: …>` vor Nutzung durch echte Angaben ersetzen. Kern-
> Klauselrisiken (Haftung/Cap, Preisanpassung, Änderungsvorbehalt, Data Act) sind mit `[ANWALT
> PRÜFEN]` markiert. Rechtsstand-Recherche siehe `docs/RECHTLICHE_ABSICHERUNG.md`, Abschnitt 3.4.

# Allgemeine Geschäftsbedingungen (AGB) — Detailly SaaS (B2B)

**Anbieter:** `<PLATZHALTER: Detailly UG (haftungsbeschränkt) i. G., Anschrift, HRB, vertreten durch Finn Bellmann>` (nachfolgend „Detailly").
**Kunde:** der die Software nutzende Betrieb (Unternehmer i. S. § 14 BGB).

Stand: `<PLATZHALTER: Datum>`.

---

## § 1 Geltungsbereich
1. Diese AGB gelten für die Nutzung der Detailly-Software (Software as a Service) durch **Unternehmer** (§ 14 BGB). **Verbraucher sind ausgeschlossen.** Der Kunde bestätigt bei Vertragsschluss, als Unternehmer zu handeln.
2. Abweichenden AGB des Kunden wird widersprochen; sie werden nicht Vertragsbestandteil.

## § 2 Vertragsgegenstand / Leistungsbeschreibung
1. Detailly stellt eine webbasierte Werkstattsoftware für Fahrzeugaufbereitung, Folierung und Lackschutz (PPF) zur Nutzung über das Internet bereit. Funktionsumfang u. a.: Kunden-/Fahrzeugverwaltung, Auftrags- und Terminplanung, Fahrzeugannahme und 3D-Schadenserfassung/Gutachten, Kalkulation/Angebote, Rechnungen (inkl. XRechnung/ZUGFeRD) und Mahnwesen, öffentliches Buchungsportal, Auswertungen und Buchhaltungs-Export.
2. Der konkrete Funktionsumfang richtet sich nach dem gebuchten Tarif (siehe **`docs/PRICING_V2.md`** bzw. die jeweils gültige Preis-/Leistungsübersicht).
3. **Übergabepunkt** der Leistung ist der Routerausgang des Rechenzentrums; Server in `<PLATZHALTER: Deutschland (Hetzner)>`.
4. **KI-Funktionen** (z. B. Support-Assistent, Kalkulationsvorschläge) erzeugen **Vorschläge**; die inhaltliche Prüfung obliegt dem Kunden.
5. Die **inhaltliche und steuerliche Richtigkeit** von Belegen/Rechnungen verantwortet der Kunde.

## § 3 Vertragsschluss / Testphase
1. Der Vertrag kommt mit der Freischaltung des Kontos zustande.
2. Eine kostenlose **Testphase** von `<PLATZHALTER: 14 Tagen>` endet automatisch; im Pilotbetrieb kann Detailly die Testphase verlängern/als Pilot-Modus führen. *[ANWALT PRÜFEN: Haftungsmaßstab in der Testphase.]*
3. Mit Vertragsschluss werden der **AVV** (`AVV.md`) und die Datenschutzhinweise einbezogen (siehe § 12).

## § 4 Tarife, Entgelte, Zahlung
1. Es gelten die Entgelte der jeweils gültigen Preisliste (siehe `docs/PRICING_V2.md`). Preise verstehen sich **netto** zzgl. gesetzlicher USt.
2. Abrechnung `<PLATZHALTER: monatlich/jährlich>`; Zahlung über `<PLATZHALTER: Zahlungsdienstleister, z. B. Stripe>`. Im Pilotbetrieb: `<PLATZHALTER: kostenlos/Sonderkondition>`.
3. Bei Zahlungsverzug kann Detailly nach **Mahnung und Ankündigung** den Zugang sperren; gesetzliche Rechte bleiben unberührt.
4. Eine **Preisanpassung** erfolgt nur zur nächsten Verlängerungsperiode mit Vorlauf von `<PLATZHALTER: ≥ 6 Wochen>` und Sonderkündigungsrecht des Kunden; keine laufzeitinterne Erhöhung, keine Zustimmungsfiktion. *[ANWALT PRÜFEN]*

## § 5 Laufzeit und Kündigung
1. Laufzeit/Verlängerung gemäß Tarif; die **ordentliche Kündigungsfrist** beträgt höchstens `<PLATZHALTER: 2 Monate>` (Data-Act-Grenze).
2. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.
3. Die Datenexport-Rechte nach § 9 bleiben von der Kündigung unberührt.

## § 6 Verfügbarkeit / Wartung
1. Detailly bemüht sich um eine Verfügbarkeit von `<PLATZHALTER: 99,0 % im Monatsmittel>` am Übergabepunkt; ausgenommen sind angekündigte Wartungsfenster und Fälle höherer Gewalt.
2. Wartungsfenster werden nach Möglichkeit mit Vorlauf angekündigt.

## § 7 Pflichten des Kunden
1. Der Kunde hält Zugangsdaten geheim und sichert Konten angemessen (2FA verfügbar).
2. Der Kunde ist für die **Rechtmäßigkeit** der von ihm eingestellten Daten und für seine eigene Rechtsgrundlage gegenüber seinen Endkunden verantwortlich (insb. Informationspflichten Art. 13/14 DSGVO, ggf. Einwilligungen).
3. Der Kunde ist für **eigenes Impressum und eigene Datenschutzerklärung** seiner öffentlichen Buchungsseite/seiner Kundenkommunikation selbst verantwortlich (Detailly stellt nur die technischen Slots und ein unverbindliches Muster, siehe `DATENSCHUTZ_BETRIEB_MUSTER.md`).
4. Der Kunde stellt Detailly von Ansprüchen Dritter frei, die auf einer schuldhaften Pflichtverletzung des Kunden beruhen. *[ANWALT PRÜFEN]*

## § 8 Nutzungsrechte
Der Kunde erhält ein einfaches, nicht übertragbares, auf die Vertragslaufzeit beschränktes Nutzungsrecht an der Software.

## § 9 Anbieterwechsel, Datenexport und Löschung (Data Act)
1. Der Kunde kann seine Daten in einem gängigen Format exportieren (z. B. CSV/JSON, Rechnungen inkl. XRechnung); die Funktionen sind im Produkt vorhanden.
2. Nach Vertragsende besteht eine Export-Karenz von `<PLATZHALTER: ≥ 30 Tagen>`, danach Löschung gemäß AVV § 10.
3. Wechselbehindernde Klauseln oder unangemessene Entgelte für den Standard-Export bestehen nicht. *[ANWALT PRÜFEN: Data Act Kap. VI + Art. 13.]*

## § 10 Haftung
1. Detailly haftet **unbeschränkt** bei Vorsatz und grober Fahrlässigkeit, für Schäden aus der Verletzung von Leben/Körper/Gesundheit, nach dem Produkthaftungsgesetz, bei Arglist und im Umfang einer übernommenen Garantie.
2. Bei einfacher Fahrlässigkeit haftet Detailly nur bei Verletzung einer **wesentlichen Vertragspflicht** (Kardinalpflicht) und begrenzt auf den vertragstypisch vorhersehbaren Schaden. `<PLATZHALTER: optionaler Haftungs-Cap — an IT-/Vermögensschaden-Haftpflicht koppeln>`. *[ANWALT PRÜFEN: „Kardinalpflicht" definieren; Cap nur haltbar, wenn er den vertragstypischen Schaden deckt.]*
3. Eine verbindliche **Backup-Zusage** (Sicherung der Kundendaten) ist Leistungsbestandteil; Datenverlust wird nicht pauschal auf ein Kunden-Backup abgewälzt.
4. Die Haftung für anfängliche Mängel nach § 536a Abs. 1 Alt. 1 BGB (verschuldensunabhängig) wird ausgeschlossen, soweit zulässig.

## § 11 Mängelrechte
Es gilt Mietrecht (§§ 535 ff. BGB). § 536a Abs. 2 BGB (Selbstvornahme) wird ausgeschlossen; eine Minderung erfolgt nur im Wege der Rückforderung.

## § 12 Datenschutz / AVV / Vertraulichkeit
1. Soweit Detailly personenbezogene Daten **im Auftrag** des Kunden verarbeitet, gilt der **AVV** (`AVV.md`) vorrangig.
2. Für eigene Verarbeitungen (Konto/Abrechnung) gilt die Datenschutzerklärung von Detailly.
3. Eine Nennung des Kunden als Referenz erfolgt nur mit dessen Zustimmung.

## § 13 Änderungen der AGB
Änderungen werden dem Kunden mit einem Vorlauf von `<PLATZHALTER: ≥ 6 Wochen>` in Textform mitgeteilt; der Kunde kann widersprechen/kündigen. Der Änderungsvorbehalt ist auf Nebenabreden beschränkt; eine Zustimmungsfiktion wird restriktiv gehandhabt. *[ANWALT PRÜFEN: keine gesicherte B2B-Rechtsprechung.]*

## § 14 Schlussbestimmungen
1. Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts (CISG).
2. **Gerichtsstand** ist `<PLATZHALTER: Sitz Detailly>`, **sofern der Kunde Kaufmann** ist (§ 38 ZPO).
3. **Rangfolge:** Individualabrede → diese AGB → AVV (in Datenschutzfragen vorrangig) → Leistungsbeschreibung → Preisliste.
4. Sollte eine Bestimmung unwirksam sein, bleibt der Vertrag im Übrigen wirksam (ohne automatische Ersetzung).

---

## Hinweis zur Abgrenzung (Pilot)
Diese AGB betreffen das **SaaS-Kernprodukt (B2B)**. Für den **Material-Marktplatz** (Händler/Käufer) und für die **Zahlungsabwicklung von Buchungen** gelten gesonderte Bedingungen und weitere gesetzliche Pflichten (P2B, DSA, ZAG, GPSR, DAC7 u. a.), die **nicht** Teil dieses Pilot-Pakets sind (siehe `COMPLIANCE_TRACKING.md`, Bereich „NACH-PILOT").

## Anwalt-/Betreiber-To-do
- [ ] Firmendaten/HRB/Sitz einsetzen; § 4/§ 10/§ 13 final prüfen; Cap an Versicherung koppeln.
- [ ] Preis-/Leistungsübersicht als Anlage verlinken (`docs/PRICING_V2.md`).
- [ ] B2B-only technisch erzwingen (Unternehmer-Bestätigung + Pflichtfeld Firma) — siehe `COMPLIANCE_TRACKING.md`.
- [ ] Data-Act-Anlage „exportierbare Datenkategorien/Formate" ergänzen.
