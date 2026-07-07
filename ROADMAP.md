# Detailly – Roadmap v2 (nach Abschluss der aktuellen Mission)

Stand: 2026-07-07 · Product Manager · Quellen: `BACKLOG.md` (🟢 T-022…T-031), `WORKFLOW.md` (P6-3 + Erkenntnisse aus P3-1/P3-4/P3-7), `BUSINESS_CASE.md` (Kosten/Gebühren).

**Was diese Roadmap ist:** Die priorisierte Zukunftsliste für die Zeit **nach** der laufenden Mission (Phasen 3–6). Alles hier ist bewusst aus dem Missions-Scope herausgehalten worden – teils als 🟢-Nice-to-have, teils als bewusst verschobenes Folge-Ticket aus einem Arbeitspaket. Diese Datei ersetzt nicht das BACKLOG, sie ordnet die Reste in eine ehrliche Reihenfolge.

**Priorisierungslogik:** Reihenfolge = Nutzerwert × Umsatzhebel ÷ (Aufwand + Risiko). Kein Feature-Wunschkonzert: Ein Punkt steht nur dann weit vorne, wenn er entweder direkt Geld bringt/sichert **oder** einen belegten Schmerz aus der Mission löst. Alles, was „nett wäre, aber niemand nachgefragt hat", steht bewusst hinten.

**Aufwand:** S = ≤ 0,5 Tag · M = 1–3 Tage · L = > 3 Tage.

**Grundregel für alle Horizonte:** Nichts hier startet, bevor Phase 5 (QA/Security) und Phase 6 (Go-Live-Legal T-005, Migrations-Baseline T-001) der aktuellen Mission abgeschlossen sind. Die Roadmap baut auf einem produktiv ausgelieferten Fundament auf.

---

## Horizont 1 · Als Nächstes

Direkt nach Go-Live. Kleine bis mittlere Häppchen mit hohem Hebel, die auf bereits gebauter Infrastruktur (Status-Mails aus P3-2, Zahlungslink aus P3-4, Fehler-Kontrakt aus P3-1) aufsetzen. Ziel: die Endkunden-Touchpoints und die Frontend-Ergonomie ausreizen, **bevor** Großvorhaben angefasst werden.

### R1-1 · ApiError.code ans Frontend durchreichen (aus P3-1)
- **Nutzen:** Wenn ein Plan-Limit greift, sieht der Anwender „Limit erreicht – upgrade auf Pro" statt eines generischen Fehlers – das verwandelt eine Sackgasse in einen Upgrade-Anstoß.
- **Aufwand:** S
- **Kostenwirkung:** Direkter Umsatzhebel (macht die Plan-Gates aus P3-1 erst monetär wirksam). Der Backend-Kontrakt `PLAN_FEATURE_MISSING`/`PLAN_LIMIT_REACHED` steht bereits (WORKFLOW, Erkenntnisse P3-1) – hier fehlt nur die Frontend-Anbindung.
- **Warum ganz vorne:** Kleinster Aufwand der ganzen Liste, schließt eine offene Baustelle aus der Mission und stützt direkt das Abo-Modell (`BUSINESS_CASE.md` §3, Starter/Pro-Differenzierung).

### R1-2 · Review-Anstoß nach Auftragsabschluss (T-022)
- **Nutzen:** Der Betrieb sammelt automatisch Google-Bewertungen von zufriedenen Kunden – der stärkste Wachstumshebel für einen lokalen Dienstleister.
- **Aufwand:** M
- **Kostenwirkung:** Null Zusatzkosten – nutzt denselben Status-Mail-Mechanismus wie P3-2 (T-003), der bereits über den bestehenden SMTP-Mailer läuft (`BUSINESS_CASE.md` §1.4, Mail schon eingeplant).
- **Warum vorne:** Verkaufsargument fürs Produkt selbst („Detailly bringt euch mehr Bewertungen"), geringe Komplexität, Infrastruktur steht.

### R1-3 · Vorher/Nachher-Fotos auf der Track-Seite (T-023)
- **Nutzen:** Der Endkunde sieht das Ergebnis direkt im Track-Link – kostenloses Marketing und emotionaler „Wow"-Moment beim Abholen.
- **Aufwand:** M
- **Kostenwirkung:** Keine relevante – Fotos existieren intern bereits, Track-Link wird seit P3-2 versendet. Nur die Freigabe-Logik pro Foto ist neu (deshalb nicht S).
- **Warum vorne:** Hoher sichtbarer Wert bei moderatem Aufwand, baut direkt auf P3-2 auf.

### R1-4 · sevDesk-Sync beim CSV-Import (aus P3-4)
- **Nutzen:** Bestandskunden aus der Buchhaltung (sevDesk) landen beim Import automatisch im richtigen Datensatz – kein doppeltes Pflegen von Kundenstammdaten.
- **Aufwand:** M
- **Kostenwirkung:** Reduziert die Adoptions-Hürde für wechselnde Betriebe (der CSV-Import aus P3-4/T-007 ist laut BACKLOG die größte Kaufentscheidungs-Hürde). Kosten: ggf. sevDesk-API-Anbindung prüfen (externe Abhängigkeit).
- **Warum vorne:** Erweitert ein frisch gebautes Feature (P3-4) genau dort, wo Betriebe es beim Onboarding brauchen – hoher Adoptions-Hebel.

### R1-5 · P3-7-Feature-Parität: Signatur & Fotos auch im 2D-Schnellmodus
- **Nutzen:** Der schnelle 2D-Annahmemodus kann dasselbe wie die 3D-Erfassung (Unterschrift des Kunden, Schadensfotos) – kein Zwang mehr, für ein vollständiges Protokoll den langsameren Weg zu gehen.
- **Aufwand:** M
- **Kostenwirkung:** Keine direkte; hebt die in P3-7 bewusst zurückgestellte Funktionslücke auf. Setzt auf dem in P3-7 entschiedenen Datenmodell (Option b: ein `inspection`-Modell, zwei Erfassungsmodi) auf.
- **Warum vorne:** Schließt die letzte offene Entscheidung aus der Mission und macht den schnellen Modus alltagstauglich für den Kernprozess (Fahrzeugannahme).

**Nachgelagert im selben Horizont (sobald R1-1…R1-5 laufen):**
- **Annahmeprotokoll-PDF** (M): Die Fahrzeugannahme (inkl. Signatur/Fotos aus R1-5) als unterschriebenes PDF für Kunde und Akte – rechtlich sauberer Nachweis des Zustands bei Übergabe. Direkt nach R1-5 sinnvoll, weil es dieselben Daten bündelt; nutzt die bereits vorhandene PDF-Pipeline (Rechnungen).

---

## Horizont 2 · Mittelfristig

Größere Querschnitts- und Umsatzvorhaben. Erst starten, wenn Horizont 1 die leichtgewichtigen Endkunden-Touchpoints ausgereizt hat und echte Nachfrage aus dem Betrieb da ist.

### R2-1 · Stripe Connect – Endkunden-Online-Zahlung mit echtem Geldfluss (aus P3-4)
- **Nutzen:** Der Endkunde zahlt seine Rechnung wirklich online, das Geld fließt über die Plattform an den Betrieb (statt nur GiroCode-QR + Zahlungslink wie in P3-4). Ermöglicht später Plattform-Provision und ist Voraussetzung für echte Slot-Buchung mit Anzahlung.
- **Aufwand:** L
- **Kostenwirkung:** Neuer Kosten- und **Umsatz**-Pfad. Payment-Gebühren Stripe: 1,5 % + 0,25 € pro Transaktion (`BUSINESS_CASE.md` §1.5). Stripe Connect bringt zusätzliche Plattform-Gebühren + KYC/Compliance-Aufwand pro angeschlossenem Betrieb – vor dem Bau die aktuelle Stripe-Preisseite verifizieren. Öffnet aber die Tür zu einem Provisions-Erlösmodell (heute nur Abo).
- **Warum L und mittelfristig:** In P3-4 bewusst als Folge-Ticket herausgetrennt („bewusst KEIN Plattform-Geldfluss" für v1). Hohe rechtliche/technische Komplexität; erst bauen, wenn Betriebe die reine Zahlungs-Erinnerung nicht mehr ausreicht.

### R2-2 · React-Query-Caching / Frontend-Datencaching (T-025)
- **Nutzen:** Seitenwechsel fühlen sich spürbar schneller an, Referenzdaten (Kunden, Leistungen) werden nicht bei jedem Klick neu geladen.
- **Aufwand:** L
- **Kostenwirkung:** Keine direkte; reine Wahrnehmungs-/Performance-Verbesserung. Senkt Backend-Last leicht (weniger Requests) – bei Hetzner-Kostenmodell (`BUSINESS_CASE.md` §1.2) marginal.
- **Warum mittelfristig:** Großer Querschnittsumbau, kein Bug. Laut BACKLOG vor der Monolith-Aufteilung (T-026) zu entscheiden. Erst nach den Umsatz-Features, weil „fühlt sich schneller an" keinen Kaufabschluss bringt.

### R2-3 · Echte Slot-Buchung mit Verfügbarkeitsprüfung (T-024)
- **Nutzen:** Der Kunde bucht verbindliche Termine mit echter Verfügbarkeit statt Wunschtermin-Freitext – weniger Rückfragen, planbarere Auslastung.
- **Aufwand:** L
- **Kostenwirkung:** Keine direkte; wird durch R2-1 (Anzahlung bei Buchung) deutlich wertvoller. Konkurriert im Markt mit Shore/Planity (Termin-Software 39–50 €/Monat, `BUSINESS_CASE.md` §2.1) – ein echtes Differenzierungs-Feature.
- **Warum mittelfristig:** Ehrlich L-Aufwand mit Konflikt-/Kalender-Logik. Der Wunschtermin-Flow funktioniert nach P3-2/P3-3 ordentlich – erst bauen, wenn Betriebe verbindliche Slots aktiv nachfragen.

### R2-4 · Monolith-Seiten aufteilen + CRUD-Hook extrahieren (T-026)
- **Nutzen:** Künftige Änderungen (auch durch Agents) werden schneller und fehlerärmer – Innenwirkung, kein sichtbares Feature.
- **Aufwand:** M
- **Kostenwirkung:** Keine; senkt langfristig die Entwicklungs-Zeitkosten. Laut BACKLOG nach T-018 (Duplikate, in P3-6 erledigt).
- **Warum mittelfristig:** Reine Wartbarkeit. Prinzip: nur Seiten anfassen, an denen ohnehin gearbeitet wird – muss kein eigenes Großprojekt sein.

---

## Horizont 3 · Später / Vision

Die großen Wetten. Nur bauen, wenn die leichten Touchpoints nachweislich nicht mehr reichen und der Markt es einfordert. Manches fällt bewusst ganz weg, falls die günstigeren Vorstufen genügen.

### R3-1 · Endkunden-Portal (Login, Historie, Folgebuchung) (T-031)
- **Nutzen:** Wiederkehrgeschäft bei PPF/Keramik über Pflegeintervalle und Folgebuchungen; der Kunde hat ein echtes Konto mit Historie.
- **Aufwand:** L (größtes Einzelvorhaben der gesamten Liste)
- **Kostenwirkung:** Neue Auth-/Sicherheitsfläche (security-auditor nötig), zusätzliche DSGVO-Pflichten. Kein neuer Erlös per se, aber Kundenbindungs-Hebel.
- **Warum ganz hinten:** Setzt R1-2 (Reviews), R1-3 (Fotos) und R2-1 (Zahlung) voraus – die Token-Links decken 80 % des Werts vorher ab. **Fällt raus, falls die Token-Links (Track/Rechnung) in der Praxis reichen.** Nicht auf Verdacht bauen.

### R3-2 · PWA/Offline für den Hallen-Einsatz (T-030)
- **Nutzen:** Fahrzeugannahme, Fotos und Zeiterfassung funktionieren auch im Funkloch an der Hebebühne.
- **Aufwand:** L
- **Kostenwirkung:** Keine direkte; hohe Komplexität durch Offline-Sync-Konflikte.
- **Warum hinten:** Real (BACKLOG §5.6), aber erst nachdem R1-5 den mobilen Annahme-Flow (2D+3D, ein Datenmodell) online sauber vereinheitlicht hat. Vorher validieren, **wie oft** ein Funkloch in der Praxis wirklich auftritt – sonst Aufwand ohne Beleg.

### R3-3 · Theme-/Branchen-Präferenz am Konto speichern (T-029)
- **Nutzen:** Einstellungen wandern zwischen Geräten mit, statt pro Browser verloren zu gehen.
- **Aufwand:** S
- **Kostenwirkung:** Keine.
- **Warum hinten trotz S:** Ehrlich ein reines Komfort-Detail ohne Umsatz- oder Prozess-Hebel. Klein genug, um bei Gelegenheit „mitgenommen" zu werden, aber nie einen eigenen Sprint wert.

### R3-4 · Konventionen dokumentieren (T-028)
- **Nutzen:** Team und Agents treffen dieselben Benennungs-/Struktur-Entscheidungen ohne Raten.
- **Aufwand:** S
- **Kostenwirkung:** Keine.
- **Hinweis:** Ist bereits als **P6-2** Teil der laufenden Mission eingeplant (WORKFLOW). Hier nur der Vollständigkeit halber – gehört nicht in v2, wenn P6-2 wie geplant abgeschlossen wird.

---

## Bewusst NICHT auf der Roadmap (Scope-Schutz)

Damit die Liste ehrlich bleibt, hier explizit die Nicht-Ziele – konsistent mit dem Scope-Schutz aus `BACKLOG.md`:
- **SMS/WhatsApp-Kanal** – E-Mail (P3-2) deckt die Endkunden-Kommunikation ab; ein zweiter Kanal ist Kosten ohne belegten Mehrwert.
- **Native App / App-Store-Release** – solange Detailly Web-App bleibt: 0 € und **keine 15–30 % Store-Provision** auf die 29–49 €-Abos (`BUSINESS_CASE.md` §1.3). Eine PWA (R3-2) deckt den mobilen Bedarf günstiger.
- **Umbenennung deutscher API-Routen** – Breaking Change ohne Nutzerwert; nur dokumentieren (R3-4).
- **Marketplace/Provisionsmodell** wie Treatwell (35 % auf Erstbuchung) – passt nicht zum B2B-SaaS-Positioning; erst denkbar, wenn R2-1 (Stripe Connect) den Geldfluss überhaupt ermöglicht.

---

## Reihenfolge-Empfehlung (eine Zeile)

R1-1 → R1-2 → R1-3 → R1-4 → R1-5 → (Annahmeprotokoll-PDF) → **dann neu bewerten mit echten Nutzungsdaten** → R2-1 … → Horizont 3 nur auf belegte Nachfrage.
