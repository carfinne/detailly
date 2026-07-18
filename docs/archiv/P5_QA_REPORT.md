# P5 – Gesamt-QA- & Security-Report (integriertes `main`)

**Datum:** 2026-07-07 · **Prüfer:** Security-Auditor + Tech Writer · **Methode:** 6 Lenses (Tenant-Isolation, AuthZ, Races, Injection, DSGVO, Frontend) + je Befund 2 Skeptiker-Pässe (Re-Verifikation am integrierten Stand + adversarische Entkräftung).

---

## 1. Kurzfazit + Ampel

### 🟡 GELB (mit einem 🔴 roten Blocker)

Der integrierte Stand ist **strukturell solide**: Tenant-Isolation zeigte über alle Module **keine einzige Verletzung** (Positivbefund), `passwordHash` wird sanitisiert, der Token-Download leakt keine Tenant-Daten, und Statusübergänge wie `booking accept()` sind bereits vorbildlich konditional gesperrt. Es gibt **keinen** Auth-Bypass und **keinen** Cross-Tenant-Datenabfluss.

**Aber:** Ein Befund ist rechtlich hart und muss vor produktivem Rechnungsversand fallen — die **fortlaufende Nummernvergabe (RE/AN/AU/BE)** ist weder gesperrt noch per Unique-Index abgesichert und kann **doppelte Rechnungsnummern** erzeugen (GoBD-Verstoß). Daneben drei ernste Race-Conditions im Shop/Lager (Lost Update, Doppel-Lieferung) und ein Frontend-Fehler, der berechtigten Inhabern den Upgrade-Weg verbaut.

**Freigabe-Empfehlung:** Nummern-Blocker (#1) und die drei High-Races/-Frontend fixen → dann grün. Ampel steht auf Gelb nur wegen dieser Fix-Liste, nicht wegen Systemschwäche.

---

## 2. Sofort fixen (critical + high) — meine Fix-Liste

### 🔴 C1 · Fortlaufende Nummern ohne Sperre UND ohne Unique-Index → Doppelnummer (GoBD) · **BACKEND**
- **Datei:** `backend/src/common/numbering.ts:29-31` (Träger: `invoices.service.ts:436`, `:313`, `orders.service.ts:231`, `shop.service.ts:145`; Entity `orders/entities/order.entity.ts:66`)
- **Warum:** Nummernvergabe ist `count()+1`. Zwei quasi-gleichzeitige Requests desselben Tenants lesen `count=N`, bilden beide `RE-2026-000(N+1)` und speichern **beide** — es existiert **kein** Composite-Unique-Constraint auf `(tenantId, nummer)`. Ergebnis: zwei Rechnungen mit **identischer** Nummer → verletzt die GoBD-Pflicht eindeutiger, lückenloser Nummern (harter Prüfungsfehler). Bei Aufträgen (`AU`) sinkt der Count zusätzlich nach Löschung → die nächste Anlage vergibt eine bereits existierende `auftragsnummer`. Der Code kündigt diesen Backstop selbst als „Folge-Ticket" an (`numbering.ts:14-16`) — er fehlt real. *(Dieser eine Root-Cause deckt zugleich die als medium re-bestätigten Befunde zu RE- und AU-Nummern ab.)*
- **Fix:** `@Index(['tenantId','nummer'], {unique:true})` bzw. `['tenantId','auftragsnummer']` auf allen Nummernträgern (partiell, mehrere NULL erlaubt). Bei RE/AU zusätzlich Retry-Schleife um Insert/Update (bei Unique-Violation Nummer neu ziehen) **oder** Nummernvergabe über dedizierte Sequenz-Tabelle je `(tenant, prefix, jahr)` mit `SELECT … FOR UPDATE` / atomarem `UPDATE … RETURNING` serialisieren. **Rechnungen priorisiert (GoBD).**

### 🟠 H1 · Lagerbewegung `recordMovement`: Read-Modify-Write ohne Transaktion → Lost Update · **BACKEND**
- **Datei:** `backend/src/shop/shop.service.ts:74-92`
- **Warum:** Zwei parallele Buchungen aufs selbe Produkt (Abgang 5 + Abgang 3, Start 10) lesen beide `10`, einer schreibt `5`, der andere überschreibt mit `7` — eine Buchung geht verloren (`bestand=7` statt `2`), während **beide** `StockMovement`-Belege persistiert werden. Bestand und Bewegungshistorie driften auseinander. Kein Transaktions-Rahmen, kein atomares UPDATE, kein Negativ-Bestand-Guard.
- **Fix:** In `dataSource.transaction` Produkt + Bewegung gemeinsam schreiben; Bestand atomar per `repo.increment/decrement` bzw. `SET bestand = bestand ± :menge WHERE id=:id AND tenantId=:t` statt in JS rechnen; bei ABGANG fail-closed gegen Negativbestand prüfen.

### 🟠 H2 · `changePurchaseOrderStatus → GELIEFERT` ohne konditionalen Flip → Doppel-Lieferung bucht Lager doppelt (TOCTOU) · **BACKEND**
- **Datei:** `backend/src/shop/shop.service.ts:195-234`
- **Warum:** `BESTELLT→GELIEFERT` ist read-check-write ohne Transaktion/konditionales UPDATE. Zwei parallele „Als geliefert markieren"-Klicks lesen beide `status=BESTELLT`, bestehen beide die Prüfung, buchen **beide** den Lagerzugang (`bestand +2×menge`, zwei ZUGANG-Belege) bei nur einer echten Lieferung. Erbt zusätzlich das Lost-Update aus H1.
- **Fix:** Statusübergang als konditionales `UPDATE … WHERE id=:id AND tenantId=:t AND status='bestellt'` (nur `affected=1` gewinnt) am Anfang einer Transaktion — analog zum bereits vorbildlichen `booking-requests.service.ts accept()`. Lagerbuchung nur beim Gewinner und in derselben Transaktion.

### 🟠 H3 · Audit-Seite mappt **jedes** 403 auf Rollen-Text und verdeckt `PLAN_FEATURE_MISSING` · **FRONTEND** (+ kleiner Backend-/lib-Anteil)
- **Datei:** `frontend/src/app/(app)/audit/page.tsx:25-31` · Mit-Ursache `frontend/src/lib/api.ts:140-146` · Backend-Verhalten korrekt: `backend/src/audit/audit.controller.ts:17-18`
- **Warum:** *(Dieser High wurde von 3 Lenses — AuthZ, Tenant, Frontend — unabhängig bestätigt.)* Der `AuditController` trägt `@UseGuards(Jwt, Subscription, PlanFeature, Roles)` mit `@RequiresFeature('audit')`. Ein **berechtigter** OWNER/MANAGER auf einem Tarif **ohne** Feature `audit` löst `PlanFeatureGuard` (läuft **vor** RolesGuard) aus → 403 mit `code=PLAN_FEATURE_MISSING` und korrektem Upgrade-Text. Die Seite verwirft die Backend-`message` und zeigt hart „nur für Manager und Inhaber sichtbar" — obwohl der Nutzer bereits Owner/Manager ist. Ergebnis: irreführende Rollen-Sackgasse, **kein Upgrade-Weg**. `ApiError` reicht das gelesene `body.code` nicht durch, daher kann das Frontend Rollen-403 und Tarif-403 nicht unterscheiden.
- **Fix:** `ApiError` um Feld `code` erweitern (in `request()` bereits gelesen, nur durchreichen — Backend-Härtung/lib). In `audit/page.tsx` bei `code==='PLAN_FEATURE_MISSING'` die Backend-`message` + Link auf `/abo` zeigen, nur ohne `code` auf den Rollen-Fallback. Idealerweise zentral in `api.ts` behandeln (analog `SUBSCRIPTION_INACTIVE`).

---

## 3. Sollte (medium)

- **M1 · Nummern-Dubletten (RE/AU) — DB-Backstop** · `numbering.ts:29`, `order.entity.ts:66` · **BACKEND.** Zwei medium-Re-Bestätigungen desselben Root-Cause wie C1 (u. a. `auftragsnummer` ohne Unique; `@Index({unique})` an `order.entity.ts:82` gehört zu `freigabeToken`, nicht zur Nummer). Wird mit C1 miterledigt — hier als eigener Punkt geführt, weil der harte Backstop separat verifiziert werden muss.
- **M2 · Zahlungsziel aus DTO ungeprüft ins Datum gerechnet** · `backend/src/invoices/invoices.service.ts:323-330` · **BACKEND.** `invoice.dto.ts:49-52` deklariert `zahlungsziel` nur `@IsOptional()@IsNumber()` ohne `@Min/@Max`; die 1..365-Klammer greift nur für den Settings-Fallback, **nicht** für den Client-Wert. `zahlungsziel=-100000` → Fälligkeit in der Vergangenheit (sofort überfällig, triggert Mahnwesen); `1e15` → Invalid Date wird persistiert. **Fix:** `@Min(0) @Max(365)` am DTO **und** DTO-Wert im Service durch dieselbe Klammer schicken.
- **M3 · DSGVO Art. 17/15-Lücke bei angenommenen Terminanfragen** · `public-booking.service.ts:229`, `gdpr.service.ts:192`, `booking-requests.service.ts:154` · **BACKEND.** Angenommene `BookingRequest`-Zeilen (Status ANGENOMMEN) behalten Klartext-PII (Name/E-Mail/Telefon/Fahrzeug/Freitext) **unbefristet**: Retention-Cleanup überspringt sie, `anonymizeCustomer` fasst sie nicht an, `exportCustomerData` exportiert sie nicht. Nach dokumentierter „Löschung" liegt die PII weiter in der DB, und die Auskunft ist unvollständig. **Fix:** beim Annehmen `customerId` als FK auf der `BookingRequest` speichern; in beide DSGVO-Pfade aufnehmen (anonymisieren/löschen + exportieren) — alternativ Kontaktdaten der Anfrage direkt beim Annehmen nullen (im Customer redundant).

---

## 4. Beobachten / später (low + bewusste Tradeoffs)

- **L1 · Audit-Nav-Link ohne Rollen-Beschränkung** · `frontend/src/components/nav-data.tsx:71` · **FRONTEND.** `audit.controller.ts:24` erlaubt nur PLATFORM_ADMIN/OWNER/MANAGER, der Nav-Eintrag trägt aber kein `rollen`-Feld → Detailer/Empfang sieht „Audit-Log", klickt, bekommt 403 (Dead-End-Nav, **kein** Security-Bypass — Backend schützt). **Fix:** `rollen: LEITUNG_ROLLEN` ergänzen, konsistent zu `/auswertungen` und `/buchhaltung`.
- **L2 · Mailversand loggt Empfänger-E-Mail im Klartext (Produktion)** · `backend/src/mailer/mail.service.ts:74` (+ Stub `:61`) · **BACKEND.** Jeder Beleg-/Status-/Terminversand schreibt die volle Endkunden-Adresse auf `log`-Level, während die übrige Codebasis bewusst nur IDs loggt. Vermeidbare PII-Ansammlung in Logs (Personenbezug bei Log-Leak). **Fix:** auf Referenz-ID umstellen oder maskieren (analog `SevdeskService.maskToken`).

---

## 5. Verworfen

**18 Kandidaten adversarisch entkräftet** — überwiegend Duplikate der obigen Root-Causes (Nummern/Audit-403/Pagination) oder am integrierten Stand widerlegt: Nav-„403-Sackgasse" (Backend schützt, reine UX → als L1 abgebildet), `booking-accept maxCustomers`-TOCTOU (durch bestehende konditionale Transaktion abgesichert), `orders.findAll` unvalidiertes page/limit (Response-Shape kippt nur ohne Sicherheitsfolge), `downloadMetaByToken` volle Tenant-Entity (**re-verifiziert: kein Leak**), LIKE-Wildcards/Positions-`@Min`/`@ArrayMinSize`/`passwordHash select:false` (Härtungs-Wünsche ohne belegten Exploit). **Tenant-Isolation gesamt: Positivbefund, keine Verletzung.**

---
*Kennzeichnung: 🔴 critical · 🟠 high · medium · low. „BACKEND" = Server-/DB-Härtung, „FRONTEND" = reiner Client-Fix. C1 + H1/H2 sind Backend-Härtung, H3 überwiegend Frontend mit kleinem lib/Backend-Anteil.*
