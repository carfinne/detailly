# Umsetzungsplan P3-7 (2D/3D-Zusammenführung) & P3-8 (Migrations-Baseline)

> Status: **PLAN, nicht freigegeben.** Code-Änderungen erst nach `PLAN FREIGEGEBEN`.
> Grundlage: `docs/KONZEPT_2D_3D_Zusammenfuehrung.md` Option (b), verifiziert im Code (Stand main).

> ⚠️ **Vor Ausführung zwingend lesen: [`REVIEW_VOR_MERGE.md`](REVIEW_VOR_MERGE.md) (Ampel GELB).**
> Der Plan wurde adversarisch geprüft. Drei Blocker/Korrekturen sind in diesen Plan noch NICHT
> eingearbeitet und müssen bei Ausführung beachtet werden:
> 1. **[CRITICAL] `entities[]` unvollständig** — `MarketplaceOrder` + `MarketplaceOrderItem` fehlen in
>    `backend/src/database/data-source-options.ts` (verifiziert: 36 `*.entity.ts`, Array listet 34).
>    Baseline (P3-8) legt sonst `marketplace_orders`/`_items` nie an → Prod `relation does not exist`.
>    B1 daher NICHT „alle 33 Entities" prüfen, sondern **Ist-Abgleich** `find backend/src -name '*.entity.ts'`
>    (minus VehicleIntake nach Löschung) gegen `entities[]`; die zwei Order-Entities eintragen.
> 2. **[HIGH] `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`** (und `pgcrypto`) als **erste** `up()`-Anweisung
>    der Baseline — TypeORM setzt `DEFAULT uuid_generate_v4()` für alle uuid-PKs, sonst scheitert schon das
>    erste `CREATE TABLE`.
> 3. **[HIGH] Fail-closed-Abo-Sperre und B3-Backfill im selben Wartungsfenster** — sonst werden Bestands-Tenants
>    ohne `subscriptions`-Zeile ausgesperrt. Vorab-Check muss 0 liefern (SQL in Review §2).
>    Bei der Datenmigration außerdem **alle Zielwerte explizit setzen** (Entity-Defaults `entwurf`/`3d` würden
>    sonst greifen) und `art`/`schweregrad` gegen die Enums validieren. Details: Review §3–§4.

## 1 · Kurz-Kontext (für Einsteiger)

Heute gibt es zwei getrennte Backends für dasselbe Thema: die schnelle 2D-**Fahrzeugannahme**
(`intake`, Tabelle `vehicle_intakes`, Schäden als JSON-Blob, Daten-Sackgasse) und die
3D-**Schadenserfassung** (`inspection`, 4 Tabellen, mit Historie/Fotos/Signatur). **P3-7** stellt die
schnelle 2D-Annahme auf die Inspektions-API um (`typ='annahme'`, Schäden als `DamageItem`
mit `positionMode='2d'`), migriert die Alt-Daten und löscht das Intake-Modul.
**P3-8** erzeugt danach die allererste Prod-Migration (`migrations/` ist leer → aktuell kein
Postgres-Deploy möglich) und füllt Alt-Tenants ein Default-Abo nach.
**Reihenfolge-Prinzip:** erst additiv (nichts wegnehmen), dann Frontend umstellen, dann Daten
migrieren, dann Intake entfernen — und erst danach die Baseline. So bricht `main` nie.

---

## 2 · P3-7 — Schritte

Die Inspektions-API kann Option (b) bereits vollständig (verifiziert): `POST /inspections`
akzeptiert `typ`, `kmStand`, `tankstand`, `notiz`; `POST /inspections/:id/items` akzeptiert
`positionMode:'2d'`, `ansicht2d`, `x2d`, `y2d`, `art`, `schweregrad`, `origin`, `notiz`.
Es sind **fast keine Backend-Änderungen** nötig — der Schwerpunkt ist Frontend + Datenmigration.

**S1 — (optional, additiv) Backend: Convenience-Feld `partId` bei 2D lockern.** *(Backend, Risiko: gering)*
`CreateDamageItemDto.partId` ist `@IsString()` **Pflicht**; ein 2D-Marker hat aber nur `zone`
(optional). Damit die 2D-Annahme keinen künstlichen `partId` erfinden muss: `partId` optional
machen und im Service auf `dto.partId ?? dto.ansicht2d ?? 'unbekannt'` defaulten.
Dateien: `backend/src/inspection/dto/create-damage-item.dto.ts`, `.../inspection.service.ts` (createItem).
Rein additiv (lockert Validierung) → kein Breaking Change. *Alternativ:* Frontend mappt `zone→partId`
(dann 0 Backend-Änderung). Entscheidung: Frontend-Mapping bevorzugen, S1 nur falls unschön.

**S2 — Frontend: `/fahrzeugannahme` auf die Inspektions-API umstellen.** *(Frontend, Risiko: mittel)*
Datei: `frontend/src/app/(app)/fahrzeugannahme/page.tsx` (aktuell 1 Call `POST /fahrzeugannahme`).
Neu = **zweistufig** (die Inspektions-API nimmt Items nicht verschachtelt im Body an):
1. `POST /inspections` mit `{ customerId, vehicleId?, typ:'annahme', kmStand?, tankstand?, notiz? }` → `id`.
2. Für **jeden** `marker` ein `POST /inspections/:id/items` mit Feldabbildung (siehe Datenmigration).
3. Optional `PATCH /inspections/:id` `{ status:'abgeschlossen' }`, dann Redirect auf die
   Detailansicht `/schadenserfassung?inspection=<id>` (statt bisher `/auftraege`).
Fehlerfall: schlägt ein Item-POST fehl, Inspektion existiert schon → Nutzer auf Detailseite leiten,
dort nacherfassbar (die Seite lädt `/inspections/:id`). Idempotenz via `clientUuid` je Marker nutzen.

**S3 — Frontend: Nav/CTAs vereinheitlichen.** *(Frontend, Risiko: gering)*
- `frontend/src/components/nav-data.tsx`: die zwei Einträge „Fahrzeugannahme" + „Schadenserfassung"
  bleiben (Option b = zwei Modi), aber Label/Hinweis schärfen („Annahme (schnell)" / „Annahme & Gutachten (3D)").
- `frontend/src/app/(app)/dashboard/page.tsx` (Zeilen ~99 und ~473): die zwei CTAs
  `Link href="/fahrzeugannahme"` bleiben gültig (Route bleibt), zeigen aber jetzt auf den
  neuen, in `inspections` speichernden Flow — keine URL-Änderung nötig.
- `frontend/src/app/(app)/schadenserfassung/page.tsx`: unterstützt bereits Query-Auswahl per Liste;
  die Detail-URL-Übernahme (`?inspection=<id>`) ergänzen, damit S2-Redirect landet.

**S4 — Frontend-Typen/Labels prüfen.** *(Frontend, Risiko: gering)*
`frontend/src/lib/types.ts` (`SchadensMarker`, `DamageItem`, `DamageInspection` existieren bereits) —
Mapping-Helfer `markerZuDamageItem()` zentral ablegen (z. B. in `fahrzeugannahme/page.tsx` oder `lib/`),
damit Frontend-Mapping und das Migrationsskript **dieselbe Abbildung** verwenden.

### Datenmigration (`vehicle_intakes` → `damage_inspections` + `damage_items`)

**Ansatz:** eigenständiges, idempotentes Node/ts-node-Skript
`backend/src/database/migrations-data/2026-xx-intake-to-inspection.ts` (bewusst **kein** TypeORM-Schema-
Migrationsskript — es läuft einmalig als Datenumzug, VOR Schritt „Intake-Ablösung" und vor der Baseline).
Läuft über die normale DataSource (SQLite Dev / Postgres Prod), **tenant-scoped** je Zeile.

**Idempotenz:** je Intake-Zeile eine deterministische `clientUuid = 'intake:' + intake.id` in die
erzeugte Inspektion schreiben; vor dem Insert prüfen, ob bereits eine Inspektion mit dieser
`clientUuid` (+ `tenantId`) existiert → dann überspringen. So ist ein Zweitlauf gefahrlos.

**Feldabbildung Inspektion (1 `VehicleIntake` → 1 `DamageInspection`):**
| Quelle `vehicle_intakes` | Ziel `damage_inspections` |
|---|---|
| `tenantId` | `tenantId` (nie aus Fremdquelle, 1:1 der Zeile) |
| `customerId` / `vehicleId` / `orderId` | gleichnamig 1:1 |
| `kmStand` / `tankstand` / `notiz` | gleichnamig 1:1 |
| — | `typ = 'annahme'` |
| — | `status = 'abgeschlossen'` (Alt-Annahmen gelten als fertig, nicht Entwurf) |
| — | `clientUuid = 'intake:'+id` (Idempotenz-Schlüssel) |
| `createdAt` | `createdAt` beibehalten (falls Insert mit explizitem Wert möglich) |

**Feldabbildung Schäden (jeder `marker[]`-Eintrag → 1 `DamageItem`):**
| Quelle `SchadensMarker` | Ziel `DamageItem` |
|---|---|
| `ansicht` | `ansicht2d` |
| `x` / `y` (0–100 %) | `x2d` / `y2d` |
| `zone` | `partId = zone ?? 'unbekannt'`, `partLabel = zone` |
| `art` | `art` (Wertemenge ist Teilmenge der 10 DamageArt → 1:1) |
| `schweregrad` | `schweregrad` (1:1) |
| `notiz` | `notiz` |
| — | `positionMode = '2d'`, `origin = 'neu'`, `status = 'offen'` |
| `marker.id` | `clientUuid = 'intake:'+intakeId+':'+marker.id` (Idempotenz Item) |

**Sicherheit/Rollback:** vor dem Lauf DB-Backup/Snapshot (Prod: `pg_dump`; Dev: Datei kopieren).
Skript schreibt **nur** neue Zeilen, ändert/löscht **kein** `vehicle_intakes` → Rollback = neue
Inspektionen mit `clientUuid LIKE 'intake:%'` löschen, Alt-Tabelle bleibt unberührt. Am Ende
Report: „N Intakes migriert, M Marker, K übersprungen (bereits vorhanden)". Zusätzlich ein
Audit-Log je Inspektion (`action:'migrate', entityType:'DamageInspection'`).

### Intake-Ablösung (entfällt/umbiegt)

**Erst NACHDEM S2 im Frontend live ist und die Datenmigration lief.** Zu entfernen/anzupassen:
- **Löschen:** `backend/src/intake/` komplett (Modul, Controller, Service, DTO, Entity
  `vehicle-intake.entity.ts`).
- `backend/src/app.module.ts`: Import + `IntakeModule` aus dem `imports`-Array entfernen (Zeilen 29, 102).
- `backend/src/database/data-source-options.ts`: `VehicleIntake`-Import + Eintrag in `entities[]` entfernen
  (Zeilen 21, 58). **Wichtig:** dadurch entfällt die Tabelle `vehicle_intakes` aus dem Ziel-Schema — genau
  das soll die Baseline (P3-8) enthalten.
- **GDPR entkoppeln** (`backend/src/gdpr/gdpr.service.ts` + `gdpr.module.ts`): `VehicleIntake`-Repo,
  die `intakeRepo`-Zugriffe (Export Zeile ~88/144, Anonymize Zeile ~270/274) und die `intakeIds`-Zweige
  in `collectAuditLogs`/`redactAuditLogs` entfernen. Der `entityType:'VehicleIntake'`-Zweig im Audit
  darf als **historischer** Redaktions-Pfad optional bleiben (schadet nicht), das Repo aber muss weg.
- **Frontend-Referenzen:** keine harte Route entfällt (`/fahrzeugannahme` bleibt, spricht nur eine
  andere API). `POST /fahrzeugannahme` verschwindet → S2 muss vorher gemergt sein. Grep-Check nach
  `'/fahrzeugannahme'` als **API-Call** (nur in `fahrzeugannahme/page.tsx`).
- **Tests:** ein evtl. Intake-Spec entfernen; GDPR-Spec auf fehlendes Intake-Repo anpassen.
- **Aufwand P3-7 gesamt: M** (Frontend M, Backend-Ablösung S, Migrationsskript S–M).

---

## 3 · P3-8 — Migrations-Baseline + Abo-Backfill

**Voraussetzung:** P3-7 vollständig gemergt (Intake-Entity ist aus `entities[]` raus), sonst
zementiert die Baseline die tote `vehicle_intakes`-Tabelle.

**B1 — Baseline generieren (gegen Postgres, NICHT SQLite).** *(Backend, Risiko: mittel)*
SQLite-DDL weicht dialektisch ab; die Prod-Migration muss Postgres-SQL sein.
```
# leere Postgres-DB, damit generate das komplette Schema als Diff ausgibt
DB_TYPE=postgres NODE_ENV=development DB_HOST=... DB_USER=... DB_PASS=... DB_NAME=detailly_baseline \
  npm run migration:generate
```
(`migration:generate` → `src/database/migrations/Migration<ts>.ts`, DataSource: `src/database/data-source.ts`).
Ergebnis prüfen: enthält alle 33 Entities, **ohne** `vehicle_intakes`.

**B2 — Dev-only-Spalten sicherstellen (bekannte Falle).** *(Risiko: hoch, wenn übersehen)*
Diese Spalten existieren dev nur via `synchronize` und **müssen** in der Baseline stehen — verifiziert:
- `tenants.calendarToken` (`tenant.entity.ts:74`, `select:false`) — genutzt in `calendar.service.ts`.
- `orders.freigabeToken` (`order.entity.ts:83`, `select:false`) — genutzt in `orders.service.ts`.
- `tenants.sevdeskApiToken`, `tenants.settings` (verschlüsselt, `type:'text'`), `tenants.betriebstyp`.
- alle `inspection`-Spalten inkl. `clientUuid`, Signatur-Felder, `previousInspectionId`.
Da B1 gegen eine **leere** Postgres-DB diffed (nicht gegen die alte Prod), sind sie automatisch enthalten —
**Verifikation:** im generierten SQL nach `calendarToken`, `freigabeToken`, `betriebstyp`, `clientUuid` grep.
Fehlt etwas, ist eine Entity nicht in `entities[]` oder der Diff lief gegen eine nicht-leere DB.

**B3 — Abo-Backfill in dieselbe Migration einweben.** *(Backend, Risiko: mittel — Datenschreibend)*
In die generierte Migration eine `INSERT`-Anweisung ergänzen (nach `CREATE TABLE`), **idempotent + tenant-scoped**:
alle Tenants **ohne** `subscriptions`-Zeile bekommen genau eine Default-Subscription.
```sql
INSERT INTO subscriptions (id, "tenantId", "planId", status)
SELECT gen_random_uuid(), t.id, NULL, 'trial'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s."tenantId" = t.id);
```
**Default-Plan-Entscheidung:** `planId = NULL` + `status='trial'` **ohne** `trialEndsAt`. Begründung
(verifiziert): `evaluateSubscription()` ist *fail-open* — `TRIAL` ohne (oder mit zukünftigem)
`trialEndsAt` = Vollzugriff; nur abgelaufene/gekündigte/gesperrte Abos blocken. So sperrt der Backfill
**keinen** Bestandsbetrieb aus (kein `blocked`), erzeugt aber die vom Modell erwartete 1:1-Zeile
(`subscriptions.tenantId UNIQUE`). Das `WHERE NOT EXISTS` macht den Lauf wiederholbar und schützt
neue Tenants (die per Registrierung bereits eine TRIAL-Subscription bekommen — siehe `tenants.service.ts:317`).
*Alternative (verworfen):* fester Starter-Plan → würde eine Zahlpflicht/Planbindung suggerieren, die es
für Alt-Tenants nie gab; Betreiber weist Tarife bewusst manuell zu.
Im `down()` der Migration: den Backfill **nicht** zurückrollen (Datenverlust-Gefahr) — nur die Tabellen.

**B4 — Verifikation (fresh DB → migrate → seed → Tests).** *(Risiko: gering)*
1. Frische Postgres-DB, `NODE_ENV=production` → `migrationsRun` läuft die Baseline (`data-source-options.ts:100`).
2. `npm run migration:run` manuell gegen zweite frische DB → muss ohne Fehler durchlaufen, `typeorm_migrations` gefüllt.
3. `DB_TYPE=postgres npm run seed` → Demo-Daten laden ohne Schemafehler.
4. `npm test` (Backend) grün, insbesondere `subscription-access.spec.ts`, `inspection-tenant-safety.spec.ts`, GDPR-Specs.
5. SQLite-Pfad bleibt unberührt (`synchronize:true`) — kurz gegenchecken, dass App-Start + Auto-Seed dort weiter läuft.
- **Aufwand P3-8 gesamt: M** (Generieren S, Backfill/Review S, Verifikation M).

---

## 4 · Merge-/Ausführungs-Reihenfolge (kanonisch)

Ausgangslage: Backend-Phase-3 (#102–#106) und Frontend (#107–#109) liegen auf getrennten,
ungemergten Stapeln; #100/#101 sind Doku/Design-Basis. Reihenfolge, damit `main` nie bricht:

1. **#100 → #101** (Doku/Design-Standard) auf `main` — reine Grundlage, konfliktfrei.
2. **#102–#106** (Backend-Phase-3, Inspektions-API) nach `main`. Danach ist die Ziel-API vollständig live.
3. **#107–#109** (Frontend-Pakete) nach `main` — inkl. der Sofortmaßnahme (Nav/Hinweise), die die
   Inspektions-API bereits voraussetzt.
4. **P3-7-Umsetzung, additiver Teil:** ggf. S1 (Backend `partId` optional) + **S2/S3/S4 Frontend**
   (`/fahrzeugannahme` schreibt jetzt `inspections`). Intake-Backend läuft noch → nichts bricht.
5. **Datenmigration ausführen** (`vehicle_intakes` → inspections/items), mit Backup davor.
6. **Intake-Ablösung** (Modul/Entity/`entities[]`/GDPR entfernen). `main` läuft weiter, weil das
   Frontend seit Schritt 4 nicht mehr auf `/fahrzeugannahme`-API angewiesen ist.
7. **P3-8 Baseline** (B1–B4) — als **allerletzter** schemaberührender Schritt, danach jede Änderung = echte Migration.

---

## 5 · Offene Fragen an den Betreiber

1. **Default-Plan im Backfill:** Vorschlag `planId=NULL, status='trial'` (kein Aussperren, keine
   Scheinbindung). Zustimmung, oder sollen Alt-Tenants einen konkreten Tarif (z. B. `pro`) bekommen?
2. **Alt-Intakes ohne Kunden-/Fahrzeugbezug:** falls historische `vehicle_intakes` einen inzwischen
   gelöschten `customerId` referenzieren — migrieren (verwaiste Inspektion) oder überspringen+protokollieren?
3. **Zeitpunkt/Wartungsfenster für Datenmigration + Baseline in Prod** (aktuell existiert noch kein
   Prod-Deploy — läuft die erste Migration gegen eine bereits per `synchronize` befüllte DB oder wirklich frisch?).
4. **Status migrierter Alt-Annahmen:** `abgeschlossen` (Vorschlag, da fertige Protokolle) oder `entwurf`
   (nacherfassbar/upgradebar auf 3D)?
