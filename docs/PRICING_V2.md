# Preismodell V2: Starter / Basic / Pro

**Stand: 2026-07-07** · Business-Analyst-Agent · Ablösung des heutigen 2-Tarif-Modells (Starter 29 € / Pro 49 €). Referenzpreise am 07.07.2026 im Netz verifiziert; Schätzungen sind markiert. Basis-Zahlen: `BUSINESS_CASE.md` (Stand 2026-07-02).

> **In einem Satz:** Drei Stufen, in denen der **Shop überall gratis** ist, die reale App-Feature-Landschaft sauber abgebildet wird und Zusatzmodule (Zeiterfassung, weiterer Standort …) als **Add-ons** verkauft werden – bei **Pro sind alle Add-ons inklusive**.

## 1. Kurzfazit + Preisphilosophie

Preisphilosophie: **Einstieg günstig, Wachstum belohnen, kein Feature verstecken, das der Betrieb zum Loslegen braucht.** Die Kernmodule (Kunden, Fahrzeuge, Aufträge, Termine, Rechnungen und **Shop/Lager**) sind in **jeder** Stufe enthalten – der Shop ist bewusst gratis, weil er die App-Nutzung erhöht und (perspektivisch über Marktplatz/Affiliate) selbst Erlöse bringt. Differenziert wird über **Mengen-Limits** (Nutzer, Standorte, Kunden) und über **Mehrwert-Module** (3D-Schadenserfassung, Auswertungen, Mahnwesen, Buchhaltungs-Export, Zeiterfassung, Audit). Bei Pro ist alles drin, damit größere Betriebe nicht einzeln zubuchen müssen und Pro als „günstiger als die Summe der Add-ons" wahrgenommen wird (Preisanker). Break-even bleibt niedrig: Der neue ARPU liegt über dem alten (Rechnung siehe Abschnitt 3), die ~39-Tenant-Schwelle aus `BUSINESS_CASE.md` verbessert sich.

**Marktvergleich (verifiziert 2026-07-07):** DE-Handwerkersoftware kostet typisch **20–80 €/Monat** (Spanne 19,90–369 €); „Das Programm" ruft 39,90 € (Büro & Mobil) bzw. 19,90 € (App-Nutzer) auf, Meisterox 79 €/Monat, KFZ-Werkstatt-SaaS starten ab ~15 €/Monat; Zusatz-Sitze z. B. bei Hawepro 7 €/Mitarbeiter/Monat. Unsere 29/49/89 € liegen damit exakt im Marktkorridor, am unteren bis mittleren Rand – passend für kleine Aufbereitungs-/Folierungs-Betriebe. Quellen: [softwareabc24 – Handwerker-Preise](https://www.softwareabc24.de/handwerker-software/preise-uebersicht), [für-gründer.de – Kfz-Software](https://www.fuer-gruender.de/wissen/unternehmen-fuehren/buchhaltung/handwerker-software-vergleich/), [meisterox.app](https://meisterox.app/blog/handwerker-software-vergleich), [hawepro.de/preise](https://hawepro.de/preise.html), [softwareabc24 – KFZ-SaaS](https://www.softwareabc24.de/kfz-werkstatt-software/saas).

## 2. Feature-Matrix

Legende: ✓ = enthalten · Zahl = Limit · **Add-on** = zubuchbar (Preise s. Abschnitt 4) · – = nicht enthalten. Spalte „Key" = realer `plan-entitlements`-Feature-Key; **(neu)** = Gate muss noch ergänzt werden (Modul existiert, ist heute aber ungegatet).

| Feature / Limit | Key | Starter | Basic | Pro |
|---|---|---|---|---|
| Kundenverwaltung | `kunden` | ✓ | ✓ | ✓ |
| Fahrzeugverwaltung | `fahrzeuge` | ✓ | ✓ | ✓ |
| Auftragsverwaltung | `auftraege` | ✓ | ✓ | ✓ |
| Termine / Plantafel | `termine` | ✓ | ✓ | ✓ |
| Rechnungen | `rechnungen` | ✓ | ✓ | ✓ |
| **Shop & Lager** | `shop` | ✓ | ✓ | ✓ |
| Marktplatz (Katalog/Bestellung) | – (kein Gate) | ✓ | ✓ | ✓ |
| Mitarbeiterverwaltung | `mitarbeiter` | ✓ | ✓ | ✓ |
| Standortverwaltung | `standorte` | ✓ | ✓ | ✓ |
| 3D-Schadenserfassung | `inspektion` **(neu)** | **Add-on** | ✓ | ✓ |
| Auswertungen / Berichte | `auswertungen` **(neu)** | Dashboard-Basis | ✓ | ✓ |
| Wirtschaftlichkeit (Deckungsbeitrag/Auftrag) | `wirtschaftlichkeit` **(neu)** | – | – | ✓ |
| Mahnwesen / Erinnerungen | `mahnwesen` **(neu)** | – | ✓ | ✓ |
| Buchhaltungs-Export (sevDesk/DATEV) | `export` **(neu)** | **Add-on** | ✓ | ✓ |
| Zeiterfassung | `zeiterfassung` **(neu)** | **Add-on** | **Add-on** | ✓ |
| Audit-Log | `audit` | – | – | ✓ |
| Prio-Support | – (organisatorisch) | – | – | ✓ |
| **Limit: max. Kunden** | `maxCustomers` | 500 | unbegrenzt | unbegrenzt |
| **Limit: max. Nutzer** | `maxUsers` | 3 | 10 | 25 |
| **Limit: max. Standorte** | `maxLocations` | 1 | 1 | 5 |

Hinweis: `standorte` und `mitarbeiter` bleiben in allen Stufen als Feature aktiv – die Differenzierung läuft (wie schon heute im Seed) über die **Limits** `maxLocations`/`maxUsers`. Ein zusätzlicher Standort/Nutzer per Add-on hebt nur das jeweilige Limit an.

## 3. Preise je Stufe

Jahrespreis = **10 × Monatspreis** (≈ 2 Monate gratis, **−17 %**) – entspricht der bestehenden Seed-Konvention (`preisMonatlich * 10`). Alle Preise **netto zzgl. USt.**

| Stufe | Monat | Jahr (−17 %) | Für wen | Begründung |
|---|---|---|---|---|
| **Starter** | **29 €** | **290 €** | Solo / 1–3 Personen, Einstieg | Anker unter Shore-Booking (39,90 €); voll arbeitsfähig inkl. Shop. |
| **Basic** | **49 €** | **490 €** | Etablierter Betrieb, 2–10 Personen | „Sweet Spot": +3D-Schadenserfassung (USP für Folierung/PPF), Auswertungen, Mahnwesen, Buchhaltungs-Export. Marktschnitt-Niveau. |
| **Pro** | **79 €** | **790 €** | Wachstum / mehrere Standorte / Franchise | **Alle Add-ons inklusive** + Wirtschaftlichkeit + Audit + Prio-Support + bis 5 Standorte. Auf Höhe von Meisterox (79 €), ersetzt aber 2–3 Add-ons → klare „Alles-drin"-Wahl. _(Betreiber-Wahl 2026-07-07: 79 € statt 89 €, dichter am Wettbewerb.)_ |

Preis-Staffelung +20 € (Starter→Basic), +30 € (Basic→Pro) macht Basic zum naheliegenden Standardkauf und Pro zur klaren „Alles-drin"-Wahl. Der frühere `BUSINESS_CASE`-Vorschlag (Pro 59–69 €, Business 99–129 €) wird hier auf drei kleinere-Betrieb-taugliche Stufen verdichtet; das Top-Segment 99–129 € bleibt als späterer, individuell verhandelter Franchise-/Enterprise-Tarif offen (nicht im Self-Service).

## 4. Add-ons

Alle Add-ons sind **bei Pro inklusive**. In Starter/Basic zubuchbar (technisch als separate Stripe-Positionen, siehe Abschnitt 6). Preise = **Schätzung**, an Referenzpreisen plausibilisiert (Hawepro 7 €/Sitz; Add-on-Faustwert 10–20 € je Zusatzmodul).

| Add-on | Preis (Schätzung) | Starter | Basic | Pro | Technischer Hebel |
|---|---|---|---|---|---|
| **Zeiterfassung** | 9 €/Monat je Betrieb | zubuchbar | zubuchbar | **inklusive** | Feature-Key `zeiterfassung` |
| **Weiterer Standort/Betrieb** | 19 €/Monat je Standort | zubuchbar | zubuchbar | **bis 5 inkl.** | hebt `maxLocations` +1 |
| **Zusätzlicher Nutzer-Sitz** | 5 €/Nutzer/Monat | zubuchbar | zubuchbar | **inkl. bis 25** | hebt `maxUsers` +1 |
| **3D-Schadenserfassung** | 9 €/Monat | zubuchbar | **inklusive** | **inklusive** | Feature-Key `inspektion` |
| **Buchhaltungs-Export (sevDesk/DATEV)** | 9 €/Monat | zubuchbar | **inklusive** | **inklusive** | Feature-Key `export` |

Rechenbeispiel Anker: Basic (49 €) + Zeiterfassung (9 €) + 1 Standort (19 €) = **77 €** → für nur **2 € mehr** gibt **Pro (79 €)** ALLE Add-ons inklusive. Genau dieser Effekt soll Betriebe nach oben ziehen.

### 3b. ARPU- und Break-even-Check (nachvollziehbar)

Annahme Tarif-Mix (Schätzung): **40 % Starter / 40 % Basic / 20 % Pro**, ohne Add-ons.
ARPU = 0,40 × 29 € + 0,40 × 49 € + 0,20 × 79 € = 11,60 + 19,60 + 15,80 = **47,00 €/Tenant/Monat**.
Das liegt **über** dem alten ARPU von 37,00 € (`BUSINESS_CASE.md` 3.1). Deckungsbeitrag ≈ 47,00 − Stripe (1,5 % × 47 + 0,25 €) = 47,00 − 0,96 = **46,04 €**. Bei Vollkosten-Fixblock ~2.025 €/Monat (`BUSINESS_CASE.md` 3.3): Break-even = 2.025 ÷ 46,04 ≈ **44 Tenants** (mit Add-on-Umsatz noch weniger). Nur-Infrastruktur-Break-even bleibt **1–3 Tenants**.

## 5. Branchen-Hinweis: ein Modell für Folierung / PPF / Aufbereitung?

**Empfehlung: EIN gemeinsames Modell – keine getrennten Branchen-Tarife.** Begründung:

- Die App-Objekte (Kunden, Fahrzeuge, Aufträge, Rechnungen, Termine, Lager) sind für alle drei Gewerke identisch; Unterschiede liegen in **Leistungskatalog/Preisen**, nicht in Funktionen. Das über getrennte Tarife abzubilden würde Vertrieb und Stripe-Pflege unnötig verdreifachen.
- Die **3D-Schadenserfassung** ist branchenübergreifend wertvoll, für **Folierung/PPF** aber besonders (Dokumentation Vorschäden/Übergabe, Streitvermeidung). Deshalb sitzt sie ab **Basic** – dort, wo Folierer/PPF-Betriebe ohnehin landen. Aufbereiter, die sie brauchen, buchen sie im Starter als 9-€-Add-on. Das deckt die Branchen-Nuance **innerhalb** eines Modells ab.
- Statt Branchen-Tarifen: **branchenspezifische Vorlagen** (Leistungs-/Preislisten für Aufbereitung, Folierung, PPF) beim Onboarding – kein eigenes Preismodell, nur Startdaten. Das ist Marketing/Seed, kein Tarif.

Fazit: Ein Modell, drei Stufen, Branchen-Feintuning über Add-on (3D) und Onboarding-Vorlagen.

## 6. Umsetzungshinweise

**a) `plan-entitlements` / Seed anpassen** (`backend/src/database/seed.ts`, `plan-entitlements.ts`):
- Neuen Plan **`basic`** (49 €/490 €) ergänzen; `starter` und `pro` behalten, Preise/Limits/Features gemäß Matrix setzen.
- **`shop` in ALLE drei `features`-Arrays** aufnehmen (heute nur in Pro) – Shop wird gratis.
- Limits setzen: Starter `{maxUsers:3, maxLocations:1, maxCustomers:500}`, Basic `{maxUsers:10, maxLocations:1, maxCustomers:null}`, Pro `{maxUsers:25, maxLocations:5, maxCustomers:null}`.
- **Neue Feature-Keys anlegen und gaten** (Module existieren, Gate fehlt): `zeiterfassung` (ZeiterfassungController), `inspektion` (InspectionController, 3D), `auswertungen` (ReportsController), `wirtschaftlichkeit` (ProfitabilityController), `mahnwesen` (RemindersController), `export` (sevDesk/Buchhaltungs-Export). Je Controller `@RequiresFeature('<key>')` + `PlanFeatureGuard` ergänzen (Muster: `shop.controller.ts`, `audit.controller.ts`). `FEATURE_LABELS` in `plan-entitlements.ts` um die neuen Keys erweitern (für saubere 403-Meldungen).
- `audit` bleibt Pro-only; `mitarbeiter`/`standorte` bleiben in allen Stufen (Steuerung über Limits).

**b) Stripe – was der Betreiber anlegen muss** (Dashboard → Products):
- 3 **Products** (Starter, Basic, Pro), je mit **2 Prices** (monatlich + jährlich) → 6 Price-IDs. Diese IDs in den Tarif-Editor eintragen (`plan.stripePriceId` / `stripePriceIdYearly` – Felder existieren bereits).
- Add-ons als **eigene Stripe-Products/Prices** (recurring, monatlich): „Zeiterfassung", „Weiterer Standort", „Zusätzlicher Nutzer", „3D-Schadenserfassung", „Buchhaltungs-Export". Standort/Nutzer als **metered/quantity**-Price (Menge = Anzahl), die anderen als Flat.

**c) Add-ons technisch – Empfehlung: Stripe-Subscription-Items + Feature-Flags kombiniert.**
- Kauf eines Add-ons = zusätzliches **Subscription-Item** in der bestehenden Stripe-Subscription des Tenants (eine Rechnung, klare Abrechnung).
- Wirkung im Backend über **Flags/Limit-Override auf Tenant-/Subscription-Ebene**, die zu den Plan-`features`/`limits` **hinzu-gemergt** werden (der `PlanFeatureGuard` liest dann effektive Entitlements = Plan + gebuchte Add-ons). Standort-/Nutzer-Add-ons erhöhen `maxLocations`/`maxUsers` um die gebuchte Menge. Das vermeidet, für jede Add-on-Kombination einen eigenen Plan zu pflegen.
- Der Stripe-Webhook (`stripe-webhook.controller.ts`) muss Add-on-Items beim Kauf/Storno auf diese Flags/Overrides abbilden.

**d) Migration Bestandskunden:** Pilot/Bestand auf Pro sind durch „Shop jetzt überall" nicht schlechter gestellt. Alt-Starter (29 €, bisher 5 User/500 Kunden) → neuer Starter erlaubt nur 3 User: Bestands-Starter mit >3 Usern **grandfathern** (Limit individuell belassen) oder auf Basic heben. Vor Rollout klären.

## 7. Offene Fragen an den Betreiber

1. **Pro-Preis 89 € ok**, oder lieber 79 € (dichter an Meisterox) bzw. 99 € (mehr Marge/Anker)? Und: separater Franchise/Enterprise-Tarif (99–129 €, individuell) gewünscht oder erst später?
2. **Add-on-Preise** (Zeiterfassung 9 €, Standort 19 €, Nutzer 5 €, 3D 9 €, Export 9 €) – so bestätigen? Insbesondere: Nutzer-Sitz **pro Kopf** (wie Hawepro) oder lieber im Limit großzügiger und keine Sitz-Gebühr?
3. **Starter-Limit 3 Nutzer** – akzeptabel als Downgrade ggü. heutigen 5, oder bei 5 belassen (weniger Upgrade-Druck, aber marktüblich)? Und wie mit Bestands-Startern verfahren (grandfathern vs. auf Basic heben)?

---
**Repo-Belege:** `backend/src/subscriptions/plan-entitlements.ts` (Keys/Guards) · `backend/src/subscriptions/entities/plan.entity.ts` (Stripe-Felder) · `backend/src/database/seed.ts` (heutige Tarife) · Gates: `shop.controller.ts`, `audit.controller.ts`, `locations.controller.ts`, `employees.controller.ts` · ungegatete Module: `zeiterfassung/`, `inspection/`, `reports/`, `profitability/`, `reminders/`, `marketplace/`, `sevdesk/`.
**Referenzpreise (abgerufen 2026-07-07):** [softwareabc24 Handwerker-Preise](https://www.softwareabc24.de/handwerker-software/preise-uebersicht) · [für-gründer.de Kfz-Software](https://www.fuer-gruender.de/wissen/unternehmen-fuehren/buchhaltung/handwerker-software-vergleich/) · [meisterox.app](https://meisterox.app/blog/handwerker-software-vergleich) · [hawepro.de/preise](https://hawepro.de/preise.html) · [softwareabc24 KFZ-SaaS](https://www.softwareabc24.de/kfz-werkstatt-software/saas). Break-even/Fixkosten: `BUSINESS_CASE.md` (Stand 2026-07-02).

---

## V3-Update (2026-07-12): Gewerke-Empfehlungs-Layer

**Betreiber-Entscheidung 2026-07-12: Option C („Empfehlungs-Layer") beschlossen.** Die drei Self-Service-Stufen **Starter/Basic/Pro bleiben unverändert** (auch die Preise: **29 / 49 / 79 €**). Statt getrennter Branchen-Tarife legt das Frontend einen **rollen-offenen Empfehlungs-Layer** über die bestehenden Stufen: Auf Basis des `betriebstyp` des Betriebs wird ein passendes **Gewerke-Bundle** vorgeschlagen (Marketing/Onboarding-Sicht) – technisch bleibt es ein Modell mit drei Stufen. Der `betriebstyp` wird dafür in `GET /tenants/me/entitlements` mitgeliefert (Response-Shape sonst unverändert).

### Bundles (Empfehlung je Betriebstyp – kein eigener Tarif)

| Bundle | Gewerk (`betriebstyp`) | Basis-Stufe | Richtpreis | Inhalt/Hebel |
|---|---|---|---|---|
| **Detailing** | Aufbereitung | **Starter** + Add-on Zeiterfassung | **≈ 38 €** (29 + 9) | Kern + Zeiterfassung; 3D-Sofortkalkulation nicht nötig |
| **Wrap** | Folierung | **Basic** | **49 €** | Kern + `kalkulation` (3D-Klick→Sofortpreis + Flächenkalkulation) + Auswertungen/Mahnwesen/Export |
| **Protect** | PPF | **Basic → Pro** | **49 → 79 €** | Wie Wrap; Empfehlung zum Aufstieg auf Pro bei Wachstum |
| **Studio** | Komplett/Franchise | **Pro** | **79 €** | Alles inklusive (alle Add-ons, Wirtschaftlichkeit, Audit, bis 5 Standorte) |

Die Bundles sind **Anzeige/Empfehlung**, keine buchbaren Extra-Produkte – gekauft werden weiterhin die Stufen Starter/Basic/Pro (plus ggf. Add-ons).

### Neuer Feature-Key `kalkulation` (ab Basic)

- **`kalkulation` = 3D-Klick→Sofortpreis + Flächenkalkulation** – der gewerkespezifische USP für **Folierung/PPF**. Quelle der Wahrheit: `plan-catalog.ts` (in den Basic-Plus-Modulen).
- **Enthalten in Basic und Pro, NICHT in Starter.** Der Pilot auf Pro erhält den Key automatisch (Pro führt alle Basic-Plus-Keys).
- **Gate:** `GET /tenants/me/kalkulation` (rollen-offener €/qm-Read für die 3D-Sofortkalkulation) läuft ab sofort über `@RequiresFeature('kalkulation')` + `PlanFeatureGuard` → Starter erhält `403 PLAN_FEATURE_MISSING`. Das **owner-only PATCH der Sätze** (Einstellungen) bleibt **ungegatet** – Konfiguration ist immer erlaubt. Der Kalkulations-**Katalog** (Bauteile/Leistungen) bleibt **KERN**.
- **Rückwärtskompatibilität unverändert:** kein Tarif / `features == null` ⇒ Vollzugriff (Bestand/Trial/Pilot verlieren nichts).

### Preise & Add-ons

- **Preise bleiben 29 / 49 / 79 €** (monatlich; Jahr = 10×). Der Empfehlungs-Layer ändert **keine** Preise.
- **Add-on-Kauf bleibt weiter blockiert**, bis der Betreiber die **Stripe-Price-IDs** angelegt und im Tarif-Editor hinterlegt hat (siehe Abschnitt 6b/6c). Bis dahin sind Add-ons nur konzeptionell dokumentiert, nicht buchbar.
