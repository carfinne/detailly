# Detailly – Vollanalyse (Architektur-Audit)

Stand: 2026-07-02 · Branch `claude/exciting-zhukovsky-260ef1` · Basis: 6 Scout-Reports
(Frontend/Backend-Inventar, Design-Konsistenz, UX-Flows, Dead-Code, Feature-Gaps),
kritische Behauptungen im Code nachgeprüft. Alle Pfade relativ zur Repo-Wurzel.

**Umfang:** Frontend 75 Quelldateien (davon 45 App-Routen-Dateien) / ~18.300 Zeilen (Next.js 14, statischer Export via
`output: 'export'` in `frontend/next.config.js`) · Backend 31 NestJS-Module, 36 Entities,
globales Prefix `api/v1` (`backend/src/main.ts`), Frontend wird per ServeStatic mitgeliefert
(`backend/src/app.module.ts`).

---

## 1. App-Struktur & Navigationsfluss

### 1.1 Routen-Baum (frontend/src/app)

```
/                               Landing (1.205 Z., größte Datei; eingeloggte User → Dashboard)
│
├─ Öffentlich (ohne Login)
│  ├─ /login  /registrieren  /passwort-vergessen  /passwort-zuruecksetzen  /email-bestaetigen
│  ├─ /abo-gesperrt             Sperrseite bei 403 SUBSCRIPTION_INACTIVE
│  ├─ /buchen?b=<slug>          Online-Terminanfrage eines Betriebs
│  ├─ /status?ref=AF-…          Status einer Anfrage
│  ├─ /track?t=<Token>          Auftrags-Tracking „Wo ist mein Auto?"
│  ├─ /rechnung?t=<Token>       Öffentlicher Beleg-Download (PDF)
│  ├─ /haendler?t=<Token>       Händler-Portal Marktplatz
│  └─ /impressum  /datenschutz  (mit markierten Go-Live-Platzhaltern, components/legal.tsx)
│
└─ App-Shell (app)/ – Login-Guard in (app)/layout.tsx, Sidebar + Topbar
   ├─ Übersicht    dashboard (523 Z.)
   ├─ Betrieb      auftraege (+detail) · plantafel · anfragen · fahrzeugannahme ·
   │               schadenserfassung (3D, 851 Z.) · zeiterfassung · kalkulation
   ├─ Stammdaten   kunden (+detail) · fahrzeuge (+detail) · leistungen
   ├─ Finanzen     rechnungen · buchhaltung · auswertungen · abo (nur owner)
   ├─ Organisation mitarbeiter · standorte · shop · marktplatz (563 Z.) ·
   │               einstellungen · audit · hilfe
   └─ Plattform    abos · plattform-analysen · plattform-marktplatz (602 Z.) · plattform-support
```

### 1.2 Navigationsfluss

- **Eine Nav-Quelle:** `frontend/src/components/nav-data.tsx` (6 Gruppen, Rollen-Filter je
  Eintrag, Live-Badge für neue Anfragen) speist Sidebar (`Sidebar.tsx`) UND MobileNav
  (`MobileNav.tsx`) — vorbildlich, keine Drift möglich.
- **Topbar** (`Topbar.tsx`): ⌘K-CommandPalette (globale Suche → Kunden/Fahrzeuge/Aufträge/
  Rechnungen/Termine), NotificationBell (`/reminders`), Zahnrad, Profilmenü.
- **Detailrouten per Query-Param** statt `[id]`-Segmenten (`/auftraege/detail/?id=…`) —
  Folge des statischen Exports; Token-Seiten lesen bewusst `window.location`
  (Kommentar in `frontend/src/app/track/page.tsx`).
- **Guards:** `(app)/layout.tsx` → Redirect `/login`; zentral in `frontend/src/lib/api.ts`:
  401 → `/login/`, `SUBSCRIPTION_INACTIVE` → `/abo-gesperrt/`.
- **Öffentliche Flüsse:** Betrieb teilt `/buchen?b=` → Kunde erhält Referenz → `/status?ref=`;
  Auftrag → Freigabe-Token → `/track?t=`; Rechnung → `/rechnung?t=`; Plattform stellt
  Händler-Token aus → `/haendler?t=`.
- **State:** kein React-Query/Redux — überall `useEffect`+`useState` gegen den zentralen
  Fetch-Client `frontend/src/lib/api.ts`; einziger Context ist `AuthProvider`
  (`frontend/src/lib/auth.tsx`); Branchen-Theming per DOM-Attribut + localStorage
  (`frontend/src/lib/branche.tsx`).

---

## 2. Feature-Inventar (vorhanden vs. fehlend)

| # | Feature | Status | Beleg |
|---|---|---|---|
| 1 | Auftrag→Rechnung inkl. Mahnwesen (Stufen 1–3), PDF, DATEV-Export | vorhanden | `backend/src/invoices/` (Service 861 Z., `invoice-pdf.ts`, `accounting-export.service.ts`) |
| 2 | 3D-Schadenserfassung mit Signatur, Carry-over, 2D-Fallback | vorhanden | `backend/src/inspection/`, `frontend/src/app/(app)/schadenserfassung/page.tsx` |
| 3 | Globale Suche (⌘K) | vorhanden | `backend/src/search/search.service.ts`, `frontend/src/components/CommandPalette.tsx` |
| 4 | Dark/Light + 3 Branchen-Akzente | vorhanden | `frontend/src/app/globals.css` (`:root`, `[data-theme]`, `[data-branche]`); Präferenz nur in localStorage, nicht am Konto |
| 5 | Kundenprofil mit Historie (Fahrzeuge/Aufträge/Belege/KPIs) | vorhanden | `frontend/src/app/(app)/kunden/detail/page.tsx:24–68` |
| 6 | Vorher/Nachher-Fotos (intern) | vorhanden | `backend/src/orders/entities/order.entity.ts:97–98`, `frontend/src/components/FotoBereich.tsx` — aber NICHT auf der öffentlichen Track-Seite |
| 7 | SaaS-Abo mit Stripe (Checkout/Portal/Webhook) | vorhanden | `backend/src/billing/` — aber Plan-Limits/Features nicht durchgesetzt (s. §6) |
| 8 | Multi-Standort, Shop/Lager, B2B-Marktplatz, Zeiterfassung, Audit-Log, DSGVO-Export/Anonymisierung | vorhanden | `backend/src/locations|shop|marketplace|zeiterfassung|audit|gdpr/` |
| 9 | Onboarding neuer Betriebe | teilweise | Registrierung + E-Mail-Verifizierung + Hilfe-Q&A ja; kein Wizard/Checkliste/Tour — neuer Nutzer landet auf leerem Dashboard (Grep `Onboarding\|Tour\|Checkliste` in `frontend/src` → nur Hilfetexte) |
| 10 | Listen-Filter/Sortierung | teilweise | Rechnungen: Suche+Status-Tabs (`rechnungen/page.tsx:218`); Aufträge/Fahrzeuge ohne Suche/Filter; klickbare Spalten-Sortierung nirgends |
| 11 | Erinnerungen/Benachrichtigungen | teilweise | In-App-Glocke (`backend/src/reminders/`) + Mahn-/Rechnungsmails; kein Web-Push, keine Termin-/Status-Mails an Endkunden |
| 12 | Online-Buchung | teilweise | Nur Wunschtermin-Anfrage (`backend/src/public-booking/`); keine Slot-Verfügbarkeit, keine Bestätigungsmail bei Annahme (kein `mail.send` in `booking-requests.service.ts`, verifiziert) |
| 13 | Offline/PWA | **fehlt** | Kein Service Worker, kein Manifest (Grep `serviceWorker\|manifest\|workbox` in `frontend/` → 0) |
| 14 | Bewertungen/Reviews | **fehlt** | Null Feature-Code (Grep `review\|rating\|Bewertung` → nur Kommentare) |
| 15 | Online-Zahlung für Endkunden-Rechnungen | **fehlt** | `/rechnung?t=` bietet nur PDF-Download (`frontend/src/app/rechnung/page.tsx`); Stripe nur fürs SaaS-Abo |
| 16 | Endkunden-Portal | **fehlt** | Nur 3 Token-Einweglinks, kein Kunden-Login/Historie/Folgebuchung |
| 17 | CSV-/Datenimport für Bestandskunden | **fehlt** | Grep `csv\|import` in `backend/src/customers/` → 0 |
| 18 | Automatische Statuskommunikation (Track-Link-Versand, „abholbereit") | **fehlt** | Kein `mail.send` bei Statuswechsel in `backend/src/orders/orders.service.ts` |

---

## 3. Inkonsistenzen

### 3.1 Toter/verdächtiger Code (verifiziert)

- **Tot:** `serverUrl()` in `frontend/src/lib/api.ts:60` — 0 Aufrufe im gesamten Repo
  (nachgeprüft per Grep); real laufen Datei-URLs über `authedFileUrl()`/`absoluteApiUrl()`.
- **Tot:** Typ `VehicleIntake` in `frontend/src/lib/types.ts` — einziger Treffer ist die
  Definition; `fahrzeugannahme/page.tsx` typisiert lokal.
- **Verdächtig, aber dokumentiert:** `backend/src/database/loadtest-seed.ts` (manuelles
  Skript, in keinem npm-Script registriert).
- **Kein Ballast sonst:** keine `.bak/.old`-Dateien, kein `public/`-Ordner, keine verwaisten
  Komponenten (alle haben echte Imports; `routeIcon()` wird von `ui.tsx` genutzt).

### 3.2 Duplikate mit Drift-Risiko

| Duplikat | Fundstellen | Abweichung |
|---|---|---|
| Pagination-Clamp 3× | `orders.service.ts:160`, `invoices.service.ts:268`, `customers.service.ts:25` | Customers OHNE untere Klammer (`Math.min(100, query.limit ?? 25)`, verifiziert): `limit=0/negativ` → leere Liste; Default 25 statt 50; von `list-pagination.spec.ts` ungetestet |
| Public-Shell (Glows+Grid+Logo-Kachel) 10× | u. a. `app/login/page.tsx:35`, `app/buchen/page.tsx:118`, `app/track/page.tsx` | wortgleicher Copy-Paste; Design-Änderung = 10 Edits |
| Auto-Logo-SVG 8× inline + Wortmarke 5× | trotz zentraler `frontend/src/lib/icons.tsx` | — |
| KPI-Kachel 3× lokal | `abos/page.tsx:18`, `auswertungen/page.tsx:135`, `plattform-analysen/page.tsx:69` | Wertgröße 1.25/1.5/1.75rem je Seite verschieden, obwohl `.kpi-value`-Token existiert (globals.css Z. 356) |
| `BEREICH_LABEL` 3× wortgleich | `plattform-marktplatz/page.tsx:44`, `haendler/page.tsx:45`, `marktplatz/page.tsx:22` | gehört nach `lib/labels.ts` |
| Token-Generierung `randomBytes(24).toString('hex')` 6× | `calendar.service.ts:86`, `invoices.service.ts:558/573`, `marketplace.service.ts:416`, `orders.service.ts:379/391` | Helper fehlt |
| Rollen-Arrays + Typen doppelt | `nav-data.tsx:25–35`, `standorte/page.tsx:587` u. a.; lokale Interfaces neben `lib/types.ts` (z. B. `BookingRequest` in `anfragen/page.tsx`) | Rollen-Enum-Änderung erfordert viele Edits (im Backend bereits passiert, s. Memory) |
| CommandPalette + 7 Nav-Einträge mit eigenen Inline-SVGs | `CommandPalette.tsx:25–52`, `nav-data.tsx:46/65/71/86/97/103/109` | Icons weichen von `ICON_PATHS` ab; `PageHeader` kann für diese Routen kein Icon auflösen |

### 3.3 Uneinheitliche Styles (Design-System sonst sehr sauber: 0 Hex in `app/`-Seiten)

- **Theming-Bruch 3D:** `frontend/src/components/Inspection3D/Scene3D.tsx:20/25–27/253`
  hartkodiert Kupfer, Semantikfarben und dunklen Hintergrund `#0b0d11` — ignoriert
  Hell-Thema und Branchen-Akzent (folierung/ppf). Vorbild: `FahrzeugDiagramm.tsx` nutzt
  `rgb(var(--…))`.
- **Grid-Hintergrund kaputt im Hell-Thema:** 6 Public-Seiten setzen `rgba(255,255,255,0.5)`
  inline statt Token `--grid-line` (verifiziert `login/page.tsx:41`; ebenso registrieren,
  buchen, rechnung, status, track). Landing/Dashboard nutzen das Token korrekt.
- **Typografie-Drift:** H1 mischt `display-xl`/`text-3xl`/`text-2xl`; Micro-Labels in
  5 Varianten + 32 arbitrary `text-[10/11px]`; 10 verschiedene `tracking`-Werte.
- **20 Ad-hoc-Karten** statt `.card`/`.panel` (u. a. `dashboard/page.tsx:84` = exakte
  `.card`-Kopie); Padding-Drift p-6/p-5/px-4 py-3.5; Radius 2xl vs. xl.
- **5× `window.confirm`** (ungestylte OS-Dialoge) trotz vorhandenem `Modal`:
  `anfragen:110`, `auftraege/detail:51`, `einstellungen:218`, `plantafel:186`,
  `schadenserfassung:530` — inkl. DSGVO-Löschung im `CustomerFormModal.tsx:85–90`.
- **Sichtbare Umlaut-Fehler in der UI:** `title="Auftraege"` und Button „Oeffnen"
  (`auftraege/page.tsx:127/180`, verifiziert) neben korrektem „Aufträge" in der Nav;
  Nav „Rechnungen" vs. Seitentitel „Belege" (`rechnungen/page.tsx:212`).
- Kleinere: Modal-Overlay `bg-black/70` vs. `bg-ink-950/70`; Fokus-Ring-Opazität 20–60
  gemischt; lokale `STATUS_BADGE`-Map in `anfragen/page.tsx:23` trotz `lib/labels.ts`;
  Branchen-Hex doppelt in `lib/branche.tsx:21–39` und globals.css.

### 3.4 Unlogische Sortierung / Benennung

- **Sortier-Ausreißer:** `locations.service.ts:43` `createdAt ASC` und
  `employees.service.ts:76` `createdAt DESC` — beides Stammdaten, übrige sortieren
  `name ASC`; Bewegungsdaten sonst konsistent `createdAt DESC`.
- **Benennung gemischt:** 3 deutsche API-Routen (`fahrzeugannahme`, `zeiterfassung`,
  `public/haendler`) unter 36 englischen Prefixen; Komponenten/libs deutsch+englisch
  gemischt (`FahrzeugDiagramm` vs. `CustomerFormModal`); faktische Konvention
  (Frontend-Routen deutsch, Backend englisch) nirgends dokumentiert.
- **Mehrfach belegte Controller-Prefixe:** `customers` (customers + gdpr), `orders`
  (+order-photo), `billing` (+webhook); `inspection.controller.ts:38` ohne Prefix —
  erschwert Endpoint-Suche.

---

## 4. UX-Schwächen

### 4.1 Flow-Brüche (zu viele Klicks)

- **Größter Bruch: Anfrage → Auftrag.** „Annehmen" erzeugt Termin + optional Kunde, aber
  **keinen Auftrag** (verifiziert: `backend/src/public-booking/booking-requests.service.ts`
  erstellt kein Order-Objekt) — Leistung/Fahrzeug aus der Anfrage müssen unter `/auftraege`
  komplett neu erfasst werden. Gesamtkette Anfrage→Rechnung: **~12–16 Klicks über 4 Seiten**.
  Zum Vergleich: Auftrag→Rechnung allein ist mit 2 Klicks sehr gut
  (`auftraege/detail/page.tsx:254–272`).
- **Kein Inline-Anlegen von Kunden** in Auftrags-/Termin-/Inspektions-Modals — Modal
  schließen, `/kunden`, anlegen, zurück, Formularstand weg (`auftraege/page.tsx:202`).
- **Kundenakte ist Sackgasse:** `kunden/detail/page.tsx` zeigt alles, bietet aber keine
  Aktionen („Neuer Auftrag", „Fahrzeug hinzufügen").
- **Doppelstruktur Schadenserfassung:** `fahrzeugannahme` (2D) und `schadenserfassung` (3D)
  stehen gleichrangig in der Nav (`nav-data.tsx:47–48`), speichern in getrennte Backends
  (`intake/` vs. `inspection/`) und kennen einander nicht — unklar, wann was.
- **Rechnungsliste überladen:** bis zu 6 `text-xs`-Aktionslinks pro Zeile
  (`rechnungen/page.tsx:305–370`), keine Beleg-Detailseite.

### 4.2 Fehlende Hierarchie / Führung

- Pflichtfelder in **3 parallelen Systemen** gekennzeichnet (`*` nur im
  NeueInspektionModal, „(optional)"-Suffix in buchen/registrieren, gar nichts im
  `CustomerFormModal.tsx:99–127` — leerer Kunde absendbar, Feedback nur als
  Server-Sammelfehler); nirgends feldbezogene Inline-Fehler.
- DSGVO-Löschung („anonymisieren") im selben Dialog wie normales Speichern, abgesichert
  nur durch `window.confirm` (`CustomerFormModal.tsx:129–140`).
- Kein Toast-/Erfolgs-Feedback-System (Grep „toast" → 0); Modal schließt nach dem
  Anlegen kommentarlos.

### 4.3 Empty/Loading/Error-Lücken (Muster sonst konsequent: Loading→Error→Empty→Daten)

| Seite | Lücke | Beleg |
|---|---|---|
| Plantafel | `loading` wird gesetzt, aber **nie gerendert** → leeres Raster sieht aus wie „keine Termine" (verifiziert: `loading` nur in Z. 83 State + Z. 140 Effect-Dep) | `plantafel/page.tsx` |
| Fahrzeugannahme | kein Loading-State, Selects während des Ladens leer | `fahrzeugannahme/page.tsx:45–55` |
| Buchhaltung | kein Loading-Skeleton | `buchhaltung/page.tsx` |
| Abo | kein Empty bei leerem `plans[]` | `abo/page.tsx:181–253` |
| Aufträge/Kunden | Empty ohne CTA („Ersten Auftrag anlegen") obwohl `Empty` eine `action`-Prop hat | `auftraege/page.tsx:140`, `kunden/page.tsx:67`, `ui.tsx:61–72` |

### 4.4 Mobile

- Fundament da (Drawer, `overflow-x-auto`-Tabellen), aber **fixe `grid-cols-2/3/12` in
  Modals ohne Breakpoint** quetschen auf 375 px: Auftrags-Modal (`auftraege/page.tsx:195,
  249–284`), `CustomerFormModal.tsx:109–123`, Plantafel-Modal (Z. 242/248). Die richtige
  Konvention (`grid-cols-1 sm:grid-cols-2`) existiert im selben Code (`buchen/page.tsx:188`).
- Plantafel `min-w-[680px]` ohne automatische Tagesansicht auf schmalen Viewports.

---

## 5. Was eine Premium-Detailing-App 2026 haben MUSS, aber fehlt

Kernthese (aus Feature-Gap-Report, im Code bestätigt): Die interne Tiefe ist überraschend
groß — die Lücken liegen fast komplett an der **Endkunden-Schnittstelle** und bei
**Adoption**. Genau diese Punkte entscheiden über den wahrgenommenen Premium-Unterschied,
weil Endkunden-Touchpoints ab Tag 1 sichtbar sind.

1. **Proaktive Kundenkommunikation.** Track-Link existiert, wird aber nie versendet;
   kein `mail.send` bei Statuswechsel (`orders.service.ts`), keine „abholbereit"-Mail,
   keine Terminbestätigung bei Anfrage-Annahme, kein SMS/WhatsApp. Erwartungshaltung 2026
   (Tesla-Service-App-Niveau) verlangt das.
2. **Online-Zahlung für Endkunden-Rechnungen.** `/rechnung?t=` = nur PDF; ein
   „Jetzt bezahlen"-Link (Stripe Payment Link) würde den bereits gebauten Mahnprozess
   direkt entlasten.
3. **Echte Slot-Buchung statt Wunschtermin-Freitext** mit Verfügbarkeitsprüfung gegen die
   Plantafel + Bestätigungsmail (`public-booking/` hat weder `slot` noch `availability`).
4. **Endkunden-Portal** (Login, Fahrzeug-/Auftragshistorie, Dokumente, Folgebuchung) —
   bei PPF/Keramik mit Garantie-/Pflegeintervallen die offensichtlichste
   Wiederkehrgeschäft-Lücke; heute nur 3 Token-Einweglinks.
5. **Bewertungen/Review-Anstoß** nach Auftragsabschluss (Google-Review-Mail) — null Code.
6. **PWA/Offline für den Hallen-Einsatz.** Fahrzeugannahme, Fotos, Zeiterfassung passieren
   am Fahrzeug; kein Manifest, kein Service Worker, keine Offline-Queue — bei Funkloch
   ist die App tot.
7. **CSV-Datenimport** für Kunden-/Fahrzeugbestand — größte Hürde für wechselnde Betriebe
   (500 Bestandskunden manuell anlegen).
8. **Onboarding-Wizard/Setup-Checkliste** — neuer Betrieb landet auf leerem Dashboard;
   Empty-States der Kernlisten ohne CTA verschärfen das.
9. **Vorher/Nachher als Marketing-Feature:** Fotos existieren intern, aber kein teilbarer
   Galerie-Link, nichts auf der Track-Seite.

---

## 6. Technische Risiken (kurz)

| Risiko | Schwere | Beleg (verifiziert) |
|---|---|---|
| **Keine DB-Migrationen** — `backend/src/database/migrations/` enthält nur `.gitkeep`; Schema nur via Dev-`synchronize`+Seed. Prod-Deploy/Upgrade ohne Baseline unmöglich | hoch | Verzeichnis-Listing; deckt sich mit Memory `schema-dev-columns-pending-migration` |
| **Plan-Limits + Feature-Gates nicht durchgesetzt** — `maxUsers/maxLocations/maxCustomers` und `features[]` existieren nur in Seed/DTO/Entity (Grep bestätigt); Starter- und Pro-Kunden bekommen identischen Funktionsumfang → Umsatzrisiko | hoch | `subscriptions/entities/plan.entity.ts:6–10`, `database/seed.ts:92/101` |
| **Abo-Sperre fail-open** — kein Abo-Datensatz = voller Zugriff (bewusst, aber ein vergessener Datensatz = Gratisnutzung) | mittel | `subscriptions/subscription-access.ts` Kommentar + `if (!sub) return full` |
| **Fehlende Paginierung** bei appointments, vehicles, services, shop, zeiterfassung, support, order-material, marketplace-Orders; `locations`-Auswertung lädt ALLE Orders/Appointments/Invoices in den Speicher | mittel (wächst mit Datenmenge) | `appointments.service.ts:47/55`, `locations.service.ts:101–104`; deckt sich mit Memory-Perf-Audit |
| **Pagination-Clamp-Bug Customers** — `limit=0`/negativ nicht abgefangen → leere Liste | niedrig | `customers.service.ts:25` |
| **Kein Daten-Caching im Frontend** — Referenzdaten pro Seite neu geladen, Nav-Badge + Glocke pollen bei jedem Routenwechsel; kein React-Query o. ä. | mittel | `lib/api.ts`-Muster, `auftraege/page.tsx` (lädt Customers+Vehicles+Services fürs Modal) |
| **5 Monolith-Seiten** (Landing 1.205 Z., Schadenserfassung 851, Plattform-Marktplatz 602, Marktplatz 563, Dashboard 523) + ~10× kopiertes CRUD-Boilerplate ohne gemeinsamen Hook — hohes Drift-Risiko bei Querschnittsänderungen | mittel | `frontend/src/app/page.tsx` u. a. |
| **Größte Backend-Services** als Aufteilungs-Kandidaten: invoices 861 Z., inspection 734 Z., gdpr 546 Z., marketplace 524 Z. | niedrig | `invoices/invoices.service.ts` u. a. |
| **Statische Daten als Code** — Kalkulationspreise (`lib/kalkulation-katalog.ts`) und Hilfe-Q&A (`lib/hilfe-daten.ts`) nur per Deploy pflegbar | niedrig | bewusste Entscheidung (Kommentar im Katalog) |
| **Go-Live-Blocker Legal** — Impressum/Datenschutz mit sichtbaren `Platzhalter`-Komponenten | hoch (nur für Launch) | `components/legal.tsx`, `app/impressum/page.tsx` |

**Positiv (belegt, beibehalten):** konsequentes Guard-Muster
(`JwtAuthGuard, SubscriptionGuard, RolesGuard`), zentrale Tenant-Helfer mit Tests
(`common/tenant/tenant-scope.ts`), Feldverschlüsselung sensibler Daten
(`common/crypto/encrypted-column.ts`), Token-Hashing + `select:false` für Secrets,
differenziertes Throttling, JWT-Invalidierung nach Passwort-Änderung, eine Nav-Quelle,
eine UI-Basisbibliothek mit a11y-Modal, 0 Hex-Farben in App-Seiten, robustes 3D-Fallback.
