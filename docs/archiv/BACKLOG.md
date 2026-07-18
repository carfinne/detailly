# Detailly – Priorisiertes Backlog

Stand: 2026-07-02 · Quelle: `AUDIT.md` (gleicher Branch) · IDs stabil für `WORKFLOW.md`.

**Priorisierungslogik (Nutzerwert × Aufwand × Risiko):**
- 🔴 **Kritisch** = blockiert Go-Live/Umsatz oder bricht den Kern-Arbeitsfluss des Betriebs. Ohne diese Punkte ist das Produkt nicht verkaufbar oder verliert Geld.
- 🟡 **Wichtig** = spürbarer täglicher Nutzen oder reales technisches Risiko, aber kein Blocker. Meist S/M-Aufwand mit hohem Hebel.
- 🟢 **Nice-to-have** = echter, aber nachgelagerter Wert — oder Ideen, die erst nach Validierung Aufwand rechtfertigen (Scope-Schutz: bewusst KEIN Endkunden-Portal, keine Slot-Engine, kein PWA-Umbau vor den 🔴/🟡-Punkten).
- **Bewusst gestrichen (kein Gold-Plating):** SMS/WhatsApp-Kanal (E-Mail reicht für v1), Web-Push, Backend-Service-Aufteilung nach Zeilenzahl (kein Nutzerwert, nur bei Anlass), Umbenennung deutscher API-Routen (Breaking Change ohne Nutzen — nur dokumentieren).

Aufwand: S = ≤ 0,5 Tag · M = 1–3 Tage · L = > 3 Tage.

---

## 🔴 Kritisch

### T-001 · DB-Migrations-Baseline erstellen
- **Nutzen:** Der Betrieb kann überhaupt erst produktiv gehen und Updates erhalten, ohne dass seine Daten bei jedem Deploy gefährdet sind.
- **Aufwand:** M · **Agent:** backend-dev (Review: architect)
- **Abhängigkeiten:** keine — muss aber als LETZTES gemergt werden, nachdem alle schema-ändernden Tickets durch sind (siehe Memory: Dev-Spalten ohne Prod-Migration).
- **Begründung:** Höchstes technisches Risiko im Audit (§6); ohne Baseline ist jedes andere Ticket nicht auslieferbar.

### T-002 · Plan-Limits und Feature-Gates durchsetzen
- **Nutzen:** Der Anbieter verdient mit Pro-Plänen tatsächlich Geld; Starter-Kunden erhalten den Umfang, für den sie zahlen.
- **Aufwand:** M · **Agent:** backend-dev (Konzept: architect)
- **Abhängigkeiten:** keine
- **Begründung:** Direktes Umsatzrisiko (§6, hoch): `maxUsers/maxLocations/maxCustomers` und `features[]` existieren nur als Daten, nirgends als Prüfung.

### T-003 · Automatische Statuskommunikation an Endkunden
- **Nutzen:** Der Kunde erhält Track-Link, „abholbereit“- und Terminbestätigungs-Mail automatisch — der Betrieb spart Anrufe und wirkt professionell.
- **Aufwand:** M · **Agent:** backend-dev
- **Abhängigkeiten:** keine (Mail-Infrastruktur und Track-Token existieren bereits)
- **Begründung:** Gap Nr. 1 in §5: der Track-Link ist gebaut, wird aber nie versendet — maximaler Nutzerwert für minimalen Restaufwand.

### T-004 · Anfrage → Auftrag durchgängig machen
- **Nutzen:** „Annehmen“ übernimmt Leistung/Fahrzeug/Kunde direkt in einen Auftrag statt 12–16 Klicks Neuerfassung über 4 Seiten.
- **Aufwand:** M · **Agent:** backend-dev + frontend-dev
- **Abhängigkeiten:** keine
- **Begründung:** Größter Flow-Bruch im täglichen Kerngeschäft (§4.1); betrifft jeden einzelnen Online-Auftrag.

### T-005 · Impressum/Datenschutz-Platzhalter ersetzen
- **Nutzen:** Der Betrieb kann rechtssicher live gehen (Abmahnrisiko in DE).
- **Aufwand:** S · **Agent:** tech-writer (Inhalte liefert der Betreiber)
- **Abhängigkeiten:** Betreiber-Input (Firmendaten)
- **Begründung:** Expliziter Go-Live-Blocker (§6); Aufwand minimal.

---

## 🟡 Wichtig

### T-006 · Online-Zahlung für Endkunden-Rechnungen
- **Nutzen:** Kunde zahlt per Klick auf `/rechnung?t=` — schnelleres Geld, weniger Mahnläufe.
- **Aufwand:** M · **Agent:** backend-dev
- **Abhängigkeiten:** keine (Stripe-Anbindung existiert fürs SaaS-Abo)
- **Begründung:** Hoher Wert, moderater Aufwand (Payment Link statt Vollintegration); knapp unter 🔴, weil PDF+Mahnwesen heute funktionieren.

### T-007 · CSV-Import für Kunden und Fahrzeuge
- **Nutzen:** Wechselnde Betriebe bringen ihre 500 Bestandskunden in Minuten statt Tagen ins System.
- **Aufwand:** M · **Agent:** backend-dev + frontend-dev
- **Abhängigkeiten:** keine
- **Begründung:** Größte Adoptions-Hürde (§5.7); entscheidet über Kaufabschluss, aber blockiert Bestandskunden nicht.

### T-008 · Onboarding-Checkliste + Empty-States mit CTA
- **Nutzen:** Neuer Betrieb sieht auf dem leeren Dashboard sofort die nächsten Schritte statt einer toten Seite.
- **Aufwand:** M · **Agent:** ux-designer (Konzept) + frontend-dev
- **Abhängigkeiten:** profitiert von T-007 (Import als Checklisten-Schritt)
- **Begründung:** Adoption-Gap (§5.8 + §4.3); bewusst Checkliste statt Wizard/Tour — kleinster Umfang mit gleichem Effekt.

### T-009 · Fehlende Paginierung + Speicher-Auswertung Standorte
- **Nutzen:** Die App bleibt auch bei wachsendem Datenbestand schnell und stürzt nicht ab.
- **Aufwand:** M · **Agent:** backend-dev
- **Abhängigkeiten:** keine
- **Begründung:** Reales Skalierungsrisiko (§6, deckt sich mit Perf-Audit-Memory); heute noch nicht sichtbar, daher 🟡.

### T-010 · Pagination-Clamp vereinheitlichen (inkl. Customers-Bug)
- **Nutzen:** `limit=0/negativ` liefert keine leere Kundenliste mehr; eine Stelle statt drei Kopien.
- **Aufwand:** S · **Agent:** backend-dev (Test: qa-tester)
- **Abhängigkeiten:** vor/mit T-009 erledigen (gleiche Baustelle)
- **Begründung:** Verifizierter Bug (§3.2/§6) mit Mini-Aufwand.

### T-011 · window.confirm durch Modal ersetzen + DSGVO-Löschung absichern
- **Nutzen:** Kein ungestylter OS-Dialog mehr; die unwiderrufliche Anonymisierung ist klar vom normalen Speichern getrennt.
- **Aufwand:** S · **Agent:** frontend-dev (Pattern-Review: ux-designer)
- **Abhängigkeiten:** keine (Modal-Komponente existiert)
- **Begründung:** 5 Fundstellen + echtes Datenverlust-Risiko im CustomerFormModal (§3.3/§4.2).

### T-012 · Formular-Feedback: Pflichtfelder, Inline-Fehler, Toasts
- **Nutzen:** Der Anwender sieht vor dem Absenden, was fehlt, und bekommt nach dem Speichern eine Bestätigung.
- **Aufwand:** M · **Agent:** ux-designer (Standard definieren) + frontend-dev
- **Abhängigkeiten:** keine
- **Begründung:** 3 parallele Kennzeichnungs-Systeme + null Erfolgs-Feedback (§4.2) — täglich spürbar.

### T-013 · Plantafel-Loading + restliche Loading/Empty-Lücken
- **Nutzen:** Leeres Terminraster ist nicht mehr von „lädt noch“ unterscheidbar; Fahrzeugannahme/Buchhaltung/Abo zeigen Ladezustand.
- **Aufwand:** S · **Agent:** frontend-dev
- **Abhängigkeiten:** keine
- **Begründung:** Verifizierter Rendering-Fehler (§4.3) mit S-Aufwand; das Muster existiert bereits überall sonst.

### T-014 · Sichtbare Textfehler: „Auftraege“/„Oeffnen“, „Rechnungen“ vs. „Belege“
- **Nutzen:** Keine peinlichen Umlaut-Fehler in der bezahlten Oberfläche; Nav und Seitentitel heißen gleich.
- **Aufwand:** S · **Agent:** frontend-dev
- **Abhängigkeiten:** keine
- **Begründung:** Trivialer Aufwand, direkter Premium-Eindruck (§3.3, Design-Standard-Memory).

### T-015 · Theming-Brüche: 3D-Szene + Grid-Hintergrund Hell-Thema
- **Nutzen:** 3D-Schadenserfassung und Public-Seiten respektieren Hell-Thema und Branchen-Akzent wie der Rest der App.
- **Aufwand:** S · **Agent:** frontend-dev
- **Abhängigkeiten:** keine (Vorbild `FahrzeugDiagramm.tsx` existiert)
- **Begründung:** Einzige echten Theming-Verstöße in einem sonst sauberen Design-System (§3.3).

### T-016 · Mobile: Modal-Grids mit Breakpoints
- **Nutzen:** Auftrags-, Kunden- und Plantafel-Modals sind auf dem Handy in der Halle benutzbar.
- **Aufwand:** S · **Agent:** frontend-dev
- **Abhängigkeiten:** keine (Konvention `grid-cols-1 sm:grid-cols-2` existiert)
- **Begründung:** Zielgruppe arbeitet am Fahrzeug mit dem Handy (§4.4); billiger Fix.

### T-017 · Inline-Kundenanlage + Aktionen in der Kundenakte
- **Nutzen:** Kunde direkt im Auftrags-/Termin-Modal anlegen; aus der Kundenakte heraus „Neuer Auftrag“/„Fahrzeug hinzufügen“ starten.
- **Aufwand:** M · **Agent:** frontend-dev (Flows: ux-designer)
- **Abhängigkeiten:** sinnvoll nach T-012 (nutzt dasselbe Formular-Feedback)
- **Begründung:** Zwei Sackgassen im Kern-Flow (§4.1) — hoher Alltagsnutzen.

### T-018 · Duplikate konsolidieren (Public-Shell, Token-Helper, Labels, KPI, Rollen)
- **Nutzen:** Design- und Rollen-Änderungen brauchen einen Edit statt zehn — weniger künftige Bugs für den Anwender.
- **Aufwand:** M · **Agent:** frontend-dev + backend-dev (Schnitt: architect)
- **Abhängigkeiten:** vor größeren UI-Tickets (T-008/T-017) einplanen, sonst wächst die Kopienzahl
- **Begründung:** Verifizierte Drift-Risiken (§3.2), Rollen-Enum-Drift ist real schon passiert (Memory).

### T-019 · Doppelstruktur Fahrzeugannahme (2D) vs. Schadenserfassung (3D) auflösen
- **Nutzen:** Der Anwender weiß eindeutig, welches Werkzeug er wann nutzt; Daten landen an einem Ort.
- **Aufwand:** M · **Agent:** architect (Entscheidung) + ux-designer, danach frontend-dev/backend-dev
- **Abhängigkeiten:** Entscheidung vor Umsetzung; berührt T-001 (Schema)
- **Begründung:** Struktureller Verwirrungspunkt (§4.1); erst Konzept, dann Code — kein blindes Zusammenlegen.

### T-020 · Abo-Sperre: fail-open absichern
- **Nutzen:** Ein vergessener Abo-Datensatz führt nicht mehr zu unbemerkter Gratisnutzung.
- **Aufwand:** S · **Agent:** backend-dev (Review: security-auditor)
- **Abhängigkeiten:** mit T-002 zusammen umsetzen (gleicher Code-Pfad)
- **Begründung:** Bewusste, aber riskante Entscheidung (§6); als Beifang von T-002 fast gratis.

### T-021 · Suche/Filter für Aufträge- und Fahrzeuge-Listen
- **Nutzen:** Der Betrieb findet einen Auftrag/ein Fahrzeug in Sekunden statt per Scrollen.
- **Aufwand:** M · **Agent:** frontend-dev
- **Abhängigkeiten:** Backend-Query-Support ggf. mit T-009
- **Begründung:** Rechnungen zeigen das Muster bereits (§2.10); klickbare Spalten-Sortierung bewusst weggelassen (Gold-Plating), Suche+Status-Filter reichen.

---

## 🟢 Nice-to-have

### T-022 · Review-Anstoß nach Auftragsabschluss
- **Nutzen:** Der Betrieb sammelt automatisch Google-Bewertungen von zufriedenen Kunden.
- **Aufwand:** M · **Agent:** backend-dev
- **Abhängigkeiten:** T-003 (nutzt denselben Status-Mail-Mechanismus)
- **Begründung:** Echter Wert, aber erst sinnvoll, wenn Status-Mails (T-003) existieren.

### T-023 · Vorher/Nachher-Fotos auf der Track-Seite
- **Nutzen:** Der Endkunde sieht das Ergebnis direkt im Track-Link — kostenloses Marketing für den Betrieb.
- **Aufwand:** M · **Agent:** frontend-dev + backend-dev (Freigabe-Logik: security-auditor)
- **Abhängigkeiten:** T-003 (Track-Link muss erst versendet werden)
- **Begründung:** Fotos existieren intern (§5.9); Freigabe pro Foto nötig, daher nicht trivial.

### T-024 · Echte Slot-Buchung mit Verfügbarkeitsprüfung
- **Nutzen:** Kunde bucht verbindliche Termine statt Wunschtermin-Freitext.
- **Aufwand:** L · **Agent:** architect (Konzept) + backend-dev + frontend-dev
- **Abhängigkeiten:** T-004 (Anfrage-Flow erst begradigen), T-003 (Bestätigungsmail)
- **Begründung:** Ehrlich 🟢: L-Aufwand, und der Wunschtermin-Flow funktioniert nach T-003/T-004 ordentlich. Erst bauen, wenn Betriebe es nachfragen.

### T-025 · Frontend-Datencaching (z. B. React Query)
- **Nutzen:** Seitenwechsel fühlen sich schneller an, Referenzdaten werden nicht ständig neu geladen.
- **Aufwand:** L · **Agent:** frontend-dev (Schnitt: architect)
- **Abhängigkeiten:** vor Monolith-Aufteilung T-026 entscheiden
- **Begründung:** Spürbar, aber kein Bug; großer Querschnittsumbau → erst nach den 🟡-Fixes.

### T-026 · Monolith-Seiten aufteilen + CRUD-Hook extrahieren
- **Nutzen:** Künftige Änderungen (auch durch Agents) werden schneller und fehlerärmer.
- **Aufwand:** M · **Agent:** frontend-dev (Schnitt: architect)
- **Abhängigkeiten:** nach T-018 (erst Duplikate, dann Struktur)
- **Begründung:** Reine Innenwirkung; nur Seiten anfassen, an denen ohnehin gearbeitet wird.

### T-027 · Dead Code + kleine Konsistenzfixes
- **Nutzen:** Weniger Irrwege für alle, die im Code arbeiten (`serverUrl()`, `VehicleIntake`, Sortier-Ausreißer, Modal-Overlay-Farbe, STATUS_BADGE-Map).
- **Aufwand:** S · **Agent:** frontend-dev + backend-dev
- **Abhängigkeiten:** keine
- **Begründung:** Verifiziert tot (§3.1); S-Aufwand, aber null Anwendernutzen → 🟢.

### T-028 · Konventionen dokumentieren (Benennung, Controller-Prefixe, Typografie)
- **Nutzen:** Team und Agents treffen dieselben Entscheidungen, ohne raten zu müssen.
- **Aufwand:** S · **Agent:** tech-writer (Input: architect)
- **Abhängigkeiten:** nach T-018 (Konventionen erst festzurren, dann aufschreiben)
- **Begründung:** Dokumentieren statt umbenennen — API-Routen-Umbenennung wäre Breaking Change ohne Nutzerwert.

### T-029 · Theme-/Branchen-Präferenz am Konto speichern
- **Nutzen:** Einstellungen wandern zwischen Geräten mit statt pro Browser verloren zu gehen.
- **Aufwand:** S · **Agent:** backend-dev + frontend-dev
- **Abhängigkeiten:** keine
- **Begründung:** Komfort-Detail (§2.4); ehrlich klein und nachgelagert.

### T-030 · PWA/Offline für den Hallen-Einsatz
- **Nutzen:** Fahrzeugannahme, Fotos und Zeiterfassung funktionieren auch im Funkloch an der Hebebühne.
- **Aufwand:** L · **Agent:** architect (Offline-Queue-Konzept) + frontend-dev
- **Abhängigkeiten:** T-016 (Mobile erst mal online sauber), T-019 (nicht zwei Annahme-Flows offline-fähig machen)
- **Begründung:** Real (§5.6), aber L-Aufwand mit hoher Komplexität (Sync-Konflikte); erst validieren, wie oft Funkloch wirklich auftritt.

### T-031 · Endkunden-Portal (Login, Historie, Folgebuchung)
- **Nutzen:** Wiederkehrgeschäft bei PPF/Keramik über Pflegeintervalle und Folgebuchungen.
- **Aufwand:** L · **Agent:** architect + backend-dev + frontend-dev + security-auditor
- **Abhängigkeiten:** T-003, T-006, T-022 (die Token-Links + Zahlung + Reviews decken 80 % des Werts vorher ab)
- **Begründung:** Bewusst ganz hinten: größtes Einzelvorhaben im Backlog; erst bauen, wenn die leichtgewichtigen Endkunden-Touchpoints ausgereizt sind. Fällt raus, falls Token-Links in der Praxis reichen.

---

## Reihenfolge-Hinweise für WORKFLOW.md

1. **T-001 zuletzt mergen**, aber sofort vorbereiten — alle schema-ändernden Tickets (T-002, T-004, T-019, ggf. T-006/T-023) davor.
2. **Bündel „Endkunden-Kommunikation“:** T-003 → T-022 → T-023 teilen sich Mail-/Token-Infrastruktur.
3. **Bündel „Backend-Hygiene“:** T-009 + T-010 + T-020 in einem Zug.
4. **Bündel „UI-Polish“:** T-013 + T-014 + T-015 + T-016 sind vier S-Tickets für einen Tag frontend-dev.
5. **T-018 vor T-008/T-017/T-026**, damit neue Features keine neuen Kopien erzeugen.
