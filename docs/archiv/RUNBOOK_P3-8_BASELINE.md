# Runbook P3-8 — Migrations-Baseline erzeugen & scharfschalten

> Zielgruppe: Einsteiger. Dies ist die **einzige** Aufgabe aus P3-8, die eine echte
> Postgres-Instanz braucht. Alles andere (entities[]-Fix, die zwei festen Migrationen
> `CreateExtensions` und `AboBackfill`) ist bereits im Code und Postgres-unabhaengig.
>
> Hier passiert genau eins: aus dem aktuellen Entity-Stand die **Baseline-Migration**
> generieren (das grosse `CREATE TABLE`-Skript fuer alle Tabellen), pruefen, testen,
> und im Wartungsfenster zusammen mit der Abo-Sperre scharfschalten.

---

## 0 · Warum ueberhaupt?

Der Ordner `backend/src/database/migrations/` enthaelt heute **keine** Schema-Migration —
nur zwei feste Rahmen-Migrationen:

- `1000000000000-CreateExtensions.ts` — legt die Postgres-Extensions `uuid-ossp` +
  `pgcrypto` an. Muss VOR allem laufen (uuid-PKs nutzen `uuid_generate_v4()`).
- `2999999999999-AboBackfill.ts` — legt fuer Alt-Tenants eine Default-Abo-Zeile an.
  Muss NACH der Baseline laufen (braucht die Tabelle `subscriptions`).

Dazwischen fehlt die **Baseline**: das eigentliche Schema. Die wird jetzt generiert und
bekommt automatisch einen **aktuellen** Zeitstempel (13-stellige Millisekunden-Zahl,
z. B. `1751880000000`) — der liegt garantiert zwischen `1000000000000` und
`2999999999999`. TypeORM sortiert Migrationen nach dieser Zahl, also ist die
Reihenfolge automatisch: **Extensions → Baseline → Backfill**.

> Warum nicht gegen SQLite generieren? SQLite-DDL weicht dialektisch ab (kein echtes
> `enum`, kein `timestamptz`, kein `jsonb`). Die Prod-Migration MUSS Postgres-SQL sein.

---

## 1 · Voraussetzungen

1. **Code-Stand:** dieser Branch `feat/p3-8-baseline` (bzw. P3-7 + P3-8 auf `main`).
   Wichtig: P3-7 muss drin sein, damit `VehicleIntake` aus `entities[]` raus ist —
   sonst zementiert die Baseline die tote Tabelle `vehicle_intakes`.
2. **Frische, leere Postgres-DB** — eine brandneue Datenbank, in der **noch keine**
   Detailly-Tabelle existiert. `migration:generate` bildet den Unterschied
   (Diff) zwischen „Entities im Code" und „was in der DB steht". Ist die DB leer,
   ist der Diff = das komplette Schema. Ist sie NICHT leer, fehlen Tabellen im
   generierten Skript.
   - Anlegen z. B.: `createdb detailly_baseline` (oder via psql `CREATE DATABASE detailly_baseline;`).
3. **Verbindungs-Env** (im Terminal gesetzt, NICHT in die dauerhafte `.env`):
   ```
   DB_TYPE=postgres
   DB_HOST=<host>
   DB_PORT=5432
   DB_USER=<user>
   DB_PASS=<pass>
   DB_NAME=detailly_baseline
   ```
4. Backend-Deps vorhanden (`backend/node_modules`; lokal ist das die Junction).

> Node-24-Hinweis: `npm install` scheitert lokal an better-sqlite3. Vorhandene
> node_modules nutzen bzw. `--legacy-peer-deps`. Fuer diesen reinen Postgres-Lauf
> wird better-sqlite3 nicht gebraucht.

---

## 2 · Baseline generieren

Aus dem Ordner `backend/`:

```bash
DB_TYPE=postgres NODE_ENV=development \
  DB_HOST=<host> DB_PORT=5432 DB_USER=<user> DB_PASS=<pass> DB_NAME=detailly_baseline \
  npm run migration:generate
```

Ergebnis: eine neue Datei `backend/src/database/migrations/Migration<zeitstempel>.ts`.
Der `<zeitstempel>` ist eine aktuelle 13-stellige Zahl → landet zwischen den beiden
festen Migrationen.

> Falls der Befehl „No changes in database schema were found" meldet: die DB war
> NICHT leer (oder es lief schon eine Migration). Leere DB neu anlegen und erneut
> generieren.

---

## 3 · Generierte Baseline pruefen (Review vor dem Committen)

Die generierte Datei NICHT blind uebernehmen. Pruefen:

**a) Alle Tabellen enthalten (~36 Entities).** `entities[]` listet aktuell 35 Klassen;
mit `damage_item_photos` etc. ergeben sich entsprechend viele `CREATE TABLE`. Stichprobe —
diese MUESSEN vorkommen (waren die Blocker-Kandidaten):

```bash
grep -c "CREATE TABLE" src/database/migrations/Migration*.ts
grep -E 'CREATE TABLE.*("marketplace_orders"|"marketplace_order_items")' src/database/migrations/Migration*.ts
```

Beide Marketplace-Order-Tabellen MUESSEN auftauchen. Fehlen sie → `entities[]` in
`data-source-options.ts` unvollstaendig (P3-8-Blocker nicht behoben).

**b) `vehicle_intakes` darf NICHT vorkommen** (P3-7 hat Intake entfernt):

```bash
grep -c "vehicle_intakes" src/database/migrations/Migration*.ts   # erwartet: 0
```

**c) Dev-only-Spalten sind drin.** Diese existieren im Dev nur via `synchronize` und
wuerden sonst in Prod fehlen. Alle MUESSEN im generierten SQL stehen:

```bash
grep -oE '"(calendarToken|freigabeToken|downloadToken|sevdeskApiToken|betriebstyp|clientUuid)"' \
  src/database/migrations/Migration*.ts | sort -u
```

Erwartet: alle sechs Namen erscheinen. Fehlt einer → betroffene Entity nicht in
`entities[]`, oder es wurde gegen eine nicht-leere DB gediffed.

**d) Reihenfolge stimmt.** Dateinamen im Ordner sortiert anschauen:

```bash
ls -1 src/database/migrations/*.ts
```

Erwartete numerische Reihenfolge:
1. `1000000000000-CreateExtensions.ts`
2. `Migration<aktuell>.ts`  ← die Baseline
3. `2999999999999-AboBackfill.ts`

**e) Extensions am Anfang der Baseline?** Nicht noetig — sie kommen aus der separaten
`CreateExtensions`-Migration, die davor laeuft. Die Baseline selbst muss KEIN
`CREATE EXTENSION` enthalten. Falls TypeORM in der Baseline dennoch `DEFAULT
uuid_generate_v4()` setzt (Regelfall): das ist genau, warum `CreateExtensions` zuerst
laufen muss.

---

## 4 · Voll-Test gegen frische DB (Pflicht, verifiziert den AboBackfill)

Der `AboBackfill` wurde ohne echten PG-Lauf geschrieben — dieser Schritt ist seine
Verifikation. Zweite, ebenfalls **frische, leere** Postgres-DB verwenden.

```bash
# 1) Migrationen ausfuehren: Extensions -> Baseline -> Backfill
DB_TYPE=postgres NODE_ENV=development \
  DB_HOST=<host> DB_USER=<user> DB_PASS=<pass> DB_NAME=detailly_test \
  npm run migration:run
```

Erwartung: laeuft ohne Fehler durch; Tabelle `typeorm_migrations` enthaelt drei
Eintraege in der oben genannten Reihenfolge. Kein „relation does not exist",
kein „function gen_random_uuid() does not exist" (dann fehlt `pgcrypto` →
`CreateExtensions` nicht gelaufen).

```bash
# 2) Seed einspielen (legt Demo-Tenant + Demo-Abo an)
DB_TYPE=postgres NODE_ENV=development \
  DB_HOST=<host> DB_USER=<user> DB_PASS=<pass> DB_NAME=detailly_test \
  npm run seed
```

```bash
# 3) Backfill-Wirkung pruefen: 0 Tenants ohne Abo-Zeile
psql "$DB_URL" -c 'SELECT count(*) FROM tenants t
  WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s."tenantId" = t.id);'
# erwartet: 0
```

> AboBackfill-Zweitlauf-Test (Idempotenz): `npm run migration:revert` (entfernt die
> Default-trial-Zeilen), dann `npm run migration:run` erneut → wieder 0 Waisen, keine
> UNIQUE-Verletzung. Achtung: revert entfernt zeilenweise alle `planId IS NULL AND
> status='trial'` — auf der Test-DB unkritisch.

```bash
# 4) Backend-Tests
npm test
```

Grün erwartet, insbesondere `subscription-access.spec.ts`,
`inspection-tenant-safety.spec.ts`, GDPR-/Marketplace-Specs.

> SQLite-Pfad bleibt unberuehrt: `DB_TYPE=sqlite` startet weiter per `synchronize`,
> die Migrationen sind dort per Dialekt-Guard No-ops. Kurz gegenchecken: `npm run seed`
> ohne `DB_TYPE` laeuft, App bootet.

---

## 5 · Scharfschalten in Prod — Reihenfolge-Auflage (REVIEW §2)

> **Zwingend:** Die fail-closed-Abo-Sperre (P3-5-Delta in
> `subscription-access.ts`) und dieser Backfill laufen im **SELBEN Wartungsfenster**.
> Sonst werden Bestands-Tenants ohne `subscriptions`-Zeile sofort ausgesperrt
> (`access='blocked'`).

**Ablauf im Fenster:**

1. **Wartungsfenster oeffnen** (Deploy pausiert / Nutzer informiert).
2. **Vorab-Check** auf der Prod-DB — MUSS die spaetere Wirkung dokumentieren:
   ```sql
   SELECT count(*) FROM tenants t
   WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s."tenantId" = t.id);
   ```
   Ergebnis notieren (= Anzahl Tenants, die der Backfill gleich versorgt).
3. **Backup/Snapshot** der Prod-DB (`pg_dump`), bevor irgendeine Migration laeuft.
4. **Migrationen ausfuehren.** In Prod erledigt das der App-Start automatisch
   (`migrationsRun` ist bei `NODE_ENV=production` true), oder manuell
   `npm run migration:run`. Reihenfolge: Extensions → Baseline → Backfill.
5. **Nach-Check** — MUSS jetzt **0** liefern:
   ```sql
   SELECT count(*) FROM tenants t
   WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s."tenantId" = t.id);
   ```
6. **Erst danach** die fail-closed-Abo-Sperre aktiv schalten / das Delta deployen.
7. **Wartungsfenster schliessen**, Zugriff eines Bestands-Tenants stichprobenhaft
   pruefen (kein faelschliches „Abo gesperrt").

> Rollback: `AboBackfill.down()` entfernt nur die erzeugten Default-trial-Zeilen
> (planId IS NULL, status='trial'). Die Baseline zurueckzurollen bedeutet Schema-Abriss —
> im Ernstfall stattdessen den DB-Snapshot aus Schritt 3 zurueckspielen.

---

## 6 · Nach dem Lauf

- Die generierte `Migration<zeitstempel>.ts` committen (thematisch: „Baseline-Schema").
- Ab jetzt gilt: **jede** Schema-Aenderung = neue Migration (kein `synchronize` in Prod).
- Die Memory-Notiz „Dev-Spalten ohne Prod-Migration" ist damit erledigt.
