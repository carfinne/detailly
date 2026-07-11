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
  'common.toSubscription': 'Zum Abo & Tarif',

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

  // ---- Einstellungen: Kalkulation (€/qm) -----------------------------------
  'settings.kalk.title': 'Kalkulation · €/qm',
  'settings.kalk.subtitle': 'Basissätze für die 3D-Sofortkalkulation. In der Kalkulation bleibt jeder Wert überschreibbar.',
  'settings.kalk.grouplabel': 'Preis je Quadratmeter (netto)',
  'settings.kalk.folierung': 'Folierung',
  'settings.kalk.ppf': 'PPF / Lackschutz',
  'settings.kalk.aufbereitung': 'Aufbereitung',
  'settings.kalk.help': 'Diese Sätze sind die Vorgabe im 3D-Modul (Fläche × Fahrzeuggröße × €/qm). Leer oder 0 = interner Standardwert.',

  // ---- Tarif-Hinweise (Feature-Gating) -------------------------------------
  'settings.sevdesk.upgrade': 'Die automatische sevDesk-Übergabe ist ab dem Basic-Tarif verfügbar.',
  'ordertime.upgrade': 'Auftragszeiten & Lohnkosten sind im Pro-Tarif enthalten.',

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

  // ---- Kundenformular ------------------------------------------------------
  'kunden.form.leitwegId.label': 'Leitweg-ID',
  'kunden.form.leitwegId.help':
    'Nur für Rechnungen an Behörden/öffentliche Auftraggeber (steuert das B2G-Routing).',

  // ===========================================================================
  // KUNDEN (Route "/kunden")
  // ===========================================================================
  'kunden.title': 'Kunden',
  'kunden.subtitle': 'Privat- und Geschäftskunden',
  'kunden.csvImport': 'CSV-Import',
  'kunden.new': 'Neuer Kunde',
  'kunden.searchPlaceholder': 'Suche nach Name, E-Mail, Telefon…',

  // ---- Leerzustand ---------------------------------------------------------
  'kunden.empty.none': 'Noch keine Kunden angelegt.',
  'kunden.empty.filtered': 'Keine Kunden gefunden.',
  'kunden.empty.cta': 'Ersten Kunden anlegen',

  // ---- Tabellenspalten -----------------------------------------------------
  'kunden.col.name': 'Name',
  'kunden.col.typ': 'Typ',
  'kunden.col.email': 'E-Mail',
  'kunden.col.telefon': 'Telefon',
  'kunden.col.ort': 'Ort',

  // ---- Kundentyp -----------------------------------------------------------
  'kunden.type.business': 'Geschäft',
  'kunden.type.private': 'Privat',

  // ---- Aktionsmenü ---------------------------------------------------------
  'kunden.actionsFor': 'Aktionen für {name}',
  'kunden.action.open': 'Öffnen',
  'kunden.action.newOrder': 'Neuer Auftrag',
  'kunden.action.edit': 'Bearbeiten',

  // ---- Toast / Fehler / Löschen-Bestätigung --------------------------------
  'kunden.toast.deleted': '{name} gelöscht',
  'kunden.error.delete': 'Löschen fehlgeschlagen',
  'kunden.delete.title': 'Kunde löschen',
  'kunden.delete.msg':
    '{name} wirklich löschen? Der Kunde wird deaktiviert und aus der Liste entfernt. Bereits erfasste Aufträge und Rechnungen bleiben erhalten.',

  // ===========================================================================
  // FAHRZEUGE (Route "/fahrzeuge")
  // ===========================================================================
  'fahrzeuge.title': 'Fahrzeuge',
  'fahrzeuge.subtitle': 'Fahrzeugbestand mit Fahrzeugakte',
  'fahrzeuge.new': 'Neues Fahrzeug',
  'fahrzeuge.searchPlaceholder': 'Suche nach Kennzeichen, Marke, Modell oder Halter…',

  // ---- Leerzustand ---------------------------------------------------------
  'fahrzeuge.empty.none': 'Noch keine Fahrzeuge angelegt.',
  'fahrzeuge.empty.filtered': 'Keine Fahrzeuge gefunden.',
  'fahrzeuge.empty.cta': 'Erstes Fahrzeug anlegen',

  // ---- Tabellenspalten -----------------------------------------------------
  'fahrzeuge.col.fahrzeug': 'Fahrzeug',
  'fahrzeuge.col.kennzeichen': 'Kennzeichen',
  'fahrzeuge.col.halter': 'Halter',
  'fahrzeuge.col.baujahr': 'Baujahr',

  // ---- Aktionsmenü ---------------------------------------------------------
  'fahrzeuge.actionsFor': 'Aktionen für {name}',
  'fahrzeuge.action.open': 'Fahrzeugakte öffnen',
  'fahrzeuge.action.newOrder': 'Neuer Auftrag',

  // ---- Formular (Neues Fahrzeug) -------------------------------------------
  'fahrzeuge.form.halter': 'Halter',
  'fahrzeuge.form.selectPlaceholder': '– wählen –',
  'fahrzeuge.form.marke': 'Marke',
  'fahrzeuge.form.modell': 'Modell',
  'fahrzeuge.form.variante': 'Variante',
  'fahrzeuge.form.baujahr': 'Baujahr',
  'fahrzeuge.form.farbe': 'Farbe',
  'fahrzeuge.form.kennzeichen': 'Kennzeichen',
  'fahrzeuge.form.kraftstoff': 'Kraftstoff',
  'fahrzeuge.form.flaeche': 'Fläche (qm)',

  // ---- Kraftstoffarten -----------------------------------------------------
  'fahrzeuge.fuel.petrol': 'Benzin',
  'fahrzeuge.fuel.diesel': 'Diesel',
  'fahrzeuge.fuel.electric': 'Elektro',
  'fahrzeuge.fuel.hybrid': 'Hybrid',
  'fahrzeuge.saving': 'Speichern…',

  // ---- Toast / Fehler / Löschen-Bestätigung --------------------------------
  'fahrzeuge.toast.deleted': '{name} gelöscht',
  'fahrzeuge.error.delete': 'Löschen fehlgeschlagen',
  'fahrzeuge.error.save': 'Speichern fehlgeschlagen',
  'fahrzeuge.delete.title': 'Fahrzeug löschen',
  'fahrzeuge.delete.msg':
    '{name} wirklich löschen? Das Fahrzeug wird aus der Liste entfernt. Bereits erfasste Aufträge und Termine bleiben erhalten.',

  // ===========================================================================
  // BELEGE / RECHNUNGEN (Route "/rechnungen")
  // ===========================================================================
  'rechnungen.title': 'Belege',
  'rechnungen.subtitle': 'Angebote und Rechnungen',
  'rechnungen.searchPlaceholder': 'Suche nach Nummer oder Kunde…',
  'rechnungen.tab.alle': 'Alle',

  // ---- Leerzustände --------------------------------------------------------
  'rechnungen.empty.none': 'Noch keine Belege. Belege entstehen aus Aufträgen.',
  'rechnungen.empty.filtered': 'Keine Belege in dieser Ansicht.',

  // ---- Tabellenspalten -----------------------------------------------------
  'rechnungen.col.nummer': 'Nummer',
  'rechnungen.col.art': 'Art',
  'rechnungen.col.kunde': 'Kunde',
  'rechnungen.col.datum': 'Datum',
  'rechnungen.col.status': 'Status',
  'rechnungen.col.brutto': 'Brutto',

  // ---- Art / Status --------------------------------------------------------
  'rechnungen.kind.angebot': 'Angebot',
  'rechnungen.kind.rechnung': 'Rechnung',
  'rechnungen.status.entwurf': 'Entwurf',
  'rechnungen.status.offen': 'Offen',
  'rechnungen.status.bezahlt': 'Bezahlt',
  'rechnungen.status.storniert': 'Storniert',

  // ---- Fälligkeit / Versand-Badges -----------------------------------------
  'rechnungen.overdue': 'Überfällig seit {tage} Tagen',
  'rechnungen.dueIn': 'fällig in {tage} Tagen',
  'rechnungen.sent': 'Gesendet',
  'rechnungen.sentOn': 'Gesendet am {datum}',

  // ---- Mahnstufen ----------------------------------------------------------
  'rechnungen.mahn.stufe1': 'Zahlungserinnerung',
  'rechnungen.mahn.stufe2': '1. Mahnung',
  'rechnungen.mahn.stufe3': '2. Mahnung',
  'rechnungen.mahn.generic': 'Mahnstufe {stufe}',

  // ---- Zeilen-Aktionen -----------------------------------------------------
  'rechnungen.action.pdf': 'PDF herunterladen',
  'rechnungen.action.xrechnung': 'XRechnung (XML)',
  'rechnungen.action.send': 'Per E-Mail senden',
  'rechnungen.action.resend': 'Erneut per E-Mail senden',
  'rechnungen.action.markPaid': 'Als bezahlt markieren',
  'rechnungen.action.copyLink': 'Download-Link kopieren',
  'rechnungen.action.mahnen': 'Mahnen',
  'rechnungen.action.storno': 'Stornieren',
  'rechnungen.action.setStatus': 'Auf „{status}“ setzen',
  'rechnungen.actionsFor': 'Aktionen für {nummer}',
  'rechnungen.linkPrompt': 'Download-Link kopieren:',

  // ---- Storno-Bestätigung --------------------------------------------------
  'rechnungen.storno.title': 'Beleg stornieren',
  'rechnungen.storno.msg':
    'Beleg {nummer} wirklich stornieren? Ein stornierter Beleg kann nicht wieder aktiviert werden.',
  'rechnungen.storno.msgPaid':
    'Die bezahlte Rechnung {nummer} wirklich stornieren? Das Storno kann nicht rückgängig gemacht werden – eine Gutschrift bzw. Erstattung ist ggf. separat zu klären.',

  // ---- Toast-Meldungen -----------------------------------------------------
  'rechnungen.toast.statusUpdated': 'Status aktualisiert',
  'rechnungen.toast.storniert': 'Beleg storniert',
  'rechnungen.toast.paid': 'Als bezahlt markiert',
  'rechnungen.toast.sent': 'Beleg per E-Mail versendet',
  'rechnungen.toast.linkCopied': 'Download-Link kopiert',
  'rechnungen.toast.mahnSent': 'Mahnung versendet',

  // ---- Fehlermeldungen -----------------------------------------------------
  'rechnungen.error.statusChange': 'Statuswechsel fehlgeschlagen',
  'rechnungen.error.pdf': 'PDF konnte nicht geladen werden',
  'rechnungen.error.xrechnung': 'XRechnung konnte nicht erstellt werden',
  'rechnungen.error.paid': 'Konnte nicht als bezahlt markiert werden',
  'rechnungen.error.send': 'E-Mail-Versand fehlgeschlagen',
  'rechnungen.error.link': 'Link konnte nicht erstellt werden',
  'rechnungen.error.mahn': 'Mahnung fehlgeschlagen',

  // ===========================================================================
  // AUFTRÄGE (Route "/auftraege")
  // ===========================================================================
  'auftraege.title': 'Aufträge',
  'auftraege.subtitle': 'Zentrale Einheit mit Status-Workflow und Kalkulation',
  'auftraege.new': 'Neuer Auftrag',
  'auftraege.searchPlaceholder': 'Suche nach Nummer oder Kunde…',
  'auftraege.tab.alle': 'Alle',

  // ---- Leerzustände --------------------------------------------------------
  'auftraege.empty.none': 'Noch keine Aufträge angelegt.',
  'auftraege.empty.filtered': 'Keine Aufträge in dieser Ansicht.',
  'auftraege.empty.cta': 'Ersten Auftrag anlegen',

  // ---- Tabellenspalten -----------------------------------------------------
  'auftraege.col.nummer': 'Nummer',
  'auftraege.col.kunde': 'Kunde',
  'auftraege.col.leistung': 'Leistung',
  'auftraege.col.status': 'Status',
  'auftraege.col.gesamt': 'Gesamt',

  // ---- Zeilen-Aktionen -----------------------------------------------------
  'auftraege.actionsFor': 'Aktionen für Auftrag {nummer}',
  'auftraege.action.open': 'Öffnen',

  // ---- Status --------------------------------------------------------------
  'auftraege.status.angefragt': 'Angefragt',
  'auftraege.status.kalkuliert': 'Kalkuliert',
  'auftraege.status.bestaetigt': 'Bestätigt',
  'auftraege.status.in_arbeit': 'In Arbeit',
  'auftraege.status.qualitaetskontrolle': 'Qualitätskontrolle',
  'auftraege.status.fertig': 'Fertig',
  'auftraege.status.abgerechnet': 'Abgerechnet',
  'auftraege.status.storniert': 'Storniert',

  // ---- Leistungsart --------------------------------------------------------
  'auftraege.service.aufbereitung': 'Aufbereitung',
  'auftraege.service.folierung': 'Folierung',
  'auftraege.service.ppf': 'PPF',
  'auftraege.service.sonstiges': 'Sonstiges',

  // ---- Formular (Neuer Auftrag) --------------------------------------------
  'auftraege.form.kunde': 'Kunde',
  'auftraege.form.selectPlaceholder': '– wählen –',
  'auftraege.form.fahrzeug': 'Fahrzeug',
  'auftraege.form.optionalPlaceholder': '– optional –',
  'auftraege.form.leistungsart': 'Leistungsart',
  'auftraege.form.materialkosten': 'Materialkosten (netto)',
  'auftraege.form.positionen': 'Positionen',
  'auftraege.form.addPosition': '+ Position',
  'auftraege.form.beschreibung': 'Beschreibung',
  'auftraege.form.fromService': 'aus Leistung übernehmen…',
  'auftraege.form.menge': 'Menge',
  'auftraege.form.einzelpreis': 'Einzelpreis',
  'auftraege.form.netto': 'Netto',
  'auftraege.form.mwst': 'MwSt (19%)',
  'auftraege.saving': 'Speichern…',
  'auftraege.submit': 'Auftrag anlegen',

  // ---- Toast / Fehler ------------------------------------------------------
  'auftraege.toast.deleted': 'Auftrag {nummer} gelöscht',
  'auftraege.error.delete': 'Löschen fehlgeschlagen',
  'auftraege.error.save': 'Speichern fehlgeschlagen',

  // ---- Löschen-Bestätigung -------------------------------------------------
  'auftraege.delete.title': 'Auftrag löschen',
  'auftraege.delete.msg':
    'Auftrag {nummer} wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.',

  // ===========================================================================
  // KALKULATION (Route "/kalkulation")
  // ===========================================================================
  'kalkulation.title': 'Kalkulation',
  'kalkulation.subtitle':
    'Bauteile bzw. Leistungen anklicken – der Preis rechnet sich live. Jede Position bleibt anpassbar.',
  'kalkulation.diagram.aria': 'Fahrzeug-Draufsicht: Bauteile anklicken',

  // ---- Katalog-Hinweis (fixer Betriebstyp) ---------------------------------
  'kalkulation.katalog.prefix': 'Katalog:',
  'kalkulation.katalog.suffix':
    '– weitere Kataloge über Einstellungen → Betriebstyp „Komplett-Anbieter“.',

  // ---- Rahmenparameter -----------------------------------------------------
  'kalkulation.section.fahrzeugMaterial': 'Fahrzeug & Material',
  'kalkulation.field.groesse': 'Fahrzeuggröße',
  'kalkulation.field.schnellauswahl': 'Schnellauswahl',
  'kalkulation.clearSelection': 'Auswahl leeren',
  'kalkulation.section.auswahlSubtitle': 'Anklicken zum Hinzufügen – im Diagramm oder in der Liste.',

  // ---- Keramik-Option ------------------------------------------------------
  'kalkulation.keramik.add': 'Keramik-Versiegelung hinzufügen',
  'kalkulation.keramik.basis': 'Basispreis (inkl. 1 Schicht)',
  'kalkulation.keramik.weitereSchichten': 'Weitere Schichten',
  'kalkulation.keramik.none': 'keine',
  'kalkulation.keramik.proSchicht': 'Preis je weitere Schicht',
  'kalkulation.keramik.layerSingular': 'Schicht',
  'kalkulation.keramik.layerPlural': 'Schichten',

  // ---- Live-Summe ----------------------------------------------------------
  'kalkulation.positionCount': '{count} Position(en)',
  'kalkulation.empty': 'Noch nichts gewählt – Bauteile im Diagramm oder in der Liste anklicken.',
  'kalkulation.priceAria': 'Preis für {label}',
  'kalkulation.netto': 'Netto',
  'kalkulation.mwst': 'MwSt (19 %)',
  'kalkulation.gesamt': 'Gesamt',
  'kalkulation.copyButton': 'Zusammenfassung kopieren',
  'kalkulation.hint.base':
    'Richtwerte auf Basis von Fahrzeuggröße{material} – jede Position kann direkt überschrieben werden.',
  'kalkulation.hint.materialSuffix': ' und Materialstufe',
  'kalkulation.toast.copied': 'Zusammenfassung kopiert',
  'kalkulation.summaryHeadline': 'Kalkulation {titel} – {rahmen}',

  // ===========================================================================
  // BUCHHALTUNG (Route "/buchhaltung")
  // ===========================================================================
  'buchhaltung.title': 'Buchhaltung',
  'buchhaltung.subtitle':
    'Daten für den Steuerberater exportieren – Rechnungen (CSV/DATEV) und Arbeitszeiten fürs Lohnbüro.',

  // ---- Zeitraum ------------------------------------------------------------
  'buchhaltung.zeitraum.title': 'Zeitraum',
  'buchhaltung.zeitraum.subtitle': 'Gilt für beide Exporte (Rechnungen und Arbeitszeiten).',
  'buchhaltung.von': 'Von',
  'buchhaltung.bis': 'Bis',
  'buchhaltung.zeitraum.help':
    'Rechnungen: gestellte (offen & bezahlt) im Zeitraum · Arbeitszeiten: alle Buchungen im Zeitraum.',

  // ---- Format --------------------------------------------------------------
  'buchhaltung.format.title': 'Format',
  'buchhaltung.format.subtitle': 'Universelles CSV oder DATEV-Buchungsstapel.',
  'buchhaltung.format.csv.title': 'CSV (universell)',
  'buchhaltung.format.csv.desc':
    'Semikolon-getrennt, für jeden Steuerberater – auch ohne DATEV. Belegnummer, Datum, Beträge, MwSt, Status.',
  'buchhaltung.format.datev.title': 'DATEV-Buchungsstapel',
  'buchhaltung.format.datev.desc':
    'EXTF-Format zum direkten Import in DATEV. Benötigt Berater-/Mandantennummer (Einstellungen).',

  // ---- Export --------------------------------------------------------------
  'buchhaltung.export': 'Exportieren',
  'buchhaltung.exporting': 'Exportiere…',
  'buchhaltung.datevStammdaten': 'DATEV-Stammdaten pflegen →',
  'buchhaltung.datevHinweis':
    'Hinweis: Der DATEV-Export folgt der gängigen EXTF-Spezifikation. Bitte vor dem ersten echten Import einmal mit dem Steuerberater bzw. dem kostenlosen DATEV-Prüfprogramm gegenprüfen.',

  // ---- Arbeitszeiten -------------------------------------------------------
  'buchhaltung.zeiten.title': 'Arbeitszeiten fürs Lohnbüro',
  'buchhaltung.zeiten.subtitle':
    'Erfasste Auftragszeiten je Mitarbeiter im Zeitraum (mit Lohnkosten) als CSV – für die Lohnabrechnung.',
  'buchhaltung.zeiten.export': 'Arbeitszeiten exportieren',
  'buchhaltung.zeiten.help':
    'Detailzeilen je Buchung + Summe je Mitarbeiter. Lohnkosten basieren auf dem aktuell hinterlegten Stundenlohn. Enthält Gehaltsdaten – nur für die Leitung.',

  // ---- Toast / Fehler ------------------------------------------------------
  'buchhaltung.toast.exportStarted': 'Export gestartet',
  'buchhaltung.error.export': 'Export fehlgeschlagen',

  // ===========================================================================
  // MAHNUNGEN (Route "/mahnungen")
  // ===========================================================================
  'mahnungen.title': 'Mahnungen',
  'mahnungen.subtitle': 'Überfällige Rechnungen im Blick behalten und anmahnen',
  'mahnungen.alleMahnen': 'Alle mahnen',
  'mahnungen.mahnt': 'Mahnt …',
  'mahnungen.empty': 'Keine überfälligen Rechnungen. Alle offenen Rechnungen sind innerhalb der Frist.',

  // ---- Mahnstufe (nächste zu versendende Stufe) ----------------------------
  'mahnungen.stufe.0': 'noch nicht gemahnt',
  'mahnungen.stufe.1': 'Zahlungserinnerung',
  'mahnungen.stufe.2': '1. Mahnung',
  'mahnungen.stufe.3': '2. Mahnung',

  // ---- Kennzahlen ----------------------------------------------------------
  'mahnungen.stat.ueberfaellig': 'Überfällige Rechnungen',
  'mahnungen.stat.offenerBetrag': 'Offener Betrag',
  'mahnungen.stat.summeBrutto': 'Summe brutto',
  'mahnungen.notYetReminded': 'Noch nicht gemahnt',
  'mahnungen.stat.ohneMahnungHintOne': 'Rechnung ohne Mahnung',
  'mahnungen.stat.ohneMahnungHintMany': 'Rechnungen ohne Mahnung',

  // ---- Tabelle -------------------------------------------------------------
  'mahnungen.col.nummer': 'Nummer',
  'mahnungen.col.kunde': 'Kunde',
  'mahnungen.col.faelligSeit': 'Fällig seit',
  'mahnungen.col.mahnstufe': 'Mahnstufe',
  'mahnungen.col.brutto': 'Brutto',
  'mahnungen.tag': 'Tag',
  'mahnungen.tage': 'Tage',
  'mahnungen.faelligAm': 'fällig {datum}',
  'mahnungen.erneutMahnen': 'Erneut mahnen',
  'mahnungen.jetztMahnen': 'Jetzt mahnen',

  // ---- Bestätigungen -------------------------------------------------------
  'mahnungen.confirmOne.title': 'Rechnung mahnen',
  'mahnungen.confirmOne.confirm': 'Mahnung senden',
  'mahnungen.confirmOne.msg':
    'Rechnung {nummer} an {kunde} mahnen? Der Kunde erhält eine {stufe} per E-Mail, die Mahnstufe wird erhöht.',
  'mahnungen.confirmBulk.msg':
    'Alle {count} überfälligen Rechnungen jetzt mahnen? An jeden betroffenen Kunden wird eine Mahnung per E-Mail versendet und die Mahnstufe erhöht.',

  // ---- Toast / Fehler ------------------------------------------------------
  'mahnungen.error.load': 'Mahnliste konnte nicht geladen werden',
  'mahnungen.error.mahn': 'Mahnung fehlgeschlagen',
  'mahnungen.toast.sentOne': 'Mahnung an {kunde} versendet.',
  'mahnungen.toast.sentBulkOne': '{count} Mahnung versendet.',
  'mahnungen.toast.sentBulkMany': '{count} Mahnungen versendet.',
  'mahnungen.error.bulkOne': '{count} Mahnung konnte nicht versendet werden.',
  'mahnungen.error.bulkMany': '{count} Mahnungen konnten nicht versendet werden.',

  // ===========================================================================
  // FAHRZEUGANNAHME (Route "/fahrzeugannahme")
  // ===========================================================================
  'fahrzeugannahme.title': 'Fahrzeugannahme',
  'fahrzeugannahme.subtitle': 'Zustand dokumentieren und Schäden im Diagramm erfassen',
  'fahrzeugannahme.save': 'Annahme speichern',

  // ---- Querverweis 3D-Schadenserfassung ------------------------------------
  'fahrzeugannahme.crosslink.title': 'Fotos, Unterschrift & Vorschaden-Übernahme?',
  'fahrzeugannahme.crosslink.subtitle': 'Zur interaktiven 3D-Schadenserfassung wechseln.',

  // ---- Annahme-Formular ----------------------------------------------------
  'fahrzeugannahme.card.annahme': 'Annahme',
  'fahrzeugannahme.label.kunde': 'Kunde',
  'fahrzeugannahme.label.fahrzeug': 'Fahrzeug',
  'fahrzeugannahme.select.placeholder': '– auswählen –',
  'fahrzeugannahme.label.km': 'km-Stand',
  'fahrzeugannahme.km.placeholder': 'z.B. 84500',
  'fahrzeugannahme.label.tankstand': 'Tankstand: {wert} %',
  'fahrzeugannahme.label.notiz': 'Allgemeine Notiz',
  'fahrzeugannahme.notiz.placeholder': 'Auffälligkeiten, Vereinbarungen …',

  // ---- Schadensdiagramm ----------------------------------------------------
  'fahrzeugannahme.card.diagramm.title': 'Schadensdiagramm',
  'fahrzeugannahme.card.diagramm.subtitle': 'In die Silhouette klicken, um einen Schaden zu markieren',
  'fahrzeugannahme.erfassteSchaeden': 'Erfasste Schäden ({count})',
  'fahrzeugannahme.empty.schaeden': 'Noch keine Schäden markiert. In das Diagramm klicken.',
  'fahrzeugannahme.action.bearbeiten': 'Bearbeiten',
  'fahrzeugannahme.action.entfernen': 'Entfernen',

  // ---- Letzte Annahmen -----------------------------------------------------
  'fahrzeugannahme.card.letzteAnnahmen.title': 'Letzte Annahmen',
  'fahrzeugannahme.card.letzteAnnahmen.subtitle': 'Zuletzt gespeicherte Fahrzeugannahmen – zum Öffnen antippen',
  'fahrzeugannahme.empty.annahmen': 'Noch keine Annahmen.',

  // ---- Marker-Editor -------------------------------------------------------
  'fahrzeugannahme.modal.title': 'Schaden bearbeiten',
  'fahrzeugannahme.modal.schadensart': 'Schadensart',
  'fahrzeugannahme.modal.schweregrad': 'Schweregrad',
  'fahrzeugannahme.modal.notiz': 'Notiz',
  'fahrzeugannahme.modal.notiz.placeholder': 'Beschreibung des Schadens …',
  'fahrzeugannahme.modal.entfernen': 'Schaden entfernen',
  'fahrzeugannahme.modal.fertig': 'Fertig',

  // ---- Schadensart (Enum) --------------------------------------------------
  'fahrzeugannahme.art.kratzer': 'Kratzer',
  'fahrzeugannahme.art.delle': 'Delle',
  'fahrzeugannahme.art.steinschlag': 'Steinschlag',
  'fahrzeugannahme.art.lackschaden': 'Lackschaden',
  'fahrzeugannahme.art.rost': 'Rost',
  'fahrzeugannahme.art.sonstiges': 'Sonstiges',

  // ---- Schweregrad (Enum) --------------------------------------------------
  'fahrzeugannahme.grad.leicht': 'Leicht',
  'fahrzeugannahme.grad.mittel': 'Mittel',
  'fahrzeugannahme.grad.schwer': 'Schwer',

  // ---- Inspektions-Status (Enum) -------------------------------------------
  'fahrzeugannahme.status.entwurf': 'Entwurf',
  'fahrzeugannahme.status.abgeschlossen': 'Abgeschlossen',
  'fahrzeugannahme.status.freigegeben': 'Freigegeben',

  // ---- Toast / Fehler ------------------------------------------------------
  'fahrzeugannahme.error.kundePflicht': 'Bitte einen Kunden auswählen.',
  'fahrzeugannahme.error.anlegen': 'Annahme konnte nicht angelegt werden.',
  'fahrzeugannahme.toast.gespeichert': 'Annahme gespeichert.',

  // ===========================================================================
  // LEISTUNGEN (Route "/leistungen")
  // ===========================================================================
  'leistungen.title': 'Leistungen & Pakete',
  'leistungen.subtitle': 'Katalog für die Auftragskalkulation',
  'leistungen.new': 'Neue Leistung',
  'leistungen.showInactive': 'Inaktive Leistungen anzeigen',

  // ---- Leerzustände --------------------------------------------------------
  'leistungen.empty.inactive': 'Keine Leistungen vorhanden.',
  'leistungen.empty.none': 'Noch keine Leistungen im Katalog.',
  'leistungen.empty.action': 'Erste Leistung anlegen',

  // ---- Tabelle -------------------------------------------------------------
  'leistungen.col.name': 'Name',
  'leistungen.col.kategorie': 'Kategorie',
  'leistungen.col.einheit': 'Einheit',
  'leistungen.col.basispreis': 'Basispreis',
  'leistungen.inaktiv': 'Inaktiv',

  // ---- Aktionsmenü ---------------------------------------------------------
  'leistungen.actionsFor': 'Aktionen für {name}',
  'leistungen.action.bearbeiten': 'Bearbeiten',
  'leistungen.action.reaktivieren': 'Reaktivieren',
  'leistungen.action.archivieren': 'Archivieren',

  // ---- Formular ------------------------------------------------------------
  'leistungen.modal.editTitle': 'Leistung bearbeiten',
  'leistungen.modal.newTitle': 'Neue Leistung',
  'leistungen.field.name': 'Name',
  'leistungen.field.beschreibung': 'Beschreibung',
  'leistungen.field.kategorie': 'Kategorie',
  'leistungen.field.einheit': 'Einheit',
  'leistungen.field.basispreis': 'Basispreis',
  'leistungen.saving': 'Speichern…',

  // ---- Kategorie (Enum) ----------------------------------------------------
  'leistungen.kat.aufbereitung': 'Aufbereitung',
  'leistungen.kat.folierung': 'Folierung',
  'leistungen.kat.ppf': 'PPF',
  'leistungen.kat.sonstiges': 'Sonstiges',

  // ---- Einheit (Enum) ------------------------------------------------------
  'leistungen.einheit.pauschal': 'Pauschal',
  'leistungen.einheit.qm': 'pro qm',
  'leistungen.einheit.stunde': 'pro Stunde',

  // ---- Fehler --------------------------------------------------------------
  'leistungen.error.aktion': 'Aktion fehlgeschlagen',
  'leistungen.error.save': 'Speichern fehlgeschlagen',

  // ===========================================================================
  // ABO & TARIF (Route "/abo")
  // ===========================================================================
  'abo.title': 'Abo & Tarif',
  'abo.subtitle': 'Tarif wählen, buchen und verwalten',

  // ---- Toast / Fehler ------------------------------------------------------
  'abo.toast.success': 'Vielen Dank! Dein Abo wird aktiviert.',
  'abo.toast.cancel': 'Vorgang abgebrochen – es wurde nichts berechnet.',
  'abo.error.load': 'Laden fehlgeschlagen',
  'abo.error.checkout': 'Checkout fehlgeschlagen',
  'abo.error.portal': 'Portal konnte nicht geöffnet werden',

  // ---- Aktueller Stand -----------------------------------------------------
  'abo.card.title': 'Dein Abo',
  'abo.card.subtitle': 'Aktueller Status deines Betriebs',
  'abo.planFallback.trial': 'Testphase',
  'abo.planFallback.none': 'Kein Tarif',
  'abo.noAbo': 'Kein Abo hinterlegt',
  'abo.remainingDayOne': 'noch {count} Tag',
  'abo.remainingDayMany': 'noch {count} Tage',
  'abo.periodUntil': 'Laufzeit bis {datum}',
  'abo.portalOpening': 'Öffne…',
  'abo.manage': 'Abo verwalten',
  'abo.ownerOnly': 'Nur der Betriebsinhaber kann das Abo buchen oder ändern.',

  // ---- Zahlweise-Umschalter ------------------------------------------------
  'abo.interval.month': 'Monatlich',
  'abo.interval.year': 'Jährlich',
  'abo.interval.yearBonus': '2 Monate gratis',

  // ---- Tarif-Karten --------------------------------------------------------
  'abo.current': 'Aktuell',
  'abo.perYear': '/ Jahr',
  'abo.equivMonth': 'entspricht {preis} / Monat',
  'abo.perMonth': '/ Monat',
  'abo.currentPlanBtn': 'Aktueller Tarif',
  'abo.toStripe': 'Weiter zu Stripe…',
  'abo.soon': 'Bald verfügbar',
  'abo.switch': 'Wechseln',
  'abo.book': 'Jetzt buchen',
  'abo.notBookableTitle': 'Diese Zahlweise ist für diesen Tarif noch nicht buchbar.',
  'abo.stripeNote':
    'Die Bezahlung läuft sicher über Stripe. Du wirst zur Stripe-Bezahlseite weitergeleitet; Detailly speichert keine Kartendaten. Kündigung und Zahlungsmittel verwaltest du jederzeit über „Abo verwalten".',

  // ---- Module (Feature-Codes → Beschriftung) -------------------------------
  'abo.modul.kunden': 'Kunden',
  'abo.modul.fahrzeuge': 'Fahrzeuge',
  'abo.modul.auftraege': 'Aufträge',
  'abo.modul.termine': 'Termine',
  'abo.modul.rechnungen': 'Rechnungen',
  'abo.modul.shop': 'Shop & Lager',
  'abo.modul.mitarbeiter': 'Mitarbeiter',
  'abo.modul.standorte': 'Standorte',
  'abo.modul.audit': 'Audit-Log',
  'abo.modul.inspektion': '3D-Schadenserfassung',
  'abo.modul.auswertungen': 'Auswertungen',
  'abo.modul.mahnwesen': 'Mahnwesen',
  'abo.modul.export': 'Buchhaltungs-Export',
  'abo.modul.wirtschaftlichkeit': 'Wirtschaftlichkeit',
  'abo.modul.zeiterfassung': 'Zeiterfassung',

  // ---- Zugriffsstufe (Enum) ------------------------------------------------
  'abo.access.full': 'Voller Zugriff',
  'abo.access.warn': 'Zugriff mit Hinweis',
  'abo.access.blocked': 'Gesperrt',

  // ---- Abo-Status (Enum) ---------------------------------------------------
  'abo.status.trial': 'Testphase',
  'abo.status.active': 'Aktiv',
  'abo.status.past_due': 'Zahlung offen',
  'abo.status.canceled': 'Gekündigt',
  'abo.status.suspended': 'Gesperrt',
} satisfies Record<string, string>;

export type Dict = typeof de;
