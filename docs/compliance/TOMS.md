> ## ⚠️ ENTWURF — anwaltliche Prüfung vor Produktivnutzung zwingend
>
> Unverbindlicher Arbeitsentwurf, **keine Rechtsberatung**, nicht anwaltlich erstellt/geprüft.
> Vor jeder produktiven Nutzung durch eine auf IT-/Datenschutzrecht spezialisierte Kanzlei prüfen
> und freigeben lassen. Alle `<PLATZHALTER: …>` vor Nutzung durch echte Betreiberdaten ersetzen.
> Die technischen Aussagen sind gegen den tatsächlichen Code-Stand belegt (Datei-Verweise am
> Zeilenrand); Rechtsstand-Recherche DE/EU siehe `docs/RECHTLICHE_ABSICHERUNG.md` (Stand 2026-07).

# Technische und organisatorische Maßnahmen (TOM) — Anlage 3 zum AVV

**Art. 32 DSGVO · Anlage zum Auftragsverarbeitungsvertrag zwischen dem Betrieb (Verantwortlicher) und der `<PLATZHALTER: Firma Detailly, z. B. Detailly UG (haftungsbeschränkt) i. G.>` (Auftragsverarbeiter).**

Diese Anlage beschreibt **ausschließlich Maßnahmen, die real im Produkt umgesetzt sind** (mit Fundstelle im Code), sowie — klar getrennt und ehrlich gekennzeichnet — die Punkte, die der **Betrieb bzw. der Hoster** eigenverantwortlich sicherstellen muss. Sie enthält keine „geplanten" oder „bald verfügbaren" Zusagen in verbindlicher Form.

Stand: `<PLATZHALTER: Datum>` · Bezugs-Code-Stand: Branch `integration/session-2026-07`.

---

## 0. Kurzüberblick (Ampel)

| Bereich | Status im Code | Wer verantwortet den Rest |
|---|---|---|
| Transportverschlüsselung (TLS) | Security-Header/HSTS gesetzt | Zertifikat + TLS-Terminierung: **Betreiber/Hoster** |
| Feld-Verschlüsselung (definierte Felder) | ✅ umgesetzt (AES-256-GCM) | — |
| At-Rest-Verschlüsselung der gesamten DB + Fotos | ⚠️ nicht in der App | **Betreiber/Hoster** (verschlüsseltes Volume) |
| Zugriffskontrolle / Rollen / Mandantentrennung | ✅ umgesetzt | — |
| Brute-Force-/Rate-Limiting | ✅ umgesetzt (in-memory) | persistenter Zähler = Roadmap |
| 2-Faktor-Authentifizierung (2FA/TOTP) | ✅ umgesetzt | serverseitige Pflicht = Roadmap |
| Audit-Log / Nachvollziehbarkeit | ✅ umgesetzt | — |
| GoBD-Unveränderbarkeit (Rechnungen) | ✅ umgesetzt | — |
| Betroffenenrechte (Export/Löschung) | ✅ umgesetzt | Auslösung durch Betrieb |
| Upload-Härtung | ✅ umgesetzt | — |
| Backup | ✅ Skript vorhanden | Verschlüsselung + Offsite + Restore-Test: **Betreiber** |

---

## 1. Vertraulichkeit (Art. 32 Abs. 1 lit. b)

### 1.1 Transportverschlüsselung (TLS)
Sicherheits-Header werden serverseitig ganz oben in der Request-Kette gesetzt (Helmet inkl. **HSTS**, `X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors 'none'` gegen Clickjacking) — `backend/src/main.ts`.
- **Offen / Betreiber-Ebene:** Die eigentliche TLS-Terminierung und das gültige Zertifikat stellt der Reverse-Proxy des Betreibers (z. B. Caddy/Nginx) bereit. **Durch Betreiber/Hoster sicherzustellen.**

### 1.2 Feld-Verschlüsselung ausgewählter Datenbankspalten (at-column)
Anwendungsseitige Verschlüsselung mit **AES-256-GCM** (authentifiziert, erkennt Manipulation), Marker `enc:v1:`, Schlüssel aus ENV `DATA_ENC_KEY` — `backend/src/common/crypto/encryption.ts`, `backend/src/common/crypto/encrypted-column.ts`. Tatsächlich verschlüsselte Felder:
- **Betriebs-Zahlungs-/Steuerdaten** in `tenant.settings`: IBAN, Steuernummer, USt-IdNr., Bankverbindung — `backend/src/tenants/entities/tenant.entity.ts`.
- **Geheimnisse des Betriebs:** sevDesk-API-Token, SMTP-Passwort, privater DKIM-Schlüssel (`select:false`) — dieselbe Entity.
- **2FA-Geheimnisse:** `user.totpSecret`, `user.recoveryCodes` (verschlüsselt + `select:false`) — `backend/src/users/entities/user.entity.ts`.
- **Rechnungen:** Freitext `hinweis` und der personenbezogene **Empfänger-Snapshot** (Name/Anschrift/USt-IdNr.) — `backend/src/invoices/entities/invoice.entity.ts`.
- **Aufträge:** interner Freitext-Hinweis — `backend/src/orders/entities/order.entity.ts`.

Schlüsselverlust = Datenverlust (dokumentiert im Code-Header). Bei falschem/rotiertem Schlüssel wird **laut** abgebrochen (`DecryptionError`), nie stillschweigend Chiffretext ausgeliefert.

### 1.3 At-Rest-Verschlüsselung der gesamten Datenbank und der Foto-Dateien — Betreiber/Hoster
**Ehrlich gekennzeichnet:** Die Feld-Verschlüsselung (1.2) deckt **nur den oben genannten, besonders sensiblen Satz** ab. Der Großteil der Endkunden-PII — **Kundenname, Kontakt, Anschrift** (`customers`), **Kennzeichen und Fahrgestellnummer/VIN** (`vehicles`), Foto-Dateien — liegt in **Klartext-Spalten bzw. -Dateien**. Diese sind durch eine **verschlüsselte Ablage auf Speicherebene** zu schützen (verschlüsseltes Volume/LUKS bzw. Hoster-seitige Verschlüsselung). **Durch Betreiber/Hoster sicherzustellen** (siehe `docs/GO_LIVE_PLAN.md`, Punkt A2.3).

Ein Primitiv zur Datei-Verschlüsselung existiert bereits (`encryptBuffer`/`decryptBuffer`, Datei-Marker `DLYENC1`), ist aber für die Foto-Ablage **noch nicht flächendeckend verdrahtet** (Foto-At-Rest-Verschlüsselung ist als NACH-PILOT-Schritt vermerkt) — deshalb kein verbindlicher Katalogeintrag.

### 1.4 Passwörter / Anmeldegeheimnisse
- Passwörter ausschließlich als **bcrypt-Hash** (Kostenfaktor 12) — `backend/src/auth/auth.service.ts`.
- Reset-/Bestätigungs-Tokens werden **nur als SHA-256-Hash** gespeichert, sind einmalig verwendbar und laufen ab (Reset 1 h, E-Mail-Bestätigung 48 h).
- Secrets (Stripe-, Anthropic-, SMTP-Schlüssel) liegen **ausschließlich im ENV**, nie im Code oder in der DB, und werden nie geloggt.

### 1.5 Zugriffskontrolle und Mandantentrennung
- JWT-basierte Authentifizierung; rollenbasierte Autorisierung mit **strikt getrennten Plattform- und Betriebs-Rollen** (`PLATFORM_*` vs. `OWNER/MANAGER/TECHNICIAN/RECEPTIONIST`) — `backend/src/users/entities/user.entity.ts`.
- **Strikte Mandantentrennung:** `tenantId` stammt immer aus dem Token; jede fachliche Query ist auf den eigenen Betrieb beschränkt (kein betriebsübergreifender Zugriff, auch nicht für `platform_admin` bei Endkundendaten). Rang-Wächter verhindern Rechte-Eskalation (z. B. Manager kann keinen Inhaber anlegen) — `backend/src/employees/*`.
- Gehaltsdaten (`user.stundenlohn`) und 2FA-Geheimnisse werden über `/auth/me` nie ausgeliefert (kuratierte Profil-Sicht).

### 1.6 Brute-Force-Schutz / Rate-Limiting („Sentinel")
Globaler Rate-Limiter (`ThrottlerGuard`) und enge Sonderlimits — `backend/src/app.module.ts`, `backend/src/auth/auth.controller.ts`:
- Global **600 Anfragen/min pro IP**; **Login 5/min**; Passwort-Reset-Anforderung 3/min; Reset-Bestätigung 5/min; 2FA-Verify 5/min.
- `trust proxy = 1`, damit hinter dem Reverse-Proxy die echte Client-IP zählt (kein Zusammenfallen aller Nutzer auf die Proxy-IP) — `backend/src/main.ts`.
- **Ehrlich gekennzeichnet:** Die Zähler sind **in-memory pro Instanz**; ein persistenter/verteilter Login-Zähler (Redis) ist als Folge-Schritt vermerkt (relevant erst bei horizontaler Skalierung).

### 1.7 Zwei-Faktor-Authentifizierung (2FA/TOTP)
Vollständige TOTP-Implementierung — `backend/src/auth/mfa.service.ts`, `totp.ts`:
- Enrollment mit QR/Base32, Aktivierung per erstem Code, **10 Einmal-Recovery-Codes** (nur als SHA-256-Hash, verschlüsselt gespeichert, single-use, konstantzeit-Vergleich).
- Zweistufiger Login (kurzlebiges `mfaPending`-Token, 2 min); JWT-Revocation über `tokenVersion` entwertet Alt-Sessions beim Aktivieren/Deaktivieren.
- Betriebsweite 2FA-Pflicht über Tenant-Setting `mfaPflicht` (Frontend erzwingt Einrichtung).
- **Ehrlich gekennzeichnet:** Eine **serverseitige** harte 2FA-Pflicht (mindestens für Plattform-Admins) ist als Härtungsschritt vermerkt, aktuell wird die Einrichtung frontendseitig erzwungen.

### 1.8 Sichere Voreinstellungen (Secure Defaults)
- Eingabevalidierung global mit `whitelist: true` + `forbidNonWhitelisted: true` → **Schutz vor Mass-Assignment** (unerlaubte Felder → 400) — `backend/src/main.ts`.
- Globaler Exception-Filter: keine Stacktrace-/Interna-Leaks (generische 500) — `backend/src/common/filters/all-exceptions.filter.ts`.
- **CORS** ohne Fail-open (Prod nur explizite `FRONTEND_URL`); Swagger-API-Doku in Produktion **abgeschaltet**.
- **ENV-Validierung** beim Boot: erzwingt `JWT_SECRET` (Prod ≥ 16 Zeichen, keine bekannten Dev-Defaults) und `DATA_ENC_KEY` (≥ 32 Zeichen bei Prod/Postgres), sonst **lauter Boot-Abbruch** — `backend/src/config/env.validation.ts`.
- **CSP** ist als Content-Security-Policy im **Report-Only-Modus** aktiv (Scharfschaltung als Härtungsschritt vermerkt).

---

## 2. Integrität (Art. 32 Abs. 1 lit. b)

### 2.1 Upload-Härtung
- **Kein öffentlicher `/uploads`-Mount mehr.** Alle Fotos (Inspektion + Auftrag) liegen unter `private-uploads/<bereich>/<tenantId>/` und werden ausschließlich **guard-geschützt und tenant-scoped** ausgeliefert — `backend/src/app.module.ts` (Kommentar), Foto-Controller.
- **Magic-Byte-Prüfung** hochgeladener Bilder (echter Dateityp statt Endung).
- **Path-Traversal-Schutz** (basename-Resolve + Präfix-Check, trenner-sicher) in den Foto-Resolvern und im SPA-Fallback (`safeJoin`).
- **Body-Größen-Limits** zweistufig: 256 kb global (DoS-Schutz für anonyme Endpunkte), 12/25 mb nur auf Upload-Routen — `backend/src/common/http/body-limits.ts`; zusätzlich Foto-Anzahl-Caps je Auftrag.

### 2.2 GoBD-Unveränderbarkeit von Rechnungen
- Eine **festgesetzte Rechnung** (kein Angebot, Entwurf verlassen) ist unveränderlich; Korrektur nur per **Storno**; erlaubte Statuswechsel sind whitelistet — `backend/src/invoices/invoice-rules.ts` (`istFestgesetzt`, `statuswechselErlaubt`).
- Lückenloser Rechnungsnummernkreis je Präfix/Jahr, Vergabe erst bei Festsetzung (Race-sicher).

### 2.3 Manipulationserkennung
- AES-256-GCM ist authentifiziert: jede Veränderung an verschlüsselten Feldern/Dateien führt beim Entschlüsseln zu einem **lauten Fehler** (`DecryptionError`), nie zu stiller Auslieferung von Datenmüll.

---

## 3. Verfügbarkeit und Belastbarkeit (Art. 32 Abs. 1 lit. b/c)

### 3.1 Backup
- Backup-Skript (dependency-frei, POSIX sh): **DB-Dump** (`pg_dump -F c` bzw. SQLite `.backup`) **plus** die Foto-Verzeichnisse `uploads/` und `private-uploads/` — `scripts/backup.sh`.
- Das Skript weist **im Kopf ausdrücklich** darauf hin, dass `private-uploads/` personenbezogene Fotos enthält und das Archiv verschlüsselt (z. B. gpg) und außerhalb des Servers aufzubewahren ist.
- **Offen / Betreiber-Ebene:** Backup-**Verschlüsselung**, **Offsite-Ablage** und regelmäßiger **Restore-Test** sind **durch den Betreiber** einzurichten (siehe `docs/GO_LIVE_PLAN.md`, A2.4/B2).

### 3.2 Betriebsstabilität
- Rate-Limiting (1.6) und Body-Limits (2.1) begrenzen Überlast/DoS.
- Health-Endpunkt `/health` außerhalb des API-Präfixes für Uptime-Monitoring — `backend/src/main.ts`.
- **Offen / Betreiber-Ebene:** Uptime-Monitoring/Alarmierung an einen echten Kanal (`SECURITY_ALERT_EMAIL`) — durch Betreiber (GO_LIVE B2).

---

## 4. Verfahren zur regelmäßigen Überprüfung, Bewertung und Evaluierung (Art. 32 Abs. 1 lit. d)

### 4.1 Protokollierung / Audit-Log
- Zentrales `audit_logs` (Wer/Was/Wann: `userId`, `action`, `entityType`, `entityId`, `payload`, `createdAt`) — `backend/src/audit/entities/audit-log.entity.ts`, `audit.service.ts`.
- **Faktisch append-only:** Der Service bietet nur `log()` (schreiben) und ein hart gedeckeltes `findAll()` (Lese-Limit 1..200, DoS-Schutz); es gibt **keine** Update-/Delete-API. Die einzige gezielte Änderung ist die **DSGVO-Payload-Redaktion** bei Kunden-Löschung (Abschnitt 5), die den Wer/Was/Wann-Trail erhält (Rechenschaft, Art. 5 Abs. 2 DSGVO).

### 4.2 Tests / CI
- Automatisierte Test-Suite (u. a. Sicherheits-/Rollen-/Nummernkreis-/Krypto-Tests) läuft real blockierend in der CI.

### 4.3 Änderungsmanagement / Reviews
- Änderungen laufen über Pull Requests mit adversarialem Sicherheits-Review (organisatorische Maßnahme, dokumentiert in `docs/` und den Projekt-Trackern).

---

## 5. Unterstützung der Betroffenenrechte (technisch umgesetzt)

`GdprModule` — `backend/src/gdpr/gdpr.service.ts`:
- **Art. 15 (Auskunft/Export):** strukturierter JSON-Export aller personenbezogenen Daten eines Kunden über sämtliche PII-Tabellen (Kunde, Fahrzeuge, Aufträge, Rechnungen, Termine, Inspektionen, Vermietungen, kundenbezogene Audit-Logs), **tenant-scoped**, nur Rolle Inhaber/`OWNER`.
- **Art. 17 (Löschung/Anonymisierung):** in **einer DB-Transaktion**; GoBD-/§-14-UStG-bewusst — der Rechnungs-Empfänger bleibt als **eingefrorener Snapshot** erhalten, während die Kundenstammdaten anonymisiert werden; Fahrzeuge (Kennzeichen/VIN) werden hart gelöscht; Foto-Dateien werden **nach** dem Commit physisch entfernt (streng innerhalb des Tenant-Ordners); Audit-Payloads werden redigiert; idempotent.

---

## 6. Pseudonymisierung / Datenminimierung (Art. 32 Abs. 1 lit. a)

- **Quell-IP** öffentlicher Terminanfragen wird **nur gehasht** gespeichert (`sourceIpHash`), nie im Klartext — `backend/src/public-booking/entities/booking-request.entity.ts`.
- Öffentliche Terminanfragen liegen in einer **eigenen, isolierten Tabelle** (`booking_requests`) mit eigener, kurzer Aufbewahrung (Richtwert 90 Tage) und werden erst beim „Annehmen" in einen echten Termin/Kunden überführt (klarer Vertrauensübergang).
- Öffentliche Buchungs-Endpunkte liefern nur eine strikte SELECT-Whitelist (keine internen IDs/E-Mails/Settings/Tokens).

---

## 7. Offene Punkte / Verantwortung des Betreibers oder Hosters (Zusammenfassung)

| # | Punkt | Verantwortlich |
|---|---|---|
| 1 | At-Rest-Verschlüsselung der gesamten DB + Foto-Volume | Betreiber/Hoster |
| 2 | TLS-Zertifikat + -Erzwingung am Reverse-Proxy | Betreiber |
| 3 | Backup-Verschlüsselung + Offsite + Restore-Test | Betreiber |
| 4 | Hetzner-AVV aktiv abschließen; Stripe-/Anthropic-DPA gegenzeichnen | Betreiber |
| 5 | Uptime-Monitoring / Alarmierung (`SECURITY_ALERT_EMAIL`) | Betreiber |
| 6 | Foto-At-Rest-Verschlüsselung flächendeckend verdrahten | Code-Team (Roadmap) |
| 7 | Serverseitige 2FA-Pflicht (mind. Plattform-Admins) | Code-Team (Roadmap) |
| 8 | CSP von Report-Only auf Enforce | Code-Team (Roadmap) |
| 9 | Persistenter/verteilter Login-Zähler (Redis) | Code-Team (Skalierung) |
| 10 | Schlüssel-Rotation (`DATA_ENC_KEY`, Key-ID im Marker) | Code-Team (Roadmap) |

---

*Diese TOM-Anlage ist gegen den realen Code-Stand belegt und bewusst konservativ formuliert. Sie ersetzt keine anwaltliche/DSB-Prüfung nach Art. 32 DSGVO.*
