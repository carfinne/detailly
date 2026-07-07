# Vor-Merge-Härtungs-Review — P3-7 / P3-8

> Stand: 2026-07-07 · Grundlage: `docs/PLAN_P3-7_P3-8.md`, Backend-Stapel #102–#106, Frontend-Stapel #107–#109.
> Methode: adversarisch geprüft (2 Skeptiker je Befund). 8 bestätigte, 13 verworfene Befunde.

## 1 · Kurzfazit — Ampel: **GELB**

Plan und Stapel sind im Kern solide: die Reihenfolge (erst additiv, dann Frontend, dann migrieren, dann Baseline) ist richtig gedacht und schützt `main`. **Aber** die Baseline-Migration (P3-8) hat einen echten Blocker — sie würde in Prod zwei reale Tabellen (`marketplace_orders`, `marketplace_order_items`) schlicht **nicht anlegen**, weil sie in der Entity-Liste fehlen. Dazu kommen zwei Cross-Stack-Kontraktfehler im Frontend, die einem berechtigten Inhaber falsche Fehlermeldungen zeigen. Keiner davon bricht `main` heute (kein Prod-Deploy), aber sie müssen vor dem Scharfschalten sitzen. Der Rest sind präzise Ausführungshinweise für die Migrationsskripte — sauber lösbar, wenn man sie kennt.

## 2 · Vor dem Merge zu fixen (3 Blocker)

### [CRITICAL] Baseline lässt zwei reale Entities aus — MarketplaceOrder + MarketplaceOrderItem fehlen in `entities[]`
- **Datei:** `backend/src/database/data-source-options.ts:71-73` (Ziel-Array) ↔ `backend/src/marketplace/marketplace.module.ts:19-20`
- **Warum:** `migration:generate` liest die Entity-Liste aus `data-source.ts` → `entities[]`. Beide Klassen sind als `@Entity` registriert und im Modul aktiv (Marketplace-Bestellflow), fehlen aber im zentralen Array. Die Baseline emittiert dann **kein** `CREATE TABLE marketplace_orders / marketplace_order_items`. In Prod (Postgres, `synchronize:false`) existieren die Tabellen nie → jeder Bestellvorgang wirft `relation does not exist`. **Verifiziert:** es gibt 36 `*.entity.ts`-Dateien, das Array listet nur 34 (inkl. VehicleIntake, das raus soll). Der Plan-Prüfschritt B1 (Zeile 133) sagt „enthält alle 33 Entities" — die Zahl ist falsch, und genau die zwei Marketplace-Order-Entities fehlen. Der Kommentar in `data-source.ts:7` („alle 25 Entities") ist ebenfalls veraltet.
- **Fix:** `MarketplaceOrder` + `MarketplaceOrderItem` in `data-source-options.ts` importieren und ins `entities[]`-Array eintragen — **bevor** B1 läuft. B1-Verifikation umstellen: nicht „alle 33", sondern Ist-Abgleich `find backend/src -name '*.entity.ts'` (minus VehicleIntake nach dessen Löschung) gegen `entities[]`. Zähler im Plan (33) und Kommentar in `data-source.ts:7` (25) korrigieren.

### [HIGH] Audit-Seite überschreibt Backend-403 mit falschem Rollen-Text (verdeckt PLAN_FEATURE_MISSING)
- **Datei:** `frontend/src/app/(app)/audit/page.tsx:26-30` ↔ `backend/src/audit/audit.controller.ts:17,24` + `backend/src/common/guards/plan-feature.guard.ts:41` + `backend/src/subscriptions/plan-entitlements.ts:74-84`
- **Warum:** Ruft ein OWNER/MANAGER auf einem Tarif **ohne** Feature `audit` `GET /audit-logs` auf, läuft `PlanFeatureGuard` **vor** `RolesGuard` → 403 `PLAN_FEATURE_MISSING`, obwohl die Rolle passt. Das Frontend mappt **jedes** 403 hart auf „nur für Manager und Inhaber sichtbar" und verwirft die Upgrade-Meldung des Backends. Der berechtigte Inhaber erfährt fälschlich, ihm fehle die Rolle, statt des Tarif-Hinweises.
- **Fix:** 403-Zweig differenzieren: konkrete Backend-`message` durchreichen (`e.message`) statt statischem Rollen-Text; idealerweise `ApiError.code` durchreichen und nur bei fehlendem code den Rollen-Fallback zeigen.

### [HIGH] Fail-closed Abo-Sperre wird VOR dem P3-8-Backfill scharfgeschaltet — Bestands-Tenants ohne Subscription-Zeile werden ausgesperrt
- **Datei:** `backend/src/subscriptions/subscription-access.ts:32` (P3-5-Delta) + `docs/PLAN_P3-7_P3-8.md:145-159` (B3)
- **Warum:** Wird das fail-closed-Delta auf `main` gemergt/deployt, **bevor** der B3-Backfill lief, liefert jeder Tenant ohne `subscriptions`-Zeile sofort `access='blocked'` → `SubscriptionGuard` sperrt alle gegateten Endpunkte. Heute klein (kein Prod-Deploy), aber die Reihenfolge ist zwingend. Eine per `synchronize` befüllte Dev/Stage-DB ohne Subscription-Zeile wäre sofort tot.
- **Fix:** fail-closed-Merge und B3-Backfill **im selben Wartungsfenster** fahren; Backfill vorziehen. Vor-Merge-QA-Check ergänzen — muss **0** liefern:
  ```sql
  SELECT count(*) FROM tenants t
  WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s."tenantId" = t.id);
  ```

## 3 · Bei P3-7-Ausführung beachten (Datenmigration `vehicle_intakes` → inspections/items)

### [HIGH] Idempotenz nicht DB-gesichert — `clientUuid` hat keinen Unique-Index
- **Datei:** `backend/src/inspection/entities/damage-inspection.entity.ts:63`, `.../damage-item.entity.ts:132` (Plan: Zeile 66-68, 91)
- **Warum:** Die Idempotenz ist ein reines SELECT-dann-INSERT ohne DB-Constraint. Sequentiell ist das geschützt, aber jeder Nebenläufigkeitsfall (Parallellauf, oder Überlappung mit dem laut Plan-Schritt 4-5 noch aktiven Alt-Flow, der `clientUuid` nicht setzt) erzeugt Dubletten — die Baseline zementiert sie.
- **Plan-Korrektur:** Migrationsskript **strikt sequentiell + Single-Instance** ausführen (kein Parallellauf). Sicherer: für die Migration temporär partiellen Unique-Index auf `(tenantId, clientUuid) WHERE clientUuid LIKE 'intake:%'` setzen oder INSERT als `ON CONFLICT DO NOTHING` gegen einen Unique-Constraint fahren.

### [HIGH] Skript umgeht den Service — Zielstatus `abgeschlossen` wird von @Column-Default `entwurf` überschrieben
- **Datei:** `backend/src/inspection/entities/damage-inspection.entity.ts:44`, `.../inspection.service.ts:186-201` (Plan: Zeile 77, 90)
- **Warum:** Das Skript läuft bewusst direkt über die DataSource (nicht über die API). Setzt es beim Insert `status`, `origin`, `positionMode` nicht **explizit**, greifen die Entity-Defaults (`entwurf`, `positionMode='3d'`). Ergebnis: Alt-Annahmen landen als Entwurf statt abgeschlossen; DamageItems als `3d` ohne `position3d`, aber mit `x2d/y2d` → die UI rendert sie nicht. Der Plan nennt die Zielwerte, warnt aber nicht, dass die Defaults abweichen.
- **Plan-Korrektur:** **Alle** Zielwerte explizit setzen: `inspection.status='abgeschlossen'`, `typ='annahme'`; `item.positionMode='2d'`, `origin='neu'`, `status='offen'`. Nie auf Insert-Default vertrauen (bei `repo.create()/save()` müssen die Felder im Objekt stehen — `undefined` ⇒ Default).

### [MEDIUM] Intake.art ist ungeprüfter Freitext — Alt-Werte außerhalb des Enums brechen die Migration ab
- **Datei:** `backend/src/intake/dto/create-intake.dto.ts:41-42`, `.../damage-item.entity.ts:87-102` (Plan: Zeile 88)
- **Warum:** Der Plan nimmt an, alle historischen `art`-Werte seien saubere Teilmenge. Das Frontend produziert nur 6 gültige Werte, die API akzeptierte per `@IsString()` aber **jeden** String. Enthält eine historische `marker`-JSON einen abweichenden `art`-Wert (API-Direktaufruf, Altbestand, Tippfehler), verletzt der Insert den Postgres-enum/CHECK-Constraint → Skript bricht **mitten im Lauf** ab (Teilmigration). `schweregrad` hat dasselbe Muster.
- **Plan-Korrektur:** `art`/`schweregrad` je Marker gegen erlaubte `DamageArt`/`DamageSchweregrad`-Werte prüfen; unbekannte auf `sonstiges` bzw. `mittel` mappen (+ Original in `notiz` protokollieren), statt roh zu inserten.

### [MEDIUM] Verwaiste Intakes — `customerId` ist NOT NULL, aber kein FK; gelöschter Kunde erzeugt Inspektion ins Leere
- **Datei:** `backend/src/inspection/entities/damage-inspection.entity.ts:29` (Plan: Zeile 196-197, offene Frage 2)
- **Warum:** Ohne DB-FK kann ein Alt-Intake auf einen `customerId` zeigen, dessen Zeile gelöscht/anonymisiert ist. Das Skript kopiert `customerId` 1:1 → die Inspektion referenziert einen nicht existenten Kunden. `findOneInspection`/`exportCustomerData` finden sie nie (Join scheitert), sie ist unsichtbar, taucht aber in Zählungen/Reports auf. Der Plan lässt das als **offene Frage 2** ohne Default stehen → stille Waisen bei Ausführung.
- **Plan-Korrektur:** Vor Migration je Intake prüfen, ob `customerId` (tenant-scoped) noch in `customers` existiert; wenn nicht: **überspringen + im Report als „K übersprungen (Kunde fehlt)" protokollieren**. Entscheidung zu offener Frage 2 vor Ausführung einholen.

## 4 · Bei P3-8-Ausführung beachten (Baseline-Migration)

### [HIGH] Backfill nutzt `gen_random_uuid()` — Extension wird nirgends angelegt
- **Datei:** `docs/PLAN_P3-7_P3-8.md:150-155` (B3 INSERT)
- **Warum:** Auf Postgres < 13 oder ohne `pgcrypto` schlägt `gen_random_uuid()` mit „function does not exist" fehl → die gesamte Baseline bricht mitten im `migrationsRun` (`data-source-options.ts:100`) ab, Prod-Deploy scheitert. Auf PG13+ hängt die Migration still von der PG-Version ab statt von einer explizit angelegten Extension.
- **Plan-Korrektur:** Entweder `CREATE EXTENSION IF NOT EXISTS pgcrypto;` als erste `up()`-Anweisung, **oder** `uuid_generate_v4()` (uuid-ossp) nutzen und `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` voranstellen. **Wichtig:** TypeORM setzt für die uuid-PKs aller ~36 Tabellen `DEFAULT uuid_generate_v4()` — `uuid-ossp` muss also **ohnehin** in `up()` angelegt werden, sonst schlägt schon das erste `CREATE TABLE` fehl. Beide Extensions am Anfang von `up()` anlegen.

> Zusätzlich hier relevant: Blocker aus §2 (fail-closed vor Backfill) und die Entity-Vollständigkeit (Marketplace-Orders) schlagen erst bei P3-8 durch — vor B1 fixen.

## 5 · Für Fable / Feinschliff

Kein Befund mit `when='fable-feinschliff'`. Entfällt.

## 6 · Verworfene Befunde (13)

Geprüft und bewusst nicht weiterverfolgt (adversarisch entkräftet oder außerhalb Scope/Risiko heute vernachlässigbar):

1. GDPR-Service liest/löscht `VehicleIntake` in Export+Anonymisierung — bereits als Plan-Schritt (Zeile 108-111) erfasst, kein neuer Befund.
2. `createdAt`-Erhalt scheitert an `@CreateDateColumn` — Plan markiert es selbst als „falls möglich" (Zeile 79); Alt-Datum-Verlust akzeptabel.
3. Synchronize-Falle (erste Migration gegen bereits befüllte DB) — bereits offene Frage 3 im Plan.
4. Backfill-Idempotenz vs. `UNIQUE(tenantId)` bei Race gegen Registrierungspfad — Race-Fenster im Wartungsfenster praktisch null.
5. Inline-Enums ohne `enumName` erzeugen instabile Postgres-Enum-Namen — Kosmetik, blockiert nichts.
6. `ApiError` verliert Backend-Feld `code` — als Fix-Empfehlung in den Audit-Blocker (§2) eingearbeitet.
7. Standorte-Seite: gated `/locations/auswertung` im selben try wie ungated `/locations` — UI-Fehlerbanner, kein Datenschaden.
8. Navigation zeigt gated Module tarifunabhängig → Klick landet im 403 — UX-Politur, kein Blocker.
9. Auftrags-Status-Reiter „In Arbeit" filtert nur `in_arbeit` — Vorbestand, nicht Teil dieses Stapels.
10. `orders.controller findAll`: `parseInt('abc')=NaN` kippt Response-Shape — Vorbestand, separat härtbar.
11. `nextSequentialNumber` count-basiert, nicht race-sicher — Vorbestand, eigener Härtungs-Task.
12. Booking-Accept: `maxCustomers`-TOCTOU über öffentlichen Flow — Vorbestand, eigener Task.
13. `downloadMetaByToken` lädt volle Tenant-Entity ohne select-Projektion — latente Angriffsfläche, kein aktueller Leak.
