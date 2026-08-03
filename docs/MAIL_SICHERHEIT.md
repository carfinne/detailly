# Mail-Sicherheit: SPF, DKIM und DMARC einrichten (Phishing-Schutz)

**Für wen:** den Inhaber/Betreiber von Detailly. Technisches Grundwissen genügt –
jeder Schritt ist erklärt.

**Warum das der wichtigste Phishing-Schutz ist:** Ohne diese drei DNS-Einträge kann
**jeder** E-Mails verschicken, die aussehen, als kämen sie von `detailly.de`, und
damit eure Kunden abfischen ("Ihr Passwort ist abgelaufen, klicken Sie hier ..."). 
SPF, DKIM und DMARC sagen der Welt: *"Diese Server dürfen in meinem Namen senden –
alles andere ist gefälscht."* Das kann **kein** Code in der App leisten, nur DNS-
Einträge bei eurem Domain-Anbieter.

> **Wo trage ich das ein?** Bei eurem Domain-Anbieter (z. B. IONOS, Strato, Namecheap,
> Cloudflare) im Bereich **DNS-Einstellungen / DNS-Verwaltung**. Alle drei sind
> **TXT-Einträge** (DKIM manchmal CNAME – siehe unten). Änderungen brauchen bis zu
> 24 Stunden, bis sie überall sichtbar sind.

---

## Kurzüberblick

| Eintrag | Was er tut (in einfachen Worten) | Typ |
|--------|-----------------------------------|-----|
| **SPF** | Liste der Server, die in eurem Namen senden dürfen | TXT |
| **DKIM** | Unfälschbare Unterschrift unter jede Mail | TXT (oder CNAME) |
| **DMARC** | Regel, was mit gefälschten Mails passiert + Report an euch | TXT |

Reihenfolge der Einrichtung: **erst SPF + DKIM**, dann **DMARC mit `p=none`**
(nur beobachten), und erst wenn alles sauber läuft, DMARC schrittweise verschärfen.

---

## 1. SPF – "Welche Server dürfen senden?"

**Was es bewirkt:** Empfänger (Gmail, Outlook, …) prüfen: *Kam diese Mail von einem
Server, der in eurem SPF-Eintrag steht?* Wenn nicht, ist sie verdächtig.

**Ihr braucht genau EINEN SPF-Eintrag** für die Domain (mehrere SPF-Einträge machen
SPF ungültig!). Er listet alle Dienste auf, die für euch senden.

**Beispiel-Eintrag** (Name/Host: `@` oder leer = die Domain selbst):

```
Typ:   TXT
Name:  @
Wert:  v=spf1 include:_spf.google.com include:sendgrid.net -all
```

- `include:...` → hier die Sende-Dienste eintragen, die ihr wirklich nutzt
  (Beispiele: `_spf.google.com` für Google Workspace, `include:sendgrid.net` für
  SendGrid). Fragt euren Mail-/SMTP-Anbieter nach seinem `include`-Wert.
- `-all` am Ende → "alles andere ablehnen" (strikt, empfohlen). Wer vorsichtig
  starten will, nimmt zunächst `~all` (softfail = nur markieren) und stellt später
  auf `-all` um.

**Wie prüfe ich, ob es wirkt?**
- Online: <https://mxtoolbox.com/spf.aspx> → eure Domain eingeben → sollte den Eintrag
  grün anzeigen.
- Sendet euch selbst eine Test-Mail an eine Gmail-Adresse, öffnet sie, "Original
  anzeigen" → dort steht `SPF: PASS`.

---

## 2. DKIM – "Die unfälschbare Unterschrift"

**Was es bewirkt:** Der sendende Server unterschreibt jede Mail kryptografisch. Der
Empfänger prüft die Unterschrift gegen einen **öffentlichen Schlüssel**, der in
eurem DNS liegt. Passt sie, ist bewiesen: Die Mail wurde unterwegs nicht verändert
und stammt wirklich von einem berechtigten Server.

**Den DKIM-Eintrag liefert euch euer Sende-Dienst** (Google Workspace, SendGrid,
euer SMTP-Anbieter). Ihr erzeugt dort einen DKIM-Schlüssel und bekommt einen
`Name` (den *Selector*) und einen langen `Wert` (den öffentlichen Schlüssel), die
ihr ins DNS eintragt.

**Beispiel-Eintrag** (der genaue Selector kommt vom Anbieter, z. B. `google`, `s1`):

```
Typ:   TXT
Name:  google._domainkey
Wert:  v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...(langer Schlüssel)
```

Manche Anbieter geben stattdessen einen **CNAME**-Eintrag vor – dann exakt so
übernehmen, wie der Anbieter es zeigt.

### Zwei Domains sauber auseinanderhalten

Bei Detailly gibt es potenziell **zwei** DKIM-Situationen:

1. **Plattform-Domain** (`detailly.de` – die Domain, von der Detailly selbst Konto-,
   Reset- und Sicherheits-Mails verschickt): Diesen DKIM-Schlüssel richtet **ihr als
   Betreiber** bei eurem Plattform-Mailanbieter ein. Diese Anleitung dreht sich
   primär um diese Domain.

2. **Betriebs-Domain** (ein angeschlossener Aufbereitungsbetrieb, der mit **seiner
   eigenen** Absenderadresse über sein eigenes SMTP sendet): Für diesen Fall erzeugt
   die App **pro Betrieb einen eigenen privaten DKIM-Schlüssel** (verschlüsselt
   gespeichert, siehe `docs/compliance/TOMS.md`). Der Betrieb trägt seinen eigenen
   öffentlichen DKIM-Schlüssel in **seine** Domain ein – die App zeigt ihm die
   fertigen DNS-Einträge unter **Einstellungen → Mail-Domain verifizieren** an und
   signiert erst, wenn die Domain dort auf "grün" steht. Das ist unabhängig von
   eurer Plattform-Domain: jede Domain hat ihren eigenen Schlüssel.

> Kurz: **Wer die Absender-Domain besitzt, richtet für sie SPF/DKIM/DMARC ein.**
> Ihr für `detailly.de`, jeder Betrieb für seine eigene Domain (dabei hilft die App).

**Wie prüfe ich, ob es wirkt?**
- Test-Mail an Gmail → "Original anzeigen" → `DKIM: PASS`.
- Online: <https://mxtoolbox.com/dkim.aspx> (Domain + Selector eingeben).

---

## 3. DMARC – "Was passiert mit gefälschten Mails?" (der wichtigste Teil)

**Was es bewirkt:** DMARC verbindet SPF und DKIM und legt eine **Regel** fest:
*Wenn eine Mail behauptet, von `detailly.de` zu sein, aber weder SPF noch DKIM
bestehen – was soll der Empfänger tun?* Zusätzlich schickt DMARC euch **Reports**,
wer in eurem Namen sendet (auch die Fälscher). Das ist eure Sichtbarkeit.

### Der sichere Weg: `p=none` → `p=quarantine` → `p=reject`

**Nicht** am ersten Tag `p=reject` setzen! Sonst blockiert ihr womöglich eure
**eigenen** legitimen Mails (z. B. ein Newsletter-Dienst, den ihr im SPF vergessen
habt) und niemand bekommt sie mehr. Stattdessen in drei Stufen:

**Stufe 1 – Nur beobachten (`p=none`), sofort einrichten:**

```
Typ:   TXT
Name:  _dmarc
Wert:  v=DMARC1; p=none; rua=mailto:dmarc@detailly.de; fo=1
```

- `p=none` → es wird **nichts** blockiert, aber ihr bekommt Reports.
- `rua=mailto:...` → an diese Adresse gehen die täglichen Zusammenfassungen. Legt
  dafür am besten ein eigenes Postfach an (die Reports sind XML-Dateien; Tools wie
  <https://dmarc.postmarkapp.com/> oder <https://www.dmarcanalyzer.com/> machen sie
  lesbar).
- **Lasst das 1–2 Wochen laufen** und schaut in den Reports: Bestehen **alle** eure
  echten Mails SPF **oder** DKIM? Taucht ein legitimer Dienst auf, der noch fehlt,
  ergänzt ihn in Schritt 1/2.

**Stufe 2 – Verdächtiges in den Spam (`p=quarantine`):**

Wenn die Reports sauber sind (eure echten Mails bestehen durchgängig):

```
Wert:  v=DMARC1; p=quarantine; rua=mailto:dmarc@detailly.de; fo=1; pct=100
```

- Gefälschte Mails landen jetzt im **Spam-Ordner** des Empfängers statt im Posteingang.
- Optional vorsichtiger starten mit `pct=25` (nur 25 % betroffen) und hochziehen.

**Stufe 3 – Fälschungen komplett ablehnen (`p=reject`), das Ziel:**

Nach ein paar Wochen ohne Probleme:

```
Wert:  v=DMARC1; p=reject; rua=mailto:dmarc@detailly.de; fo=1; pct=100
```

- Gefälschte Mails werden jetzt **gar nicht mehr zugestellt**. Das ist der eigentliche
  Phishing-Schutz: Niemand kann mehr glaubhaft in eurem Namen an eure Kunden schreiben.

**Wie prüfe ich, ob es wirkt?**
- Online: <https://mxtoolbox.com/dmarc.aspx> → zeigt eure aktuelle Policy an.
- Test-Mail an Gmail → "Original anzeigen" → `DMARC: PASS`.
- Der beste Nachweis sind die **rua-Reports**: dort seht ihr über Tage, dass eure
  echten Mails bestehen und wer sonst noch versucht, in eurem Namen zu senden.

---

## Checkliste

- [ ] Genau **ein** SPF-TXT-Eintrag, der alle eure Sende-Dienste listet, endet mit `-all` (oder zunächst `~all`).
- [ ] **DKIM** beim Sende-Dienst erzeugt und der vorgegebene TXT/CNAME-Eintrag im DNS.
- [ ] **DMARC** startet mit `p=none` + `rua`-Report-Adresse.
- [ ] Reports 1–2 Wochen geprüft: alle **echten** Mails bestehen SPF **oder** DKIM.
- [ ] DMARC auf `p=quarantine` erhöht, weiter beobachtet.
- [ ] DMARC final auf `p=reject`.
- [ ] Jeder angeschlossene Betrieb mit eigener Absender-Domain richtet dasselbe für **seine** Domain ein (App: *Mail-Domain verifizieren*).

---

## Wichtig zur Ehrlichkeit

SPF/DKIM/DMARC schützen davor, dass jemand **eure Domain** fälscht. Sie schützen
**nicht** davor, dass ein Angreifer eine **ähnlich aussehende** Domain registriert
(`detai11y.de`, `detailly-support.com`). Dagegen helfen: solche Tippfehler-Domains
selbst registrieren, Kunden schulen ("wir schreiben nur von `@detailly.de`") und der
Hinweis in unseren Sicherheits-Mails: *"Detailly fragt Sie NIE per E-Mail nach Ihrem
Passwort."* Wie man eine gefundene Schwachstelle meldet, steht in `SECURITY.md`.
