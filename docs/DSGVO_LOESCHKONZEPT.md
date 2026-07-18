# DSGVO-Löschkonzept (Art. 17 Löschung / Art. 15+20 Auskunft & Export)

Grundlage des Codes in `backend/src/gdpr/*`. Abweichungen des Codes von dieser
Matrix sind zu begründen. Stand: Paket „DSGVO-Löschung & Export".

## 1. Der Kernkonflikt: Löschpflicht ↔ Aufbewahrungspflicht

Art. 17 Abs. 1 DSGVO gibt der betroffenen Person einen Löschanspruch. Art. 17
Abs. 3 lit. b DSGVO nimmt davon Daten aus, deren Verarbeitung zur **Erfüllung
einer rechtlichen Aufbewahrungspflicht** erforderlich ist. Die einschlägigen
Pflichten im Werkstatt-/SaaS-Kontext:

- **§ 14b UStG / § 14 UStG:** Rechnungen (Kopien) → **10 Jahre**.
- **§ 147 Abs. 1 Nr. 4/4a AO, § 257 HGB:** Buchungsbelege, empfangene/abgesandte
  Handels- und Geschäftsbriefe → **10 bzw. 6 Jahre**.
- **GoBD (Unveränderbarkeit + Vollständigkeit):** festgeschriebene Belege dürfen
  nicht mehr geändert/gelöscht werden; Belegnummernkreise müssen **lückenlos**
  sein. Umgesetzt in `invoices`/`orders`/`kassenbuch_eintraege` über
  Festschreibung + `ConflictException` + `withUniqueRetry`.

**Auflösung des Konflikts (Kernregel):**

> Existiert für den Kunden mindestens ein **aufbewahrungspflichtiger Beleg**,
> wird der Kunde **anonymisiert** statt hart gelöscht: alle PII-Stammdaten werden
> überschrieben, PII-tragende abhängige Daten werden gelöscht/geleert, der
> **Beleg bleibt inhaltlich unverändert** (Empfänger wird als Snapshot
> eingefroren). Gibt es **keinen** solchen Beleg, wird der Kunde **vollständig
> hart gelöscht** inklusive aller abhängigen Zeilen und physischen Dateien.

### 1.1 Trigger „Aufbewahrungspflicht" (Entscheidung Anonymisieren vs. Hart-Löschen)

`GdprService.hatAufbewahrungspflicht()` liefert `true`, sobald **eines** zutrifft
(alles tenant-scoped auf den Kunden):

| Kriterium | Rechtsgrund |
|---|---|
| Rechnung mit vergebener Belegnummer (`art=rechnung`, `nummer != NULL`) | § 14 UStG / § 147 AO – 10 Jahre |
| Angebot mit vergebener Belegnummer (`art=angebot`, `nummer != NULL`) | GoBD-Lückenlosigkeit des Nummernkreises (Löschen risse eine Lücke) |
| Auftrag im Status `abgerechnet` | Buchungszusammenhang / Geschäftsbrief (§ 147 AO), Backstop bei Dateninkonsistenz |
| Signiertes/freigegebenes Übergabe-Protokoll (`unterschriftPng != NULL` **oder** `status=freigegeben`) | Haftungsbeweis, Art. 17 Abs. 3 lit. e (Rechtsansprüche) |

Reine Entwürfe (Rechnung/Angebot ohne Nummer, Inspektion ohne Unterschrift) sind
**kein** Beleg und lösen keine Aufbewahrung aus.

## 2. Löschmatrix je Entität

Legende Konsequenz: **HART** = Zeile physisch entfernt · **ANON** = Zeile bleibt,
PII-Felder geleert/ersetzt · **BEHALTEN** = unverändert (kein Endkunden-PII bzw.
Beleg-Ausnahme).

| Entität | Endkunden-PII? | Aufbewahrungspflichtig (Beleg)? | Konsequenz bei Kunden-Löschung |
|---|---|---|---|
| `customers` | JA (Name, Anschrift, E-Mail, Tel., USt-IdNr., Leitweg-ID, notes) | Nein (Stammdaten selbst), aber von Belegen referenziert | **ANON** (PII überschreiben, `anonymisiertAm` setzen) wenn Beleg existiert; sonst **HART** |
| `vehicles` | JA (Kennzeichen, VIN = personenbeziehbar) | Nein | **HART** (beide Pfade) + Halterbezug gekappt |
| `orders` | teilweise (`internerHinweis`, `leistungDetails`, Vorher/Nachher-Bilder) | Auftrag = Geschäftsbrief bei Abrechnung | ANON-Pfad: **BEHALTEN**, Freitexte/Bilder leeren, `vehicleId` kappen. HART-Pfad: **HART** (samt items) |
| `order_items` | Nein (Positionstext) | folgt Auftrag | folgt `orders` |
| `invoices` Rechnung (`nummer != NULL`) | JA (über `customerId` + Empfänger-Snapshot) | **JA** § 14 UStG/§ 147 AO 10 J. | **BEHALTEN**; Empfänger-Snapshot (`empfaengerName/-Anschrift/-VatNumber`) einfrieren, `hinweis` leeren. NIE hart löschen |
| `invoices` Angebot (`nummer != NULL`) | JA (über `customerId`) | GoBD-Nummernkreis | **BEHALTEN** + Snapshot (löst ANON-Pfad aus) |
| `invoices` Entwurf (`nummer = NULL`) | JA (über `customerId`) | Nein (kein Beleg) | HART-Pfad: **HART** (samt items) |
| `invoice_items` | Nein | Teil des Belegs (Art. 17 Abs. 3 lit. b) | bleibt bei Belegen; bei Entwürfen mitgelöscht |
| `appointments` | teilweise (`customerId`, `notiz`) | Nein | **HART** (beide Pfade), erfasst auch rein auftragsbezogene Termine über `orderId` |
| `damage_inspections` signiert/freigegeben | JA (Unterschrift, `consentText`, Kennzeichen) | Haftungsbeweis (Art. 17 Abs. 3 lit. e) → löst ANON-Pfad aus | ANON-Pfad: **BEHALTEN**, `unterschriftPng`/`consentText`/`notiz` leeren, Name → „Anonymisiert" |
| `damage_inspections` Entwurf | JA | Nein | **HART** samt Kindern |
| `damage_items` | teilweise (`notiz`, `ausmass`) | folgt Inspektion | ANON: geleert bei behaltenen; HART bei gelöschten |
| `damage_photos` | JA (zeigen Kennzeichen/VIN/Tacho) | Nein | **IMMER HART** (DB-Zeile **und** physische Datei) – auch bei behaltenen Inspektionen |
| `damage_item_photos` (Join) | Nein | – | folgt `damage_photos` |
| `rentals` | JA (über `customerId`) | evtl. Beleg bei Abrechnung | ANON-Pfad: **BEHALTEN** (Kunde ohnehin anonym). HART-Pfad: **HART** |
| `order_times` | Nein (Mitarbeiter-Arbeitszeit auf Auftrag) | Lohn-/Buchungsbezug | HART-Pfad: mit dem Auftrag **HART**. ANON-Pfad: bleibt (kein Endkunden-PII) |
| `booking_requests` | JA (`name`/`email`/`phone`/`fahrzeug`/`nachricht`), **kein `customerId`-FK** | Nein (nicht angenommen) | Best-effort per exaktem E-Mail-Match → **HART** (nur wenn Kunde eine E-Mail hat). Sonst über eigene Retention (`BookingRetentionService`) |
| `kassenbuch_eintraege` | evtl. im Freitext `zweck`, **kein `customerId`-FK** | **JA** GoBD unveränderbar | **BEHALTEN** unverändert (Art. 17 Abs. 3 lit. b). Nicht kunden-FK-verknüpft → keine Aktion (siehe § 3) |
| `audit_logs` | `payload` kann PII enthalten | Rechenschaft Art. 5 Abs. 2 | **BEHALTEN**, `payload` redigiert; WER/WAS/WANN-Trail (action/entityType/entityId/userId/createdAt) bleibt |

## 3. Bewusste Abgrenzungen / offene Rechtspunkte

- **Kassenbuch-Bezug:** `kassenbuch_eintraege` haben **keinen** `customerId`-FK.
  Ein Bargeld-Eintrag verweist höchstens über die Belegnummer (`belegNummer`) auf
  eine Rechnung. Solche Einträge sind GoBD-unveränderbar und bleiben in **beiden**
  Pfaden unverändert. Steht ausnahmsweise ein Kundenname im Freitext `zweck`, ist
  dieser Teil des unveränderbaren Belegs (Art. 17 Abs. 3 lit. b) → keine Änderung.
  Eine Freitext-Suche nach Namen wäre unzuverlässig (False Positives) und wird
  bewusst nicht durchgeführt.
- **Booking-Requests:** ohne `customerId`-FK nur per exaktem E-Mail-Match dem
  Kunden zuordenbar. Bei Kunden ohne hinterlegte E-Mail bleibt der Regelweg die
  zeitbasierte Retention (`BookingRetentionService`, nicht angenommene Anfragen).
- **`incoming_invoices` (Eingangsrechnungen):** enthalten Lieferanten-, nicht
  Endkundendaten → von der Kunden-Löschung nicht betroffen (aber Teil des
  Betriebs-Gesamtexports).
- **Snapshot vs. Relation (geprüft):** Rechnungen halten den Kunden als
  **Relation** (`invoices.customerId`) und füllen die **Snapshot**-Spalten
  (`empfaengerName/-Anschrift/-VatNumber`, verschlüsselt) erst zum
  Anonymisierungszeitpunkt. Die Anonymisierung verändert daher **nur** die
  Kunden-Stammzeile und schreibt den Beleg-Empfänger als eingefrorenen Snapshot;
  Beträge/Positionen/Nummer der Rechnung bleiben unangetastet (GoBD).

## 4. Fristbasierte Lösch-Automatik (Art. 5 Abs. 1 lit. e – Speicherbegrenzung)

- Tenant-Einstellung `datenschutz.aufbewahrungInaktiveKundenJahre` (Default **3**,
  konfigurierbar 0–20; **0 = aus**), in `tenant.settings` (verschlüsseltes JSON,
  **kein** Schema-Change).
- „Letzter Kontakt" = Maximum aus `customers.updatedAt` und dem jüngsten
  verknüpften Vorgang (Auftrag/Termin/Rechnung/Vermietung).
- `DatenschutzRetentionService` (täglicher `IntervalScheduler`, wie Mahn-Automatik)
  **findet** fällige Kunden und stellt sie in die **Prüfliste** – es wird **nichts
  automatisch gelöscht**. Der Betrieb bestätigt jede Löschung/Anonymisierung
  einzeln oder gesammelt im „Datenschutz-Cockpit" (Hausregel „Review before send"
  gilt analog für unumkehrbares Löschen).

## 5. Protokollierung (Rechenschaft)

Jede Aktion schreibt einen Audit-Eintrag **ohne PII** (nur Zähler/Modus):
`gdpr_export`, `gdpr_delete` (mit `modus` = `geloescht`|`anonymisiert`,
`rechtsgrund`), `gdpr_tenant_export`. Der Verlauf ist im Cockpit einsehbar.

## 6. Rollen

- Kunden-Löschung/-Anonymisierung + Datenauszug + Cockpit: **OWNER, MANAGER**.
- Betriebs-Gesamtexport + Fristkonfiguration: **OWNER** (bzw. `platform_admin`
  per Guard-Bypass, bleibt aber tenant-gebunden).

## 7. Migration

Additiv **ohne** Schema-Change: die Fristkonfiguration lebt im bestehenden
verschlüsselten JSON `tenant.settings`, die Prüfliste wird live berechnet, das
Protokoll nutzt die bestehende `audit_logs`-Tabelle. Es werden **keine** neuen
Spalten/Tabellen angelegt → keine Migration nötig (kleinste, sicherste Änderung).
