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
};
