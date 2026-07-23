> ## ⚠️ ENTWURF — Arbeitsstand, keine Rechtsberatung
>
> Konsolidiertes Tracking der rechtlichen/regulatorischen Lücken für den Go-Live-Pilot. **Keine
> Rechtsberatung.** Der Status „geschlossen" bezieht sich auf den **technischen bzw. dokumentarischen**
> Stand; die **rechtsverbindliche** Freigabe aller Rechtstexte bleibt in jedem Fall der Anwaltschaft
> vorbehalten. Belege sind gegen Code/Doc verlinkt; Rechtsstand-Recherche: `docs/RECHTLICHE_ABSICHERUNG.md`.

# Compliance-Tracking — die „28 Gesetzeslücken"

## Herkunft der Liste (transparent)
`docs/GO_LIVE_PLAN.md` (B1) beauftragt ein **„28-Lücken-Tracking"**, ohne die 28 Punkte selbst aufzuzählen. Ein verbatim nummeriertes „28er"-Register existierte im Repo **nicht** (die Zahl „28" in `FEINSCHLIFF_BRIEFING.md` bezieht sich auf UI-Seiten, nicht auf Recht). Diese Liste **konsolidiert** daher die real identifizierten Lücken aus:
- `docs/RECHTLICHE_ABSICHERUNG.md` — „Anwalt-Pflicht-Register" (36 Punkte) + Executive Summary + Go-Live-Checkliste,
- `docs/GO_LIVE_PLAN.md` — Blocker A1/A2 + Pilot-wichtig B1/B2 + NACH-PILOT,
- dem realen Code-Stand (Belege).

Auf **28 pilot-relevante Positionen** zusammengeführt und dedupliziert. Spalte „Ref RA" verweist auf die Nummer im Anwalt-Pflicht-Register von `RECHTLICHE_ABSICHERUNG.md` (Abschnitt 4).

**Legende Status:** ✅ geschlossen · 🟡 teilweise · 🔴 offen. **Verantwortlich:** Code = Entwicklungsteam · Betreiber = Inhaber/externe Konten · Anwalt = anwaltliche/steuerliche Prüfung.

---

## Übersicht

| # | Lücke | Status | Verantwortlich | Beleg | Ref RA |
|---|---|---|---|---|---|
| 1 | Zustimmungserfassung bei Registrierung (AGB/DSE/AVV) | 🔴 offen | Code | `backend/src/tenants` (Register erfasst keine Zustimmung) | — |
| 2 | AVV (Art. 28) als Entwurf | 🟡 teilweise | Anwalt/Code | `docs/compliance/AVV.md` | 5 |
| 3 | TOMs (Art. 32) dokumentiert | 🟡 teilweise | Code/Betreiber | `docs/compliance/TOMS.md` | 5 |
| 4 | Verzeichnis Art. 30 (Abs. 1 + Abs. 2) | 🟡 teilweise | Betreiber/Anwalt | `docs/compliance/VERARBEITUNGSVERZEICHNIS.md` | — |
| 5 | Subprozessorenliste | 🟡 teilweise | Betreiber | `docs/compliance/SUBPROZESSOREN.md` | 5 |
| 6 | Datenschutzerklärung Detailly (Art. 13/14) mit echten Daten | 🟡 teilweise | Betreiber/Anwalt | `frontend/src/app/datenschutz/page.tsx` | 4 |
| 7 | Datenpannen-Runbook (Art. 33/34) | 🟡 teilweise | Betreiber/Code | `docs/compliance/DATENPANNEN_RUNBOOK.md` | 6 |
| 8 | SaaS-AGB (B2B) | 🟡 teilweise | Anwalt | `docs/compliance/AGB.md` | 14–19 |
| 9 | Muster-DSE für Betriebe (RDG-konform) | 🟡 teilweise | Anwalt | `docs/compliance/DATENSCHUTZ_BETRIEB_MUSTER.md` | 9 |
| 10 | B2B-only technisch erzwungen (Unternehmer-Bestätigung + Firmenfeld) | 🔴 offen | Code | fehlt im Register-Flow | 34 |
| 11 | At-Rest-Verschlüsselung DB + Fotos | 🔴 offen | Betreiber/Hoster | `backend/src/common/crypto/encryption.ts` (nur Felder) | — |
| 12 | Backup: Verschlüsselung + Offsite + Restore-Test | 🟡 teilweise | Betreiber | `scripts/backup.sh` | — |
| 13 | Auftragsverarbeiter-Kette schließen (Hetzner-AVV, Stripe/Anthropic-DPA) | 🔴 offen | Betreiber | GO_LIVE A2.7 | 5/10 |
| 14 | Secrets erzeugen + ENV-Härtung (`JWT_SECRET`,`DATA_ENC_KEY`,`DB_PASS`) | 🟡 teilweise | Betreiber | `backend/src/config/env.validation.ts` | — |
| 15 | Impressum Detailly (§ 5 DDG) mit Anschrift + DSA-Kontaktstelle | 🟡 teilweise | Betreiber/Anwalt | `frontend/src/app/impressum/page.tsx` | 1/2 |
| 16 | IT-/Vermögensschaden-Haftpflicht + DL-InfoV-Angabe | 🔴 offen | Betreiber | — | 14 |
| 17 | E-Rechnungs-Empfang (EN 16931) technisch möglich | ✅ geschlossen | Code | `backend/src/e-invoice-eingang` (PR #206) | 29 |
| 18 | GoBD-Unveränderbarkeit Rechnungen + Nummernkreis | ✅ geschlossen | Code | `backend/src/invoices/invoice-rules.ts` | — |
| 19 | § 35a GmbHG-Pflichtangaben (Mail/Rechnung) nach HR-Eintragung | 🔴 offen | Betreiber | — | — |
| 20 | BFSG-Barrierefreiheit (WCAG 2.1 AA) + Erklärung | 🟡 teilweise | Code/Betreiber | a11y-Quickwins PR #206/#207 | 33 |
| 21 | Buchungs-Flow-Einordnung + § 312i/§ 312f/Widerruf | 🟡 teilweise | Code/Anwalt | `booking_requests` (Anfrage-Modus) | 32 |
| 22 | Cookie/§ 25 TDDDG (nur technisch notwendig, kein Banner) | 🟡 teilweise | Anwalt | `frontend/src/app/datenschutz/page.tsx` | — |
| 23 | Impressum + VSBG je Tenant-Buchungsseite (Pflicht-Gate) | 🟡 teilweise | Code/Betreiber | `frontend/src/components/PublicLegalFooter.tsx` | 3 |
| 24 | KI-Transparenz (AI Act Art. 50) + Anthropic in DSE/Subprozessoren | 🟡 teilweise | Code/Anwalt | `backend/src/support-ai` | 20/12 |
| 25 | Drittland-TIA Stripe/Anthropic (DPF + SCC) | 🔴 offen | Anwalt | `SUBPROZESSOREN.md` | 10 |
| 26 | Marktplatz-/Händler-AGB + P2B/DSA + GPSR/VerpackG/ElektroG | 🔴 offen (NACH-PILOT) | Anwalt/Code | RA 3.5/3.6 | 21–23 |
| 27 | ZAG (Direct Charges) + KYB + § 25e/§ 22f + PStTG/DAC7 | 🔴 offen (NACH-PILOT) | Anwalt/Steuerberater | RA 3.7 | 27/28 |
| 28 | DSFA / Schwellwertanalyse (Art. 35) | 🔴 offen | Anwalt/DSB | RA 3.2 | 7 |

**Zählung:** ✅ 2 · 🟡 14 · 🔴 12.

---

## Detail je Lücke (Kurzbegründung + nächster Schritt)

### Bereich 1 — Vertrags- und Datenschutzgrundlage (SaaS-Kern, P0)
- **1 · Zustimmungserfassung (🔴 Code):** Die Selbst-Registrierung legt Tenant + Inhaber an, erfasst aber **keine** dokumentierte Zustimmung zu AGB/DSE/AVV → ohne diese ist der AVV-Abschluss (Art. 28 Abs. 9) nicht nachweisbar. **Nächster Schritt:** Checkbox + gespeicherter Zeitstempel/Version beim Onboarding (Code-Team, GO_LIVE A1.1).
- **2 · AVV (🟡):** Entwurf `AVV.md` liegt vor (auf SCC 2021/915 aufbauen). **Offen:** Anwaltsfreigabe + elektronischer Abschluss (hängt an #1).
- **3 · TOMs (🟡):** `TOMS.md` code-belegt; **offen:** die dort markierten Betreiber-/Hoster-Punkte (At-Rest, Backup-Krypto).
- **4 · Art. 30 (🟡):** `VERARBEITUNGSVERZEICHNIS.md` (Abs. 2 + Muster Abs. 1); **offen:** echte Firmendaten/Fristen, laufende Fortschreibung.
- **5 · Subprozessoren (🟡):** `SUBPROZESSOREN.md`; **offen:** echte Anbieter/Anschriften + AVV/DPA-Status.
- **6 · DSE Detailly (🟡):** Seite live mit sichtbaren Platzhaltern; **offen:** Anschrift, Hoster/SMTP, Stripe/Anthropic-Abschnitte, Anwaltsfreigabe.
- **7 · Datenpannen-Runbook (🟡):** `DATENPANNEN_RUNBOOK.md`; **offen:** Kontakte/Fristen final; Register nur als Prozess (kein Code-Modul — ehrlich vermerkt).
- **8 · SaaS-AGB (🟡):** `AGB.md`; **offen:** Haftungs-Cap/Versicherung, Preis-/Änderungsklauseln, Data-Act-Anlage — Anwalt.
- **9 · Muster-DSE Betrieb (🟡):** `DATENSCHUTZ_BETRIEB_MUSTER.md` mit RDG-Disclaimer; **offen:** idealerweise Kanzlei-Kooperation (§ 2 RDG).
- **10 · B2B-only (🔴 Code):** Unternehmer-Bestätigung + Pflichtfeld Firma/Gewerbe technisch erzwingen, sonst kippt die B2B-Statik der AGB.

### Bereich 2 — Betrieb/Sicherheit (P0, überwiegend Betreiber)
- **11 · At-Rest (🔴 Betreiber/Hoster):** Feld-Verschlüsselung deckt nur definierte Felder; Kundenname/Kennzeichen/VIN/Fotos liegen sonst klartext → verschlüsseltes Volume nötig (GO_LIVE A2.3).
- **12 · Backup (🟡):** `scripts/backup.sh` erzeugt Dump + Foto-Archive; **offen:** gpg-Verschlüsselung, Offsite, Restore-Test (Betreiber).
- **13 · AV-Kette (🔴 Betreiber):** Hetzner-AVV aktiv abschließen; Stripe-/Anthropic-DPA gegenzeichnen.
- **14 · Secrets/ENV (🟡):** `env.validation.ts` erzwingt Pflicht/Härtung in Prod; **offen:** echte Werte erzeugen + sicher verwahren (DATA_ENC_KEY-Verlust = Datenverlust).
- **15 · Impressum (🟡):** Seite live; **offen:** ladungsfähige Anschrift (harte Pflicht), zweiter Kontaktweg, DSA-Kontaktstelle Art. 11/12, nach Eintragung HRB + „i. G." entfernen.
- **16 · Haftpflicht (🔴 Betreiber):** IT-/Vermögensschaden-Haftpflicht abschließen; DL-InfoV-Angabe + Cap koppeln.

### Bereich 3 — Rechnung/Steuer (P0/P1)
- **17 · E-Rechnungs-Empfang (✅):** Empfang/Lesen von XRechnung/ZUGFeRD + GoBD-Archiv im Produkt (`e-invoice-eingang`). **Folge:** eigene E-Rechnungs-**Ausstellung** ab 2027/28.
- **18 · GoBD (✅):** festgesetzte Rechnung unveränderlich, Storno-only, lückenloser Nummernkreis (`invoice-rules.ts`).
- **19 · § 35a GmbHG (🔴 Betreiber):** nach HR-Eintragung Pflichtangaben in E-Mail-Signaturen/Rechnungs-Templates.

### Bereich 4 — Buchungsportal/B2C (P1)
- **20 · BFSG (🟡):** a11y-Quickwins (role=alert, Kontrast AA, Skip-Link) gemergt; **offen:** vollständige WCAG-2.1-AA-Abdeckung + Erklärung zur Barrierefreiheit.
- **21 · Buchungs-Flow (🟡):** „unverbindliche Anfrage" ist Default (`booking_requests`); **offen:** verbindlicher Flow mit § 312i/§ 312f/Widerruf, falls gewünscht.
- **22 · Cookie/TDDDG (🟡):** nur technisch notwendiger Login-Token; **offen:** anwaltliche Bestätigung „kein Banner" (gilt nur ohne Tracking).
- **23 · Tenant-Impressum/VSBG (🟡):** Footer verlinkt Betriebs-Impressum; **offen:** Veröffentlichungs-Gate + VSBG-Slot.

### Bereich 5 — KI/Drittland (P1/P2)
- **24 · KI-Transparenz (🟡):** Support-Assistent opt-in (nur Chat-Text an Anthropic, keine DB-PII); **offen:** AI-Act-Art.-50-Kennzeichnung + Nennung in DSE/Subprozessoren.
- **25 · TIA (🔴 Anwalt):** Transfer-Folgenabschätzung Stripe/Anthropic (DPF + SCC), laufend aktuell halten.

### Bereich 6 — NACH-PILOT (bewusst später)
- **26 · Marktplatz/P2B/GPSR (🔴):** Marktplatz-/Händler-AGB, DSA-Kontaktstellen, GPSR/VerpackG/ElektroG/BattDG-Betreiberpflichten.
- **27 · ZAG/Steuer (🔴):** Stripe auf Direct Charges (keine Geldannahme), KYB, § 25e/§ 22f UStG, PStTG/DAC7 (BZSt/DIP 2.x).
- **28 · DSFA (🔴):** Schwellwertanalyse/DSFA nach Art. 35 (Multi-Tenant + KYB-Uploads + KI).

---

## Was Inhaber/Anwalt noch tun müssen (Kurzliste)
**Inhaber/Betreiber:** echte Firmendaten in alle `<PLATZHALTER>` (Anschrift ist harte Pflicht); Secrets erzeugen & verwahren; Hoster + verschlüsseltes Volume; Backup verschlüsseln/offsite + Restore-Test; Hetzner-AVV + Stripe/Anthropic-DPA; SMTP-Zugang; IT-Haftpflicht; nach HR-Eintragung HRB/§ 35a nachziehen.
**Anwalt/Steuerberater/DSB:** Finalfreigabe aller Rechtstexte (AVV/AGB/DSE/Impressum/Runbook/Muster); TIA + DPF/SCC; RDG-Konformität der Muster; DSFA-Schwellwertanalyse; NACH-PILOT (Marktplatz/ZAG/Steuer).
**Code-Team:** Zustimmungserfassung (#1), B2B-Gate (#10), Foto-At-Rest, serverseitige 2FA-Pflicht, CSP-Enforce, optionales Datenpannen-Register.

*Diese Übersicht ist bei jedem Compliance-Fortschritt fortzuschreiben.*
