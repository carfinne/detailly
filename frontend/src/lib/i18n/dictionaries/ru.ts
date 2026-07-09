// ===========================================================================
// RU – WÖRTERBUCH (Partial<Dict>) · Vollparität mit DE
// ---------------------------------------------------------------------------
// Enthält ALLE Keys aus de.ts, muttersprachlich (RU) übersetzt. Bleibt technisch
// `Partial<Dict>`: sollte de.ts künftig neue Keys bekommen, fallen nur DIESE
// automatisch auf DE zurück (siehe ../provider, t() → de[key]) – nie ein leerer
// String oder der rohe Key.
//
// Platzhalter wie {year}/{label} bleiben unverändert (werden zur Laufzeit ersetzt).
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
  'nav.item.planboard': 'Планировщик',
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
    'Detailly объединяет клиентов, автомобили, заказы, планировщик, 3D-фиксацию повреждений и корректные счета в одной программе — с защитой данных, на любом устройстве. Конец бумажному хаосу.',
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

  // =========================================================================
  // Vollparität-Ergänzung: alle übrigen DE-Keys, muttersprachlich (RU).
  // =========================================================================

  // ---- Common (weitere) ----------------------------------------------------
  'common.toSubscription': 'К подписке и тарифу',

  // ---- Einstellungen: Kalkulation (€/qm) -----------------------------------
  'settings.kalk.title': 'Расчёт · €/м²',
  'settings.kalk.subtitle':
    'Базовые ставки для мгновенного 3D-расчёта. В расчёте любое значение можно изменить.',
  'settings.kalk.grouplabel': 'Цена за квадратный метр (без НДС)',
  'settings.kalk.folierung': 'Оклейка плёнкой',
  'settings.kalk.ppf': 'PPF / защита лака',
  'settings.kalk.aufbereitung': 'Детейлинг',
  'settings.kalk.help':
    'Эти ставки используются по умолчанию в 3D-модуле (площадь × размер автомобиля × €/м²). Пусто или 0 = внутреннее значение по умолчанию.',

  // ---- Tarif-Hinweise (Feature-Gating) -------------------------------------
  'settings.sevdesk.upgrade': 'Автоматическая передача в sevDesk доступна начиная с тарифа Basic.',
  'ordertime.upgrade': 'Учёт времени по заказам и затрат на оплату труда входит в тариф Pro.',

  // ---- Landing: Vertrauens-Leiste ------------------------------------------
  'landing.trust.dsgvo': 'Соответствие GDPR',
  'landing.trust.gobd': 'Счета в соответствии с GoBD',
  'landing.trust.madeInGermany': 'Сделано в Германии',
  'landing.trust.encrypted': 'Данные зашифрованы',
  'landing.trust.noInstall': 'Без установки',

  // ---- Landing: Problem ----------------------------------------------------
  'landing.problem.kicker': 'Знакомо?',
  'landing.problem.title': 'Мастерская работает — а бумажная волокита тормозит.',
  'landing.problem.sub':
    'Работа с автомобилем требует точности, а всё вокруг тонет в бумагах.',
  'landing.problem.p1': 'История автомобиля разбросана по папкам, запискам и в голове.',
  'landing.problem.p2': 'Счета залёживаются — и это стоит вам реальных денег.',
  'landing.problem.p3': 'Повреждения при приёмке потом почти невозможно доказать.',
  'landing.problem.p4': 'Пять разных инструментов, которые не связаны между собой.',
  'landing.problem.summaryPre': 'Detailly объединяет всё это в ',
  'landing.problem.summaryEm': 'одну',
  'landing.problem.summaryPost': ' систему — наглядно, быстро, на любом устройстве.',

  // ---- Landing: Branchen-Switcher ------------------------------------------
  'landing.branchen.kicker': 'Создано для вашего ремесла',
  'landing.branchen.title': 'Программа, которая говорит на языке вашего ремесла',
  'landing.branchen.sub':
    'При старте вы выбираете своё направление — Detailly подстраивает под него каталог услуг, расчёт и даже оформление. Попробуйте: выберите своё ремесло и посмотрите, как меняются цвета страницы.',
  'landing.branchen.selected': 'Выбрано',
  'landing.branchen.complete': 'Всё из одних рук?',
  'landing.branchen.aufbereitung.l1': 'Детейлинг салона и кузова',
  'landing.branchen.aufbereitung.l2': 'Полировка и керамическое покрытие',
  'landing.branchen.aufbereitung.l3': 'Проверки при возврате из лизинга',
  'landing.branchen.folierung.l1': 'Полная и частичная оклейка',
  'landing.branchen.folierung.l2': 'Смена цвета и дизайн',
  'landing.branchen.folierung.l3': 'Рекламное брендирование',
  'landing.branchen.ppf.l1': 'Защита передней части и всего кузова',
  'landing.branchen.ppf.l2': 'Пакеты защиты от сколов',
  'landing.branchen.ppf.l3': 'Точный раскрой',

  // ---- Landing: So funktioniert's ------------------------------------------
  'landing.ablauf.kicker': 'Всё очень просто',
  'landing.ablauf.title': 'Три шага к отлаженному процессу',
  'landing.ablauf.step1.title': 'Приёмка',
  'landing.ablauf.step1.desc':
    'Клиент, автомобиль и повреждения — за минуты, с 3D-отметками, фото и цифровой подписью.',
  'landing.ablauf.step2.title': 'Выполнение',
  'landing.ablauf.step2.desc':
    'Рассчитывайте услуги, планируйте записи в планировщике и держите ход работ под контролем.',
  'landing.ablauf.step3.title': 'Выставление счёта',
  'landing.ablauf.step3.desc':
    'Из заказа в один клик создаётся счёт в формате PDF (в соответствии с GoBD) — со сроками оплаты и напоминаниями.',

  // ---- Landing: Funktionen -------------------------------------------------
  'landing.funktionen.kicker': 'Все инструменты',
  'landing.funktionen.title': 'Всё, что нужно вашей мастерской',
  'landing.funktionen.sub':
    'Единый процесс — от приёмки автомобиля до оплаченного счёта.',
  'landing.funktionen.kunden.title': 'Клиенты и автомобили',
  'landing.funktionen.kunden.desc':
    'Данные клиентов, карточка и полная история по каждому автомобилю — всё под рукой.',
  'landing.funktionen.auftraege.title': 'Заказы и планировщик',
  'landing.funktionen.auftraege.desc':
    'От предложения до сдачи. Планирование недели с записями — всё как на ладони.',
  'landing.funktionen.rechnungen.title': 'Счета и документы',
  'landing.funktionen.rechnungen.desc':
    'Счета и предложения в PDF (в соответствии с §14 и GoBD), со сроками оплаты и напоминаниями.',
  'landing.funktionen.schaden3d.title': '3D-фиксация повреждений',
  'landing.funktionen.schaden3d.desc':
    'Отмечайте повреждения прямо на 3D-модели, фиксируйте фото и получайте цифровую подпись.',
  'landing.funktionen.kalkulation.title': 'Расчёт под каждое направление',
  'landing.funktionen.kalkulation.desc':
    'Каталоги услуг и логика цен для детейлинга, оклейки и PPF — под ваш профиль.',
  'landing.funktionen.dsgvo.title': 'GDPR и безопасность',
  'landing.funktionen.dsgvo.desc':
    'Конфиденциальные данные зашифрованы, строго разделены по мастерским, с экспортом и удалением в один клик.',
  'landing.funktionen.footnotePre': 'А ещё: молниеносный глобальный поиск (',
  'landing.funktionen.footnotePost': '), мобильная навигация и несколько сотрудников на мастерскую.',

  // ---- Landing: 3D-Schadenserfassung (Showcase) ----------------------------
  'landing.schaden.kicker': 'Изюминка',
  'landing.schaden.title': 'Зафиксируйте повреждения, пока они не стали спором',
  'landing.schaden.desc':
    'При приёмке вы отмечаете царапины, вмятины и сколы прямо на 3D-модели — с фото и цифровой подписью клиента. Если потом возникнут вопросы, у вас есть доказательства. Чёрным по белому.',
  'landing.schaden.point1': 'Отметки о повреждениях прямо на 3D-модели',
  'landing.schaden.point2': 'Фото к каждому повреждению — привязываются автоматически',
  'landing.schaden.point3': 'Цифровая подпись при приёмке и выдаче',
  'landing.schaden.cardHeader': 'Приёмка автомобиля · Фиксация повреждений',
  'landing.schaden.cardBadge': '2 повреждения',
  'landing.schaden.cardPhotos': '4 фото зафиксировано',
  'landing.schaden.cardSignature': 'Подпись получена',

  // ---- Landing: Wachstum ---------------------------------------------------
  'landing.wachstum.kicker': 'Масштабируемо',
  'landing.wachstum.title': 'Рост благодаря ясной картине',
  'landing.wachstum.sub':
    'Когда всё организовано и цифры под рукой, решения лучше — от одной мастерской до сети.',
  'landing.wachstum.echtzeit.title': 'Обзор в реальном времени',
  'landing.wachstum.echtzeit.desc':
    'Выручка, открытые заказы и записи — вживую на панели. Сразу видно, где всё идёт, а где затык.',
  'landing.wachstum.standorte.title': 'Несколько филиалов',
  'landing.wachstum.standorte.desc':
    'Управляйте филиалами в одном месте — чётко разделёнными, но под общим контролем. Расширяется вместе с вами.',
  'landing.wachstum.team.title': 'Команда, роли и права',
  'landing.wachstum.team.desc':
    'Приглашайте сотрудников и назначайте роли — каждый видит ровно то, что нужно. Всё под контролем и задокументировано.',
  'landing.wachstum.chartVolume': 'Объём заказов',
  'landing.wachstum.chartGrowing': 'растёт',
  'landing.wachstum.chartLocations': 'Филиалы',

  // ---- Landing: Zahlen (Count-up) ------------------------------------------
  'landing.zahlen.stat1.unit': 'мин.',
  'landing.zahlen.stat1.label': 'от приёмки до готового заказа',
  'landing.zahlen.stat2.unit': 'дней',
  'landing.zahlen.stat2.label': 'бесплатно — без банковской карты',
  'landing.zahlen.stat3.unit': '%',
  'landing.zahlen.stat3.label': 'соответствие GDPR и GoBD',
  'landing.zahlen.stat4.value': '5 → 1',
  'landing.zahlen.stat4.label': 'одна система вместо пяти разрозненных',

  // ---- Landing: Stimmen ----------------------------------------------------
  'landing.stimmen.kicker': 'Из практики',
  'landing.stimmen.title': 'Что говорят пилотные мастерские',
  'landing.stimmen.q1.text':
    'Наконец-то утром одним взглядом вижу, что сегодня происходит в цеху. С бумажным хаосом покончено.',
  'landing.stimmen.q1.who': 'Владелец · студия детейлинга',
  'landing.stimmen.q2.text':
    '3D-фиксация повреждений при приёмке уже дважды спасла нас от дорогих споров.',
  'landing.stimmen.q2.who': 'Директор · студия оклейки',
  'landing.stimmen.q3.text':
    'Из готового заказа за секунды получается счёт. Раньше на это уходил весь вечер.',
  'landing.stimmen.q3.who': 'Руководитель мастерской · студия PPF',

  // ---- Landing: Warum Detailly ---------------------------------------------
  'landing.warum.kicker': 'Почему Detailly',
  'landing.warum.title': 'ПО для мастерской, а не для автосалона.',
  'landing.warum.body':
    'Детейлеры, специалисты по оклейке и PPF-студии выполняют точную работу и заслуживают ПО, которое работает так же аккуратно. Большинство программ для автосервисов сделаны для крупных дилерских центров: перегруженные, сложные и дорогие. Detailly сознательно другой — простой, заточенный под ваши процессы и готовый к работе за минуты. Разработан самостоятельно, в Германии, с защитой данных с самого начала.',

  // ---- Landing: News-Teaser ------------------------------------------------
  'landing.news.kicker': 'Новости Detailly',
  'landing.news.title': 'Что нового',
  'landing.news.sub':
    'Обновления продукта и новости о Detailly. (Примеры записей — скоро появятся настоящие.)',
  'landing.news.all': 'Все новости',

  // ---- Landing: FAQ --------------------------------------------------------
  'landing.faq.kicker': 'Частые вопросы',
  'landing.faq.title': 'Что важно узнать перед стартом',
  'landing.faq.q1.q': 'Нужны ли технические знания или установка?',
  'landing.faq.q1.a':
    'Нет. Вы регистрируете свою мастерскую и сразу работаете в браузере — на компьютере, планшете или смартфоне. Ничего устанавливать и настраивать не нужно.',
  'landing.faq.q2.q': 'Я занимаюсь и детейлингом, И оклейкой — что выбрать?',
  'landing.faq.q2.a':
    'Тогда вы универсальный сервис: при регистрации просто выберите «Универсальный сервис» и получите все каталоги услуг и расчёты вместе.',
  'landing.faq.q3.q': 'Насколько безопасны данные моих клиентов?',
  'landing.faq.q3.a':
    'Конфиденциальные данные хранятся в зашифрованном виде и строго отделены от других мастерских. Данные клиентов можно в любой момент экспортировать или удалить — в полном соответствии с GDPR.',
  'landing.faq.q4.q': 'Что будет после 14 дней?',
  'landing.faq.q4.a':
    'Вы тестируете без банковской карты и без риска. После пробного периода выбираете тариф, который подходит вашей мастерской. Если пробный период заканчивается, никаких затрат не возникает.',
  'landing.faq.q5.q': 'Работает ли это на планшете в мастерской?',
  'landing.faq.q5.a':
    'Да. Detailly создан для любого устройства — от офисного ПК до планшета на приёмке. Интерфейс подстраивается автоматически.',
  'landing.faq.q6.q': 'Могу ли я забрать свои данные?',
  'landing.faq.q6.a':
    'В любой момент. Ваши данные принадлежат вам — экспорт в один клик, никого спрашивать не нужно.',

  // ---- Landing: Abschluss-CTA ----------------------------------------------
  'landing.cta.band': 'Полный вперёд',
  'landing.cta.title': 'Наведите порядок в мастерской — уже сегодня.',
  'landing.cta.sub':
    'Зарегистрируйте мастерскую за несколько минут и тестируйте Detailly 14 дней бесплатно. Без карты, без риска.',

  // ---- Landing: Footer (weitere) -------------------------------------------
  'landing.footer.tagline':
    'ПО для мастерских детейлинга, оклейки и PPF. Разработано самостоятельно в Германии.',
  'landing.footer.discover': 'Обзор',
  'landing.footer.product': 'Продукт',
  'landing.footer.account': 'Аккаунт и правовая информация',
  'landing.footer.news': 'Новости',
  'landing.footer.masterclass': 'Мастер-класс',
  'landing.footer.gruendung': 'Открытие бизнеса',
  'landing.footer.features': 'Функции',
  'landing.footer.branchen': 'Для вашего ремесла',
  'landing.footer.faq': 'Частые вопросы',
  'landing.footer.impressum': 'Выходные данные',
  'landing.footer.datenschutz': 'Конфиденциальность',
  'landing.footer.copyright': '© {year} Detailly · Все права защищены',

  // ---- Kundenformular ------------------------------------------------------
  'kunden.form.leitwegId.label': 'Leitweg-ID',
  'kunden.form.leitwegId.help':
    'Только для счетов государственным органам/публичным заказчикам (управляет маршрутизацией B2G).',
};
