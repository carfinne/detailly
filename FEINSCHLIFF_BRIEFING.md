# Feinschliff-Briefing für Fable — Detailly-UI auf Weltklasse-Niveau

**Stand:** 2026-07-07 · **Verfasser:** UX/Tech-Writing-Rolle · **Ausführung:** Modell „Fable", Donnerstag
**Basis-UI:** `frontend-paket-a/frontend/src` (Pakete A+B+C gemerged) · **Referenz:** AUDIT.md §3.3 / §4.3 / §4.4
Alle Zeilennummern gegen den Worktree `frontend-paket-a` geprüft (READ-ONLY, nichts geändert).

---

## 1. Kontext & Ziel

Die Detailly-UI ist bereits sehr sauber: 0 Hex in App-Seiten, eine Nav-Quelle, a11y-Modal mit Fokusfalle,
konsistentes Loading→Error→Empty→Daten-Muster. Pakete A–C haben die **großen Struktur-Drifts** aus AUDIT §3.3
geschlossen (H1 via `PageHeader`/`.display-xl`, PublicShell statt 10× Copy-Paste, `.label` 133× für Formulare,
`ConfirmDialog` statt 5× `window.confirm`, Toast-System, StatCard, breakpoint-sichere Modal-Grids, Scene3D-Theming).
**Der Feinschliff ist reine Politur:** die letzten Micro-Label-Drifts, Einzel-Ausreißer und — der größte Hebel —
die vorhandene Motion-Sprache von der Landing-Page **nach innen in die App tragen**. Ziel: das *wahrgenommene* Niveau
auf Apple/Anthropic/Google heben, ohne Funktion oder Struktur anzufassen.
**NICHT Teil dieses Feinschliffs:** P3-7 (2D-Annahme auf Inspektions-Backend) und P3-8 (Migrations-Baseline) — das sind
eigene, laufende Struktur-Tasks.

---

## 2. Arbeitsweise für Fable

- **Branch:** `feat/p4-d-feinschliff`, gestapelt auf `feat/p4-c-logo-nav` (nicht direkt auf main).
- **Plan-Gate:** Erst Plan vorlegen, `PLAN-FREIGEGEBEN` abwarten, dann umsetzen (Team-Protokoll).
- **Commits:** kleine, thematisch getrennte Commits (Typo / Motion / A11y / Komponenten), nicht ein Riesen-Commit.
- **Design-Tokens strikt:** keine neuen Hex-Werte, keine arbitrary `text-[10px]`/`tracking-[…]` — vorhandene Klassen
  (`.kpi-label`, `.label`, `.display-xl`, `.card`, `.panel`, `.link-action`) nutzen bzw. genau eine ergänzen.
- **`prefers-reduced-motion`:** jede neue Bewegung dreifach guarden wie der Bestand (`@media reduce` + `.dl-reduce-motion`
  + JS-`motionOk()`); nur `transform`/`opacity`, App-Motion ≤ 400 ms.
- **Grün halten:** `tsc` + `next build` müssen nach jedem Commit durchlaufen.
- **Preview-Verifikation framelos:** Preview im Worktree kann framelos sein (Screenshot-Timeout bei `document.hidden`);
  per `preview_eval`/`preview_inspect` (computed styles) verifizieren statt Screenshot (Run-Umgebungs-Notiz).

---

## 3. Priorisierte Aufgabenliste (Dubletten aus 4 Lenses zusammengeführt)

Stufen: 🔴 Muss (hebt Niveau/Zugänglichkeit spürbar) · 🟡 Sollte (sichtbare Politur) · 🟢 Kür (Detailliebe).

### 🔴 Muss

**F-1 · Skip-Link + anspringbarer `<main>` — A11y — S**
`app/(app)/layout.tsx:50` — `<main>` hat weder `id` noch Skip-Ziel; Tastaturnutzer tabben bei jedem Seitenwechsel die
komplette Sidebar durch. **Soll:** `<a href="#hauptinhalt" class="sr-only focus:not-sr-only …">Zum Inhalt springen</a>`
als erstes Kind, `<main id="hauptinhalt" tabIndex={-1}>`. `sr-only`/`focus:not-sr-only`-Utility fehlt in `globals.css` —
mitliefern. Betrifft alle 28 App-Seiten auf einmal.

**F-2 · Motion nach innen: animierte Kennzahlen im Dashboard — Motion — M**
Der `CountUp`-Zähler (ease-out-cubic, rAF, IntersectionObserver-getriggert, reduced-motion-sicher) existiert bereits,
aber **nur auf der Landing** (`app/page.tsx:103-136`). Dashboard-`StatCard`s (`ui.tsx:452`) rendern statische Zahlen.
**Soll:** `CountUp` in eine wiederverwendbare Stelle heben und die Kennzahl-Werte im Dashboard/Auswertungen damit
zählen lassen. Größter „Premium"-Effekt fürs Geld — die App wirkt beim ersten Blick lebendig statt statisch.

**F-3 · Dashboard-Hero-Karte auf `.card`-Token + H1-Entscheidung — Typo/Komponenten — S**
`app/(app)/dashboard/page.tsx:65` ist eine **exakte `.card`-Kopie** (`rounded-2xl border border-ink-700/70
bg-ink-800/80 p-6 shadow-card backdrop-blur-sm`); Z. 71 nutzt eine eigene, größere H1 (`text-2xl sm:text-3xl`) statt
`.display-xl` (1.75rem). **Soll:** Ad-hoc-Klassen durch `.card` ersetzen. Für die H1 **bewusst entscheiden** und im
Code kommentieren: entweder auf `.display-xl` angleichen (Konsistenz) ODER als bewusster „Hero"-Gruß dokumentieren —
kein stiller Drift.

### 🟡 Sollte

**F-4 · Micro-Label-Drift auf `.kpi-label` vereinheitlichen — Typo — M**
Der kanonische Nicht-Formular-Microlabel-Token **existiert bereits**: `.kpi-label` (`globals.css:359` =
`text-[11px] font-semibold uppercase tracking-[0.08em] text-chrome-400`). Er ist aber kaum adoptiert — 28 Stellen über
9 Seiten nutzen stattdessen `uppercase tracking-wide`/`tracking-wider` + arbitrary `text-[10/11px]` (KPI-Captions,
Section-Eyebrows, Tabellen-Spaltenköpfe außerhalb von `.table`), u. a. `dashboard/page.tsx:70`, `plantafel/page.tsx`,
`plattform-analysen/page.tsx`, `abo/page.tsx`. **Soll:** diese Nicht-Formular-Microlabels auf `.kpi-label` umstellen.
**Formularfelder NICHT anfassen** (`.label` ist dort sauber, 133×).

**F-5 · Seitenwechsel-Transition aufwerten — Motion — S**
`app/(app)/layout.tsx:53` nutzt `key={pathname}` + `animate-fade-in` — solide, aber sehr schlicht. **Soll:** dezenten
kombinierten Fade+Rise (`opacity` + `translate-y-1`, ~200 ms, ease-emphasized) als eigene Utility, reduced-motion-guarded.
Kleiner Aufwand, spürbar geschmeidigerer App-Eindruck bei jeder Navigation.

**F-6 · MobileNav-Drawer: Fokusfalle + Escape — A11y/Mobile — M**
Der Slide-in-Drawer (`components/MobileNav.tsx`) hat Overlay + `aria-label`, aber — anders als `Modal` (`ui.tsx:207-266`)
— keine Tab-Fokusfalle und kein Escape-to-close. Auf Mobile kann der Fokus hinter das offene Menü wandern. **Soll:** das
bewährte Fokus-Trap-/Escape-Muster aus `Modal` übernehmen (kein neues Muster erfinden).

**F-7 · Modal-Overlay-Farbe angleichen — Komponenten — S**
`components/ui.tsx:273` nutzt noch `bg-black/70`, während `CommandPalette.tsx:142` und `MobileNav.tsx:63` bereits
`bg-ink-950/70` (Token-basiert) verwenden. **Soll:** `Modal` auf `bg-ink-950/70` angleichen — letzter Rest des
AUDIT-§3.3-Overlay-Befunds. Trivial, aber sichtbar bei jedem Dialog.

### 🟢 Kür

**F-8 · Disabled-Opacity-Ausreißer vereinheitlichen — Komponenten — S**
`.btn` setzt `disabled:opacity-50` (Standard). Zwei Ausreißer weichen ab: `CustomerFormModal.tsx:160` (`opacity-60`),
`Pager` (`opacity-40`). **Soll:** beide auf `opacity-50` bringen. Minimaler Drift, aber genau solche Details trennen
„gut" von „Weltklasse".

---

## 4. Nicht-Ziele / Vorsicht

- **Keine funktionalen Änderungen** — nur Klassen/Styles/Markup-Attribute, keine geänderte Logik, keine neuen Props mit
  Verhalten.
- **Keine Backend-Calls / API-Änderungen.**
- **A–C nicht erneut anfassen:** `PageHeader`/`.display-xl` (28/29 Seiten), PublicShell, `.label` (Formulare),
  `ConfirmDialog`, Toast-Provider, StatCard, Skeleton-Loader, Empty-CTAs, breakpoint-sichere Modal-Grids
  (`grid-cols-1 sm:grid-cols-*`), Scene3D-Theming, Fokus-Ringe, Modal-Fokusfalle, Alt-Texte — alles verifiziert
  geschlossen.
- **Landing-Motion-Fundament nicht umbauen** (`.reveal`, Parallax, `tilt`, Marquee, `CountUp`) — nur wiederverwenden,
  nicht neu erfinden.
- **Keine neuen abstrakten Utilities „auf Vorrat"** — genau die drei fehlenden Klassen (`sr-only`,
  Fade-Rise-Transition, ggf. `focus:not-sr-only`) ergänzen, sonst Bestandstoken nutzen.

---

## Top-8 auf einen Blick

1. 🔴 F-1 · Skip-Link + anspringbarer `<main>` — **S**
2. 🔴 F-2 · CountUp-Kennzahlen ins Dashboard tragen — **M**
3. 🔴 F-3 · Dashboard-Hero auf `.card` + H1-Entscheidung — **S**
4. 🟡 F-4 · Micro-Labels auf `.kpi-label` vereinheitlichen — **M**
5. 🟡 F-5 · Seitenwechsel-Transition (Fade+Rise) — **S**
6. 🟡 F-6 · MobileNav-Drawer: Fokusfalle + Escape — **M**
7. 🟡 F-7 · Modal-Overlay auf `bg-ink-950/70` — **S**
8. 🟢 F-8 · Disabled-Opacity-Ausreißer angleichen — **S**
