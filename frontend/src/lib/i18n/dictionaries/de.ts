// ===========================================================================
// DE – REFERENZ-WÖRTERBUCH (Quelle der Wahrheit)
// ---------------------------------------------------------------------------
// Flaches, getyptes Objekt. Verschachtelte Namespaces per Punkt-Key
// (z. B. `nav.item.dashboard`, `common.save`, `landing.hero.title1`).
//
// Diese Datei ist die REFERENZ: `type Dict = typeof de` (siehe ../provider)
// erzwingt, dass `en.ts` DIESELBEN Keys vollständig liefert. `ru.ts`/`pl.ts`
// sind `Partial<Dict>` – dort fehlende Keys fallen zur Laufzeit automatisch auf
// DE zurück (nie ein leerer String oder der rohe Key).
//
// Platzhalter: `{name}` wird per einfacher Interpolation ersetzt (siehe t()).
// `satisfies Record<string, string>` prüft, dass jeder Wert ein String ist,
// ohne die literalen Keys zu verlieren (die brauchen wir für die Typprüfung).
// ===========================================================================

export const de = {
  // ---- Gemeinsame UI-Texte -------------------------------------------------
  'common.save': 'Speichern',
  'common.cancel': 'Abbrechen',
  'common.confirm': 'Bestätigen',
  'common.delete': 'Löschen',
  'common.close': 'Schließen',
  'common.back': 'Zurück',
  'common.loading': 'Lädt',
  'common.loadingEllipsis': 'Lädt…',
  'common.error': 'Fehler',
  'common.toStart': 'Zur Startseite',

  // ---- Sprachumschalter ----------------------------------------------------
  'switcher.label': 'Sprache wählen',
  'switcher.current': 'Aktuelle Sprache',

  // ---- Navigation: Gruppen -------------------------------------------------
  'nav.group.overview': 'Übersicht',
  'nav.group.operations': 'Betrieb',
  'nav.group.masterdata': 'Stammdaten',
  'nav.group.finance': 'Finanzen',
  'nav.group.organization': 'Organisation',
  'nav.group.platform': 'Plattform',

  // ---- Navigation: Einträge ------------------------------------------------
  'nav.item.dashboard': 'Dashboard',
  'nav.item.orders': 'Aufträge',
  'nav.item.calculation': 'Kalkulation',
  'nav.item.intakeQuick': 'Annahme (schnell)',
  'nav.item.intake3d': 'Annahme & Gutachten (3D)',
  'nav.item.planboard': 'Plantafel',
  'nav.item.requests': 'Anfragen',
  'nav.item.customers': 'Kunden',
  'nav.item.vehicles': 'Fahrzeuge',
  'nav.item.services': 'Leistungen',
  'nav.item.invoices': 'Rechnungen',
  'nav.item.reminders': 'Mahnungen',
  'nav.item.reports': 'Auswertungen',
  'nav.item.accounting': 'Buchhaltung',
  'nav.item.shop': 'Shop & Lager',
  'nav.item.marketplace': 'Marktplatz',
  'nav.item.locations': 'Standorte',
  'nav.item.staff': 'Mitarbeiter',
  'nav.item.time': 'Zeiterfassung',
  'nav.item.audit': 'Audit-Log',
  'nav.item.settings': 'Einstellungen',
  'nav.item.help': 'Hilfe & Support',
  'nav.item.assistant': 'Support-Assistent',
  'nav.item.subscription': 'Abo & Tarif',
  'nav.item.platformAnalytics': 'Plattform-Analysen',
  'nav.item.platformMarketplace': 'Marktplatz-Pflege',
  'nav.item.platformSupport': 'Support-Anfragen',
  'nav.item.subscriptions': 'Abos',

  // ---- Login ---------------------------------------------------------------
  'login.subtitle': 'Detailing Suite — Aufbereitung, Folierung & PPF',
  'login.email': 'E-Mail',
  'login.password': 'Passwort',
  'login.forgot': 'Passwort vergessen?',
  'login.showPassword': 'Passwort anzeigen',
  'login.hidePassword': 'Passwort verbergen',
  'login.submit': 'Anmelden',
  'login.submitting': 'Anmelden…',
  'login.failed': 'Anmeldung fehlgeschlagen',
  'login.noAccount': 'Noch kein Konto?',
  'login.registerCta': 'Betrieb registrieren',
  'login.footer': '© {year} Detailly · Eigenständige Detailing-Software',

  // ===========================================================================
  // LANDING (Route "/")
  // ===========================================================================

  // ---- Kopfleiste ----------------------------------------------------------
  'landing.nav.branchen': 'Branchen',
  'landing.nav.ablauf': 'So funktioniert’s',
  'landing.nav.funktionen': 'Funktionen',
  'landing.nav.faq': 'FAQ',
  'landing.nav.login': 'Anmelden',
  'landing.nav.trial': 'Kostenlos testen',

  // ---- Hero ----------------------------------------------------------------
  'landing.hero.badge': 'Die Werkstatt-Software für Aufbereitung, Folierung & PPF',
  'landing.hero.title1': 'Dein Handwerk ist Präzision.',
  'landing.hero.title2': 'Deine Software jetzt auch.',
  'landing.hero.sub':
    'Detailly bündelt Kunden, Fahrzeuge, Aufträge, Plantafel, 3D-Schadenserfassung und GoBD-konforme Rechnungen in einer Software — DSGVO-konform, auf jedem Gerät. Schluss mit Zettelwirtschaft.',
  'landing.hero.ctaPrimary': '14 Tage kostenlos testen',
  'landing.hero.ctaSecondary': 'Funktionen ansehen',
  'landing.hero.trailer': 'Keine Kreditkarte nötig · In Minuten startklar · Monatlich kündbar',

  // ---- Vertrauens-Leiste ---------------------------------------------------
  'landing.trust.dsgvo': 'DSGVO-konform',
  'landing.trust.gobd': 'GoBD-konforme Rechnungen',
  'landing.trust.madeInGermany': 'Made in Germany',
  'landing.trust.encrypted': 'Daten verschlüsselt',
  'landing.trust.noInstall': 'Keine Installation',

  // ---- Problem -------------------------------------------------------------
  'landing.problem.kicker': 'Kennst du das?',
  'landing.problem.title': 'Der Betrieb läuft — die Verwaltung bremst.',
  'landing.problem.sub':
    'Während die Arbeit am Fahrzeug Präzision verlangt, versinkt das Drumherum im Papierkram.',
  'landing.problem.p1': 'Die Fahrzeughistorie liegt verteilt auf Ordnern, Zetteln und im Kopf.',
  'landing.problem.p2': 'Rechnungen bleiben liegen — und kosten dich bares Geld.',
  'landing.problem.p3': 'Schäden bei der Annahme lassen sich später kaum noch nachweisen.',
  'landing.problem.p4': 'Fünf verschiedene Tools, die nicht miteinander reden.',
  'landing.problem.summaryPre': 'Detailly bringt all das in ',
  'landing.problem.summaryEm': 'ein',
  'landing.problem.summaryPost': ' System — übersichtlich, schnell, an jedem Gerät.',

  // ---- Branchen-Switcher ---------------------------------------------------
  'landing.branchen.kicker': 'Für dein Gewerk gebaut',
  'landing.branchen.title': 'Eine Software, die dein Gewerk spricht',
  'landing.branchen.sub':
    'Beim Start wählst du deinen Schwerpunkt — Detailly stellt Leistungskatalog, Kalkulation und sogar den Look darauf ein. Probier es aus: Wähle dein Gewerk und sieh zu, wie sich die Seite umfärbt.',
  'landing.branchen.selected': 'Ausgewählt',
  'landing.branchen.cta': 'Als {label} starten',
  'landing.branchen.complete': 'Alles aus einer Hand?',
  'landing.branchen.completeCta': 'Als Komplett-Anbieter starten',
  'landing.branchen.aufbereitung.l1': 'Innen- & Außenaufbereitung',
  'landing.branchen.aufbereitung.l2': 'Politur & Keramikversiegelung',
  'landing.branchen.aufbereitung.l3': 'Leasingrückgabe-Checks',
  'landing.branchen.folierung.l1': 'Voll- & Teilfolierung',
  'landing.branchen.folierung.l2': 'Farbwechsel & Design',
  'landing.branchen.folierung.l3': 'Werbebeschriftung',
  'landing.branchen.ppf.l1': 'Front- & Komplettschutz',
  'landing.branchen.ppf.l2': 'Steinschlagschutz-Pakete',
  'landing.branchen.ppf.l3': 'Präzise Zuschnitte',

  // ---- So funktioniert's ---------------------------------------------------
  'landing.ablauf.kicker': 'So einfach geht’s',
  'landing.ablauf.title': 'In drei Schritten zum sauberen Ablauf',
  'landing.ablauf.step1.title': 'Annehmen',
  'landing.ablauf.step1.desc':
    'Kunde, Fahrzeug und Schäden in Minuten erfasst — mit 3D-Markierung, Fotos und digitaler Unterschrift.',
  'landing.ablauf.step2.title': 'Abwickeln',
  'landing.ablauf.step2.desc':
    'Leistungen kalkulieren, Termine auf der Plantafel planen, den Fortschritt jederzeit im Blick behalten.',
  'landing.ablauf.step3.title': 'Abrechnen',
  'landing.ablauf.step3.desc':
    'Aus dem Auftrag wird per Klick die GoBD-konforme Rechnung als PDF — inklusive Fälligkeiten und Mahnwesen.',

  // ---- Funktionen ----------------------------------------------------------
  'landing.funktionen.kicker': 'Alle Werkzeuge',
  'landing.funktionen.title': 'Alles, was dein Betrieb braucht',
  'landing.funktionen.sub':
    'Ein durchgängiger Ablauf — von der Fahrzeugannahme bis zur bezahlten Rechnung.',
  'landing.funktionen.kunden.title': 'Kunden & Fahrzeuge',
  'landing.funktionen.kunden.desc':
    'Stammdaten, Fahrzeugakte und komplette Historie pro Fahrzeug — sofort auffindbar.',
  'landing.funktionen.auftraege.title': 'Aufträge & Plantafel',
  'landing.funktionen.auftraege.desc':
    'Vom Angebot bis zur Abnahme. Wochenplanung mit Terminen — alles im Blick.',
  'landing.funktionen.rechnungen.title': 'Rechnungen & Belege',
  'landing.funktionen.rechnungen.desc':
    '§14- & GoBD-konforme Rechnungen und Angebote als PDF, inkl. Fälligkeiten und Mahnwesen.',
  'landing.funktionen.schaden3d.title': '3D-Schadenserfassung',
  'landing.funktionen.schaden3d.desc':
    'Schäden direkt am Fahrzeugmodell markieren, mit Fotos dokumentieren und digital unterschreiben lassen.',
  'landing.funktionen.kalkulation.title': 'Kalkulation je Gewerk',
  'landing.funktionen.kalkulation.desc':
    'Leistungskataloge und Preislogik für Aufbereitung, Folierung und PPF — passend zu deinem Schwerpunkt.',
  'landing.funktionen.dsgvo.title': 'DSGVO & Sicherheit',
  'landing.funktionen.dsgvo.desc':
    'Sensible Daten verschlüsselt, strikt pro Betrieb getrennt, mit Datenexport und Löschung auf Knopfdruck.',
  'landing.funktionen.footnotePre': 'Plus: blitzschnelle globale Suche (',
  'landing.funktionen.footnotePost': '), mobile Navigation und mehrere Mitarbeiter pro Betrieb.',

  // ---- 3D-Schadenserfassung (Showcase) -------------------------------------
  'landing.schaden.kicker': 'Das Highlight',
  'landing.schaden.title': 'Schäden festhalten, bevor sie zum Streit werden',
  'landing.schaden.desc':
    'Bei der Annahme markierst du Kratzer, Dellen und Steinschläge direkt am Fahrzeugmodell — mit Fotos und digitaler Unterschrift des Kunden. Wenn später Fragen kommen, hast du die Beweise. Schwarz auf weiß.',
  'landing.schaden.point1': 'Schadenspunkte direkt am 3D-Modell setzen',
  'landing.schaden.point2': 'Fotos je Schaden — automatisch zugeordnet',
  'landing.schaden.point3': 'Digitale Unterschrift bei Annahme und Abnahme',
  'landing.schaden.cardHeader': 'Fahrzeugannahme · Schadenserfassung',
  'landing.schaden.cardBadge': '2 Schäden',
  'landing.schaden.cardPhotos': '4 Fotos dokumentiert',
  'landing.schaden.cardSignature': 'Unterschrift erfasst',

  // ---- Wachstum ------------------------------------------------------------
  'landing.wachstum.kicker': 'Skalierbar',
  'landing.wachstum.title': 'Wachstum durch Überblick',
  'landing.wachstum.sub':
    'Wer organisiert ist und seine Zahlen kennt, trifft bessere Entscheidungen — vom Einzelbetrieb bis zur Kette.',
  'landing.wachstum.echtzeit.title': 'Echtzeit-Überblick',
  'landing.wachstum.echtzeit.desc':
    'Umsatz, offene Aufträge und Termine live im Dashboard — du siehst sofort, wo es läuft und wo es hakt.',
  'landing.wachstum.standorte.title': 'Mehrere Standorte',
  'landing.wachstum.standorte.desc':
    'Filialen unter einem Dach verwalten — sauber getrennt und trotzdem zentral im Blick. Ausbaufähig, wann immer du wächst.',
  'landing.wachstum.team.title': 'Team, Rollen & Rechte',
  'landing.wachstum.team.desc':
    'Mitarbeiter einladen und Rollen vergeben — jeder sieht genau das, was er soll. Sauber überwacht und dokumentiert.',
  'landing.wachstum.chartVolume': 'Auftragsvolumen',
  'landing.wachstum.chartGrowing': 'wächst',
  'landing.wachstum.chartLocations': 'Standorte',

  // ---- Zahlen (Count-up) ---------------------------------------------------
  'landing.zahlen.stat1.unit': 'Min.',
  'landing.zahlen.stat1.label': 'von der Annahme bis zum fertigen Auftrag',
  'landing.zahlen.stat2.unit': 'Tage',
  'landing.zahlen.stat2.label': 'kostenlos testen — ohne Kreditkarte',
  'landing.zahlen.stat3.unit': '%',
  'landing.zahlen.stat3.label': 'DSGVO- und GoBD-konform',
  'landing.zahlen.stat4.value': '5 → 1',
  'landing.zahlen.stat4.label': 'ein System statt fünf Insellösungen',

  // ---- Stimmen -------------------------------------------------------------
  'landing.stimmen.kicker': 'Aus der Praxis',
  'landing.stimmen.title': 'Was Pilotbetriebe sagen',
  'landing.stimmen.q1.text':
    'Endlich sehe ich morgens auf einen Blick, was heute in der Halle passiert. Die Zettelwirtschaft ist weg.',
  'landing.stimmen.q1.who': 'Inhaber · Aufbereitungs-Studio',
  'landing.stimmen.q2.text':
    'Die 3D-Schadenserfassung bei der Annahme hat uns schon zweimal vor teuren Diskussionen bewahrt.',
  'landing.stimmen.q2.who': 'Geschäftsführer · Folierungs-Betrieb',
  'landing.stimmen.q3.text':
    'Aus dem fertigen Auftrag wird in Sekunden die Rechnung. Das hat früher den Feierabend gekostet.',
  'landing.stimmen.q3.who': 'Werkstattleitung · PPF-Studio',

  // ---- Warum Detailly ------------------------------------------------------
  'landing.warum.kicker': 'Warum Detailly',
  'landing.warum.title': 'Software für die Werkstatt — nicht fürs Autohaus.',
  'landing.warum.body':
    'Aufbereiter, Folierer und PPF-Studios liefern Präzisionsarbeit und verdienen Software, die genauso sauber arbeitet. Die meisten Werkstatt-Programme sind für große Autohäuser gebaut: überladen, kompliziert und teuer. Detailly ist bewusst anders — schlank, auf eure Abläufe zugeschnitten und in Minuten startklar. Eigenständig entwickelt, in Deutschland, mit Datenschutz von Grund auf.',

  // ---- News-Teaser ---------------------------------------------------------
  'landing.news.kicker': 'Detailly News',
  'landing.news.title': 'Was sich gerade tut',
  'landing.news.sub':
    'Produkt-Updates und Neuigkeiten rund um Detailly. (Beispiel-Einträge — bald mit echten Meldungen.)',
  'landing.news.all': 'Alle News ansehen',

  // ---- FAQ -----------------------------------------------------------------
  'landing.faq.kicker': 'Häufige Fragen',
  'landing.faq.title': 'Was du wissen willst, bevor du startest',
  'landing.faq.q1.q': 'Brauche ich technisches Wissen oder eine Installation?',
  'landing.faq.q1.a':
    'Nein. Du registrierst deinen Betrieb und legst direkt im Browser los — auf Computer, Tablet oder Smartphone. Es gibt nichts zu installieren und nichts einzurichten.',
  'landing.faq.q2.q': 'Ich mache Aufbereitung UND Folierung — was wähle ich?',
  'landing.faq.q2.a':
    'Dann bist du Komplett-Anbieter: Bei der Registrierung wählst du einfach „Komplett-Anbieter" und bekommst alle Leistungskataloge und Kalkulationen zusammen.',
  'landing.faq.q3.q': 'Wie sicher sind meine Kundendaten?',
  'landing.faq.q3.a':
    'Sensible Daten werden verschlüsselt gespeichert und sind strikt von anderen Betrieben getrennt. Kundendaten kannst du jederzeit exportieren oder löschen — komplett DSGVO-konform.',
  'landing.faq.q4.q': 'Was passiert nach den 14 Tagen?',
  'landing.faq.q4.a':
    'Du testest ohne Kreditkarte und ohne Risiko. Nach der Testphase wählst du den Tarif, der zu deinem Betrieb passt. Endet die Testphase, entstehen dir keine Kosten.',
  'landing.faq.q5.q': 'Läuft das auch auf dem Tablet in der Werkstatt?',
  'landing.faq.q5.a':
    'Ja. Detailly ist für jedes Gerät gebaut — vom Büro-PC bis zum Tablet an der Fahrzeugannahme. Die Bedienung passt sich automatisch an.',
  'landing.faq.q6.q': 'Kann ich meine Daten wieder mitnehmen?',
  'landing.faq.q6.a':
    'Jederzeit. Deine Daten gehören dir — ein Export ist auf Knopfdruck möglich, ohne dass du jemanden fragen musst.',

  // ---- Abschluss-CTA -------------------------------------------------------
  'landing.cta.band': 'Volle Fahrt voraus',
  'landing.cta.title': 'Bring Ordnung in deinen Betrieb — ab heute.',
  'landing.cta.sub':
    'Registriere deinen Betrieb in wenigen Minuten und teste Detailly 14 Tage kostenlos. Ohne Kreditkarte, ohne Risiko.',
  'landing.cta.primary': 'Jetzt kostenlos starten',
  'landing.cta.secondary': 'Ich habe schon ein Konto',

  // ---- Footer --------------------------------------------------------------
  'landing.footer.tagline':
    'Die Werkstatt-Software für Aufbereitung, Folierung und PPF. Eigenständig entwickelt in Deutschland.',
  'landing.footer.discover': 'Entdecken',
  'landing.footer.product': 'Produkt',
  'landing.footer.account': 'Konto & Rechtliches',
  'landing.footer.news': 'News',
  'landing.footer.masterclass': 'Masterclass',
  'landing.footer.gruendung': 'Gründung',
  'landing.footer.features': 'Funktionen',
  'landing.footer.branchen': 'Für dein Gewerk',
  'landing.footer.faq': 'Häufige Fragen',
  'landing.footer.trial': 'Kostenlos testen',
  'landing.footer.login': 'Anmelden',
  'landing.footer.register': 'Registrieren',
  'landing.footer.impressum': 'Impressum',
  'landing.footer.datenschutz': 'Datenschutz',
  'landing.footer.copyright': '© {year} Detailly · Alle Rechte vorbehalten',
} satisfies Record<string, string>;

export type Dict = typeof de;
