> ## ⚠️ ENTWURF — anwaltliche Prüfung vor Produktivnutzung zwingend
>
> Unverbindlicher Arbeitsentwurf, **keine Rechtsberatung**, nicht anwaltlich erstellt/geprüft.
> Alle `<PLATZHALTER: …>` vor Nutzung durch echte Angaben ersetzen. Fristen/Zuständigkeiten mit
> Anwalt/DSB final abstimmen. Rechtsstand-Recherche siehe `docs/RECHTLICHE_ABSICHERUNG.md`.

# Datenpannen-Runbook (Art. 33/34 DSGVO)

**Schriftliche Meldekette und Handlungsanweisung bei einer Verletzung des Schutzes personenbezogener Daten.**

Rollenlogik: Für die Endkundendaten in der Plattform ist der **Betrieb der Verantwortliche** und Detailly der **Auftragsverarbeiter**. Wird Detailly eine Datenpanne bekannt, meldet es **unverzüglich an den betroffenen Betrieb** (Art. 33 Abs. 2). Die **72-Stunden-Meldung an die Aufsichtsbehörde** und ggf. die Benachrichtigung der Betroffenen (Art. 34) obliegen dem **Betrieb**.

Stand: `<PLATZHALTER: Datum>`.

---

## 0. Wichtiger Hinweis zum Register (ehrlich)
Ein **dediziertes Datenpannen-Register als Software-Modul** existiert im Code **derzeit nicht**. Das Register wird daher als **dokumentierter Prozess** geführt (Vorlage in Abschnitt 6 dieses Runbooks, abgelegt unter `<PLATZHALTER: Ablageort, z. B. internes Wiki / verschlüsselter Ordner>`). Als **technischer Nachweis-/Evidenztrail** dient das im Code vorhandene **Audit-Log** (`audit_logs`, `backend/src/audit/`), das Wer/Was/Wann protokolliert. *[Folge-Ticket Code-Team: optionales Register-Modul mit Fristen-Timer.]*

---

## 1. Was ist eine „Datenpanne"?
Eine Verletzung der Sicherheit, die zur Vernichtung, zum Verlust, zur Veränderung oder zur unbefugten Offenlegung von bzw. zum unbefugten Zugang zu personenbezogenen Daten führt. Beispiele im Detailly-Kontext:
- Unbefugter Zugriff auf Kunden-/Fahrzeug-/Rechnungsdaten oder Fotos (z. B. kompromittiertes Konto, Fehlkonfiguration).
- Verlust/Diebstahl eines Datenträgers oder eines **unverschlüsselten Backups** (Achtung: `private-uploads/` = personenbezogene Fotos).
- Fehlversand von Belegen/Mails an falsche Empfänger.
- Cross-Tenant-Datenabfluss (mandantenübergreifender Zugriff).
- Verlust von `DATA_ENC_KEY` (Verfügbarkeitsverlust der verschlüsselten Felder).

## 2. Rollen und Kontakte

| Rolle | Person / Kanal | Aufgabe |
|---|---|---|
| **Incident-Lead (Detailly)** | `<PLATZHALTER: Finn Bellmann>` | Gesamtkoordination, Bewertung, Meldung an Betriebe |
| **Technischer Ansprechpartner** | `<PLATZHALTER: Name/Kanal>` | Eindämmung, Log-Analyse, Ursachenforschung |
| **Melde-/Sicherheitspostfach** | `<PLATZHALTER: security@detailly.de / SECURITY_ALERT_EMAIL>` | Eingang von Hinweisen (intern/extern) |
| **Datenschutzbeauftragter** | `<PLATZHALTER: benannt/nicht benannt>` | Rechtliche Bewertung |
| **Kanzlei** | `<PLATZHALTER: Kanzlei/Notfallkontakt>` | Meldepflicht/Formulierung |
| **Betrieb (Verantwortlicher)** | Kontaktdaten je Tenant | Empfänger der Detailly-Meldung; meldet ggf. an Aufsicht/Betroffene |

## 3. Fristen (Richtwerte — final mit Anwalt/DSB)
- **Detailly → Betrieb:** unverzüglich, spätestens **`<PLATZHALTER: 24>` Stunden** nach Kenntnis (nicht 48 h) — entspricht AVV § 8 Abs. 2.
- **Betrieb → Aufsichtsbehörde:** **72 Stunden** ab Kenntnis des Betriebs (Art. 33 Abs. 1), außer die Panne führt voraussichtlich nicht zu einem Risiko.
- **Betrieb → Betroffene:** unverzüglich bei **hohem Risiko** (Art. 34).

## 4. Ablauf (Meldekette)

### Schritt 1 — Erkennen & Erstaufnahme (Detailly)
Hinweis geht an das Sicherheitspostfach oder fällt intern auf. Incident-Lead eröffnet einen Vorgang, vergibt eine ID, hält Zeitpunkt der **Kenntnisnahme** fest (Fristbeginn). Erste Sicherung von **Audit-Logs** und Server-Logs.

### Schritt 2 — Eindämmen (Detailly, technisch)
Sofortmaßnahmen je nach Fall: betroffene Konten sperren/Passwörter zurücksetzen (entwertet Sessions über `tokenVersion`/`passwordChangedAt`), 2FA erzwingen, Schlüssel/Secrets rotieren, betroffene Endpunkte abschalten, Hoster einbeziehen.

### Schritt 3 — Bewerten (Detailly + DSB/Anwalt)
Art der Panne, betroffene Datenkategorien und Personen, wahrscheinliche Folgen, Risiko (niedrig/hoch). Welche Betriebe (Tenants) sind betroffen?

### Schritt 4 — Melden an die betroffenen Betriebe (Detailly → Betrieb)
Unverzügliche Meldung an jeden betroffenen Betrieb (Vorlage Abschnitt 5) mit den nach Art. 33 Abs. 3 verfügbaren Angaben. Dokumentation im Register (Abschnitt 6).

### Schritt 5 — Meldung an Aufsicht/Betroffene (Betrieb)
Der Betrieb entscheidet als Verantwortlicher über die Meldung an seine zuständige Aufsichtsbehörde (72 h) und ggf. an die Betroffenen (Art. 34). Detailly unterstützt mit Informationen.

### Schritt 6 — Nachbereitung
Ursachenanalyse (Root Cause), dauerhafte Abstellung, Update der TOM (`TOMS.md`), Lessons Learned. Register-Eintrag abschließen.

## 5. Vorlage: Meldung Detailly → Betrieb

```
Betreff: [Datenschutzvorfall] Meldung nach Art. 33 Abs. 2 DSGVO — Vorgang <ID>

Sehr geehrte Damen und Herren,

als Ihr Auftragsverarbeiter informieren wir Sie über einen uns am
<Datum/Uhrzeit Kenntnisnahme> bekannt gewordenen Sicherheitsvorfall.

1. Art der Verletzung: <Beschreibung>
2. Betroffene Datenkategorien: <z. B. Kundenkontakt, Fahrzeug, Rechnung, Fotos>
3. Betroffene Personen (Kategorien/ca. Anzahl): <…>
4. Wahrscheinliche Folgen: <…>
5. Ergriffene/vorgeschlagene Maßnahmen: <…>
6. Ansprechpartner bei uns: <Name, Kontakt>

Bitte prüfen Sie als Verantwortlicher eine etwaige Meldepflicht gegenüber Ihrer
Aufsichtsbehörde (72 Stunden ab Ihrer Kenntnis) sowie ggf. die Benachrichtigung
betroffener Personen (Art. 34 DSGVO). Wir unterstützen Sie hierbei.
```

## 6. Register-Vorlage (dokumentierter Prozess, Art. 33 Abs. 5)

| Feld | Inhalt |
|---|---|
| Vorgangs-ID | `<…>` |
| Kenntnisnahme (Datum/Uhrzeit) | `<…>` |
| Meldung an Betrieb(e) am | `<…>` |
| Art der Verletzung | `<…>` |
| Betroffene Datenkategorien | `<…>` |
| Betroffene Personen (Kategorien/Anzahl) | `<…>` |
| Betroffene Betriebe (Tenants) | `<…>` |
| Wahrscheinliche Folgen / Risiko | `<niedrig/hoch>` |
| Sofortmaßnahmen | `<…>` |
| Meldung an Aufsicht durch Betrieb? | `<ja/nein/Begründung>` |
| Benachrichtigung Betroffener? | `<ja/nein/Begründung>` |
| Root Cause / dauerhafte Abstellung | `<…>` |
| Abgeschlossen am | `<…>` |

---

## Betreiber-/Anwalt-To-do
- [ ] Namen, Kontakte, `SECURITY_ALERT_EMAIL` und Ablageort des Registers eintragen.
- [ ] 24-h-/72-h-Fristen und Bewertungsschema mit Anwalt/DSB final abstimmen.
- [ ] Erreichbarkeit außerhalb der Geschäftszeiten (Notfallkontakt Kanzlei/Hoster) sicherstellen.
- [ ] Optionales Register-Modul im Produkt bewerten (Code-Team-Ticket).
