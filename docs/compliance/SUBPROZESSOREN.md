> ## ⚠️ ENTWURF — anwaltliche Prüfung vor Produktivnutzung zwingend
>
> Unverbindlicher Arbeitsentwurf, **keine Rechtsberatung**, nicht anwaltlich erstellt/geprüft.
> Vor jeder produktiven Nutzung durch eine spezialisierte Kanzlei prüfen und freigeben lassen.
> Alle `<PLATZHALTER: …>` vor Nutzung durch echte Angaben ersetzen. Technische Aussagen sind
> gegen den Code belegt (Datei-Verweise); Rechtsstand-Recherche siehe `docs/RECHTLICHE_ABSICHERUNG.md`.

# Liste der Unterauftragsverarbeiter (Subprozessoren) — Anlage 2 zum AVV

**Art. 28 Abs. 2/4 DSGVO · Anlage zum AVV zwischen dem Betrieb (Verantwortlicher) und der `<PLATZHALTER: Firma Detailly>` (Auftragsverarbeiter).**

Diese Liste nennt **die tatsächlich eingesetzten** bzw. optional aktivierbaren Unterauftragsverarbeiter. Grundlage der Beauftragung ist eine **allgemeine schriftliche Genehmigung** mit Änderungs-Information und Widerspruchsrecht (siehe AVV §6). Detailly gibt jedem Unterauftragsverarbeiter im jeweiligen Vertrag mindestens dieselben Datenschutzpflichten weiter (Art. 28 Abs. 4).

Stand: `<PLATZHALTER: Datum>`.

---

## 1. Eingesetzte Unterauftragsverarbeiter (Kernbetrieb)

| # | Anbieter | Zweck / verarbeitete Daten | Sitz / Serverstandort | Drittland | Grundlage |
|---|---|---|---|---|---|
| 1 | **Hosting** `<PLATZHALTER: Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Deutschland — Serverstandort DE>` | Betrieb der Server, Datenbank, Foto-Ablage (`private-uploads/`) und Server-Logfiles — d. h. **alle** in der Plattform gespeicherten Endkundendaten | Deutschland (EU) | nein | AVV nach Art. 28 DSGVO (**Hetzner-DPA muss aktiv im Kundenkonto abgeschlossen werden — vor Prod-Go-Live**) |
| 2 | **Plattform-SMTP** `<PLATZHALTER: E-Mail-/SMTP-Provider, Anschrift>` | Versand system-/kontobezogener Mails: Passwort-Reset, E-Mail-Bestätigung, Eingangs-Benachrichtigung an den Betrieb bei neuer Online-Terminanfrage. Übermittelt werden Empfänger-Adresse + Mailinhalt | `<PLATZHALTER: Sitz>` | `<PLATZHALTER: ja/nein>` | AVV nach Art. 28; nur aktiv, wenn `SMTP_HOST` gesetzt ist (sonst No-op) |

**Belegt im Code:**
- Hosting/Foto-Ablage: `backend/src/app.module.ts` (privat gemountete Uploads), `scripts/backup.sh`.
- Plattform-SMTP: `backend/src/mailer/mail.service.ts` (Transport nur bei gesetztem `SMTP_HOST`; Empfänger im Log maskiert).

---

## 2. Optional / bedingt eingesetzte Dienste

| # | Anbieter | Zweck | Sitz | Drittland | Besonderheit |
|---|---|---|---|---|---|
| 3 | **Anthropic** `<PLATZHALTER: Anthropic PBC, San Francisco, USA / bzw. Anthropic Ireland Ltd.>` | Interner Support-Assistent (Bedienungsfragen zur App). Übermittelt wird **nur der vom Nutzer eingegebene Chat-Text** (aktuelle Frage + max. 8 vorherige Turns) | USA (bzw. EU-Tochter) | ja (USA) | **Nur** aktiv, wenn `ANTHROPIC_API_KEY` gesetzt ist. **Keine** Kunden-Datenbankdaten werden bestimmungsgemäß übermittelt. Transfer-Grundlage: **primär EU-US Data Privacy Framework, hilfsweise SCC + TIA**; keine Trainingsnutzung von API-Daten (Anthropic Commercial Terms/DPA) |
| 4 | **sevDesk GmbH** `<PLATZHALTER: Anschrift, Deutschland>` | Buchhaltungs-/Rechnungsexport — **nur wenn ein Betrieb die Anbindung selbst aktiviert** und seinen sevDesk-Token hinterlegt. Übermittelt Kontakt- und Rechnungsdaten | Deutschland (EU) | nein | Token pro Betrieb, verschlüsselt gespeichert; Aktivierung durch den Betrieb |
| 5 | **Stripe** `<PLATZHALTER: Stripe Payments Europe, Ltd., Dublin, Irland; Konzernmutter Stripe, Inc., USA>` | Abwicklung des **Detailly-SaaS-Abos der Betriebe** (Checkout/Portal/Webhooks). Übermittelt Betriebs-E-Mail und -Name; Karten-/Kontodaten liegen **ausschließlich** bei Stripe | Irland (EU) / USA | ja (USA) | Betrifft **nur** die Abo-Beziehung Detailly↔Betrieb, **nicht** Endkundendaten → hier ist Detailly **eigenständig Verantwortlicher**, nicht Auftragsverarbeiter. Nur aktiv bei gesetzten Stripe-ENV-Keys (Pilot: deaktiviert). Grundlage: **DPF + SCC** |

**Belegt im Code:**
- Anthropic: `backend/src/support-ai/support-ai.service.ts` (nativer `fetch`, ENV-Key, Stub ohne Key; nur Frage + letzte 8 Turns; System-Prompt scopet strikt auf Bedienungsfragen).
- sevDesk: verschlüsselter Token pro Betrieb (`tenant.sevdeskApiToken`), Aktivierung über die Betriebseinstellungen.
- Stripe: `backend/src/config/env.validation.ts` (Opt-in via ENV), `BillingModule`.

---

## 3. Ausdrücklich KEINE Unterauftragsverarbeiter von Detailly

- **Betriebseigener SMTP-Versand:** Hinterlegt ein Betrieb seine **eigenen** SMTP-/DKIM-Daten, gehen seine Kundenmails über **seinen eigenen** Mailserver unter seinem eigenen Absender raus (`backend/src/mailer/mail.service.ts`). Dieser Mailprovider ist ein **Auftragsverarbeiter des Betriebs**, nicht von Detailly.
- **GiroCode/QR auf Rechnungen** wird **lokal** erzeugt — keine Datenübermittlung an Dritte.

---

## 4. Genehmigungs- und Änderungsmodell (Art. 28 Abs. 2)

- **Allgemeine schriftliche Genehmigung:** Der Betrieb genehmigt die oben gelisteten Unterauftragsverarbeiter mit Abschluss des AVV.
- **Änderungen:** Detailly informiert über Aufnahme/Austausch eines Unterauftragsverarbeiters mit einer Vorlauffrist von `<PLATZHALTER: z. B. 30 Tagen>`; der Betrieb kann **widersprechen**; bei berechtigtem Widerspruch besteht ein Sonderkündigungsrecht.
- **Bekanntgabe:** Die jeweils aktuelle Liste wird `<PLATZHALTER: z. B. im Dashboard / unter detailly.de/subprozessoren>` bereitgestellt.

---

## 5. To-do des Betreibers (vor Go-Live)

- [ ] **Hetzner-AVV** (bzw. AVV des tatsächlichen Hosters) aktiv abschließen und archivieren.
- [ ] **SMTP-Provider** festlegen, dessen AVV abschließen, Sitz/Drittlandbezug eintragen.
- [ ] **Anthropic-DPA / Commercial Terms** archivieren, **falls** der Support-Assistent produktiv aktiviert wird; sonst Zeile 3 streichen.
- [ ] **Stripe-DPA** archivieren, **sobald** das Abo scharf geschaltet wird (Pilot: entfällt).
- [ ] Alle `<PLATZHALTER>` durch echte Firmierung + Anschrift ersetzen; Konsistenz mit AVV/Datenschutzerklärung prüfen.

---

*Quellen zu Sitz/Transfer-Grundlagen der Anbieter: siehe `docs/RECHTLICHE_ABSICHERUNG.md`, Abschnitt 3.2/3.3. Vor Veröffentlichung anwaltlich verifizieren.*
