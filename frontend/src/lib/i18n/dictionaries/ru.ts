// ===========================================================================
// RU – KERN-WÖRTERBUCH (Partial<Dict>)
// ---------------------------------------------------------------------------
// Bewusst NUR die Kern-Keys übersetzt: Navigation, Landing-CTAs (+ Hero),
// Login, common, Switcher. ALLE anderen Keys fehlen absichtlich und werden zur
// Laufzeit automatisch auf DE zurückgeführt (siehe ../provider, t() → de[key]).
//
// So entstehen KEINE erfundenen Halb-Übersetzungen. Die hier vorhandenen Texte
// sollten vor dem Launch muttersprachlich (RU) gegengelesen werden.
// ===========================================================================

import type { Dict } from './de';

export const ru: Partial<Dict> = {
  // ---- Common --------------------------------------------------------------
  'common.save': 'Сохранить',
  'common.cancel': 'Отмена',
  'common.confirm': 'Подтвердить',
  'common.delete': 'Удалить',
  'common.close': 'Закрыть',
  'common.back': 'Назад',
  'common.loading': 'Загрузка',
  'common.loadingEllipsis': 'Загрузка…',
  'common.error': 'Ошибка',
  'common.toStart': 'На главную',

  // ---- Switcher ------------------------------------------------------------
  'switcher.label': 'Выбрать язык',
  'switcher.current': 'Текущий язык',

  // ---- Navigation: groups --------------------------------------------------
  'nav.group.overview': 'Обзор',
  'nav.group.operations': 'Работа',
  'nav.group.masterdata': 'Справочники',
  'nav.group.finance': 'Финансы',
  'nav.group.organization': 'Организация',
  'nav.group.platform': 'Платформа',

  // ---- Navigation: items ---------------------------------------------------
  'nav.item.dashboard': 'Панель',
  'nav.item.orders': 'Заказы',
  'nav.item.calculation': 'Расчёт',
  'nav.item.intakeQuick': 'Приёмка (быстро)',
  'nav.item.intake3d': 'Приёмка и оценка (3D)',
  'nav.item.planboard': 'Планшет',
  'nav.item.requests': 'Заявки',
  'nav.item.customers': 'Клиенты',
  'nav.item.vehicles': 'Автомобили',
  'nav.item.services': 'Услуги',
  'nav.item.invoices': 'Счета',
  'nav.item.reminders': 'Напоминания',
  'nav.item.reports': 'Отчёты',
  'nav.item.accounting': 'Бухгалтерия',
  'nav.item.shop': 'Магазин и склад',
  'nav.item.marketplace': 'Маркетплейс',
  'nav.item.locations': 'Филиалы',
  'nav.item.staff': 'Сотрудники',
  'nav.item.time': 'Учёт времени',
  'nav.item.audit': 'Журнал аудита',
  'nav.item.settings': 'Настройки',
  'nav.item.help': 'Помощь и поддержка',
  'nav.item.assistant': 'Ассистент поддержки',
  'nav.item.subscription': 'Подписка и тариф',
  'nav.item.platformAnalytics': 'Аналитика платформы',
  'nav.item.platformMarketplace': 'Управление маркетплейсом',
  'nav.item.platformSupport': 'Запросы поддержки',
  'nav.item.subscriptions': 'Подписки',

  // ---- Login ---------------------------------------------------------------
  'login.subtitle': 'Detailing Suite — детейлинг, оклейка и PPF',
  'login.email': 'Эл. почта',
  'login.password': 'Пароль',
  'login.forgot': 'Забыли пароль?',
  'login.showPassword': 'Показать пароль',
  'login.hidePassword': 'Скрыть пароль',
  'login.submit': 'Войти',
  'login.submitting': 'Вход…',
  'login.failed': 'Не удалось войти',
  'login.noAccount': 'Ещё нет аккаунта?',
  'login.registerCta': 'Зарегистрировать бизнес',
  'login.footer': '© {year} Detailly · Независимое ПО для детейлинга',

  // ---- Landing: header -----------------------------------------------------
  'landing.nav.branchen': 'Направления',
  'landing.nav.ablauf': 'Как это работает',
  'landing.nav.funktionen': 'Возможности',
  'landing.nav.faq': 'Вопросы',
  'landing.nav.login': 'Войти',
  'landing.nav.trial': 'Попробовать бесплатно',

  // ---- Landing: hero + CTAs ------------------------------------------------
  'landing.hero.badge': 'ПО для мастерских: детейлинг, оклейка и PPF',
  'landing.hero.title1': 'Ваше ремесло — это точность.',
  'landing.hero.title2': 'Теперь и ваше ПО тоже.',
  'landing.hero.sub':
    'Detailly объединяет клиентов, автомобили, заказы, планшет, 3D-фиксацию повреждений и корректные счета в одной программе — с защитой данных, на любом устройстве. Конец бумажному хаосу.',
  'landing.hero.ctaPrimary': '14 дней бесплатно',
  'landing.hero.ctaSecondary': 'Смотреть возможности',
  'landing.hero.trailer': 'Без карты · Готово за минуты · Отмена помесячно',

  // ---- Landing: weitere CTAs -----------------------------------------------
  'landing.branchen.cta': 'Начать как {label}',
  'landing.branchen.completeCta': 'Начать как универсальный сервис',
  'landing.cta.primary': 'Начать бесплатно',
  'landing.cta.secondary': 'У меня уже есть аккаунт',
  'landing.footer.trial': 'Попробовать бесплатно',
  'landing.footer.login': 'Войти',
  'landing.footer.register': 'Регистрация',
};
