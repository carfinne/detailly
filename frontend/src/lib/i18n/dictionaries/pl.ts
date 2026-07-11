// ===========================================================================
// PL – WÖRTERBUCH (Partial<Dict>) · Vollparität mit DE
// ---------------------------------------------------------------------------
// Enthält ALLE Keys aus de.ts, muttersprachlich (PL) übersetzt. Bleibt technisch
// `Partial<Dict>`: sollte de.ts künftig neue Keys bekommen, fallen nur DIESE
// automatisch auf DE zurück (siehe ../provider, t() → de[key]) – nie ein leerer
// String oder der rohe Key.
//
// Platzhalter wie {year}/{label} bleiben unverändert (werden zur Laufzeit ersetzt).
// ===========================================================================

import type { Dict } from './de';

export const pl: Partial<Dict> = {
  // ---- Common --------------------------------------------------------------
  'common.save': 'Zapisz',
  'common.cancel': 'Anuluj',
  'common.confirm': 'Potwierdź',
  'common.delete': 'Usuń',
  'common.close': 'Zamknij',
  'common.back': 'Wstecz',
  'common.loading': 'Ładowanie',
  'common.loadingEllipsis': 'Ładowanie…',
  'common.error': 'Błąd',
  'common.toStart': 'Na stronę główną',

  // ---- Switcher ------------------------------------------------------------
  'switcher.label': 'Wybierz język',
  'switcher.current': 'Bieżący język',

  // ---- Navigation: groups --------------------------------------------------
  'nav.group.overview': 'Przegląd',
  'nav.group.operations': 'Praca',
  'nav.group.masterdata': 'Dane podstawowe',
  'nav.group.finance': 'Finanse',
  'nav.group.organization': 'Organizacja',
  'nav.group.platform': 'Platforma',

  // ---- Navigation: items ---------------------------------------------------
  'nav.item.dashboard': 'Pulpit',
  'nav.item.orders': 'Zlecenia',
  'nav.item.calculation': 'Wycena',
  'nav.item.intakeQuick': 'Przyjęcie (szybkie)',
  'nav.item.intake3d': 'Przyjęcie i ocena (3D)',
  'nav.item.planboard': 'Tablica planowania',
  'nav.item.requests': 'Zapytania',
  'nav.item.customers': 'Klienci',
  'nav.item.vehicles': 'Pojazdy',
  'nav.item.services': 'Usługi',
  'nav.item.invoices': 'Faktury',
  'nav.item.reminders': 'Ponaglenia',
  'nav.item.reports': 'Analizy',
  'nav.item.accounting': 'Księgowość',
  'nav.item.shop': 'Sklep i magazyn',
  'nav.item.marketplace': 'Marketplace',
  'nav.item.locations': 'Lokalizacje',
  'nav.item.staff': 'Pracownicy',
  'nav.item.time': 'Ewidencja czasu',
  'nav.item.audit': 'Dziennik audytu',
  'nav.item.settings': 'Ustawienia',
  'nav.item.help': 'Pomoc i wsparcie',
  'nav.item.assistant': 'Asystent wsparcia',
  'nav.item.subscription': 'Subskrypcja i taryfa',
  'nav.item.platformAnalytics': 'Analityka platformy',
  'nav.item.platformMarketplace': 'Zarządzanie marketplace',
  'nav.item.platformSupport': 'Zgłoszenia wsparcia',
  'nav.item.subscriptions': 'Subskrypcje',

  // ---- Login ---------------------------------------------------------------
  'login.subtitle': 'Detailing Suite — detailing, oklejanie i PPF',
  'login.email': 'E-mail',
  'login.password': 'Hasło',
  'login.forgot': 'Nie pamiętasz hasła?',
  'login.showPassword': 'Pokaż hasło',
  'login.hidePassword': 'Ukryj hasło',
  'login.submit': 'Zaloguj się',
  'login.submitting': 'Logowanie…',
  'login.failed': 'Logowanie nie powiodło się',
  'login.noAccount': 'Nie masz jeszcze konta?',
  'login.registerCta': 'Zarejestruj firmę',
  'login.footer': '© {year} Detailly · Niezależne oprogramowanie do detailingu',

  // ---- Landing: header -----------------------------------------------------
  'landing.nav.branchen': 'Branże',
  'landing.nav.ablauf': 'Jak to działa',
  'landing.nav.funktionen': 'Funkcje',
  'landing.nav.faq': 'FAQ',
  'landing.nav.login': 'Zaloguj się',
  'landing.nav.trial': 'Wypróbuj za darmo',

  // ---- Landing: hero + CTAs ------------------------------------------------
  'landing.hero.badge': 'Oprogramowanie dla warsztatów: detailing, oklejanie i PPF',
  'landing.hero.title1': 'Twoje rzemiosło to precyzja.',
  'landing.hero.title2': 'Teraz Twoje oprogramowanie też.',
  'landing.hero.sub':
    'Detailly łączy klientów, pojazdy, zlecenia, tablicę planowania, rejestrację uszkodzeń 3D i zgodne z prawem faktury w jednym programie — zgodnie z RODO, na każdym urządzeniu. Koniec z papierowym chaosem.',
  'landing.hero.ctaPrimary': 'Wypróbuj 14 dni za darmo',
  'landing.hero.ctaSecondary': 'Zobacz funkcje',
  'landing.hero.trailer': 'Bez karty · Gotowe w minuty · Anulowanie co miesiąc',

  // ---- Landing: weitere CTAs -----------------------------------------------
  'landing.branchen.cta': 'Zacznij jako {label}',
  'landing.branchen.completeCta': 'Zacznij jako usługodawca kompleksowy',
  'landing.cta.primary': 'Zacznij za darmo',
  'landing.cta.secondary': 'Mam już konto',
  'landing.footer.trial': 'Wypróbuj za darmo',
  'landing.footer.login': 'Zaloguj się',
  'landing.footer.register': 'Rejestracja',

  // =========================================================================
  // Vollparität-Ergänzung: alle übrigen DE-Keys, muttersprachlich (PL).
  // =========================================================================

  // ---- Common (weitere) ----------------------------------------------------
  'common.toSubscription': 'Do subskrypcji i taryfy',

  // ---- Einstellungen: Kalkulation (€/qm) -----------------------------------
  'settings.kalk.title': 'Wycena · €/m²',
  'settings.kalk.subtitle':
    'Stawki bazowe do błyskawicznej wyceny 3D. W wycenie każdą wartość można nadpisać.',
  'settings.kalk.grouplabel': 'Cena za metr kwadratowy (netto)',
  'settings.kalk.folierung': 'Oklejanie folią',
  'settings.kalk.ppf': 'PPF / ochrona lakieru',
  'settings.kalk.aufbereitung': 'Detailing',
  'settings.kalk.help':
    'Te stawki są domyślne w module 3D (powierzchnia × rozmiar pojazdu × €/m²). Puste lub 0 = wewnętrzna wartość domyślna.',

  // ---- Tarif-Hinweise (Feature-Gating) -------------------------------------
  'settings.sevdesk.upgrade': 'Automatyczne przekazanie do sevDesk jest dostępne od taryfy Basic.',
  'ordertime.upgrade': 'Czasy zleceń i koszty pracy są zawarte w taryfie Pro.',

  // ---- Landing: Vertrauens-Leiste ------------------------------------------
  'landing.trust.dsgvo': 'Zgodność z RODO',
  'landing.trust.gobd': 'Faktury zgodne z GoBD',
  'landing.trust.madeInGermany': 'Stworzone w Niemczech',
  'landing.trust.encrypted': 'Dane zaszyfrowane',
  'landing.trust.noInstall': 'Bez instalacji',

  // ---- Landing: Problem ----------------------------------------------------
  'landing.problem.kicker': 'Znasz to?',
  'landing.problem.title': 'Firma działa — a administracja hamuje.',
  'landing.problem.sub':
    'Podczas gdy praca przy pojeździe wymaga precyzji, wszystko wokół tonie w papierach.',
  'landing.problem.p1': 'Historia pojazdu jest rozproszona po segregatorach, karteczkach i w głowie.',
  'landing.problem.p2': 'Faktury zalegają — i kosztują Cię realne pieniądze.',
  'landing.problem.p3': 'Uszkodzeń z przyjęcia później prawie nie da się udowodnić.',
  'landing.problem.p4': 'Pięć różnych narzędzi, które ze sobą nie rozmawiają.',
  'landing.problem.summaryPre': 'Detailly łączy to wszystko w ',
  'landing.problem.summaryEm': 'jeden',
  'landing.problem.summaryPost': ' system — przejrzyście, szybko, na każdym urządzeniu.',

  // ---- Landing: Branchen-Switcher ------------------------------------------
  'landing.branchen.kicker': 'Stworzone dla Twojego fachu',
  'landing.branchen.title': 'Oprogramowanie, które mówi językiem Twojego fachu',
  'landing.branchen.sub':
    'Na starcie wybierasz swoją specjalizację — Detailly dopasowuje do niej katalog usług, wycenę, a nawet wygląd. Wypróbuj: wybierz swój fach i zobacz, jak strona zmienia kolory.',
  'landing.branchen.selected': 'Wybrano',
  'landing.branchen.complete': 'Wszystko z jednej ręki?',
  'landing.branchen.aufbereitung.l1': 'Detailing wnętrza i karoserii',
  'landing.branchen.aufbereitung.l2': 'Polerowanie i powłoki ceramiczne',
  'landing.branchen.aufbereitung.l3': 'Kontrole przy zwrocie z leasingu',
  'landing.branchen.folierung.l1': 'Oklejanie pełne i częściowe',
  'landing.branchen.folierung.l2': 'Zmiana koloru i design',
  'landing.branchen.folierung.l3': 'Oznakowanie reklamowe',
  'landing.branchen.ppf.l1': 'Ochrona przodu i całego pojazdu',
  'landing.branchen.ppf.l2': 'Pakiety ochrony przed odpryskami',
  'landing.branchen.ppf.l3': 'Precyzyjne wykroje',

  // ---- Landing: So funktioniert's ------------------------------------------
  'landing.ablauf.kicker': 'To takie proste',
  'landing.ablauf.title': 'W trzech krokach do uporządkowanego procesu',
  'landing.ablauf.step1.title': 'Przyjęcie',
  'landing.ablauf.step1.desc':
    'Klient, pojazd i uszkodzenia w kilka minut — z oznaczeniem 3D, zdjęciami i podpisem cyfrowym.',
  'landing.ablauf.step2.title': 'Realizacja',
  'landing.ablauf.step2.desc':
    'Wyceniaj usługi, planuj terminy na tablicy planowania i miej postęp cały czas pod kontrolą.',
  'landing.ablauf.step3.title': 'Rozliczenie',
  'landing.ablauf.step3.desc':
    'Ze zlecenia jednym kliknięciem powstaje faktura PDF zgodna z GoBD — wraz z terminami płatności i ponagleniami.',

  // ---- Landing: Funktionen -------------------------------------------------
  'landing.funktionen.kicker': 'Wszystkie narzędzia',
  'landing.funktionen.title': 'Wszystko, czego potrzebuje Twoja firma',
  'landing.funktionen.sub':
    'Spójny proces — od przyjęcia pojazdu po opłaconą fakturę.',
  'landing.funktionen.kunden.title': 'Klienci i pojazdy',
  'landing.funktionen.kunden.desc':
    'Dane podstawowe, kartoteka pojazdu i pełna historia każdego auta — od razu pod ręką.',
  'landing.funktionen.auftraege.title': 'Zlecenia i tablica planowania',
  'landing.funktionen.auftraege.desc':
    'Od oferty po odbiór. Planowanie tygodnia z terminami — wszystko na widoku.',
  'landing.funktionen.rechnungen.title': 'Faktury i dokumenty',
  'landing.funktionen.rechnungen.desc':
    'Faktury i oferty w PDF zgodne z §14 i GoBD, wraz z terminami płatności i ponagleniami.',
  'landing.funktionen.schaden3d.title': 'Rejestracja uszkodzeń 3D',
  'landing.funktionen.schaden3d.desc':
    'Oznaczaj uszkodzenia bezpośrednio na modelu 3D, dokumentuj je zdjęciami i zbieraj podpis cyfrowy.',
  'landing.funktionen.kalkulation.title': 'Wycena dla każdego fachu',
  'landing.funktionen.kalkulation.desc':
    'Katalogi usług i logika cen dla detailingu, oklejania i PPF — dopasowane do Twojej specjalizacji.',
  'landing.funktionen.dsgvo.title': 'RODO i bezpieczeństwo',
  'landing.funktionen.dsgvo.desc':
    'Dane wrażliwe zaszyfrowane, ściśle oddzielone dla każdej firmy, z eksportem i usuwaniem jednym kliknięciem.',
  'landing.funktionen.footnotePre': 'A do tego: błyskawiczne wyszukiwanie globalne (',
  'landing.funktionen.footnotePost': '), nawigacja mobilna i wielu pracowników w jednej firmie.',

  // ---- Landing: 3D-Schadenserfassung (Showcase) ----------------------------
  'landing.schaden.kicker': 'Wyróżnik',
  'landing.schaden.title': 'Zarejestruj uszkodzenia, zanim staną się sporem',
  'landing.schaden.desc':
    'Podczas przyjęcia zaznaczasz rysy, wgniecenia i odpryski bezpośrednio na modelu pojazdu — ze zdjęciami i podpisem cyfrowym klienta. Gdy później pojawią się pytania, masz dowody. Czarno na białym.',
  'landing.schaden.point1': 'Punkty uszkodzeń bezpośrednio na modelu 3D',
  'landing.schaden.point2': 'Zdjęcia do każdego uszkodzenia — przypisywane automatycznie',
  'landing.schaden.point3': 'Podpis cyfrowy przy przyjęciu i odbiorze',
  'landing.schaden.cardHeader': 'Przyjęcie pojazdu · Rejestracja uszkodzeń',
  'landing.schaden.cardBadge': '2 uszkodzenia',
  'landing.schaden.cardPhotos': '4 zdjęcia udokumentowane',
  'landing.schaden.cardSignature': 'Podpis zebrany',

  // ---- Landing: Wachstum ---------------------------------------------------
  'landing.wachstum.kicker': 'Skalowalne',
  'landing.wachstum.title': 'Wzrost dzięki pełnemu obrazowi',
  'landing.wachstum.sub':
    'Kto jest zorganizowany i zna swoje liczby, podejmuje lepsze decyzje — od jednoosobowej firmy po sieć.',
  'landing.wachstum.echtzeit.title': 'Podgląd w czasie rzeczywistym',
  'landing.wachstum.echtzeit.desc':
    'Obrót, otwarte zlecenia i terminy na żywo w pulpicie — od razu widzisz, gdzie idzie dobrze, a gdzie się zacina.',
  'landing.wachstum.standorte.title': 'Wiele lokalizacji',
  'landing.wachstum.standorte.desc':
    'Zarządzaj oddziałami pod jednym dachem — czysto rozdzielonymi, a mimo to centralnie na widoku. Rozwija się, gdy rośniesz.',
  'landing.wachstum.team.title': 'Zespół, role i uprawnienia',
  'landing.wachstum.team.desc':
    'Zapraszaj pracowników i przydzielaj role — każdy widzi dokładnie to, co powinien. Wszystko nadzorowane i udokumentowane.',
  'landing.wachstum.chartVolume': 'Wolumen zleceń',
  'landing.wachstum.chartGrowing': 'rośnie',
  'landing.wachstum.chartLocations': 'Lokalizacje',

  // ---- Landing: Zahlen (Count-up) ------------------------------------------
  'landing.zahlen.stat1.unit': 'min',
  'landing.zahlen.stat1.label': 'od przyjęcia do gotowego zlecenia',
  'landing.zahlen.stat2.unit': 'dni',
  'landing.zahlen.stat2.label': 'testu za darmo — bez karty',
  'landing.zahlen.stat3.unit': '%',
  'landing.zahlen.stat3.label': 'zgodność z RODO i GoBD',
  'landing.zahlen.stat4.value': '5 → 1',
  'landing.zahlen.stat4.label': 'jeden system zamiast pięciu osobnych narzędzi',

  // ---- Landing: Stimmen ----------------------------------------------------
  'landing.stimmen.kicker': 'Z praktyki',
  'landing.stimmen.title': 'Co mówią firmy pilotażowe',
  'landing.stimmen.q1.text':
    'Wreszcie rano jednym spojrzeniem widzę, co dziś dzieje się w warsztacie. Papierowy chaos zniknął.',
  'landing.stimmen.q1.who': 'Właściciel · studio detailingu',
  'landing.stimmen.q2.text':
    'Rejestracja uszkodzeń 3D przy przyjęciu już dwa razy uchroniła nas przed kosztownymi dyskusjami.',
  'landing.stimmen.q2.who': 'Dyrektor · firma oklejania',
  'landing.stimmen.q3.text':
    'Z gotowego zlecenia w kilka sekund powstaje faktura. Kiedyś kosztowało to cały wieczór.',
  'landing.stimmen.q3.who': 'Kierownik warsztatu · studio PPF',

  // ---- Landing: Warum Detailly ---------------------------------------------
  'landing.warum.kicker': 'Dlaczego Detailly',
  'landing.warum.title': 'Oprogramowanie dla warsztatu — nie dla salonu.',
  'landing.warum.body':
    'Specjaliści od detailingu, oklejania i studia PPF wykonują pracę precyzyjną i zasługują na oprogramowanie, które działa równie starannie. Większość programów warsztatowych powstała dla dużych salonów samochodowych: przeładowane, skomplikowane i drogie. Detailly jest świadomie inny — prosty, dopasowany do Waszych procesów i gotowy do pracy w kilka minut. Tworzony samodzielnie, w Niemczech, z ochroną danych od podstaw.',

  // ---- Landing: News-Teaser ------------------------------------------------
  'landing.news.kicker': 'Aktualności Detailly',
  'landing.news.title': 'Co się właśnie dzieje',
  'landing.news.sub':
    'Aktualizacje produktu i nowości o Detailly. (Przykładowe wpisy — wkrótce z prawdziwymi wiadomościami.)',
  'landing.news.all': 'Zobacz wszystkie aktualności',

  // ---- Landing: FAQ --------------------------------------------------------
  'landing.faq.kicker': 'Częste pytania',
  'landing.faq.title': 'Co warto wiedzieć przed startem',
  'landing.faq.q1.q': 'Czy potrzebuję wiedzy technicznej lub instalacji?',
  'landing.faq.q1.a':
    'Nie. Rejestrujesz swoją firmę i od razu działasz w przeglądarce — na komputerze, tablecie lub smartfonie. Nie ma nic do instalowania ani konfigurowania.',
  'landing.faq.q2.q': 'Robię detailing I oklejanie — co wybrać?',
  'landing.faq.q2.a':
    'Wtedy jesteś usługodawcą kompleksowym: przy rejestracji po prostu wybierasz „Usługodawca kompleksowy” i otrzymujesz wszystkie katalogi usług i wyceny razem.',
  'landing.faq.q3.q': 'Jak bezpieczne są dane moich klientów?',
  'landing.faq.q3.a':
    'Dane wrażliwe są przechowywane w postaci zaszyfrowanej i ściśle oddzielone od innych firm. Dane klientów możesz w każdej chwili wyeksportować lub usunąć — w pełni zgodnie z RODO.',
  'landing.faq.q4.q': 'Co dzieje się po 14 dniach?',
  'landing.faq.q4.a':
    'Testujesz bez karty i bez ryzyka. Po okresie próbnym wybierasz taryfę pasującą do Twojej firmy. Jeśli okres próbny się kończy, nie ponosisz żadnych kosztów.',
  'landing.faq.q5.q': 'Czy działa też na tablecie w warsztacie?',
  'landing.faq.q5.a':
    'Tak. Detailly jest stworzony na każde urządzenie — od biurowego PC po tablet przy przyjęciu pojazdu. Obsługa dopasowuje się automatycznie.',
  'landing.faq.q6.q': 'Czy mogę zabrać swoje dane?',
  'landing.faq.q6.a':
    'W każdej chwili. Twoje dane należą do Ciebie — eksport jednym kliknięciem, bez pytania kogokolwiek.',

  // ---- Landing: Abschluss-CTA ----------------------------------------------
  'landing.cta.band': 'Cała naprzód',
  'landing.cta.title': 'Zaprowadź porządek w firmie — już dziś.',
  'landing.cta.sub':
    'Zarejestruj firmę w kilka minut i testuj Detailly przez 14 dni za darmo. Bez karty, bez ryzyka.',

  // ---- Landing: Footer (weitere) -------------------------------------------
  'landing.footer.tagline':
    'Oprogramowanie warsztatowe do detailingu, oklejania i PPF. Tworzone samodzielnie w Niemczech.',
  'landing.footer.discover': 'Odkryj',
  'landing.footer.product': 'Produkt',
  'landing.footer.account': 'Konto i informacje prawne',
  'landing.footer.news': 'Aktualności',
  'landing.footer.masterclass': 'Masterclass',
  'landing.footer.gruendung': 'Zakładanie firmy',
  'landing.footer.features': 'Funkcje',
  'landing.footer.branchen': 'Dla Twojego fachu',
  'landing.footer.faq': 'Częste pytania',
  'landing.footer.impressum': 'Nota prawna',
  'landing.footer.datenschutz': 'Prywatność',
  'landing.footer.copyright': '© {year} Detailly · Wszelkie prawa zastrzeżone',

  // ---- Kundenformular ------------------------------------------------------
  'kunden.form.leitwegId.label': 'Leitweg-ID',
  'kunden.form.leitwegId.help':
    'Tylko dla faktur do urzędów/zamawiających publicznych (steruje routingiem B2G).',

  // ===========================================================================
  // KLIENCI (trasa "/kunden")
  // ===========================================================================
  'kunden.title': 'Klienci',
  'kunden.subtitle': 'Klienci prywatni i firmowi',
  'kunden.csvImport': 'Import CSV',
  'kunden.new': 'Nowy klient',
  'kunden.searchPlaceholder': 'Szukaj po nazwie, e-mailu, telefonie…',

  // ---- Stan pusty ----------------------------------------------------------
  'kunden.empty.none': 'Brak klientów.',
  'kunden.empty.filtered': 'Nie znaleziono klientów.',
  'kunden.empty.cta': 'Dodaj pierwszego klienta',

  // ---- Kolumny tabeli ------------------------------------------------------
  'kunden.col.name': 'Nazwa',
  'kunden.col.typ': 'Typ',
  'kunden.col.email': 'E-mail',
  'kunden.col.telefon': 'Telefon',
  'kunden.col.ort': 'Miasto',

  // ---- Typ klienta ---------------------------------------------------------
  'kunden.type.business': 'Firma',
  'kunden.type.private': 'Osoba prywatna',

  // ---- Menu akcji ----------------------------------------------------------
  'kunden.actionsFor': 'Akcje dla {name}',
  'kunden.action.open': 'Otwórz',
  'kunden.action.newOrder': 'Nowe zlecenie',
  'kunden.action.edit': 'Edytuj',

  // ---- Powiadomienie / błąd / potwierdzenie usunięcia ----------------------
  'kunden.toast.deleted': '{name} usunięty',
  'kunden.error.delete': 'Usuwanie nie powiodło się',
  'kunden.delete.title': 'Usuń klienta',
  'kunden.delete.msg':
    'Na pewno usunąć {name}? Klient zostanie dezaktywowany i usunięty z listy. Utworzone już zlecenia i faktury zostaną zachowane.',

  // ===========================================================================
  // FAHRZEUGE (trasa "/fahrzeuge")
  // ===========================================================================
  'fahrzeuge.title': 'Pojazdy',
  'fahrzeuge.subtitle': 'Baza pojazdów z kartoteką pojazdu',
  'fahrzeuge.new': 'Nowy pojazd',
  'fahrzeuge.searchPlaceholder': 'Szukaj po nr rejestracyjnym, marce, modelu lub właścicielu…',

  // ---- Stan pusty ----------------------------------------------------------
  'fahrzeuge.empty.none': 'Brak pojazdów.',
  'fahrzeuge.empty.filtered': 'Nie znaleziono pojazdów.',
  'fahrzeuge.empty.cta': 'Dodaj pierwszy pojazd',

  // ---- Kolumny tabeli ------------------------------------------------------
  'fahrzeuge.col.fahrzeug': 'Pojazd',
  'fahrzeuge.col.kennzeichen': 'Nr rejestracyjny',
  'fahrzeuge.col.halter': 'Właściciel',
  'fahrzeuge.col.baujahr': 'Rok produkcji',

  // ---- Menu akcji ----------------------------------------------------------
  'fahrzeuge.actionsFor': 'Akcje dla {name}',
  'fahrzeuge.action.open': 'Otwórz kartotekę pojazdu',
  'fahrzeuge.action.newOrder': 'Nowe zlecenie',

  // ---- Formularz (nowy pojazd) ---------------------------------------------
  'fahrzeuge.form.halter': 'Właściciel',
  'fahrzeuge.form.selectPlaceholder': '– wybierz –',
  'fahrzeuge.form.marke': 'Marka',
  'fahrzeuge.form.modell': 'Model',
  'fahrzeuge.form.variante': 'Wariant',
  'fahrzeuge.form.baujahr': 'Rok produkcji',
  'fahrzeuge.form.farbe': 'Kolor',
  'fahrzeuge.form.kennzeichen': 'Nr rejestracyjny',
  'fahrzeuge.form.kraftstoff': 'Paliwo',
  'fahrzeuge.form.flaeche': 'Powierzchnia (m²)',

  // ---- Rodzaje paliwa ------------------------------------------------------
  'fahrzeuge.fuel.petrol': 'Benzyna',
  'fahrzeuge.fuel.diesel': 'Diesel',
  'fahrzeuge.fuel.electric': 'Elektryczny',
  'fahrzeuge.fuel.hybrid': 'Hybryda',
  'fahrzeuge.saving': 'Zapisywanie…',

  // ---- Powiadomienie / błąd / potwierdzenie usunięcia ----------------------
  'fahrzeuge.toast.deleted': '{name} usunięty',
  'fahrzeuge.error.delete': 'Usuwanie nie powiodło się',
  'fahrzeuge.error.save': 'Zapis nie powiódł się',
  'fahrzeuge.delete.title': 'Usuń pojazd',
  'fahrzeuge.delete.msg':
    'Na pewno usunąć {name}? Pojazd zostanie usunięty z listy. Utworzone już zlecenia i terminy zostaną zachowane.',

  // ===========================================================================
  // DOKUMENTY / FAKTURY (trasa "/rechnungen")
  // ===========================================================================
  'rechnungen.title': 'Dokumenty',
  'rechnungen.subtitle': 'Oferty i faktury',
  'rechnungen.searchPlaceholder': 'Szukaj po numerze lub kliencie…',
  'rechnungen.tab.alle': 'Wszystkie',

  // ---- Stany puste ---------------------------------------------------------
  'rechnungen.empty.none': 'Brak dokumentów. Dokumenty powstają ze zleceń.',
  'rechnungen.empty.filtered': 'Brak dokumentów w tym widoku.',

  // ---- Kolumny tabeli ------------------------------------------------------
  'rechnungen.col.nummer': 'Numer',
  'rechnungen.col.art': 'Rodzaj',
  'rechnungen.col.kunde': 'Klient',
  'rechnungen.col.datum': 'Data',
  'rechnungen.col.status': 'Status',
  'rechnungen.col.brutto': 'Brutto',

  // ---- Rodzaj / status -----------------------------------------------------
  'rechnungen.kind.angebot': 'Oferta',
  'rechnungen.kind.rechnung': 'Faktura',
  'rechnungen.status.entwurf': 'Szkic',
  'rechnungen.status.offen': 'Otwarta',
  'rechnungen.status.bezahlt': 'Opłacona',
  'rechnungen.status.storniert': 'Anulowana',

  // ---- Terminy / plakietki wysyłki -----------------------------------------
  'rechnungen.overdue': 'Zaległe od {tage} dni',
  'rechnungen.dueIn': 'termin za {tage} dni',
  'rechnungen.sent': 'Wysłano',
  'rechnungen.sentOn': 'Wysłano {datum}',

  // ---- Poziomy monitu ------------------------------------------------------
  'rechnungen.mahn.stufe1': 'Przypomnienie o płatności',
  'rechnungen.mahn.stufe2': '1. monit',
  'rechnungen.mahn.stufe3': '2. monit',
  'rechnungen.mahn.generic': 'Poziom monitu {stufe}',

  // ---- Akcje w wierszu -----------------------------------------------------
  'rechnungen.action.pdf': 'Pobierz PDF',
  'rechnungen.action.xrechnung': 'XRechnung (XML)',
  'rechnungen.action.send': 'Wyślij e-mailem',
  'rechnungen.action.resend': 'Wyślij ponownie e-mailem',
  'rechnungen.action.markPaid': 'Oznacz jako opłacone',
  'rechnungen.action.copyLink': 'Kopiuj link do pobrania',
  'rechnungen.action.mahnen': 'Wyślij monit',
  'rechnungen.action.storno': 'Anuluj',
  'rechnungen.action.setStatus': 'Ustaw na „{status}”',
  'rechnungen.actionsFor': 'Akcje dla {nummer}',
  'rechnungen.linkPrompt': 'Kopiuj link do pobrania:',

  // ---- Potwierdzenie anulowania --------------------------------------------
  'rechnungen.storno.title': 'Anuluj dokument',
  'rechnungen.storno.msg':
    'Na pewno anulować dokument {nummer}? Anulowanego dokumentu nie można ponownie aktywować.',
  'rechnungen.storno.msgPaid':
    'Na pewno anulować opłaconą fakturę {nummer}? Anulowania nie można cofnąć – notę korygującą lub zwrot może być konieczne rozliczyć osobno.',

  // ---- Powiadomienia (toast) -----------------------------------------------
  'rechnungen.toast.statusUpdated': 'Status zaktualizowany',
  'rechnungen.toast.storniert': 'Dokument anulowany',
  'rechnungen.toast.paid': 'Oznaczono jako opłacone',
  'rechnungen.toast.sent': 'Dokument wysłany e-mailem',
  'rechnungen.toast.linkCopied': 'Link do pobrania skopiowany',
  'rechnungen.toast.mahnSent': 'Monit wysłany',

  // ---- Komunikaty o błędach ------------------------------------------------
  'rechnungen.error.statusChange': 'Zmiana statusu nie powiodła się',
  'rechnungen.error.pdf': 'Nie udało się wczytać PDF',
  'rechnungen.error.xrechnung': 'Nie udało się utworzyć XRechnung',
  'rechnungen.error.paid': 'Nie udało się oznaczyć jako opłacone',
  'rechnungen.error.send': 'Wysyłka e-mail nie powiodła się',
  'rechnungen.error.link': 'Nie udało się utworzyć linku',
  'rechnungen.error.mahn': 'Monit nie powiódł się',

  // ===========================================================================
  // ZLECENIA (trasa "/auftraege")
  // ===========================================================================
  'auftraege.title': 'Zlecenia',
  'auftraege.subtitle': 'Centralna jednostka z przepływem statusów i kalkulacją',
  'auftraege.new': 'Nowe zlecenie',
  'auftraege.searchPlaceholder': 'Szukaj po numerze lub kliencie…',
  'auftraege.tab.alle': 'Wszystkie',

  // ---- Stany puste ---------------------------------------------------------
  'auftraege.empty.none': 'Brak zleceń.',
  'auftraege.empty.filtered': 'Brak zleceń w tym widoku.',
  'auftraege.empty.cta': 'Utwórz pierwsze zlecenie',

  // ---- Kolumny tabeli ------------------------------------------------------
  'auftraege.col.nummer': 'Numer',
  'auftraege.col.kunde': 'Klient',
  'auftraege.col.leistung': 'Usługa',
  'auftraege.col.status': 'Status',
  'auftraege.col.gesamt': 'Razem',

  // ---- Akcje w wierszu -----------------------------------------------------
  'auftraege.actionsFor': 'Akcje dla zlecenia {nummer}',
  'auftraege.action.open': 'Otwórz',

  // ---- Status --------------------------------------------------------------
  'auftraege.status.angefragt': 'Zapytanie',
  'auftraege.status.kalkuliert': 'Skalkulowane',
  'auftraege.status.bestaetigt': 'Potwierdzone',
  'auftraege.status.in_arbeit': 'W toku',
  'auftraege.status.qualitaetskontrolle': 'Kontrola jakości',
  'auftraege.status.fertig': 'Gotowe',
  'auftraege.status.abgerechnet': 'Rozliczone',
  'auftraege.status.storniert': 'Anulowane',

  // ---- Rodzaj usługi -------------------------------------------------------
  'auftraege.service.aufbereitung': 'Detailing',
  'auftraege.service.folierung': 'Oklejanie folią',
  'auftraege.service.ppf': 'PPF',
  'auftraege.service.sonstiges': 'Inne',

  // ---- Formularz (nowe zlecenie) -------------------------------------------
  'auftraege.form.kunde': 'Klient',
  'auftraege.form.selectPlaceholder': '– wybierz –',
  'auftraege.form.fahrzeug': 'Pojazd',
  'auftraege.form.optionalPlaceholder': '– opcjonalnie –',
  'auftraege.form.leistungsart': 'Rodzaj usługi',
  'auftraege.form.materialkosten': 'Koszt materiałów (netto)',
  'auftraege.form.positionen': 'Pozycje',
  'auftraege.form.addPosition': '+ Pozycja',
  'auftraege.form.beschreibung': 'Opis',
  'auftraege.form.fromService': 'przejmij z usługi…',
  'auftraege.form.menge': 'Ilość',
  'auftraege.form.einzelpreis': 'Cena jednostkowa',
  'auftraege.form.netto': 'Netto',
  'auftraege.form.mwst': 'VAT (19%)',
  'auftraege.saving': 'Zapisywanie…',
  'auftraege.submit': 'Utwórz zlecenie',

  // ---- Powiadomienia / błędy -----------------------------------------------
  'auftraege.toast.deleted': 'Zlecenie {nummer} usunięte',
  'auftraege.error.delete': 'Usuwanie nie powiodło się',
  'auftraege.error.save': 'Zapis nie powiódł się',

  // ---- Potwierdzenie usunięcia ---------------------------------------------
  'auftraege.delete.title': 'Usuń zlecenie',
  'auftraege.delete.msg':
    'Na pewno usunąć zlecenie {nummer}? Tej operacji nie można cofnąć.',

  // ===========================================================================
  // KALKULACJA (Route "/kalkulation")
  // ===========================================================================
  'kalkulation.title': 'Kalkulacja',
  'kalkulation.subtitle':
    'Kliknij elementy lub usługi – cena liczy się na bieżąco. Każdą pozycję można zmienić.',
  'kalkulation.diagram.aria': 'Widok pojazdu z góry: kliknij elementy',

  // ---- Wskazówka katalogu --------------------------------------------------
  'kalkulation.katalog.prefix': 'Katalog:',
  'kalkulation.katalog.suffix':
    '– więcej katalogów w Ustawieniach → typ działalności „Usługodawca kompleksowy”.',

  // ---- Parametry -----------------------------------------------------------
  'kalkulation.section.fahrzeugMaterial': 'Pojazd i materiał',
  'kalkulation.field.groesse': 'Rozmiar pojazdu',
  'kalkulation.field.schnellauswahl': 'Szybki wybór',
  'kalkulation.clearSelection': 'Wyczyść wybór',
  'kalkulation.section.auswahlSubtitle': 'Kliknij, aby dodać – na schemacie lub na liście.',

  // ---- Powłoka ceramiczna --------------------------------------------------
  'kalkulation.keramik.add': 'Dodaj powłokę ceramiczną',
  'kalkulation.keramik.basis': 'Cena podstawowa (w tym 1 warstwa)',
  'kalkulation.keramik.weitereSchichten': 'Dodatkowe warstwy',
  'kalkulation.keramik.none': 'brak',
  'kalkulation.keramik.proSchicht': 'Cena za dodatkową warstwę',
  'kalkulation.keramik.layerSingular': 'warstwa',
  'kalkulation.keramik.layerPlural': 'warstwy',

  // ---- Suma na żywo --------------------------------------------------------
  'kalkulation.positionCount': 'Pozycji: {count}',
  'kalkulation.empty': 'Nic jeszcze nie wybrano – kliknij elementy na schemacie lub na liście.',
  'kalkulation.priceAria': 'Cena za {label}',
  'kalkulation.netto': 'Netto',
  'kalkulation.mwst': 'VAT (19%)',
  'kalkulation.gesamt': 'Razem',
  'kalkulation.copyButton': 'Kopiuj podsumowanie',
  'kalkulation.hint.base':
    'Ceny orientacyjne na podstawie rozmiaru pojazdu{material} – każdą pozycję można bezpośrednio nadpisać.',
  'kalkulation.hint.materialSuffix': ' i klasy materiału',
  'kalkulation.toast.copied': 'Skopiowano podsumowanie',
  'kalkulation.summaryHeadline': 'Kalkulacja {titel} – {rahmen}',

  // ===========================================================================
  // KSIĘGOWOŚĆ (Route "/buchhaltung")
  // ===========================================================================
  'buchhaltung.title': 'Księgowość',
  'buchhaltung.subtitle':
    'Eksport danych dla księgowego – faktury (CSV/DATEV) i czas pracy do rozliczenia płac.',

  // ---- Okres ---------------------------------------------------------------
  'buchhaltung.zeitraum.title': 'Okres',
  'buchhaltung.zeitraum.subtitle': 'Dotyczy obu eksportów (faktury i czas pracy).',
  'buchhaltung.von': 'Od',
  'buchhaltung.bis': 'Do',
  'buchhaltung.zeitraum.help':
    'Faktury: wystawione (otwarte i opłacone) w okresie · Czas pracy: wszystkie wpisy w okresie.',

  // ---- Format --------------------------------------------------------------
  'buchhaltung.format.title': 'Format',
  'buchhaltung.format.subtitle': 'Uniwersalny CSV lub pakiet księgowań DATEV.',
  'buchhaltung.format.csv.title': 'CSV (uniwersalny)',
  'buchhaltung.format.csv.desc':
    'Rozdzielany średnikami, dla każdego księgowego – także bez DATEV. Numer dokumentu, data, kwoty, VAT, status.',
  'buchhaltung.format.datev.title': 'Pakiet księgowań DATEV',
  'buchhaltung.format.datev.desc':
    'Format EXTF do bezpośredniego importu do DATEV. Wymaga numeru doradcy/klienta (Ustawienia).',

  // ---- Eksport -------------------------------------------------------------
  'buchhaltung.export': 'Eksportuj',
  'buchhaltung.exporting': 'Eksportowanie…',
  'buchhaltung.datevStammdaten': 'Zarządzaj danymi podstawowymi DATEV →',
  'buchhaltung.datevHinweis':
    'Uwaga: Eksport DATEV jest zgodny z powszechną specyfikacją EXTF. Przed pierwszym rzeczywistym importem sprawdź go z księgowym lub bezpłatnym programem weryfikującym DATEV.',

  // ---- Czas pracy ----------------------------------------------------------
  'buchhaltung.zeiten.title': 'Czas pracy do rozliczenia płac',
  'buchhaltung.zeiten.subtitle':
    'Zarejestrowany czas zleceń na pracownika w okresie (z kosztami pracy) jako CSV – do rozliczenia płac.',
  'buchhaltung.zeiten.export': 'Eksportuj czas pracy',
  'buchhaltung.zeiten.help':
    'Szczegółowe wiersze na wpis + suma na pracownika. Koszty pracy oparte są na aktualnie zapisanej stawce godzinowej. Zawiera dane o wynagrodzeniach – tylko dla kierownictwa.',

  // ---- Powiadomienia / Błędy -----------------------------------------------
  'buchhaltung.toast.exportStarted': 'Eksport rozpoczęty',
  'buchhaltung.error.export': 'Eksport nie powiódł się',

  // ===========================================================================
  // MONITY (Route "/mahnungen")
  // ===========================================================================
  'mahnungen.title': 'Monity',
  'mahnungen.subtitle': 'Miej przeterminowane faktury pod kontrolą i wysyłaj monity',
  'mahnungen.alleMahnen': 'Ponagl wszystkie',
  'mahnungen.mahnt': 'Wysyłanie …',
  'mahnungen.empty': 'Brak przeterminowanych faktur. Wszystkie otwarte faktury są w terminie.',

  // ---- Poziom monitu (następny do wysłania) --------------------------------
  'mahnungen.stufe.0': 'jeszcze nie ponaglono',
  'mahnungen.stufe.1': 'Przypomnienie',
  'mahnungen.stufe.2': '1. monit',
  'mahnungen.stufe.3': '2. monit',

  // ---- Wskaźniki -----------------------------------------------------------
  'mahnungen.stat.ueberfaellig': 'Przeterminowane faktury',
  'mahnungen.stat.offenerBetrag': 'Kwota otwarta',
  'mahnungen.stat.summeBrutto': 'Suma brutto',
  'mahnungen.notYetReminded': 'Jeszcze nie ponaglono',
  'mahnungen.stat.ohneMahnungHintOne': 'faktura bez monitu',
  'mahnungen.stat.ohneMahnungHintMany': 'faktur bez monitu',

  // ---- Tabela --------------------------------------------------------------
  'mahnungen.col.nummer': 'Numer',
  'mahnungen.col.kunde': 'Klient',
  'mahnungen.col.faelligSeit': 'Zaległa od',
  'mahnungen.col.mahnstufe': 'Poziom monitu',
  'mahnungen.col.brutto': 'Brutto',
  'mahnungen.tag': 'dzień',
  'mahnungen.tage': 'dni',
  'mahnungen.faelligAm': 'termin {datum}',
  'mahnungen.erneutMahnen': 'Ponagl ponownie',
  'mahnungen.jetztMahnen': 'Ponagl teraz',

  // ---- Potwierdzenia -------------------------------------------------------
  'mahnungen.confirmOne.title': 'Wyślij monit',
  'mahnungen.confirmOne.confirm': 'Wyślij monit',
  'mahnungen.confirmOne.msg':
    'Wysłać monit dla faktury {nummer} do {kunde}? Klient otrzyma {stufe} e-mailem, a poziom monitu zostanie podniesiony.',
  'mahnungen.confirmBulk.msg':
    'Ponaglić teraz wszystkie {count} przeterminowane faktury? Każdy dotknięty klient otrzyma monit e-mailem, a poziom monitu zostanie podniesiony.',

  // ---- Powiadomienia / Błędy -----------------------------------------------
  'mahnungen.error.load': 'Nie udało się załadować listy monitów',
  'mahnungen.error.mahn': 'Wysłanie monitu nie powiodło się',
  'mahnungen.toast.sentOne': 'Monit wysłany do {kunde}.',
  'mahnungen.toast.sentBulkOne': 'Wysłano monity: {count}.',
  'mahnungen.toast.sentBulkMany': 'Wysłano monity: {count}.',
  'mahnungen.error.bulkOne': 'Nie udało się wysłać monitów: {count}.',
  'mahnungen.error.bulkMany': 'Nie udało się wysłać monitów: {count}.',

  // ===========================================================================
  // PRZYJĘCIE POJAZDU (Route "/fahrzeugannahme")
  // ===========================================================================
  'fahrzeugannahme.title': 'Przyjęcie pojazdu',
  'fahrzeugannahme.subtitle': 'Udokumentuj stan i zaznacz uszkodzenia na schemacie',
  'fahrzeugannahme.save': 'Zapisz przyjęcie',

  // ---- Odnośnik do fiksacji 3D ---------------------------------------------
  'fahrzeugannahme.crosslink.title': 'Zdjęcia, podpis i przejęcie wcześniejszych uszkodzeń?',
  'fahrzeugannahme.crosslink.subtitle': 'Przejdź do interaktywnej fiksacji uszkodzeń 3D.',

  // ---- Formularz przyjęcia -------------------------------------------------
  'fahrzeugannahme.card.annahme': 'Przyjęcie',
  'fahrzeugannahme.label.kunde': 'Klient',
  'fahrzeugannahme.label.fahrzeug': 'Pojazd',
  'fahrzeugannahme.select.placeholder': '– wybierz –',
  'fahrzeugannahme.label.km': 'Przebieg',
  'fahrzeugannahme.km.placeholder': 'np. 84500',
  'fahrzeugannahme.label.tankstand': 'Poziom paliwa: {wert} %',
  'fahrzeugannahme.label.notiz': 'Uwaga ogólna',
  'fahrzeugannahme.notiz.placeholder': 'Uwagi, ustalenia …',

  // ---- Schemat uszkodzeń ---------------------------------------------------
  'fahrzeugannahme.card.diagramm.title': 'Schemat uszkodzeń',
  'fahrzeugannahme.card.diagramm.subtitle': 'Kliknij sylwetkę, aby zaznaczyć uszkodzenie',
  'fahrzeugannahme.erfassteSchaeden': 'Zapisane uszkodzenia ({count})',
  'fahrzeugannahme.empty.schaeden': 'Nie zaznaczono jeszcze uszkodzeń. Kliknij schemat.',
  'fahrzeugannahme.action.bearbeiten': 'Edytuj',
  'fahrzeugannahme.action.entfernen': 'Usuń',

  // ---- Ostatnie przyjęcia --------------------------------------------------
  'fahrzeugannahme.card.letzteAnnahmen.title': 'Ostatnie przyjęcia',
  'fahrzeugannahme.card.letzteAnnahmen.subtitle': 'Ostatnio zapisane przyjęcia pojazdów – dotknij, aby otworzyć',
  'fahrzeugannahme.empty.annahmen': 'Brak przyjęć.',

  // ---- Edytor uszkodzenia --------------------------------------------------
  'fahrzeugannahme.modal.title': 'Edytuj uszkodzenie',
  'fahrzeugannahme.modal.schadensart': 'Rodzaj uszkodzenia',
  'fahrzeugannahme.modal.schweregrad': 'Stopień',
  'fahrzeugannahme.modal.notiz': 'Uwaga',
  'fahrzeugannahme.modal.notiz.placeholder': 'Opis uszkodzenia …',
  'fahrzeugannahme.modal.entfernen': 'Usuń uszkodzenie',
  'fahrzeugannahme.modal.fertig': 'Gotowe',

  // ---- Rodzaj uszkodzenia (wyliczenie) -------------------------------------
  'fahrzeugannahme.art.kratzer': 'Rysa',
  'fahrzeugannahme.art.delle': 'Wgniecenie',
  'fahrzeugannahme.art.steinschlag': 'Odprysk od kamienia',
  'fahrzeugannahme.art.lackschaden': 'Uszkodzenie lakieru',
  'fahrzeugannahme.art.rost': 'Rdza',
  'fahrzeugannahme.art.sonstiges': 'Inne',

  // ---- Stopień (wyliczenie) ------------------------------------------------
  'fahrzeugannahme.grad.leicht': 'Lekki',
  'fahrzeugannahme.grad.mittel': 'Średni',
  'fahrzeugannahme.grad.schwer': 'Poważny',

  // ---- Status inspekcji (wyliczenie) ---------------------------------------
  'fahrzeugannahme.status.entwurf': 'Wersja robocza',
  'fahrzeugannahme.status.abgeschlossen': 'Zakończono',
  'fahrzeugannahme.status.freigegeben': 'Zatwierdzono',

  // ---- Powiadomienia / Błędy -----------------------------------------------
  'fahrzeugannahme.error.kundePflicht': 'Proszę wybrać klienta.',
  'fahrzeugannahme.error.anlegen': 'Nie udało się utworzyć przyjęcia.',
  'fahrzeugannahme.toast.gespeichert': 'Przyjęcie zapisane.',

  // ===========================================================================
  // USŁUGI (Route "/leistungen")
  // ===========================================================================
  'leistungen.title': 'Usługi i pakiety',
  'leistungen.subtitle': 'Katalog do kalkulacji zleceń',
  'leistungen.new': 'Nowa usługa',
  'leistungen.showInactive': 'Pokaż nieaktywne usługi',

  // ---- Stany puste ---------------------------------------------------------
  'leistungen.empty.inactive': 'Brak dostępnych usług.',
  'leistungen.empty.none': 'Brak usług w katalogu.',
  'leistungen.empty.action': 'Utwórz pierwszą usługę',

  // ---- Tabela --------------------------------------------------------------
  'leistungen.col.name': 'Nazwa',
  'leistungen.col.kategorie': 'Kategoria',
  'leistungen.col.einheit': 'Jednostka',
  'leistungen.col.basispreis': 'Cena bazowa',
  'leistungen.inaktiv': 'Nieaktywna',

  // ---- Menu akcji ----------------------------------------------------------
  'leistungen.actionsFor': 'Akcje dla {name}',
  'leistungen.action.bearbeiten': 'Edytuj',
  'leistungen.action.reaktivieren': 'Reaktywuj',
  'leistungen.action.archivieren': 'Archiwizuj',

  // ---- Formularz -----------------------------------------------------------
  'leistungen.modal.editTitle': 'Edytuj usługę',
  'leistungen.modal.newTitle': 'Nowa usługa',
  'leistungen.field.name': 'Nazwa',
  'leistungen.field.beschreibung': 'Opis',
  'leistungen.field.kategorie': 'Kategoria',
  'leistungen.field.einheit': 'Jednostka',
  'leistungen.field.basispreis': 'Cena bazowa',
  'leistungen.saving': 'Zapisywanie…',

  // ---- Kategoria (wyliczenie) ----------------------------------------------
  'leistungen.kat.aufbereitung': 'Detailing',
  'leistungen.kat.folierung': 'Oklejanie folią',
  'leistungen.kat.ppf': 'PPF',
  'leistungen.kat.sonstiges': 'Inne',

  // ---- Jednostka (wyliczenie) ----------------------------------------------
  'leistungen.einheit.pauschal': 'Ryczałt',
  'leistungen.einheit.qm': 'za m²',
  'leistungen.einheit.stunde': 'za godzinę',

  // ---- Błędy ---------------------------------------------------------------
  'leistungen.error.aktion': 'Akcja nie powiodła się',
  'leistungen.error.save': 'Zapis nie powiódł się',

  // ===========================================================================
  // SUBSKRYPCJA I TARYFA (Route "/abo")
  // ===========================================================================
  'abo.title': 'Subskrypcja i taryfa',
  'abo.subtitle': 'Wybierz, wykup i zarządzaj taryfą',

  // ---- Powiadomienia / Błędy -----------------------------------------------
  'abo.toast.success': 'Dziękujemy! Twoja subskrypcja jest aktywowana.',
  'abo.toast.cancel': 'Operacja przerwana – nic nie pobrano.',
  'abo.error.load': 'Ładowanie nie powiodło się',
  'abo.error.checkout': 'Płatność nie powiodła się',
  'abo.error.portal': 'Nie udało się otworzyć portalu',

  // ---- Bieżący stan --------------------------------------------------------
  'abo.card.title': 'Twoja subskrypcja',
  'abo.card.subtitle': 'Aktualny status Twojej firmy',
  'abo.planFallback.trial': 'Okres próbny',
  'abo.planFallback.none': 'Brak taryfy',
  'abo.noAbo': 'Brak subskrypcji',
  'abo.remainingDayOne': 'pozostał {count} dzień',
  'abo.remainingDayMany': 'pozostało dni: {count}',
  'abo.periodUntil': 'Okres do {datum}',
  'abo.portalOpening': 'Otwieram…',
  'abo.manage': 'Zarządzaj subskrypcją',
  'abo.ownerOnly': 'Tylko właściciel firmy może wykupić lub zmienić subskrypcję.',

  // ---- Przełącznik okresu płatności ----------------------------------------
  'abo.interval.month': 'Miesięcznie',
  'abo.interval.year': 'Rocznie',
  'abo.interval.yearBonus': '2 miesiące gratis',

  // ---- Karty taryf ---------------------------------------------------------
  'abo.current': 'Bieżąca',
  'abo.perYear': '/ rok',
  'abo.equivMonth': 'co odpowiada {preis} / miesiąc',
  'abo.perMonth': '/ miesiąc',
  'abo.currentPlanBtn': 'Bieżąca taryfa',
  'abo.toStripe': 'Przejdź do Stripe…',
  'abo.soon': 'Wkrótce dostępne',
  'abo.switch': 'Zmień',
  'abo.book': 'Wykup teraz',
  'abo.notBookableTitle': 'Ten okres płatności nie jest jeszcze dostępny dla tej taryfy.',
  'abo.stripeNote':
    'Płatność przebiega bezpiecznie przez Stripe. Zostaniesz przekierowany na stronę płatności Stripe; Detailly nie przechowuje danych kart. Anulowanie i metody płatności możesz zmienić w dowolnym momencie przez „Zarządzaj subskrypcją”.',

  // ---- Moduły (kody funkcji → etykieta) ------------------------------------
  'abo.modul.kunden': 'Klienci',
  'abo.modul.fahrzeuge': 'Pojazdy',
  'abo.modul.auftraege': 'Zlecenia',
  'abo.modul.termine': 'Terminy',
  'abo.modul.rechnungen': 'Faktury',
  'abo.modul.shop': 'Sklep i magazyn',
  'abo.modul.mitarbeiter': 'Pracownicy',
  'abo.modul.standorte': 'Lokalizacje',
  'abo.modul.audit': 'Dziennik audytu',
  'abo.modul.inspektion': 'Fiksacja uszkodzeń 3D',
  'abo.modul.auswertungen': 'Raporty',
  'abo.modul.mahnwesen': 'Monity',
  'abo.modul.export': 'Eksport księgowy',
  'abo.modul.wirtschaftlichkeit': 'Rentowność',
  'abo.modul.zeiterfassung': 'Rejestracja czasu',

  // ---- Poziom dostępu (wyliczenie) -----------------------------------------
  'abo.access.full': 'Pełny dostęp',
  'abo.access.warn': 'Dostęp z ostrzeżeniem',
  'abo.access.blocked': 'Zablokowany',

  // ---- Status subskrypcji (wyliczenie) -------------------------------------
  'abo.status.trial': 'Okres próbny',
  'abo.status.active': 'Aktywna',
  'abo.status.past_due': 'Płatność zaległa',
  'abo.status.canceled': 'Anulowana',
  'abo.status.suspended': 'Zawieszona',

  // ===========================================================================
  // Tablica planowania (kalendarz terminów)
  // ===========================================================================
  'plantafel.title': 'Tablica planowania',
  'plantafel.subtitle': 'Planowanie terminów – dzień, tydzień lub miesiąc. Przeciągnij, aby przenieść.',
  'plantafel.new': 'Nowy termin',
  'plantafel.today': 'Dziś',
  'plantafel.next': 'Dalej',
  'plantafel.view.tag': 'Dzień',
  'plantafel.view.woche': 'Tydzień',
  'plantafel.view.monat': 'Miesiąc',
  'plantafel.edit': 'Edytuj termin',
  'plantafel.form.titel': 'Tytuł',
  'plantafel.form.start': 'Początek',
  'plantafel.form.ende': 'Koniec',
  'plantafel.form.kunde': 'Klient',
  'plantafel.form.fahrzeug': 'Pojazd',
  'plantafel.form.optional': '– opcjonalnie –',
  'plantafel.form.status': 'Status',
  'plantafel.status.geplant': 'Zaplanowany',
  'plantafel.status.bestaetigt': 'Potwierdzony',
  'plantafel.status.laeuft': 'W toku',
  'plantafel.status.abgeschlossen': 'Zakończony',
  'plantafel.status.abgesagt': 'Odwołany',
  'plantafel.link.customer': 'Do klienta →',
  'plantafel.link.vehicle': 'Do pojazdu →',
  'plantafel.link.order': 'Do zlecenia →',
  'plantafel.saving': 'Zapisywanie…',
  'plantafel.delete.title': 'Usuń termin',
  'plantafel.delete.msg': 'Czy na pewno usunąć ten termin? Tej operacji nie można cofnąć.',
  'plantafel.weekday.mo': 'Pon',
  'plantafel.weekday.di': 'Wt',
  'plantafel.weekday.mi': 'Śr',
  'plantafel.weekday.do': 'Czw',
  'plantafel.weekday.fr': 'Pt',
  'plantafel.weekday.sa': 'Sob',
  'plantafel.weekday.so': 'Ndz',
  'plantafel.more': '+{count} więcej',
  'plantafel.error.load': 'Błąd ładowania',
  'plantafel.error.save': 'Nie udało się zapisać',
  'plantafel.error.delete': 'Nie udało się usunąć',
  'plantafel.error.move': 'Nie udało się przenieść',

  // ===========================================================================
  // Lokalizacje (zarządzanie oddziałami)
  // ===========================================================================
  'standorte.title': 'Lokalizacje',
  'standorte.subtitle': 'Zarządzanie lokalizacjami i ich porównanie',
  'standorte.new': '+ Lokalizacja',
  'standorte.auswertung.title': 'Analiza wszystkich lokalizacji',
  'standorte.auswertung.subtitle': 'W obrębie organizacji',
  'standorte.auswertung.empty': 'Brak danych do analizy.',
  'standorte.col.standort': 'Lokalizacja',
  'standorte.col.umsatz': 'Przychód',
  'standorte.col.offeneAuftraege': 'Otwarte zlecenia',
  'standorte.col.termine': 'Terminy',
  'standorte.col.name': 'Nazwa',
  'standorte.col.adresse': 'Adres',
  'standorte.col.telefon': 'Telefon',
  'standorte.col.status': 'Status',
  'standorte.listTitle': 'Lokalizacje ({count})',
  'standorte.empty': 'Nie utworzono jeszcze żadnej lokalizacji.',
  'standorte.emptyCta': 'Utwórz pierwszą lokalizację',
  'standorte.active': 'Aktywna',
  'standorte.inactive': 'Nieaktywna',
  'standorte.actionsFor': 'Akcje dla {name}',
  'standorte.action.edit': 'Edytuj',
  'standorte.action.deactivate': 'Dezaktywuj',
  'standorte.action.activate': 'Aktywuj',
  'standorte.modal.edit': 'Edytuj lokalizację',
  'standorte.modal.new': 'Utwórz lokalizację',
  'standorte.form.name': 'Nazwa',
  'standorte.form.namePlaceholder': 'np. Oddział München-Nord',
  'standorte.form.street': 'Ulica',
  'standorte.form.plz': 'Kod pocztowy',
  'standorte.form.stadt': 'Miasto',
  'standorte.form.telefon': 'Telefon',
  'standorte.form.active': 'Lokalizacja aktywna',
  'standorte.error.load': 'Błąd ładowania',
  'standorte.error.nameRequired': 'Nazwa jest wymagana.',
  'standorte.error.save': 'Nie udało się zapisać',
  'standorte.error.action': 'Nie udało się wykonać akcji',

  // ===========================================================================
  // Pracownicy (zarządzanie użytkownikami)
  // ===========================================================================
  'mitarbeiter.title': 'Pracownicy',
  'mitarbeiter.subtitle': 'Użytkownicy, role (RBAC) i stawki godzinowe',
  'mitarbeiter.new': 'Nowy pracownik',
  'mitarbeiter.empty': 'Brak pracowników.',
  'mitarbeiter.col.name': 'Imię i nazwisko',
  'mitarbeiter.col.email': 'E-mail',
  'mitarbeiter.col.rolle': 'Rola',
  'mitarbeiter.col.stundenlohn': 'Stawka godzinowa',
  'mitarbeiter.col.status': 'Status',
  'mitarbeiter.role.owner': 'Właściciel (Admin)',
  'mitarbeiter.role.manager': 'Menedżer',
  'mitarbeiter.role.technician': 'Technik',
  'mitarbeiter.role.receptionist': 'Recepcja',
  'mitarbeiter.wagePerHour': '{amount}/godz',
  'mitarbeiter.active': 'Aktywny',
  'mitarbeiter.inactive': 'Nieaktywny',
  'mitarbeiter.actionsFor': 'Akcje dla {name}',
  'mitarbeiter.action.edit': 'Edytuj',
  'mitarbeiter.action.deactivate': 'Dezaktywuj',
  'mitarbeiter.modal.edit': 'Edytuj pracownika',
  'mitarbeiter.form.firstName': 'Imię',
  'mitarbeiter.form.lastName': 'Nazwisko',
  'mitarbeiter.form.email': 'E-mail',
  'mitarbeiter.form.password': 'Hasło (min. 8)',
  'mitarbeiter.form.phone': 'Telefon',
  'mitarbeiter.form.role': 'Rola',
  'mitarbeiter.form.wage': 'Stawka godzinowa (€)',
  'mitarbeiter.form.optional': '(opcjonalnie)',
  'mitarbeiter.form.wagePlaceholder': 'np. 18,50',
  'mitarbeiter.saving': 'Zapisywanie…',
  'mitarbeiter.deactivate.title': 'Dezaktywuj pracownika',
  'mitarbeiter.deactivate.msg':
    'Czy na pewno dezaktywować {name}? Dostęp zostanie zablokowany, a logowanie nie będzie już możliwe. Zarejestrowane godziny i zlecenia zostaną zachowane.',

  // ===========================================================================
  // Zeiterfassung (Stempeluhr, Route "/zeiterfassung")
  // ===========================================================================
  'zeiterfassung.title': 'Rejestracja czasu',
  'zeiterfassung.subtitle': 'Zegar: rejestracja wejścia/wyjścia',
  'zeiterfassung.clock.title': 'Zegar',
  'zeiterfassung.clock.subtitle': 'Zarejestruj teraz wejście lub wyjście',
  'zeiterfassung.clock.since': 'Na zmianie od {time}',
  'zeiterfassung.clock.out': 'Poza zmianą',
  'zeiterfassung.clock.noLocation': 'Bez lokalizacji',
  'zeiterfassung.clock.stamping': 'Odbijanie…',
  'zeiterfassung.art.kommen': 'Wejście',
  'zeiterfassung.art.gehen': 'Wyjście',
  'zeiterfassung.mine.title': 'Moje czasy',
  'zeiterfassung.mine.subtitle': 'Twoje ostatnie odbicia',
  'zeiterfassung.mine.empty': 'Brak odbić.',
  'zeiterfassung.col.zeitpunkt': 'Czas',
  'zeiterfassung.col.art': 'Typ',
  'zeiterfassung.col.standort': 'Lokalizacja',
  'zeiterfassung.col.notiz': 'Uwaga',
  'zeiterfassung.col.mitarbeiter': 'Pracownik',
  'zeiterfassung.col.korrigiert': 'Skorygowano',
  'zeiterfassung.all.title': 'Wszystkie wpisy (kierownictwo)',
  'zeiterfassung.all.subtitle': 'Odbicia wszystkich pracowników – filtruj, koryguj, dodawaj',
  'zeiterfassung.all.empty': 'Brak wpisów dla bieżącego wyboru.',
  'zeiterfassung.newEntry': 'Dodaj wpis',
  'zeiterfassung.filter.alle': 'Wszystkie',
  'zeiterfassung.filter.von': 'Od',
  'zeiterfassung.filter.bis': 'Do',
  'zeiterfassung.action.edit': 'Edytuj',
  'zeiterfassung.action.delete': 'Usuń',
  'zeiterfassung.modal.edit': 'Edytuj wpis',
  'zeiterfassung.form.selectEmployee': 'Wybierz pracownika…',
  'zeiterfassung.saving': 'Zapisywanie…',
  'zeiterfassung.delete.title': 'Usuń wpis',
  'zeiterfassung.delete.msgNamed': 'Czy na pewno usunąć wpis pracownika {name} z {date}?',
  'zeiterfassung.delete.msg': 'Czy na pewno usunąć wpis z {date}?',
  'zeiterfassung.error.load': 'Błąd ładowania',
  'zeiterfassung.error.stamp': 'Nie udało się odbić',
  'zeiterfassung.error.timeRequired': 'Podaj czas.',
  'zeiterfassung.error.save': 'Nie udało się zapisać',
  'zeiterfassung.error.delete': 'Nie udało się usunąć',
};
