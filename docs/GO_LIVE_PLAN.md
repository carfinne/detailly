# Go-Live-Plan Detailly

**Stand:** 2026-08-06 · Produktstand `7614394` auf `main`

---

## Wo wir stehen

**Das Produkt ist fertig.** Was zwischen dir und den ersten echten Betrieben steht, ist
**kein Code mehr** — es sind Beschaffung, Recht und ein Deployment.

Geprüft und behoben wurden in dieser Ausbaustufe:

| Prüfung | Ergebnis |
|---|---|
| Sicherheit (7 Angriffsflächen) | kein blockierender Fund |
| Rollen & Rechte (7 Rollen) | 8 Mängel gefunden, alle behoben |
| Korrektheit (7 Fehlerklassen) | 3 ernste + 7 kleinere Fehler, alle behoben |
| Frontend (6 Fehlerklassen) | 2 Datenverlust-Fehler, beide behoben |

Dauerhaft aktiv: Schwachstellen-Überwachung der Abhängigkeiten, CodeQL-Analyse,
Migrationskette gegen echtes Postgres, E-Rechnungs-Validierung (KoSIT), E2E-Rauchtest.

---

## Phase 0 — Sofort, kostet nichts

- [ ] **Dependabot-Warnungen einschalten.** *Settings → Code security → Dependabot alerts.*
      Zehn Sekunden. Ohne das meldet GitHub keine neu bekannt gewordenen Sicherheitslücken;
      die wöchentliche `npm audit`-Prüfung läuft zwar, ist aber die schwächere Hälfte.
- [ ] **Offene Prüfung nachholen:** Die Migration der Nachbarschaftshilfe (3 additive Spalten,
      Commit `920cda4`) lief noch nicht gegen echtes Postgres — GitHub Actions weist diesem
      Repo seit 2026-08-04 keine Ausführungsumgebung zu (Läufe werden erzeugt, dann abgebrochen).
      Sobald das behoben ist: `gh workflow run "Migrations gegen echtes Postgres" --ref main`.
      Delta zum letzten grünen Lauf: exakt 6 SQL-Zeilen (`ADD/DROP COLUMN IF [NOT] EXISTS`).

---

## Phase 1 — Beschaffen (Inhaber, extern, parallel möglich)

Diese vier Punkte blockieren alles Weitere. Sie hängen nicht voneinander ab.

### 1.1 Hoster + Domain
Server bestellen (z. B. Hetzner), Domain registrieren, DNS auf den Server zeigen lassen.
**Beim Hoster zwingend die Verschlüsselung der Festplatte aktivieren** — Kundennamen,
Adressen und Telefonnummern liegen in der Datenbank im Klartext (bewusste Entscheidung,
weil sie durchsuchbar bleiben müssen). Der Schutz hängt allein an dieser Einstellung.
Lass dir das schriftlich bestätigen.

### 1.2 SMTP-Zugang
Ohne ihn versendet die App **still gar nichts** — kein Passwort-Zurücksetzen, keine
Mitarbeiter-Einladung, keine Statusmail an Endkunden. Kein Fehler, einfach nichts.

### 1.3 Schlüssel erzeugen
Vier Stück, je `openssl rand -hex 32`, sofort in einen Passwortmanager:

| Schlüssel | Wofür | Bei Verlust |
|---|---|---|
| `JWT_SECRET` | Anmelde-Token | alle werden abgemeldet, unkritisch |
| `DATA_ENC_KEY` | Feldverschlüsselung | **Daten unwiederbringlich verloren** |
| `BACKUP_ENC_KEY` | Sicherungen | Sicherungen nicht mehr lesbar |
| `DB_PASS` | Datenbank | neu setzen möglich |

`DATA_ENC_KEY` ist der gefährlichste. Verlierst du ihn, sind verschlüsselte
Rechnungsdaten, interne Hinweise und Kundenfeedback **weg** — auch aus jeder Sicherung.

### 1.4 Steuerberater + Anwalt beauftragen
Läuft parallel, dauert erfahrungsgemäß am längsten. Details in Phase 3.

---

## Phase 2 — Aufsetzen (sobald Phase 1 vorliegt)

Die Vorstart-Kontrolle (`backend/src/config/production-preflight.ts`) prüft diese Variablen
und bricht bei fehlenden **hart ab** — das ist Absicht.

**Zwingend:**

```
NODE_ENV=production
JWT_SECRET=            # aus 1.3
DATA_ENC_KEY=          # aus 1.3
DB_TYPE=postgres
DB_PASS=               # aus 1.3, NICHT der Standardwert
FRONTEND_URL=          # https://deine-domain.de
PUBLIC_SITE_URL=       # dieselbe Domain — sonst zeigen Sitemap und
                       # kanonische Verweise auf einen Platzhalter
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=    # PERSISTENTES Verzeichnis, kein Container-Pfad.
                       # Sonst sind nach jedem Neustart ALLE Fotos und
                       # aufbewahrungspflichtigen Belege weg.
SMTP_HOST= SMTP_PORT= SMTP_USER= SMTP_PASS= MAIL_FROM=
TRUST_PROXY_HOPS=1     # hinter Caddy/nginx — sonst lässt sich der
                       # Brute-Force-Schutz per gefälschtem Header umgehen
SECURITY_ALERT_EMAIL=  # sonst gehen Sicherheits-Warnmails ins Leere
SEED_ADMIN_PASSWORD=   # NICHT das Demo-Passwort
```

**Später (nach dem Pilot):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
Solange sie fehlen, warnt die Kontrolle nur — Zahlungen laufen im Pilot manuell.

Ablauf: Deploy nach `docs/RUNBOOK_PRODUKTION.md` → Migrationskette fahren →
Rauchtest (Anmeldung, Auftrag, Rechnung, PDF, Mailversand).

---

## Phase 3 — Recht (vor dem ersten echten Kunden)

- [ ] **Anwalt:** AGB, Datenschutzerklärung, AVV, Impressum mit echten Betreiberdaten.
      Entwürfe liegen unter `docs/compliance/`.
- [ ] **Steuerberater:** die neue Stornorechnung freigeben — Belegtitel, Behandlung im
      Buchhaltungs-Export, und ob Vollstorno genügt oder ein Differenzbeleg gebraucht wird.
      Steht auch im PR-Text von #301.
- [ ] **DNS für Mail:** SPF, DKIM, DMARC nach `docs/MAIL_SICHERHEIT.md`.
      **Schrittweise** vorgehen (`p=none` → `quarantine` → `reject`), sonst blockierst du
      am ersten Tag deine eigenen Mails. Ohne diese Einträge kann jeder Mails verschicken,
      die aussehen, als kämen sie von dir — und deine Kunden abfischen.
- [ ] **Auftragsverarbeiter:** AVV mit dem Hoster, DPA mit Anthropic (KI-Assistent).

---

## Phase 4 — Letzte Kontrolle vor echten Daten

- [ ] **Sicherung einmal echt zurückspielen.** Nicht „das Skript läuft durch", sondern:
      Datenbank wegwerfen, aus der Sicherung wiederherstellen, App startet, Daten sind da.
      Eine ungetestete Sicherung ist keine Sicherung.
- [ ] Ersten Pilotbetrieb anlegen und den kompletten Ablauf einmal von Hand durchgehen:
      Kunde → Fahrzeug → Auftrag → Rechnung → bezahlt → Übergabemappe beim Kunden.
- [ ] Erreichbarkeits-Überwachung einrichten (Ping auf `/api/v1/health/ready`).

---

## Bewusst NICHT vor dem Go-Live

| Thema | Warum später |
|---|---|
| 14 offene Abhängigkeits-Aktualisierungen | Darunter Hauptversionssprünge (Next 14→16, NestJS 10→11, Tailwind 3→4). Einzeln, mit echtem Start-Test, in einer ruhigen Woche. **#315 ist blockiert:** das pdfmake-Update bricht die gesamte PDF-Erzeugung. |
| Betriebs-Abschied (Datenlöschung) | Kündigen kann jeder selbst; das Löschen der Daten nach Vertragsende fehlt noch. Wird erst beim ersten Kündiger relevant. |
| Nachrichten für Sub-Aufträge | Kontaktfreigabe genügt zunächst. |
| Übersetzungen auf 22 Seiten | Für einen deutschen Pilotbetrieb unsichtbar. |
| Gebühr für Inserate (2 €) | Mechanik eingebaut, abgeschaltet. Braucht Stripe. |
| Kilometergenauer Umkreis | Braucht eine PLZ-Koordinatentabelle (Datenquelle + Lizenz = Inhaber-Entscheidung). |

---

## Reihenfolge in einem Satz

Dependabot-Warnungen einschalten → Hoster, Domain, SMTP und Schlüssel beschaffen →
aufsetzen und Rauchtest → Anwalt und Steuerberater abwarten → Sicherung testen →
ersten Pilotbetrieb aufschalten.

**Der Engpass ist Phase 1 und 3, nicht die Technik.** Anwalt und Steuerberater brauchen
Vorlauf — beauftrage sie zuerst, dann läuft der Rest parallel.
