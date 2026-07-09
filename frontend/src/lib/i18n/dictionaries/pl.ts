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
};
