> ## ⚠️ ENTWURF — anwaltliche Prüfung vor Produktivnutzung zwingend
>
> Unverbindlicher Arbeitsentwurf, **keine Rechtsberatung**, nicht anwaltlich erstellt/geprüft.
> Alle `<PLATZHALTER: …>` vor Nutzung durch echte Betreiberdaten ersetzen. Die Datenkategorien und
> Verarbeitungstätigkeiten sind aus dem **realen Datenmodell** abgeleitet (Entity-Verweise);
> Rechtsstand-Recherche siehe `docs/RECHTLICHE_ABSICHERUNG.md`.

# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

Dieses Dokument enthält **zwei** Verzeichnisse:
- **Teil A:** Detailly als **Auftragsverarbeiter** — Verzeichnis nach **Art. 30 Abs. 2 DSGVO**.
- **Teil B:** **Muster** für den **Betrieb** als **Verantwortlicher** — Verzeichnis nach **Art. 30 Abs. 1 DSGVO** (zum Ausfüllen).

Stand: `<PLATZHALTER: Datum>`. Bei jeder größeren Funktionsänderung aktualisieren.

---

# TEIL A — Detailly als Auftragsverarbeiter (Art. 30 Abs. 2)

## A.1 Verantwortlicher / Auftragsverarbeiter
- **Auftragsverarbeiter:** `<PLATZHALTER: Firma Detailly, Anschrift>`, vertreten durch `<PLATZHALTER: Finn Bellmann>`. Kontakt Datenschutz: `<PLATZHALTER: datenschutz@detailly.de>`.
- **Datenschutzbeauftragter:** `<PLATZHALTER: benannt/nicht benannt — § 38 BDSG jährlich prüfen>`.
- **Verantwortliche (Auftraggeber):** die angeschlossenen Betriebe (je eigener AVV nach Art. 28).

## A.2 Kategorien der im Auftrag durchgeführten Verarbeitungen
Detailly verarbeitet im Auftrag der Betriebe deren Endkundendaten zum Zweck des Software-Betriebs (Speicherung/Anzeige/Verarbeitung im Rahmen der App-Funktionen). Die inhaltlichen Datenkategorien pro Tätigkeit:

| # | Verarbeitungstätigkeit (im Auftrag) | Datenkategorien | Betroffene | Fundstelle (Entity) |
|---|---|---|---|---|
| A1 | Kundenverwaltung | Name/Firma, USt-Nr., Leitweg-ID, E-Mail, Telefon/Mobil, Anschrift, Notizen | Endkunden des Betriebs | `customers` |
| A2 | Fahrzeugverwaltung | Marke/Modell/Baujahr/Farbe, **Kennzeichen**, **VIN**, Maße, Notizen | Endkunden | `vehicles` |
| A3 | Auftrags-/Terminabwicklung | Leistungsdetails, interne Hinweise, **Fotos**, km/Tankstand, Terminzeiten | Endkunden | `orders`, `appointments` |
| A4 | Fahrzeugannahme & Gutachten | Schadenspositionen, **Fotos**, **digitale Unterschrift (PNG)**, Einwilligungstext, Unterzeichner | Endkunden | `damage_inspections` + Positionen/Fotos |
| A5 | Rechnungen & Mahnwesen | Rechnungsnummer/Beträge/Datum, Empfänger-Snapshot (verschlüsselt), Freitext (verschlüsselt) | Endkunden | `invoices`, `invoice_items` |
| A6 | Öffentliche Online-Terminbuchung | Name, E-Mail/Telefon, Leistung, Fahrzeug, Wunschtermin, Nachricht, **gehashte IP** | Interessenten/Endkunden | `booking_requests` |
| A7 | Vermietung / Zeiterfassung / Support | je nach Modul personenbezogene Bezüge | Endkunden / Mitarbeiter | `rentals`, `order_times`, `support_*` |
| A8 | Protokollierung (Rechenschaft) | Wer/Was/Wann (userId, action, entityType/-id, payload, Zeit) | Nutzer/Endkunden (Bezug) | `audit_logs` |

## A.3 Kategorien von Empfängern (Unterauftragsverarbeiter)
Siehe **`SUBPROZESSOREN.md`**: Hosting (`<PLATZHALTER: Hetzner, DE>`), Plattform-SMTP (`<PLATZHALTER>`), optional Anthropic (Support-Assistent, USA), optional sevDesk (DE, tenant-aktiviert). Betriebseigener SMTP ist Auftragsverarbeiter des Betriebs, nicht von Detailly.

## A.4 Drittlandübermittlungen
Kernbetrieb in DE/EU. Drittland nur bei optional aktiviertem Anthropic (USA) / Stripe (Abo, USA-Konzernbezug) — Grundlage **DPF + SCC + TIA** (siehe AVV § 7).

## A.5 Löschfristen (aus dem Löschkonzept)
- Endkundendaten: solange der verantwortliche Betrieb die Verarbeitung beauftragt; nach Vertragsende Export + Löschung gemäß AVV § 10 (Karenz `<PLATZHALTER: 30>` Tage, Backup-Löschung `<PLATZHALTER: 90>` Tage).
- **Rechnungen/steuerrelevante Belege:** gesetzliche Aufbewahrung (Richtwert 8–10 Jahre, § 147 AO/§ 257 HGB) — bei Löschung Anonymisierung statt Hartlöschung, Rechnungs-Snapshot bleibt (§ 14 UStG).
- **Online-Terminanfragen:** Richtwert `<PLATZHALTER: 90>` Tage (opportunistische Bereinigung, `booking_requests`).
- **Server-Logfiles:** `<PLATZHALTER: z. B. 7 Tage>` (Hoster-Ebene).
- Betroffenenrecht auf Löschung: technisch über das DSGVO-Cockpit (Art. 17), siehe `TOMS.md` §5.

## A.6 Technische und organisatorische Maßnahmen
Verweis auf **`TOMS.md`** (Art. 32). Ehrlich gekennzeichnete Betreiber-/Hoster-Verantwortung dort in Abschnitt 7.

---

# TEIL B — MUSTER für den Betrieb als Verantwortlicher (Art. 30 Abs. 1)

> Der Betrieb ist **Verantwortlicher** für die Daten seiner Endkunden. Detailly ist insoweit sein Auftragsverarbeiter. Dieses Muster ist auszufüllen; es ist **keine Rechtsberatung**.

## B.1 Verantwortlicher
`<PLATZHALTER: Firma des Betriebs, Anschrift>`, vertreten durch `<PLATZHALTER>`. Kontakt: `<PLATZHALTER: E-Mail/Telefon>`. Datenschutzbeauftragter: `<PLATZHALTER: benannt/nicht benannt>`.

## B.2 Verarbeitungstätigkeiten (Beispiele/Muster)

| # | Tätigkeit | Zweck | Rechtsgrundlage | Datenkategorien | Betroffene | Empfänger | Löschfrist |
|---|---|---|---|---|---|---|---|
| B1 | Kunden-/Fahrzeugverwaltung | Auftragsabwicklung | Art. 6 Abs. 1 lit. b | Name, Kontakt, Anschrift, Fahrzeug (Kennzeichen/VIN) | Endkunden | Detailly (AV), `<PLATZHALTER: Steuerberater>` | nach Zweckwegfall / gesetzl. Fristen |
| B2 | Angebote/Aufträge/Gutachten | Leistungserbringung, Beweissicherung | Art. 6 Abs. 1 lit. b/f | Leistungs-, Schadens-, Fotodaten, Unterschrift | Endkunden | Detailly (AV) | nach Zweckwegfall / Gewährleistung |
| B3 | Rechnungsstellung/Buchhaltung | Abrechnung, steuerliche Pflichten | Art. 6 Abs. 1 lit. b/c | Rechnungs-/Zahlungsdaten | Endkunden | Detailly (AV), `<PLATZHALTER: sevDesk/DATEV/Steuerberater>` | 8–10 Jahre (AO/HGB) |
| B4 | Online-Terminanfragen | vorvertragliche Kontaktaufnahme | Art. 6 Abs. 1 lit. b/f | Name, Kontakt, Anliegen | Interessenten | Detailly (AV) | `<PLATZHALTER: 90 Tage>` |
| B5 | Terminerinnerungen / Marketing | Kundenbindung | Art. 6 Abs. 1 lit. a/f (§ 7 UWG!) | Kontaktdaten | Endkunden | `<PLATZHALTER>` | bis Widerruf |
| B6 | Beschäftigtendaten | Personalorganisation | Art. 6 Abs. 1 lit. b, § 26 BDSG | Mitarbeiterdaten, Stundenlohn | Beschäftigte | Detailly (AV), `<PLATZHALTER>` | nach Beschäftigungsende + Fristen |

## B.3 Empfänger / Auftragsverarbeiter des Betriebs
- **Detailly** (Software, AVV nach Art. 28) — siehe AVV.
- `<PLATZHALTER: Steuerberater, DATEV/sevDesk, eigener Mailprovider, ggf. Inkasso>`.

## B.4 Drittlandübermittlungen
`<PLATZHALTER: i. d. R. keine; Ausnahmen dokumentieren>`.

## B.5 Technische und organisatorische Maßnahmen
`<PLATZHALTER: eigene TOM des Betriebs — Zugriffsschutz, Gerätesicherheit, verschlossene Ablage von Ausdrucken usw.; die softwareseitigen TOM stellt Detailly, siehe TOMS.md>`.

---

## Betreiber-/Anwalt-To-do
- [ ] Teil A mit echten Firmendaten und finalen Fristen befüllen; bei jeder Funktionsänderung fortschreiben.
- [ ] Teil B den Betrieben als **ausfüllbares Muster** (mit Disclaimer wegen RDG) bereitstellen — nicht als fertige verbindliche Rechtsdienstleistung.
- [ ] Rechtsgrundlagen/Löschfristen mit Anwalt/Steuerberater final abstimmen.
