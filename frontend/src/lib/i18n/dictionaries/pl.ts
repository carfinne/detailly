// ===========================================================================
// PL – KERN-WÖRTERBUCH (Partial<Dict>)
// ---------------------------------------------------------------------------
// Bewusst NUR die Kern-Keys übersetzt: Navigation, Landing-CTAs (+ Hero),
// Login, common, Switcher. ALLE anderen Keys fehlen absichtlich und werden zur
// Laufzeit automatisch auf DE zurückgeführt (siehe ../provider, t() → de[key]).
//
// So entstehen KEINE erfundenen Halb-Übersetzungen. Die hier vorhandenen Texte
// sollten vor dem Launch muttersprachlich (PL) gegengelesen werden.
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
};
