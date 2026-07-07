# Business Case: Detailly

**Stand: 2026-07-02** · Erstellt vom Business-Analyst-Agenten · Alle Web-Preise wurden am 02.07.2026 abgerufen; jede Zahl hat eine Quelle. Zahlen ohne Quelle sind **explizit als Schätzung markiert**.

> **Für Nicht-BWLer kurz erklärt:** Ein Business Case beantwortet drei Fragen:
> (1) Was kostet der Betrieb der App? (2) Was kann man dafür verlangen (Markt)?
> (3) Ab wie vielen zahlenden Kunden ist man im Plus (Break-even)?

---

## 0. Ausgangslage im Code (was heute schon existiert)

Bevor gerechnet wird: Detailly hat bereits ein echtes Abo-Modul mit zwei Tarifen. Diese Zahlen sind die Basis aller Rechnungen unten.

| Tarif | Preis/Monat | Preis/Jahr | Enthalten | Limits |
|---|---|---|---|---|
| **Starter** | 29 € | 290 € (≈ 2 Monate gratis) | Kunden, Fahrzeuge, Aufträge, Termine, Rechnungen | max. 5 Nutzer, 1 Standort, 500 Kunden |
| **Pro** | 49 € | 490 € | + Shop/Lager, Mitarbeiter, Standorte, Audit | max. 25 Nutzer, 5 Standorte, Kunden unbegrenzt |

**Belege im Repo:**
- Tarif-Definition (Seeds): `backend/src/database/seed.ts` (Zeilen 84–104: `starter` 29 €/290 €, `pro` 49 €/490 €)
- Tarif-Entity mit Stripe-Anbindung (`stripePriceId`, `stripePriceIdYearly`): `backend/src/subscriptions/entities/plan.entity.ts`
- Stripe-Billing bereits implementiert: `backend/src/billing/billing.service.ts`, `backend/src/billing/stripe-webhook.controller.ts`
- E-Mail-Versand provider-neutral über SMTP (nodemailer): `backend/src/mailer/mail.service.ts` → jeder SMTP-Anbieter (Brevo, SES, …) ist ohne Code-Änderung nutzbar
- Kein Push-Dienst im Backend integriert (kein `web-push`/FCM in `backend/package.json`) → Push ist heute ein Null-Kosten-Punkt

**Wichtig für die Hosting-Frage:** Das Backend ist NestJS + TypeORM (klassische SQL-Datenbank). Das passt 1:1 auf einen eigenen Server (Hetzner). Firebase (Firestore = NoSQL) würde ein **Umschreiben des Backends** bedeuten und ist daher nur als Vergleich aufgeführt, keine echte Option.

---

## 1. Kostenkalkulation

### 1.1 Annahmen (damit die Zahlen vergleichbar sind)

„Nutzer" heißt hier: einzelne eingeloggte Personen (Mitarbeiter der Betriebe). Ein zahlender Kunde von Detailly ist ein **Tenant** (Betrieb). Annahme: **Ø 5 Nutzer pro Tenant** (entspricht dem Starter-Limit in `backend/src/database/seed.ts`).

| Stufe | Nutzer gesamt | ≈ Tenants (zahlende Betriebe) | Last-Annahme (Schätzung) |
|---|---|---|---|
| Klein | 100 | ~20 | wenige Requests/s, DB < 1 GB |
| Mittel | 1.000 | ~200 | moderate Last, DB wenige GB |
| Groß | 10.000 | ~2.000 | dauerhafte Last, DB 10–50 GB, Redundanz nötig |

Detailly ist eine **Web-App** (Next.js-Frontend + NestJS-API), Single-App-Hosting auf einem Server ist möglich. B2B-Werkstattsoftware erzeugt wenig Traffic pro Nutzer (kein Video, wenige Bilder) – die Last-Annahmen sind daher konservativ, aber Schätzungen.

### 1.2 Hosting-Vergleich

**Achtung, frische Preisänderung:** Hetzner hat zum **15.06.2026** die Cloud-Preise erhöht. Es gelten die neuen Preise (Quelle: [Hetzner Docs – Price Adjustment 15 June 2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/), abgerufen 2026-07-02):

| Hetzner-Server | vCPU/RAM | Neu ab 15.06.2026 | vorher |
|---|---|---|---|
| CX23 (shared) | 2 vCPU / 4 GB | **5,49 €/Monat** | 3,99 € |
| CX33 (shared) | 4 vCPU / 8 GB | **8,49 €/Monat** | 6,49 € |
| CX43 (shared) | 8 vCPU / 16 GB | **15,99 €/Monat** | 11,99 € |
| CPX32 (AMD) | 4 vCPU / 8 GB | 35,49 €/Monat | 13,99 € |

(Netto zzgl. USt.; IPv4-Adresse ca. +0,50 €/Monat, Backups +20 % Aufpreis – Schätzung auf Basis des bekannten Hetzner-Modells. Weitere Quellen: [Hetzner Pressroom](https://www.hetzner.com/pressroom/new-cx-plans/), [datacentrenews.uk](https://datacentrenews.uk/story/hetzner-unveils-new-cloud-server-plans-from-eur-3-79-per-month) – dort noch Alt-Preise genannt.)

**Vercel** (Frontend-Hosting): Hobby = 0 €, **Pro = 20 $/Entwickler/Monat** inkl. 20 $ Nutzungsguthaben, 1 TB Traffic, 10 Mio. Edge-Requests; darüber z. B. 0,15 $/GB Traffic. Quellen: [vercel.com/pricing](https://vercel.com/pricing), [vercel.com/docs/plans/pro-plan](https://vercel.com/docs/plans/pro-plan) (abgerufen 2026-07-02).

**Supabase** (Postgres-Backend als Service): Free = 0 € (500 MB DB, Projekt pausiert nach 1 Woche Inaktivität – für Produktion ungeeignet), **Pro = 25 $/Monat/Projekt** (8 GB DB, 100k MAU, inkl. 10 $ Compute-Guthaben), Team = 599 $/Monat. Quellen: [supabase.com/pricing](https://supabase.com/pricing), [uibakery.io/blog/supabase-pricing](https://uibakery.io/blog/supabase-pricing) (abgerufen 2026-07-02).

**Firebase**: Spark = 0 € (u. a. Firestore 1 GB, 50k Reads/Tag), Blaze = Pay-as-you-go (Firestore 0,18 $/100k Reads, 0,18 $/100k Writes, 0,26 $/GB; Hosting 0,15 $/GB Traffic). Typisch laut Quellen: kleine Apps 10–50 $/Monat, mittlere 50–300 $/Monat (Schätzbereich der Quelle). Quellen: [firebase.google.com/pricing](https://firebase.google.com/pricing), [cloud.google.com/firestore/pricing](https://cloud.google.com/firestore/pricing), [supertokens.com/blog/firebase-pricing](https://supertokens.com/blog/firebase-pricing) (abgerufen 2026-07-02).

**Monatskosten-Vergleich je Nutzer-Stufe** (Hosting only; Kombinationen und Auslegung = Schätzung, Einzelpreise = belegt wie oben):

| Stufe | Hetzner (Empfehlung) | Vercel + Supabase | Firebase (nur theoretisch*) |
|---|---|---|---|
| **100 Nutzer** | 1× CX23 (App+DB auf einem Server): **~6–8 €** | Free Tier möglich, produktiv realistisch Pro+Pro: **~45 $ (~42 €)** | Spark 0 € bis Blaze ~10–25 $ |
| **1.000 Nutzer** | CX33 (App) + CX23 (DB) + Backups: **~17–20 €** | Vercel Pro + Supabase Pro + etwas Usage: **~50–80 $** | Blaze **~50–150 $** |
| **10.000 Nutzer** | 2× CX43 + LB + DB-Server + Backups: **~60–90 €** | Vercel Pro + Usage + Supabase Pro/Team + Compute: **~150–500 $** | Blaze **~150–500 $** |

\* Firebase würde einen Backend-Rewrite erfordern (NestJS/TypeORM/SQL ↔ Firestore/NoSQL) – siehe Abschnitt 0. Umstellungskosten wären weit höher als jede Hosting-Ersparnis.

**Empfehlung: Hetzner.** Für eine mandantenfähige SQL-App ist ein Hetzner-Server die mit Abstand günstigste und passendste Option (deutscher Anbieter, DSGVO-freundlich, Serverstandort DE – passt zur Verschlüsselungs-/DSGVO-Anforderung des Projekts). Selbst bei 10.000 Nutzern bleibt man unter 100 €/Monat, während Vercel+Supabase dann das 3–5-Fache kostet. Preis-Trade-off: Bei Hetzner betreibt man Updates/Backups/Monitoring selbst (Zeitkosten, nicht Geldkosten).

### 1.3 App-Store-Gebühren (nur Ausblick – Detailly ist aktuell eine Web-App)

| Store | Gebühr | Status |
|---|---|---|
| Apple Developer Program | **99 $/Jahr** + 15 % Provision auf In-App-Umsätze (< 1 Mio. $/Jahr, sonst 30 %) | lt. Drittquellen (offizielle Apple-Seite nicht direkt abgerufen) |
| Google Play Console | **25 $ einmalig** + 15 % auf die erste 1 Mio. $/Jahr (Abos ab Jahr 2: 15 %) | lt. Drittquellen (offizielle Google-Seite nicht direkt abgerufen) |

Quellen (abgerufen 2026-07-02): [groovyweb.co – Apple Developer Fee 2026](https://www.groovyweb.co/blog/how-much-does-it-cost-app-store), [iconikai.com – Google Play Fee 2026](https://www.iconikai.com/blog/google-play-developer-account-fee-2026), [revenuecat.com – 15% Small Business Program](https://www.revenuecat.com/blog/engineering/small-business-program/). Hinweis: Google verlangt für neue Privat-Konten inzwischen einen Test mit 12 Testern vor Produktions-Release (Quelle: iconikai.com). **Solange Detailly Web-App bleibt: 0 € und keine Store-Provision** – das ist ein echter Kostenvorteil, weil 15–30 % Provision auf 29–49 €-Abos massiv wären.

### 1.4 Domain, E-Mail-Versand, Push

| Position | Anbieter/Modell | Kosten | Quelle (2026-07-02) |
|---|---|---|---|
| Domain (.de) | Netcup / IONOS Regulärpreis | **~10–14 €/Jahr** (Netcup 0,99 €/Monat; IONOS ab 2. Jahr ~12 €/Jahr) | [experte.de/domains/de](https://www.experte.de/domains/de), [hosttest.de](https://www.hosttest.de/vergleich/de-domain.html) |
| E-Mail Transaktional | **Amazon SES** | **0,10 $/1.000 Mails** (günstigster Anbieter) | [smtpedia.com – SES Pricing](https://smtpedia.com/amazon-aws-ses-pricing/) |
| E-Mail Alternative | **Resend** | Free bis 3.000/Monat; Pro 20 $/Monat für 50.000 | [buildmvpfast.com – Email API Pricing](https://www.buildmvpfast.com/api-costs/email) |
| E-Mail Alternative | **Brevo** | Free ~300/Tag; transaktional ab ~15 $/Monat für 20.000 | [smtpedia.com – Brevo Pricing](https://smtpedia.com/brevo-pricing/) |
| Push (Web) | Web Push (VAPID) / FCM | **0 €** – im Backend heute ohnehin nicht integriert (`backend/package.json`) | Begründete Annahme (Web Push/VAPID ist ein kostenloses Browser-Protokoll ohne Anbieter-Gebühr); nicht extern belegt |

E-Mail-Volumen-Schätzung: ~10 Mails/Nutzer/Monat (Terminbestätigungen, Erinnerungen, Rechnungen) → 100 Nutzer ≈ 1.000 Mails (Free Tier reicht), 10.000 Nutzer ≈ 100.000 Mails ≈ **10 $/Monat via SES** oder ~40 $/Monat via Resend (Extrapolation über den belegten Pro-Tarif hinaus, Schätzung). Da der Mailer SMTP-generisch ist (`backend/src/mailer/mail.service.ts`), ist der Anbieter frei wählbar – **Empfehlung: Start mit Brevo Free (EU-Anbieter, DSGVO-einfach), Wechsel auf SES bei Volumen.**

### 1.5 Payment-Gebühren (Deutschland)

| Anbieter | Satz für DE | Quelle (2026-07-02) |
|---|---|---|
| **Stripe** (EU-Standardkarten) | **1,5 % + 0,25 €** pro Transaktion (eine Quelle nennt 1,4 % + 0,25 €; offizielle Preisseite: [stripe.com/pricing](https://stripe.com/pricing)) | [transaktionsgebuehren.com/stripe](https://transaktionsgebuehren.com/stripe), [kosten.org](https://kosten.org/rechner/stripe-gebuehren-rechner) |
| Stripe (internationale Karten) | 2,9 % + 0,25 € | dito |
| **PayPal** (Inland, Waren/Dienstleistungen) | **2,49 % + 0,35 €**; PayPal-Checkout-Tarif: 2,99 % + 0,39 € | [paypal.com/de/business/paypal-business-fees](https://www.paypal.com/de/business/paypal-business-fees), [shopify.com/de/blog/paypal-gebuhren](https://www.shopify.com/de/blog/paypal-gebuhren) |

Konkret pro Abo-Abbuchung (Stripe, 1,5 % + 0,25 €): **Starter 29 € → 0,69 € Gebühr (2,4 %)** · **Pro 49 € → 0,99 € (2,0 %)** · Jahreszahlung 490 € → 7,60 € (1,6 %, nur 1× jährlich → Jahreszahler sind auch gebührenseitig attraktiver). Schätzung/Hinweis: Stripe Billing (Abo-Verwaltung, im Code bereits genutzt) kostet je nach Modell ~0,5–0,7 % zusätzlich – auf der offiziellen Preisseite verifizieren, bevor kalkuliert wird. **Empfehlung: nur Stripe anbieten** – ist bereits integriert (`backend/src/billing/billing.service.ts`), günstiger als PayPal, und B2B-Kunden akzeptieren Kartenzahlung/SEPA.

### 1.6 Gesamtkosten-Tabelle (Hetzner-Szenario, Empfehlung)

**Einmalig:**

| Position | Kosten |
|---|---|
| Domain-Registrierung (1. Jahr, oft rabattiert) | ~1–12 € |
| App-Store (nur falls später native App): Google 25 $ einmalig, Apple 99 $/Jahr | 0 € heute |
| **Summe einmalig** | **~12 € (Web-App)** |

**Monatlich (netto, Infrastruktur; Zusammenstellung = Schätzung, Einzelpreise belegt):**

| Position | 100 Nutzer / ~20 Tenants | 1.000 Nutzer / ~200 Tenants | 10.000 Nutzer / ~2.000 Tenants |
|---|---|---|---|
| Hetzner Server | 6–8 € | 17–20 € | 60–90 € |
| Domain (umgelegt) | ~1 € | ~1 € | ~1 € |
| E-Mail | 0 € (Free Tier) | ~2 € (SES) | ~10 € (SES) |
| Push | 0 € | 0 € | 0 € |
| **Fixkosten gesamt** | **~7–9 €** | **~20–25 €** | **~70–100 €** |
| + Payment-Gebühr (variabel, Stripe) | ~0,81 €/Tenant* | ~0,81 €/Tenant* | ~0,81 €/Tenant* |

\* bei Ø-Umsatz 37 €/Tenant/Monat (Mix Starter/Pro, siehe 3.1): 1,5 % × 37 € + 0,25 € ≈ 0,81 €.

**Nicht enthalten (bewusst, aber wichtig):** eigene Arbeitszeit für Entwicklung, Support, Wartung, Marketing sowie ggf. Buchhaltung/Steuerberater und Pflichtkosten eines Gewerbes. Das sind real die größten Kosten – siehe Break-even-Szenario B in Abschnitt 3.

---

## 2. Wettbewerbs- und Preisrecherche (DE-Markt)

### 2.1 Vergleichbare Software (Preise, abgerufen 2026-07-02)

| Anbieter | Modell | Preis | Quelle |
|---|---|---|---|
| **Shore** (Termin/Salon, DE) | Abo, 12 Monate Mindestlaufzeit | Booking **39,90–49,90 €/Monat**; +Marketing 69,90–79,90 €; All-in-One 119,90–129,90 € | [trusted.de/shore-kosten](https://trusted.de/shore-kosten) |
| **Planity** (Beauty-Buchung) | Abo, **keine Provision** | **ab 49 €/Monat**; realer Gesamtmonat lt. Vergleich ~233 € (inkl. Zusatzmodule/TSE) | [studiolution.com/vergleich](https://www.studiolution.com/vergleich/) |
| **Treatwell Connect** | Abo + **35 % Provision auf Erstbuchung neuer Marktplatz-Kunden** + 2 % Online-Payment | realer Gesamtmonat lt. Vergleich ~266 € | [treatwell.de/partners/preise](https://www.treatwell.de/partners/preise/), [studiolution.com/vergleich/treatwell](https://www.studiolution.com/vergleich/treatwell/) |
| **KFZ-Werkstattsoftware** (allgemein) | Abo oder Kauf | **~25–180 €/Monat** typische Spanne | [fuer-gruender.de – Kfz-Software-Vergleich](https://www.fuer-gruender.de/wissen/unternehmen-fuehren/buchhaltung/handwerker-software-vergleich/kfz-werkstatt-software-vergleich/), [kfz-werkstatt-software.de](https://kfz-werkstatt-software.de/) |

**Einordnung:** Detaillys 29/49 € liegen am **unteren Rand** des Marktes. Shore verlangt für reines Booking schon ~40–50 €, Werkstattsoftware mit Rechnungen/Lager typischerweise 50–180 €. Detailly bietet mit Aufträgen + Rechnungen + Lager + Terminen + 3D-Schadenserfassung funktional mehr als reine Booking-Tools.

### 2.2 Zahlungsbereitschaft: Was verdienen Detailing-Studios pro Auftrag?

Preise der Zielgruppe (DE, abgerufen 2026-07-02): Keramikversiegelung **300–1.500 €** (Mittelklasse typ. 800–1.200 €), Vollfolierung **1.500–5.000 €**, PPF-Frontpaket **800–2.000 €**, PPF-Vollschutz **1.800–5.500 €**. Quellen: [motor.com.de – Keramikversiegelung](https://motor.com.de/ratgeber/keramikversiegelung-auto), [fahrzeugfolierung-kumaco.de – Autofolierung Kosten 2026](https://www.fahrzeugfolierung-kumaco.de/autofolierungs-ratgeber/autofolierung-kosten-2026-vollfolierung-teilfolierung-lackschutz), [tiptopcarbon.de](https://tiptopcarbon.de/auto-folieren-kosten). Die Seeds im Repo (`backend/src/database/seed.ts`, Zeilen 276–282: Basis-Aufbereitung 149 €, Keramik 899 €, PPF Front 950 €) liegen realistisch in diesen Spannen.

**Schlussfolgerung:** Ein Studio mit nur 10 Aufträgen/Monat setzt 3.000–15.000 € um. 49 €/Monat Software sind **< 1 % vom Umsatz** bzw. weniger als ein halber Basis-Auftrag – die Zahlungsbereitschaft trägt die aktuellen Preise locker, eher auch mehr.

### 2.3 Preisstrategie-Empfehlung

1. **Abo behalten, keine Provision, kein Einmalkauf.**
   - Provision (Treatwell-Modell, 35 %) wird von Betrieben gehasst und passt nicht: Detailly vermittelt (noch) keine Neukunden über einen Marktplatz mit Reichweite.
   - Einmalkauf killt wiederkehrende Einnahmen und passt nicht zu laufenden Hosting-/Wartungskosten.
   - Abo ist bereits gebaut (Plan/Subscription/Stripe) – Umbau wäre reine Verschwendung.
2. **Drei Tiers statt zwei.** Die Plan-Entity nennt `enterprise` schon als Beispiel-Slug (`backend/src/subscriptions/entities/plan.entity.ts`, Zeile 24). Empfehlung:
   - **Starter 29 €** (so lassen – Einstiegsanker, günstiger als Shore-Booking)
   - **Pro 59–69 €** statt 49 € (immer noch unter Marktschnitt; 3D-Schadenserfassung als Pro-Feature ist ein Alleinstellungsmerkmal, das keiner der Wettbewerber hat)
   - **Business/Enterprise 99–129 €** (mehrere Standorte, Marketplace, API/sevDesk-Export, Prio-Support) – schöpft die Zahlungsbereitschaft größerer Betriebe ab und macht Pro „vernünftig" wirkend (Preisanker).
3. **Jahreszahlung aktiv pushen** (Modell „2 Monate gratis" ist im Seed schon angelegt): bessere Liquidität, weniger Kündigungen, niedrigere Stripe-Fixgebühren (1× 0,25 € statt 12×).
4. **14–30 Tage kostenlos testen statt Free-Tier** – Free-Tenants erzeugen Support ohne Umsatz; die Zielgruppe entscheidet nach Nutzen, nicht nach Gratis-Dauer.
5. Später, wenn der Marketplace echte Kundenanfragen vermittelt: **kleine Vermittlungsgebühr (2–5 %) nur auf vermittelte Neuaufträge** als Zusatzerlös – deutlich unter Treatwells 35 %, als fairer Differenzierer vermarktbar.

---

## 3. Break-even-Rechnung

### 3.1 Formel und Eingangswerte

**Break-even (Anzahl Tenants) = monatliche Fixkosten ÷ Deckungsbeitrag pro Tenant**

Der *Deckungsbeitrag* ist das, was pro Kunde nach variablen Kosten übrig bleibt:

- Ø-Umsatz/Tenant (ARPU): Annahme **60 % Starter / 40 % Pro** (Schätzung) → 0,6 × 29 € + 0,4 × 49 € = **37,00 €**
- variable Kosten/Tenant: Stripe-Gebühr 1,5 % × 37 € + 0,25 € = **0,81 €** (Quellen s. 1.5)
- **Deckungsbeitrag = 37,00 − 0,81 = 36,19 €/Tenant/Monat**

### 3.2 Szenario A: nur Infrastrukturkosten (Hetzner, aus Tabelle 1.6)

| Stufe | Fixkosten/Monat | Rechnung | Break-even |
|---|---|---|---|
| 100 Nutzer | ~10 € | 10 ÷ 36,19 = 0,28 | **1 zahlender Tenant** |
| 1.000 Nutzer | ~25 € | 25 ÷ 36,19 = 0,69 | **1 zahlender Tenant** |
| 10.000 Nutzer | ~100 € | 100 ÷ 36,19 = 2,76 | **3 zahlende Tenants** |

**Klartext:** Die Infrastruktur ist so billig, dass sie ab dem **ersten zahlenden Betrieb** verdient ist. Das ist die Stärke des Hetzner-Wegs. (Zum Vergleich Vercel+Supabase bei 10.000 Nutzern: bis ~500 $ ≈ 460 € Fixkosten → ~13 Tenants – immer noch klein.)

### 3.3 Szenario B: realistische Vollkosten (Schätzung, klar markiert)

Die echten Kosten sind Arbeitszeit. Konservative **Schätzungen** (keine Quellen, bewusst als Annahmen ausgewiesen):

| Annahme | Wert (Schätzung) |
|---|---|
| Support/Wartung/Weiterentwicklung als Nebenerwerb | 1.500 €/Monat (≈ 20 h à 75 €) |
| Marketing/Vertrieb (Anzeigen, Messen, Inhalte) | 400 €/Monat |
| Buchhaltung/Steuerberater/Versicherung | 100 €/Monat |
| + Infrastruktur (Stufe 1.000 Nutzer) | 25 €/Monat |
| **Fixkosten gesamt** | **≈ 2.025 €/Monat** |

**Break-even: 2.025 ÷ 36,19 ≈ 56 zahlende Tenants.**

Mit der empfohlenen Preisanpassung (Pro 69 €, Business 99 €; Mix 50/35/15 → ARPU = 0,5×29 + 0,35×69 + 0,15×99 = **53,50 €**, Deckungsbeitrag ≈ 52,45 €): **2.025 ÷ 52,45 ≈ 39 Tenants** – die Preisstrategie senkt die Hürde um ~30 %.

| Szenario | Break-even |
|---|---|
| Nur Infrastruktur (Hobby-Betrieb) | **1–3 Tenants** |
| Vollkosten Nebenerwerb, heutige Preise | **~56 Tenants** |
| Vollkosten Nebenerwerb, empfohlene Preise | **~39 Tenants** |
| Vollzeit-Gründung (1 Gehalt ~5.000 €/Monat brutto inkl. Nebenkosten + Marketing/Buchhaltung wie Szenario B, Schätzung) | ~153 Tenants (heutige Preise) / ~105 (empfohlene) |

### 3.4 Sensitivität (was die Rechnung kippen kann)

- **Churn (Kündigungen)** ist nicht eingerechnet; bei 2–3 %/Monat braucht man laufend Neukunden, nur um den Bestand zu halten.
- Stripe-Billing-Zusatzgebühr (~0,5–0,7 %, unverifiziert) verschiebt den Deckungsbeitrag nur um ~0,2 € – unkritisch.
- Die Hetzner-Preiserhöhung 06/2026 zeigt: Hosting-Preise sind nicht fix; selbst +50 % ändert am Break-even aber fast nichts, weil Hosting < 1 % der Vollkosten ist.
- Größter Hebel ist **nicht** die Kostenseite, sondern ARPU (Preise/Tiers) und die Zahl der Tenants → Vertrieb/Marketing entscheidet.

---

## Anhang: Quellenübersicht (alle abgerufen 2026-07-02)

**Hosting:** [Hetzner Price Adjustment 15.06.2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) · [Hetzner Pressroom](https://www.hetzner.com/pressroom/new-cx-plans/) · [Vercel Pricing](https://vercel.com/pricing) · [Vercel Pro Plan Docs](https://vercel.com/docs/plans/pro-plan) · [Supabase Pricing](https://supabase.com/pricing) · [UI Bakery Supabase-Analyse](https://uibakery.io/blog/supabase-pricing) · [Firebase Pricing](https://firebase.google.com/pricing) · [Firestore Pricing](https://cloud.google.com/firestore/pricing) · [SuperTokens Firebase-Analyse](https://supertokens.com/blog/firebase-pricing)
**Stores:** [groovyweb.co (Apple 99 $)](https://www.groovyweb.co/blog/how-much-does-it-cost-app-store) · [iconikai.com (Google 25 $)](https://www.iconikai.com/blog/google-play-developer-account-fee-2026) · [RevenueCat (15 %-Programme)](https://www.revenuecat.com/blog/engineering/small-business-program/)
**E-Mail/Domain:** [smtpedia SES](https://smtpedia.com/amazon-aws-ses-pricing/) · [smtpedia Brevo](https://smtpedia.com/brevo-pricing/) · [buildmvpfast E-Mail-API-Vergleich](https://www.buildmvpfast.com/api-costs/email) · [experte.de .de-Domains](https://www.experte.de/domains/de) · [hosttest.de](https://www.hosttest.de/vergleich/de-domain.html)
**Payment:** [Stripe Pricing (offiziell)](https://stripe.com/pricing) · [transaktionsgebuehren.com/stripe](https://transaktionsgebuehren.com/stripe) · [kosten.org Stripe-Rechner](https://kosten.org/rechner/stripe-gebuehren-rechner) · [PayPal Business Fees DE (offiziell)](https://www.paypal.com/de/business/paypal-business-fees) · [Shopify PayPal-Gebühren](https://www.shopify.com/de/blog/paypal-gebuhren)
**Wettbewerb:** [trusted.de Shore-Kosten](https://trusted.de/shore-kosten) · [studiolution Salon-Software-Vergleich](https://www.studiolution.com/vergleich/) · [Treatwell Partner-Preise](https://www.treatwell.de/partners/preise/) · [für-gründer.de Kfz-Software](https://www.fuer-gruender.de/wissen/unternehmen-fuehren/buchhaltung/handwerker-software-vergleich/kfz-werkstatt-software-vergleich/)
**Detailing-Preise:** [motor.com.de Keramik](https://motor.com.de/ratgeber/keramikversiegelung-auto) · [kumaco Folierung 2026](https://www.fahrzeugfolierung-kumaco.de/autofolierungs-ratgeber/autofolierung-kosten-2026-vollfolierung-teilfolierung-lackschutz) · [tiptopcarbon.de](https://tiptopcarbon.de/auto-folieren-kosten)
**Repo-Belege:** `backend/src/database/seed.ts` · `backend/src/subscriptions/entities/plan.entity.ts` · `backend/src/billing/billing.service.ts` · `backend/src/mailer/mail.service.ts` · `backend/package.json`
