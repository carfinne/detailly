# Sicherheitsrichtlinie (Security Policy)

Wir nehmen die Sicherheit von Detailly und den Daten unserer Kundinnen und Kunden
ernst. Wenn Sie eine Schwachstelle gefunden haben, danken wir Ihnen für eine
verantwortungsvolle Meldung – bitte machen Sie sie **nicht** vorher öffentlich.

## Wie melde ich eine Schwachstelle?

Zwei Wege, der erste ist bevorzugt:

1. **GitHub Private Vulnerability Reporting** (vertraulich, empfohlen):
   Über den Reiter **"Security" → "Report a vulnerability"** dieses Repositories.
   Die Meldung ist privat und nur für die Maintainer sichtbar.

2. **Per E-Mail:** an **security@detailly.de**.
   Wenn Sie möchten, verschlüsseln Sie die Nachricht oder bitten Sie zuerst um einen
   sicheren Kanal.

Bitte melden Sie **keine** Schwachstellen über öffentliche GitHub-Issues, Pull
Requests oder soziale Medien.

## Was gehört in die Meldung?

Damit wir schnell reagieren können, hilft uns:

- eine **Beschreibung** der Schwachstelle und ihrer möglichen Auswirkung,
- eine **Schritt-für-Schritt-Anleitung** zum Nachstellen (Proof of Concept),
- betroffene **URL/Endpunkt/Datei** bzw. Version/Commit,
- optional Ihr Name für die Danksagung (auf Wunsch bleiben Sie anonym).

**Bitte nicht:** echte fremde Kundendaten herunterladen/verändern, Konten Dritter
angreifen, Dienste stören (kein DoS/Lasttest), oder mehr Daten abgreifen, als zum
Nachweis nötig ist. Nutzen Sie nach Möglichkeit **Testkonten** und eigene Daten.

## Was passiert dann? (unser Ablauf)

| Schritt | Zeitrahmen (Richtwert) |
|--------|------------------------|
| Eingangsbestätigung Ihrer Meldung | innerhalb von **3 Werktagen** |
| Erste Einschätzung (Schweregrad, ob bestätigt) | innerhalb von **10 Werktagen** |
| Behebung / Zeitplan | je nach Schweregrad, kritische Punkte priorisiert |
| Rückmeldung nach Fix + (auf Wunsch) Danksagung | nach Abschluss |

Bei laufender Bearbeitung halten wir Sie über den Stand auf dem Laufenden. Eine
Veröffentlichung stimmen wir gemeinsam ab, nachdem der Fix ausgerollt ist
(koordinierte Offenlegung).

## Geltungsbereich

**In Scope:** die Detailly-Anwendung (Backend `backend/`, Frontend `frontend/`) und
ihre öffentlich erreichbaren Endpunkte.

**Out of Scope / bereits bekannt:**

- **Volumetrische DDoS-/Netzwerk-Angriffe (L3/L4).** Diese kann Anwendungscode nicht
  abwehren – dafür sind vorgelagerte Schutzschichten des Betreibers zuständig
  (WAF/CDN, Reverse-Proxy-Limits, fail2ban). Solche Berichte sind kein App-Bug.
- Findings aus reinen automatisierten Scannern **ohne** belegbare Auswirkung.
- Fehlende Sicherheits-Header auf reinen Redirect-/Statik-Antworten ohne Impact.
- Social Engineering gegen Mitarbeitende, physischer Zugang.

## Sichere Zusage (Safe Harbor)

Wenn Sie sich an diese Richtlinie halten (verantwortungsvoll, keine Datenschäden,
keine Störung des Betriebs), werden wir Ihre Sicherheitsforschung als gutgläubig
betrachten und keine rechtlichen Schritte gegen Sie einleiten.

## Verwandte Dokumente

- **Mail-/Phishing-Härtung (SPF/DKIM/DMARC):** [`docs/MAIL_SICHERHEIT.md`](docs/MAIL_SICHERHEIT.md)
- **Technische und organisatorische Maßnahmen (DSGVO):** [`docs/compliance/TOMS.md`](docs/compliance/TOMS.md)
- **Datenpannen-Prozess:** [`docs/compliance/DATENPANNEN_RUNBOOK.md`](docs/compliance/DATENPANNEN_RUNBOOK.md)
