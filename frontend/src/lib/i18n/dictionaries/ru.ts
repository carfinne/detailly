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

  // ===========================================================================
  // КЛИЕНТЫ (маршрут "/kunden")
  // ===========================================================================
  'kunden.title': 'Клиенты',
  'kunden.subtitle': 'Частные и корпоративные клиенты',
  'kunden.csvImport': 'Импорт CSV',
  'kunden.new': 'Новый клиент',
  'kunden.searchPlaceholder': 'Поиск по имени, эл. почте, телефону…',

  // ---- Пустое состояние ----------------------------------------------------
  'kunden.empty.none': 'Клиентов пока нет.',
  'kunden.empty.filtered': 'Клиенты не найдены.',
  'kunden.empty.cta': 'Создать первого клиента',

  // ---- Столбцы таблицы -----------------------------------------------------
  'kunden.col.name': 'Имя',
  'kunden.col.typ': 'Тип',
  'kunden.col.email': 'Эл. почта',
  'kunden.col.telefon': 'Телефон',
  'kunden.col.ort': 'Город',

  // ---- Тип клиента ---------------------------------------------------------
  'kunden.type.business': 'Компания',
  'kunden.type.private': 'Частное лицо',

  // ---- Меню действий -------------------------------------------------------
  'kunden.actionsFor': 'Действия для {name}',
  'kunden.action.open': 'Открыть',
  'kunden.action.newOrder': 'Новый заказ',
  'kunden.action.edit': 'Изменить',

  // ---- Уведомление / ошибка / подтверждение удаления -----------------------
  'kunden.toast.deleted': '{name} удалён',
  'kunden.error.delete': 'Не удалось удалить',
  'kunden.delete.title': 'Удалить клиента',
  'kunden.delete.msg':
    'Действительно удалить {name}? Клиент будет деактивирован и удалён из списка. Уже созданные заказы и счета сохранятся.',

  // ===========================================================================
  // FAHRZEUGE (маршрут "/fahrzeuge")
  // ===========================================================================
  'fahrzeuge.title': 'Автомобили',
  'fahrzeuge.subtitle': 'Автопарк с карточками автомобилей',
  'fahrzeuge.new': 'Новый автомобиль',
  'fahrzeuge.searchPlaceholder': 'Поиск по госномеру, марке, модели или владельцу…',

  // ---- Пустое состояние ----------------------------------------------------
  'fahrzeuge.empty.none': 'Автомобилей пока нет.',
  'fahrzeuge.empty.filtered': 'Автомобили не найдены.',
  'fahrzeuge.empty.cta': 'Создать первый автомобиль',

  // ---- Столбцы таблицы -----------------------------------------------------
  'fahrzeuge.col.fahrzeug': 'Автомобиль',
  'fahrzeuge.col.kennzeichen': 'Госномер',
  'fahrzeuge.col.halter': 'Владелец',
  'fahrzeuge.col.baujahr': 'Год выпуска',

  // ---- Меню действий -------------------------------------------------------
  'fahrzeuge.actionsFor': 'Действия для {name}',
  'fahrzeuge.action.open': 'Открыть карточку автомобиля',
  'fahrzeuge.action.newOrder': 'Новый заказ',

  // ---- Форма (новый автомобиль) --------------------------------------------
  'fahrzeuge.form.halter': 'Владелец',
  'fahrzeuge.form.selectPlaceholder': '– выбрать –',
  'fahrzeuge.form.marke': 'Марка',
  'fahrzeuge.form.modell': 'Модель',
  'fahrzeuge.form.variante': 'Модификация',
  'fahrzeuge.form.baujahr': 'Год выпуска',
  'fahrzeuge.form.farbe': 'Цвет',
  'fahrzeuge.form.kennzeichen': 'Госномер',
  'fahrzeuge.form.kraftstoff': 'Топливо',
  'fahrzeuge.form.flaeche': 'Площадь (кв. м)',

  // ---- Виды топлива --------------------------------------------------------
  'fahrzeuge.fuel.petrol': 'Бензин',
  'fahrzeuge.fuel.diesel': 'Дизель',
  'fahrzeuge.fuel.electric': 'Электро',
  'fahrzeuge.fuel.hybrid': 'Гибрид',
  'fahrzeuge.saving': 'Сохранение…',

  // ---- Уведомление / ошибка / подтверждение удаления -----------------------
  'fahrzeuge.toast.deleted': '{name} удалён',
  'fahrzeuge.error.delete': 'Не удалось удалить',
  'fahrzeuge.error.save': 'Не удалось сохранить',
  'fahrzeuge.delete.title': 'Удалить автомобиль',
  'fahrzeuge.delete.msg':
    'Действительно удалить {name}? Автомобиль будет удалён из списка. Уже созданные заказы и записи сохранятся.',

  // ===========================================================================
  // ДОКУМЕНТЫ / СЧЕТА (маршрут "/rechnungen")
  // ===========================================================================
  'rechnungen.title': 'Документы',
  'rechnungen.subtitle': 'Предложения и счета',
  'rechnungen.searchPlaceholder': 'Поиск по номеру или клиенту…',
  'rechnungen.tab.alle': 'Все',

  // ---- Пустые состояния ----------------------------------------------------
  'rechnungen.empty.none': 'Пока нет документов. Документы создаются из заказов.',
  'rechnungen.empty.filtered': 'Нет документов в этом представлении.',

  // ---- Столбцы таблицы -----------------------------------------------------
  'rechnungen.col.nummer': 'Номер',
  'rechnungen.col.art': 'Тип',
  'rechnungen.col.kunde': 'Клиент',
  'rechnungen.col.datum': 'Дата',
  'rechnungen.col.status': 'Статус',
  'rechnungen.col.brutto': 'Брутто',

  // ---- Тип / статус --------------------------------------------------------
  'rechnungen.kind.angebot': 'Предложение',
  'rechnungen.kind.rechnung': 'Счёт',
  'rechnungen.status.entwurf': 'Черновик',
  'rechnungen.status.offen': 'Открыт',
  'rechnungen.status.bezahlt': 'Оплачен',
  'rechnungen.status.storniert': 'Аннулирован',

  // ---- Сроки / бейджи отправки ---------------------------------------------
  'rechnungen.overdue': 'Просрочено на {tage} дн.',
  'rechnungen.dueIn': 'срок через {tage} дн.',
  'rechnungen.sent': 'Отправлено',
  'rechnungen.sentOn': 'Отправлено {datum}',

  // ---- Уровни напоминаний --------------------------------------------------
  'rechnungen.mahn.stufe1': 'Напоминание об оплате',
  'rechnungen.mahn.stufe2': '1-е напоминание',
  'rechnungen.mahn.stufe3': '2-е напоминание',
  'rechnungen.mahn.generic': 'Уровень напоминания {stufe}',

  // ---- Действия в строке ---------------------------------------------------
  'rechnungen.action.pdf': 'Скачать PDF',
  'rechnungen.action.xrechnung': 'XRechnung (XML)',
  'rechnungen.action.send': 'Отправить по эл. почте',
  'rechnungen.action.resend': 'Отправить повторно по эл. почте',
  'rechnungen.action.markPaid': 'Отметить оплаченным',
  'rechnungen.action.copyLink': 'Копировать ссылку для скачивания',
  'rechnungen.action.mahnen': 'Напомнить',
  'rechnungen.action.storno': 'Аннулировать',
  'rechnungen.action.setStatus': 'Установить «{status}»',
  'rechnungen.actionsFor': 'Действия для {nummer}',
  'rechnungen.linkPrompt': 'Копировать ссылку для скачивания:',

  // ---- Подтверждение аннулирования -----------------------------------------
  'rechnungen.storno.title': 'Аннулировать документ',
  'rechnungen.storno.msg':
    'Действительно аннулировать документ {nummer}? Аннулированный документ нельзя снова активировать.',
  'rechnungen.storno.msgPaid':
    'Действительно аннулировать оплаченный счёт {nummer}? Аннулирование нельзя отменить — кредит-ноту или возврат, возможно, придётся оформить отдельно.',

  // ---- Уведомления (toast) -------------------------------------------------
  'rechnungen.toast.statusUpdated': 'Статус обновлён',
  'rechnungen.toast.storniert': 'Документ аннулирован',
  'rechnungen.toast.paid': 'Отмечено как оплачено',
  'rechnungen.toast.sent': 'Документ отправлен по эл. почте',
  'rechnungen.toast.linkCopied': 'Ссылка для скачивания скопирована',
  'rechnungen.toast.mahnSent': 'Напоминание отправлено',

  // ---- Сообщения об ошибках ------------------------------------------------
  'rechnungen.error.statusChange': 'Не удалось изменить статус',
  'rechnungen.error.pdf': 'Не удалось загрузить PDF',
  'rechnungen.error.xrechnung': 'Не удалось создать XRechnung',
  'rechnungen.error.paid': 'Не удалось отметить как оплачено',
  'rechnungen.error.send': 'Не удалось отправить по эл. почте',
  'rechnungen.error.link': 'Не удалось создать ссылку',
  'rechnungen.error.mahn': 'Не удалось отправить напоминание',

  // ===========================================================================
  // ЗАКАЗЫ (маршрут "/auftraege")
  // ===========================================================================
  'auftraege.title': 'Заказы',
  'auftraege.subtitle': 'Центральная единица со статусным процессом и калькуляцией',
  'auftraege.new': 'Новый заказ',
  'auftraege.searchPlaceholder': 'Поиск по номеру или клиенту…',
  'auftraege.tab.alle': 'Все',

  // ---- Пустые состояния ----------------------------------------------------
  'auftraege.empty.none': 'Пока нет заказов.',
  'auftraege.empty.filtered': 'Нет заказов в этом представлении.',
  'auftraege.empty.cta': 'Создать первый заказ',

  // ---- Столбцы таблицы -----------------------------------------------------
  'auftraege.col.nummer': 'Номер',
  'auftraege.col.kunde': 'Клиент',
  'auftraege.col.leistung': 'Услуга',
  'auftraege.col.status': 'Статус',
  'auftraege.col.gesamt': 'Итого',

  // ---- Действия в строке ---------------------------------------------------
  'auftraege.actionsFor': 'Действия для заказа {nummer}',
  'auftraege.action.open': 'Открыть',

  // ---- Статус --------------------------------------------------------------
  'auftraege.status.angefragt': 'Запрошен',
  'auftraege.status.kalkuliert': 'Рассчитан',
  'auftraege.status.bestaetigt': 'Подтверждён',
  'auftraege.status.in_arbeit': 'В работе',
  'auftraege.status.qualitaetskontrolle': 'Контроль качества',
  'auftraege.status.fertig': 'Готов',
  'auftraege.status.abgerechnet': 'Выставлен счёт',
  'auftraege.status.storniert': 'Отменён',

  // ---- Вид услуги ----------------------------------------------------------
  'auftraege.service.aufbereitung': 'Детейлинг',
  'auftraege.service.folierung': 'Оклейка плёнкой',
  'auftraege.service.ppf': 'PPF',
  'auftraege.service.sonstiges': 'Прочее',

  // ---- Форма (новый заказ) -------------------------------------------------
  'auftraege.form.kunde': 'Клиент',
  'auftraege.form.selectPlaceholder': '– выбрать –',
  'auftraege.form.fahrzeug': 'Автомобиль',
  'auftraege.form.optionalPlaceholder': '– необязательно –',
  'auftraege.form.leistungsart': 'Вид услуги',
  'auftraege.form.materialkosten': 'Стоимость материалов (нетто)',
  'auftraege.form.positionen': 'Позиции',
  'auftraege.form.addPosition': '+ Позиция',
  'auftraege.form.beschreibung': 'Описание',
  'auftraege.form.fromService': 'взять из услуги…',
  'auftraege.form.menge': 'Количество',
  'auftraege.form.einzelpreis': 'Цена за единицу',
  'auftraege.form.netto': 'Нетто',
  'auftraege.form.mwst': 'НДС (19%)',
  'auftraege.saving': 'Сохранение…',
  'auftraege.submit': 'Создать заказ',

  // ---- Уведомления / ошибки ------------------------------------------------
  'auftraege.toast.deleted': 'Заказ {nummer} удалён',
  'auftraege.error.delete': 'Не удалось удалить',
  'auftraege.error.save': 'Не удалось сохранить',

  // ---- Подтверждение удаления ----------------------------------------------
  'auftraege.delete.title': 'Удалить заказ',
  'auftraege.delete.msg':
    'Действительно удалить заказ {nummer}? Это действие нельзя отменить.',

  // ===========================================================================
  // РАСЧЁТ (Route "/kalkulation")
  // ===========================================================================
  'kalkulation.title': 'Расчёт',
  'kalkulation.subtitle':
    'Выберите детали или услуги – цена рассчитывается автоматически. Каждую позицию можно изменить.',
  'kalkulation.diagram.aria': 'Вид автомобиля сверху: выберите детали',

  // ---- Подсказка каталога --------------------------------------------------
  'kalkulation.katalog.prefix': 'Каталог:',
  'kalkulation.katalog.suffix':
    '– другие каталоги через Настройки → тип бизнеса «Комплексный сервис».',

  // ---- Параметры -----------------------------------------------------------
  'kalkulation.section.fahrzeugMaterial': 'Автомобиль и материал',
  'kalkulation.field.groesse': 'Размер автомобиля',
  'kalkulation.field.schnellauswahl': 'Быстрый выбор',
  'kalkulation.clearSelection': 'Очистить выбор',
  'kalkulation.section.auswahlSubtitle': 'Нажмите, чтобы добавить – на схеме или в списке.',

  // ---- Керамическое покрытие -----------------------------------------------
  'kalkulation.keramik.add': 'Добавить керамическое покрытие',
  'kalkulation.keramik.basis': 'Базовая цена (вкл. 1 слой)',
  'kalkulation.keramik.weitereSchichten': 'Дополнительные слои',
  'kalkulation.keramik.none': 'нет',
  'kalkulation.keramik.proSchicht': 'Цена за дополнительный слой',
  'kalkulation.keramik.layerSingular': 'слой',
  'kalkulation.keramik.layerPlural': 'слоя',

  // ---- Итоговая сумма ------------------------------------------------------
  'kalkulation.positionCount': 'Позиций: {count}',
  'kalkulation.empty': 'Пока ничего не выбрано – нажмите детали на схеме или в списке.',
  'kalkulation.priceAria': 'Цена за {label}',
  'kalkulation.netto': 'Нетто',
  'kalkulation.mwst': 'НДС (19 %)',
  'kalkulation.gesamt': 'Итого',
  'kalkulation.copyButton': 'Скопировать сводку',
  'kalkulation.hint.base':
    'Ориентировочные цены на основе размера автомобиля{material} – каждую позицию можно изменить напрямую.',
  'kalkulation.hint.materialSuffix': ' и класса материала',
  'kalkulation.toast.copied': 'Сводка скопирована',
  'kalkulation.summaryHeadline': 'Расчёт {titel} – {rahmen}',

  // ===========================================================================
  // БУХГАЛТЕРИЯ (Route "/buchhaltung")
  // ===========================================================================
  'buchhaltung.title': 'Бухгалтерия',
  'buchhaltung.subtitle':
    'Экспорт данных для бухгалтера – счета (CSV/DATEV) и рабочее время для расчёта зарплаты.',

  // ---- Период --------------------------------------------------------------
  'buchhaltung.zeitraum.title': 'Период',
  'buchhaltung.zeitraum.subtitle': 'Действует для обоих экспортов (счета и рабочее время).',
  'buchhaltung.von': 'С',
  'buchhaltung.bis': 'По',
  'buchhaltung.zeitraum.help':
    'Счета: выставленные (открытые и оплаченные) за период · Рабочее время: все записи за период.',

  // ---- Формат --------------------------------------------------------------
  'buchhaltung.format.title': 'Формат',
  'buchhaltung.format.subtitle': 'Универсальный CSV или пакет проводок DATEV.',
  'buchhaltung.format.csv.title': 'CSV (универсальный)',
  'buchhaltung.format.csv.desc':
    'С разделителем «точка с запятой», для любого бухгалтера – даже без DATEV. Номер документа, дата, суммы, НДС, статус.',
  'buchhaltung.format.datev.title': 'Пакет проводок DATEV',
  'buchhaltung.format.datev.desc':
    'Формат EXTF для прямого импорта в DATEV. Требуется номер консультанта/клиента (Настройки).',

  // ---- Экспорт -------------------------------------------------------------
  'buchhaltung.export': 'Экспортировать',
  'buchhaltung.exporting': 'Экспорт…',
  'buchhaltung.datevStammdaten': 'Настроить основные данные DATEV →',
  'buchhaltung.datevHinweis':
    'Примечание: экспорт DATEV соответствует общепринятой спецификации EXTF. Перед первым реальным импортом проверьте его с бухгалтером или бесплатной программой проверки DATEV.',

  // ---- Рабочее время -------------------------------------------------------
  'buchhaltung.zeiten.title': 'Рабочее время для расчёта зарплаты',
  'buchhaltung.zeiten.subtitle':
    'Учтённое рабочее время по заказам на каждого сотрудника за период (с затратами на оплату труда) в CSV – для расчёта зарплаты.',
  'buchhaltung.zeiten.export': 'Экспортировать рабочее время',
  'buchhaltung.zeiten.help':
    'Детальные строки по каждой записи + итог по сотруднику. Затраты на оплату труда основаны на текущей почасовой ставке. Содержит данные о зарплате – только для руководства.',

  // ---- Уведомления / Ошибки ------------------------------------------------
  'buchhaltung.toast.exportStarted': 'Экспорт начат',
  'buchhaltung.error.export': 'Не удалось выполнить экспорт',

  // ===========================================================================
  // НАПОМИНАНИЯ ОБ ОПЛАТЕ (Route "/mahnungen")
  // ===========================================================================
  'mahnungen.title': 'Напоминания об оплате',
  'mahnungen.subtitle': 'Следите за просроченными счетами и отправляйте напоминания',
  'mahnungen.alleMahnen': 'Напомнить всем',
  'mahnungen.mahnt': 'Отправка …',
  'mahnungen.empty': 'Нет просроченных счетов. Все открытые счета в пределах срока.',

  // ---- Уровень напоминания (следующий к отправке) --------------------------
  'mahnungen.stufe.0': 'напоминание ещё не отправлено',
  'mahnungen.stufe.1': 'Напоминание',
  'mahnungen.stufe.2': '1-е напоминание об оплате',
  'mahnungen.stufe.3': '2-е напоминание об оплате',

  // ---- Показатели ----------------------------------------------------------
  'mahnungen.stat.ueberfaellig': 'Просроченные счета',
  'mahnungen.stat.offenerBetrag': 'Открытая сумма',
  'mahnungen.stat.summeBrutto': 'Сумма брутто',
  'mahnungen.notYetReminded': 'Ещё не напомнено',
  'mahnungen.stat.ohneMahnungHintOne': 'счёт без напоминания',
  'mahnungen.stat.ohneMahnungHintMany': 'счетов без напоминания',

  // ---- Таблица -------------------------------------------------------------
  'mahnungen.col.nummer': 'Номер',
  'mahnungen.col.kunde': 'Клиент',
  'mahnungen.col.faelligSeit': 'Просрочен с',
  'mahnungen.col.mahnstufe': 'Уровень напоминания',
  'mahnungen.col.brutto': 'Брутто',
  'mahnungen.tag': 'день',
  'mahnungen.tage': 'дн.',
  'mahnungen.faelligAm': 'срок {datum}',
  'mahnungen.erneutMahnen': 'Напомнить снова',
  'mahnungen.jetztMahnen': 'Напомнить сейчас',

  // ---- Подтверждения -------------------------------------------------------
  'mahnungen.confirmOne.title': 'Отправить напоминание',
  'mahnungen.confirmOne.confirm': 'Отправить напоминание',
  'mahnungen.confirmOne.msg':
    'Отправить напоминание по счёту {nummer} клиенту {kunde}? Клиент получит {stufe} по эл. почте, уровень напоминания будет повышен.',
  'mahnungen.confirmBulk.msg':
    'Напомнить сейчас по всем {count} просроченным счетам? Каждому затронутому клиенту будет отправлено напоминание по эл. почте, а уровень напоминания повышен.',

  // ---- Уведомления / Ошибки ------------------------------------------------
  'mahnungen.error.load': 'Не удалось загрузить список напоминаний',
  'mahnungen.error.mahn': 'Не удалось отправить напоминание',
  'mahnungen.toast.sentOne': 'Напоминание отправлено клиенту {kunde}.',
  'mahnungen.toast.sentBulkOne': 'Отправлено напоминаний: {count}.',
  'mahnungen.toast.sentBulkMany': 'Отправлено напоминаний: {count}.',
  'mahnungen.error.bulkOne': 'Не удалось отправить напоминаний: {count}.',
  'mahnungen.error.bulkMany': 'Не удалось отправить напоминаний: {count}.',

  // ===========================================================================
  // ПРИЁМКА АВТОМОБИЛЯ (Route "/fahrzeugannahme")
  // ===========================================================================
  'fahrzeugannahme.title': 'Приёмка автомобиля',
  'fahrzeugannahme.subtitle': 'Задокументируйте состояние и отметьте повреждения на схеме',
  'fahrzeugannahme.save': 'Сохранить приёмку',

  // ---- Переход к 3D-фиксации повреждений ------------------------------------
  'fahrzeugannahme.crosslink.title': 'Фото, подпись и перенос прежних повреждений?',
  'fahrzeugannahme.crosslink.subtitle': 'Перейти к интерактивной 3D-фиксации повреждений.',

  // ---- Форма приёмки -------------------------------------------------------
  'fahrzeugannahme.card.annahme': 'Приёмка',
  'fahrzeugannahme.label.kunde': 'Клиент',
  'fahrzeugannahme.label.fahrzeug': 'Автомобиль',
  'fahrzeugannahme.select.placeholder': '– выбрать –',
  'fahrzeugannahme.label.km': 'Пробег',
  'fahrzeugannahme.km.placeholder': 'напр. 84500',
  'fahrzeugannahme.label.tankstand': 'Уровень топлива: {wert} %',
  'fahrzeugannahme.label.notiz': 'Общая заметка',
  'fahrzeugannahme.notiz.placeholder': 'Особенности, договорённости …',

  // ---- Схема повреждений ---------------------------------------------------
  'fahrzeugannahme.card.diagramm.title': 'Схема повреждений',
  'fahrzeugannahme.card.diagramm.subtitle': 'Нажмите на силуэт, чтобы отметить повреждение',
  'fahrzeugannahme.erfassteSchaeden': 'Зафиксированные повреждения ({count})',
  'fahrzeugannahme.empty.schaeden': 'Повреждения ещё не отмечены. Нажмите на схему.',
  'fahrzeugannahme.action.bearbeiten': 'Изменить',
  'fahrzeugannahme.action.entfernen': 'Удалить',

  // ---- Последние приёмки ---------------------------------------------------
  'fahrzeugannahme.card.letzteAnnahmen.title': 'Последние приёмки',
  'fahrzeugannahme.card.letzteAnnahmen.subtitle': 'Недавно сохранённые приёмки автомобилей — нажмите, чтобы открыть',
  'fahrzeugannahme.empty.annahmen': 'Пока нет приёмок.',

  // ---- Редактор повреждения ------------------------------------------------
  'fahrzeugannahme.modal.title': 'Изменить повреждение',
  'fahrzeugannahme.modal.schadensart': 'Тип повреждения',
  'fahrzeugannahme.modal.schweregrad': 'Степень тяжести',
  'fahrzeugannahme.modal.notiz': 'Заметка',
  'fahrzeugannahme.modal.notiz.placeholder': 'Описание повреждения …',
  'fahrzeugannahme.modal.entfernen': 'Удалить повреждение',
  'fahrzeugannahme.modal.fertig': 'Готово',

  // ---- Тип повреждения (перечисление) --------------------------------------
  'fahrzeugannahme.art.kratzer': 'Царапина',
  'fahrzeugannahme.art.delle': 'Вмятина',
  'fahrzeugannahme.art.steinschlag': 'Скол от камня',
  'fahrzeugannahme.art.lackschaden': 'Повреждение ЛКП',
  'fahrzeugannahme.art.rost': 'Ржавчина',
  'fahrzeugannahme.art.sonstiges': 'Прочее',

  // ---- Степень тяжести (перечисление) --------------------------------------
  'fahrzeugannahme.grad.leicht': 'Лёгкая',
  'fahrzeugannahme.grad.mittel': 'Средняя',
  'fahrzeugannahme.grad.schwer': 'Тяжёлая',

  // ---- Статус осмотра (перечисление) ---------------------------------------
  'fahrzeugannahme.status.entwurf': 'Черновик',
  'fahrzeugannahme.status.abgeschlossen': 'Завершено',
  'fahrzeugannahme.status.freigegeben': 'Согласовано',

  // ---- Уведомления / Ошибки ------------------------------------------------
  'fahrzeugannahme.error.kundePflicht': 'Пожалуйста, выберите клиента.',
  'fahrzeugannahme.error.anlegen': 'Не удалось создать приёмку.',
  'fahrzeugannahme.toast.gespeichert': 'Приёмка сохранена.',

  // ===========================================================================
  // УСЛУГИ (Route "/leistungen")
  // ===========================================================================
  'leistungen.title': 'Услуги и пакеты',
  'leistungen.subtitle': 'Каталог для расчёта заказов',
  'leistungen.new': 'Новая услуга',
  'leistungen.showInactive': 'Показать неактивные услуги',

  // ---- Пустые состояния ----------------------------------------------------
  'leistungen.empty.inactive': 'Нет доступных услуг.',
  'leistungen.empty.none': 'В каталоге пока нет услуг.',
  'leistungen.empty.action': 'Создать первую услугу',

  // ---- Таблица -------------------------------------------------------------
  'leistungen.col.name': 'Название',
  'leistungen.col.kategorie': 'Категория',
  'leistungen.col.einheit': 'Единица',
  'leistungen.col.basispreis': 'Базовая цена',
  'leistungen.inaktiv': 'Неактивно',

  // ---- Меню действий -------------------------------------------------------
  'leistungen.actionsFor': 'Действия для {name}',
  'leistungen.action.bearbeiten': 'Изменить',
  'leistungen.action.reaktivieren': 'Восстановить',
  'leistungen.action.archivieren': 'Архивировать',

  // ---- Форма ---------------------------------------------------------------
  'leistungen.modal.editTitle': 'Изменить услугу',
  'leistungen.modal.newTitle': 'Новая услуга',
  'leistungen.field.name': 'Название',
  'leistungen.field.beschreibung': 'Описание',
  'leistungen.field.kategorie': 'Категория',
  'leistungen.field.einheit': 'Единица',
  'leistungen.field.basispreis': 'Базовая цена',
  'leistungen.saving': 'Сохранение…',

  // ---- Категория (перечисление) --------------------------------------------
  'leistungen.kat.aufbereitung': 'Детейлинг',
  'leistungen.kat.folierung': 'Оклейка плёнкой',
  'leistungen.kat.ppf': 'PPF',
  'leistungen.kat.sonstiges': 'Прочее',

  // ---- Единица (перечисление) ----------------------------------------------
  'leistungen.einheit.pauschal': 'Фикс. цена',
  'leistungen.einheit.qm': 'за м²',
  'leistungen.einheit.stunde': 'за час',

  // ---- Ошибки --------------------------------------------------------------
  'leistungen.error.aktion': 'Не удалось выполнить действие',
  'leistungen.error.save': 'Не удалось сохранить',

  // ===========================================================================
  // ПОДПИСКА И ТАРИФ (Route "/abo")
  // ===========================================================================
  'abo.title': 'Подписка и тариф',
  'abo.subtitle': 'Выбор, оформление и управление тарифом',

  // ---- Уведомления / Ошибки ------------------------------------------------
  'abo.toast.success': 'Спасибо! Ваша подписка активируется.',
  'abo.toast.cancel': 'Операция отменена — списаний не было.',
  'abo.error.load': 'Не удалось загрузить',
  'abo.error.checkout': 'Не удалось оформить оплату',
  'abo.error.portal': 'Не удалось открыть портал',

  // ---- Текущее состояние ---------------------------------------------------
  'abo.card.title': 'Ваша подписка',
  'abo.card.subtitle': 'Текущий статус вашего бизнеса',
  'abo.planFallback.trial': 'Пробный период',
  'abo.planFallback.none': 'Нет тарифа',
  'abo.noAbo': 'Подписка не оформлена',
  'abo.remainingDayOne': 'осталось {count} дн.',
  'abo.remainingDayMany': 'осталось {count} дн.',
  'abo.periodUntil': 'Срок действия до {datum}',
  'abo.portalOpening': 'Открываю…',
  'abo.manage': 'Управлять подпиской',
  'abo.ownerOnly': 'Только владелец бизнеса может оформить или изменить подписку.',

  // ---- Переключатель периода оплаты ----------------------------------------
  'abo.interval.month': 'Ежемесячно',
  'abo.interval.year': 'Ежегодно',
  'abo.interval.yearBonus': '2 месяца бесплатно',

  // ---- Карточки тарифов ----------------------------------------------------
  'abo.current': 'Текущий',
  'abo.perYear': '/ год',
  'abo.equivMonth': 'что равно {preis} / месяц',
  'abo.perMonth': '/ месяц',
  'abo.currentPlanBtn': 'Текущий тариф',
  'abo.toStripe': 'Перейти в Stripe…',
  'abo.soon': 'Скоро доступно',
  'abo.switch': 'Сменить',
  'abo.book': 'Оформить',
  'abo.notBookableTitle': 'Этот период оплаты пока недоступен для данного тарифа.',
  'abo.stripeNote':
    'Оплата проходит безопасно через Stripe. Вы будете перенаправлены на страницу оплаты Stripe; Detailly не хранит данные карт. Отменить подписку и изменить способ оплаты можно в любой момент через «Управлять подпиской».',

  // ---- Модули (коды функций → название) ------------------------------------
  'abo.modul.kunden': 'Клиенты',
  'abo.modul.fahrzeuge': 'Автомобили',
  'abo.modul.auftraege': 'Заказы',
  'abo.modul.termine': 'Записи',
  'abo.modul.rechnungen': 'Счета',
  'abo.modul.shop': 'Магазин и склад',
  'abo.modul.mitarbeiter': 'Сотрудники',
  'abo.modul.standorte': 'Точки',
  'abo.modul.audit': 'Журнал аудита',
  'abo.modul.inspektion': '3D-фиксация повреждений',
  'abo.modul.auswertungen': 'Отчёты',
  'abo.modul.mahnwesen': 'Напоминания об оплате',
  'abo.modul.export': 'Экспорт в бухгалтерию',
  'abo.modul.wirtschaftlichkeit': 'Рентабельность',
  'abo.modul.zeiterfassung': 'Учёт времени',

  // ---- Уровень доступа (перечисление) --------------------------------------
  'abo.access.full': 'Полный доступ',
  'abo.access.warn': 'Доступ с предупреждением',
  'abo.access.blocked': 'Заблокировано',

  // ---- Статус подписки (перечисление) --------------------------------------
  'abo.status.trial': 'Пробный период',
  'abo.status.active': 'Активна',
  'abo.status.past_due': 'Ожидается оплата',
  'abo.status.canceled': 'Отменена',
  'abo.status.suspended': 'Приостановлена',

  // ===========================================================================
  // Планировщик (календарь записей)
  // ===========================================================================
  'plantafel.title': 'Планировщик',
  'plantafel.subtitle': 'Планирование записей — день, неделя или месяц. Перетащите, чтобы переместить.',
  'plantafel.new': 'Новая запись',
  'plantafel.today': 'Сегодня',
  'plantafel.next': 'Вперёд',
  'plantafel.view.tag': 'День',
  'plantafel.view.woche': 'Неделя',
  'plantafel.view.monat': 'Месяц',
  'plantafel.edit': 'Редактировать запись',
  'plantafel.form.titel': 'Название',
  'plantafel.form.start': 'Начало',
  'plantafel.form.ende': 'Окончание',
  'plantafel.form.kunde': 'Клиент',
  'plantafel.form.fahrzeug': 'Автомобиль',
  'plantafel.form.optional': '— не обязательно —',
  'plantafel.form.status': 'Статус',
  'plantafel.status.geplant': 'Запланирована',
  'plantafel.status.bestaetigt': 'Подтверждена',
  'plantafel.status.laeuft': 'В процессе',
  'plantafel.status.abgeschlossen': 'Завершена',
  'plantafel.status.abgesagt': 'Отменена',
  'plantafel.link.customer': 'К клиенту →',
  'plantafel.link.vehicle': 'К автомобилю →',
  'plantafel.link.order': 'К заказу →',
  'plantafel.saving': 'Сохранение…',
  'plantafel.delete.title': 'Удалить запись',
  'plantafel.delete.msg': 'Действительно удалить эту запись? Отменить это действие нельзя.',
  'plantafel.weekday.mo': 'Пн',
  'plantafel.weekday.di': 'Вт',
  'plantafel.weekday.mi': 'Ср',
  'plantafel.weekday.do': 'Чт',
  'plantafel.weekday.fr': 'Пт',
  'plantafel.weekday.sa': 'Сб',
  'plantafel.weekday.so': 'Вс',
  'plantafel.more': '+{count} ещё',
  'plantafel.error.load': 'Ошибка загрузки',
  'plantafel.error.save': 'Не удалось сохранить',
  'plantafel.error.delete': 'Не удалось удалить',
  'plantafel.error.move': 'Не удалось переместить',

  // ===========================================================================
  // Филиалы (управление филиалами)
  // ===========================================================================
  'standorte.title': 'Филиалы',
  'standorte.subtitle': 'Управление филиалами и их сравнение',
  'standorte.new': '+ Филиал',
  'standorte.auswertung.title': 'Сводка по всем филиалам',
  'standorte.auswertung.subtitle': 'В рамках организации',
  'standorte.auswertung.empty': 'Данных для анализа пока нет.',
  'standorte.col.standort': 'Филиал',
  'standorte.col.umsatz': 'Выручка',
  'standorte.col.offeneAuftraege': 'Открытые заказы',
  'standorte.col.termine': 'Записи',
  'standorte.col.name': 'Название',
  'standorte.col.adresse': 'Адрес',
  'standorte.col.telefon': 'Телефон',
  'standorte.col.status': 'Статус',
  'standorte.listTitle': 'Филиалы ({count})',
  'standorte.empty': 'Филиалы ещё не созданы.',
  'standorte.emptyCta': 'Создать первый филиал',
  'standorte.active': 'Активен',
  'standorte.inactive': 'Неактивен',
  'standorte.actionsFor': 'Действия для {name}',
  'standorte.action.edit': 'Редактировать',
  'standorte.action.deactivate': 'Деактивировать',
  'standorte.action.activate': 'Активировать',
  'standorte.modal.edit': 'Редактировать филиал',
  'standorte.modal.new': 'Создать филиал',
  'standorte.form.name': 'Название',
  'standorte.form.namePlaceholder': 'напр. Филиал Мюнхен-Норд',
  'standorte.form.street': 'Улица',
  'standorte.form.plz': 'Индекс',
  'standorte.form.stadt': 'Город',
  'standorte.form.telefon': 'Телефон',
  'standorte.form.active': 'Филиал активен',
  'standorte.error.load': 'Ошибка загрузки',
  'standorte.error.nameRequired': 'Укажите название.',
  'standorte.error.save': 'Не удалось сохранить',
  'standorte.error.action': 'Не удалось выполнить действие',

  // ===========================================================================
  // Сотрудники (управление пользователями)
  // ===========================================================================
  'mitarbeiter.title': 'Сотрудники',
  'mitarbeiter.subtitle': 'Пользователи, роли (RBAC) и почасовые ставки',
  'mitarbeiter.new': 'Новый сотрудник',
  'mitarbeiter.empty': 'Нет сотрудников.',
  'mitarbeiter.col.name': 'ФИО',
  'mitarbeiter.col.email': 'Эл. почта',
  'mitarbeiter.col.rolle': 'Роль',
  'mitarbeiter.col.stundenlohn': 'Почасовая ставка',
  'mitarbeiter.col.status': 'Статус',
  'mitarbeiter.role.owner': 'Владелец (админ)',
  'mitarbeiter.role.manager': 'Менеджер',
  'mitarbeiter.role.technician': 'Техник',
  'mitarbeiter.role.receptionist': 'Ресепшн',
  'mitarbeiter.wagePerHour': '{amount}/ч',
  'mitarbeiter.active': 'Активен',
  'mitarbeiter.inactive': 'Неактивен',
  'mitarbeiter.actionsFor': 'Действия для {name}',
  'mitarbeiter.action.edit': 'Редактировать',
  'mitarbeiter.action.deactivate': 'Деактивировать',
  'mitarbeiter.modal.edit': 'Редактировать сотрудника',
  'mitarbeiter.form.firstName': 'Имя',
  'mitarbeiter.form.lastName': 'Фамилия',
  'mitarbeiter.form.email': 'Эл. почта',
  'mitarbeiter.form.password': 'Пароль (мин. 8)',
  'mitarbeiter.form.phone': 'Телефон',
  'mitarbeiter.form.role': 'Роль',
  'mitarbeiter.form.wage': 'Почасовая ставка (€)',
  'mitarbeiter.form.optional': '(необязательно)',
  'mitarbeiter.form.wagePlaceholder': 'напр. 18,50',
  'mitarbeiter.saving': 'Сохранение…',
  'mitarbeiter.deactivate.title': 'Деактивировать сотрудника',
  'mitarbeiter.deactivate.msg':
    'Действительно деактивировать {name}? Доступ будет заблокирован, и вход станет невозможен. Уже учтённое время и заказы сохранятся.',

  // ===========================================================================
  // Zeiterfassung (Stempeluhr, Route "/zeiterfassung")
  // ===========================================================================
  'zeiterfassung.title': 'Учёт времени',
  'zeiterfassung.subtitle': 'Отметка: фиксация прихода/ухода',
  'zeiterfassung.clock.title': 'Отметка времени',
  'zeiterfassung.clock.subtitle': 'Отметьте приход или уход сейчас',
  'zeiterfassung.clock.since': 'На смене с {time}',
  'zeiterfassung.clock.out': 'Не на смене',
  'zeiterfassung.clock.noLocation': 'Без филиала',
  'zeiterfassung.clock.stamping': 'Отмечаем…',
  'zeiterfassung.art.kommen': 'Приход',
  'zeiterfassung.art.gehen': 'Уход',
  'zeiterfassung.mine.title': 'Моё время',
  'zeiterfassung.mine.subtitle': 'Ваши последние отметки',
  'zeiterfassung.mine.empty': 'Пока нет отметок.',
  'zeiterfassung.col.zeitpunkt': 'Время',
  'zeiterfassung.col.art': 'Тип',
  'zeiterfassung.col.standort': 'Филиал',
  'zeiterfassung.col.notiz': 'Заметка',
  'zeiterfassung.col.mitarbeiter': 'Сотрудник',
  'zeiterfassung.col.korrigiert': 'Исправлено',
  'zeiterfassung.all.title': 'Все записи (руководство)',
  'zeiterfassung.all.subtitle': 'Отметки всех сотрудников — фильтрация, исправление, добавление',
  'zeiterfassung.all.empty': 'Нет записей для текущего выбора.',
  'zeiterfassung.newEntry': 'Добавить запись',
  'zeiterfassung.filter.alle': 'Все',
  'zeiterfassung.filter.von': 'С',
  'zeiterfassung.filter.bis': 'По',
  'zeiterfassung.action.edit': 'Редактировать',
  'zeiterfassung.action.delete': 'Удалить',
  'zeiterfassung.modal.edit': 'Изменить запись',
  'zeiterfassung.form.selectEmployee': 'Выберите сотрудника…',
  'zeiterfassung.saving': 'Сохранение…',
  'zeiterfassung.delete.title': 'Удалить запись',
  'zeiterfassung.delete.msgNamed': 'Действительно удалить запись сотрудника {name} от {date}?',
  'zeiterfassung.delete.msg': 'Действительно удалить запись от {date}?',
  'zeiterfassung.error.load': 'Ошибка загрузки',
  'zeiterfassung.error.stamp': 'Не удалось отметить',
  'zeiterfassung.error.timeRequired': 'Укажите время.',
  'zeiterfassung.error.save': 'Не удалось сохранить',
  'zeiterfassung.error.delete': 'Не удалось удалить',

  // ===========================================================================
  // Audit-Log (Route "/audit")
  // ===========================================================================
  'audit.title': 'Журнал аудита',
  'audit.subtitle': 'Прослеживаемые действия в системе',
  'audit.error.forbidden': 'Нет прав — журнал аудита виден только менеджерам и владельцам.',
  'audit.error.load': 'Не удалось загрузить журнал аудита.',
  'audit.empty': 'Пока нет записей.',
  'audit.col.zeitpunkt': 'Время',
  'audit.col.aktion': 'Действие',
  'audit.col.objekt': 'Объект',
  'audit.col.referenz': 'Ссылка',
  'audit.action.create': 'Создано',
  'audit.action.update': 'Обновлено',
  'audit.action.delete': 'Удалено',
  'audit.action.statusChange': 'Статус изменён',

  // ===========================================================================
  // Auswertungen (Berichte, Route "/auswertungen")
  // ===========================================================================
  'auswertungen.title': 'Отчёты',
  'auswertungen.subtitle': 'Объём, выручка, структура услуг и топ-клиенты за период.',
  'auswertungen.von': 'С',
  'auswertungen.bis': 'По',
  'auswertungen.error.load': 'Не удалось загрузить отчёт',
  'auswertungen.kpi.volumen': 'Объём заказов',
  'auswertungen.kpi.anzahl': 'Заказы',
  'auswertungen.kpi.schnitt': '⌀ Стоимость заказа',
  'auswertungen.kpi.bezahlt': 'Оплаченная выручка',
  'auswertungen.leistungsart.title': 'Выручка по видам услуг',
  'auswertungen.leistungsart.subtitle': 'Объём заказов за период',
  'auswertungen.empty': 'Нет заказов за период.',
  'auswertungen.auftrCount': '{count} зак.',
  'auswertungen.topKunden.title': 'Топ-клиенты',
  'auswertungen.topKunden.subtitle': 'По объёму заказов за период',
  'auswertungen.art.aufbereitung': 'Детейлинг',
  'auswertungen.art.folierung': 'Оклейка плёнкой',
  'auswertungen.art.ppf': 'PPF',
  'auswertungen.art.sonstiges': 'Прочее',

  // ===========================================================================
  // Dashboard (Route "/dashboard")
  // ===========================================================================
  'dashboard.hero.morning': 'Доброе утро',
  'dashboard.hero.day': 'Добрый день',
  'dashboard.hero.evening': 'Добрый вечер',
  'dashboard.hero.subtitle': 'Обзор вашего автосервиса.',
  'dashboard.hero.intake': 'Приёмка авто',
  'dashboard.hero.newOrder': 'Новый заказ',
  'dashboard.hero.newCustomer': 'Новый клиент',
  'dashboard.chart.total': 'всего · последние 6 месяцев',
  'dashboard.chart.emptyTitle': 'Пока нет выручки',
  'dashboard.chart.emptyHint': 'Как только счета будут оплачены, они появятся здесь.',
  'dashboard.top.empty': 'Услуги ещё не добавлены.',
  'dashboard.top.count': '{count}× · {sum}',
  'dashboard.onboarding.customer': 'Добавить первого клиента',
  'dashboard.onboarding.services': 'Заполнить каталог услуг',
  'dashboard.onboarding.profile': 'Заполнить профиль компании (налоги и банк)',
  'dashboard.onboarding.order': 'Оформить первый заказ',
  'dashboard.error.load': 'Не удалось загрузить панель',
  'dashboard.kpi.openOrders': 'Открытые заказы',
  'dashboard.kpi.appointmentsToday': 'Записи на сегодня',
  'dashboard.kpi.revenueMonth': 'Выручка за месяц',
  'dashboard.kpi.openInvoices': 'Неоплаченные счета',
  'dashboard.kpi.customersTotal': 'Всего клиентов',
  'dashboard.kpi.revenueHint': 'к прошлому месяцу',
  'dashboard.kpi.invoicesHint': '{count} шт.',
  'dashboard.section.revenue.title': 'Динамика выручки',
  'dashboard.section.revenue.subtitle': 'Оплаченные счета по месяцам',
  'dashboard.section.top.title': 'Топ услуг',
  'dashboard.section.top.subtitle': 'По выручке',
  'dashboard.section.today.title': 'Записи на сегодня',
  'dashboard.section.upcoming.title': 'Ближайшие записи',
  'dashboard.section.upcoming.subtitle': 'Ближайшие 7 дней',
  'dashboard.section.openOrders.title': 'Открытые заказы',
  'dashboard.section.openOrders.subtitle': 'Недавно созданные',
  'dashboard.today.empty': 'Сегодня записей нет.',
  'dashboard.today.toPlanboard': 'К планировщику',
  'dashboard.upcoming.empty': 'Нет предстоящих записей.',
  'dashboard.lowStock.title': 'Материалы заканчиваются',
  'dashboard.lowStock.subtitleOne': '{count} товар ниже мин. остатка',
  'dashboard.lowStock.subtitleMany': '{count} товаров ниже мин. остатка',
  'dashboard.lowStock.toShop': 'На склад',
  'dashboard.lowStock.badge': 'мало',
  'dashboard.openOrders.empty': 'Нет открытых заказов — всё готово!',
  'dashboard.openOrders.intake': 'Принять авто',
  'dashboard.openOrders.viewAll': 'Показать все',
  'dashboard.openOrders.open': 'Открыть',
  'dashboard.col.nummer': 'Номер',
  'dashboard.col.kunde': 'Клиент',
  'dashboard.col.fahrzeug': 'Автомобиль',
  'dashboard.col.leistung': 'Услуга',
  'dashboard.col.status': 'Статус',
  'dashboard.col.gesamt': 'Итого',
  'dashboard.status.angefragt': 'Запрошен',
  'dashboard.status.kalkuliert': 'Рассчитан',
  'dashboard.status.bestaetigt': 'Подтверждён',
  'dashboard.status.in_arbeit': 'В работе',
  'dashboard.status.qualitaetskontrolle': 'Контроль качества',
  'dashboard.status.fertig': 'Готов',
  'dashboard.status.abgerechnet': 'Выставлен счёт',
  'dashboard.status.storniert': 'Отменён',
  'dashboard.art.aufbereitung': 'Детейлинг',
  'dashboard.art.folierung': 'Оклейка плёнкой',
  'dashboard.art.ppf': 'PPF',
  'dashboard.art.sonstiges': 'Прочее',

  // ===========================================================================
  // Shop & Lager (Route "/shop")
  // ===========================================================================
  'shop.title': 'Магазин и склад',
  'shop.subtitle': 'Товары, остатки и согласование заказов',
  'shop.newProduct': 'Новый товар',
  'shop.newOrder': 'Новый заказ',
  'shop.tab.products': 'Товары',
  'shop.tab.orders': 'Заказы',
  'shop.products.empty': 'Нет товаров.',
  'shop.orders.empty': 'Нет заказов.',
  'shop.col.product': 'Товар',
  'shop.col.sku': 'Артикул',
  'shop.col.stock': 'Остаток',
  'shop.col.vk': 'Цена',
  'shop.col.nummer': 'Номер',
  'shop.col.lieferant': 'Поставщик',
  'shop.col.status': 'Статус',
  'shop.col.summe': 'Сумма',
  'shop.badge.belowMin': 'Ниже мин. остатка',
  'shop.badge.rentable': 'В аренду',
  'shop.poStatus.entwurf': 'Черновик',
  'shop.poStatus.eingereicht': 'Отправлен',
  'shop.poStatus.freigegeben': 'Согласован',
  'shop.poStatus.bestellt': 'Заказан',
  'shop.poStatus.geliefert': 'Доставлен',
  'shop.poStatus.abgelehnt': 'Отклонён',
  'shop.error.statusChange': 'Не удалось изменить статус',
  'shop.error.save': 'Не удалось сохранить',
  'shop.form.name': 'Название',
  'shop.form.sku': 'Артикул',
  'shop.form.kategorie': 'Категория',
  'shop.form.einheit': 'Единица',
  'shop.form.einkaufspreis': 'Закупочная цена',
  'shop.form.verkaufspreis': 'Цена продажи',
  'shop.form.bestand': 'Остаток',
  'shop.form.mindestbestand': 'Мин. остаток',
  'shop.form.lieferant': 'Поставщик',
  'shop.form.positionen': 'Позиции',
  'shop.form.addPosition': '+ Позиция',
  'shop.placeholder.beschreibung': 'Описание',
  'shop.placeholder.menge': 'Кол-во',
  'shop.placeholder.preis': 'Цена',
  'shop.createOrder': 'Создать заказ',
  'shop.saving': 'Сохранение…',

  // ===========================================================================
  // Marktplatz (Route "/marktplatz")
  // ===========================================================================
  'marktplatz.title': 'Маркетплейс',
  'marktplatz.subtitle': 'Отобранные предложения наших партнёров-продавцов — заказывайте напрямую или покупайте у продавца.',
  'marktplatz.tab.catalog': 'Каталог',
  'marktplatz.tab.orders': 'Мои заказы',
  'marktplatz.error.catalog': 'Не удалось загрузить маркетплейс',
  'marktplatz.error.orders': 'Не удалось загрузить заказы',
  'marktplatz.error.link': 'Не удалось открыть ссылку',
  'marktplatz.empty.catalog': 'Маркетплейс сейчас наполняется — загляните позже. ✨',
  'marktplatz.bereich.all': 'Все',
  'marktplatz.bereich.folierung': 'Оклейка плёнкой',
  'marktplatz.bereich.aufbereitung': 'Детейлинг',
  'marktplatz.bereich.ppf': 'PPF и защита ЛКП',
  'marktplatz.bereich.sonstiges': 'Прочее',
  'marktplatz.searchPlaceholder': 'Поиск товара, бренда или продавца…',
  'marktplatz.marken': 'Бренды',
  'marktplatz.markenAll': 'Все',
  'marktplatz.noResults': 'Ничего не найдено — измените фильтры.',
  'marktplatz.priceOnRequest': 'Цена у продавца',
  'marktplatz.addToCart': 'В корзину',
  'marktplatz.inCart': '{count} в корзине',
  'marktplatz.decrease': 'Уменьшить количество',
  'marktplatz.increase': 'Увеличить количество',
  'marktplatz.opening': 'Открывается…',
  'marktplatz.toOffer': 'К предложению ↗',
  'marktplatz.cart.items': 'товаров',
  'marktplatz.cart.clear': 'Очистить',
  'marktplatz.cart.checkout': 'Заказать →',
  'marktplatz.checkout.title': 'Оформить заказ',
  'marktplatz.checkout.total': 'Итого',
  'marktplatz.checkout.multiDealer': 'Товары от {count} продавцов — будет создано {count} отдельных заказов, каждый продавец доставляет и выставляет счёт напрямую.',
  'marktplatz.checkout.contact': 'Контактное лицо*',
  'marktplatz.checkout.email': 'Эл. почта*',
  'marktplatz.checkout.phone': 'Телефон',
  'marktplatz.checkout.company': 'Компания',
  'marktplatz.checkout.street': 'Улица и дом',
  'marktplatz.checkout.zip': 'Индекс',
  'marktplatz.checkout.city': 'Город',
  'marktplatz.checkout.note': 'Примечание продавцу',
  'marktplatz.checkout.sending': 'Отправка…',
  'marktplatz.checkout.submit': 'Оформить заказ ({sum})',
  'marktplatz.checkout.footer': 'Заказ отправляется напрямую соответствующему продавцу; доставка и счёт — от продавца.',
  'marktplatz.checkout.error': 'Не удалось оформить заказ',
  'marktplatz.orders.empty': 'Пока нет заказов с маркетплейса.',
  'marktplatz.orderStatus.eingegangen': 'Получен',
  'marktplatz.orderStatus.bestaetigt': 'Подтверждён',
  'marktplatz.orderStatus.versendet': 'Отправлен',
  'marktplatz.orderStatus.storniert': 'Отменён',
};
