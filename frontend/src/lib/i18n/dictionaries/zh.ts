// ===========================================================================
// ZH – WÖRTERBUCH (Partial<Dict>) · 简体中文 (Chinesisch, vereinfacht)
// ---------------------------------------------------------------------------
// MT-gestützte Erstübersetzung — professionelle Prüfung empfohlen.
// Enthält die UI-Keys aus de.ts, nach vereinfachtem Chinesisch übersetzt. Bleibt
// technisch `Partial<Dict>`: fehlende/neue Keys fallen automatisch auf DE zurück
// (siehe ../provider, t() → de[key]) — nie ein leerer String oder der rohe Key.
// Juristische Volltexte (AGB, AVV, Datenschutz, Widerrufsbelehrung, Impressum)
// liegen NICHT in diesem Wörterbuch, sondern in den jeweiligen Seiten-Komponenten
// und bleiben bewusst auf Deutsch.
//
// Platzhalter wie {name}/{year} bleiben unverändert (werden zur Laufzeit ersetzt).
// ===========================================================================

import type { Dict } from './de';

export const zh: Partial<Dict> = {
  // ---- Gemeinsame UI-Texte -------------------------------------------------
  'common.save': "保存",
  'common.cancel': "取消",
  'common.confirm': "确认",
  'common.delete': "删除",
  'common.close': "关闭",
  'common.back': "返回",
  'common.loading': "加载中",
  'common.loadingEllipsis': "加载中…",
  'common.loadingBrand': "正在加载 Detailly…",
  'common.error': "错误",
  'common.toStart': "前往首页",
  // ---- Fehler-/Leerzustaende (App-Router error/not-found Boundaries) --------
  'errorBoundary.title': "出现了问题",
  'errorBoundary.desc': "发生了意外错误。您可以重试或重新加载页面。",
  'errorBoundary.retry': "重试",
  'errorBoundary.reload': "重新加载页面",
  'errorBoundary.reference': "参考编号",
  'notFound.title': "找不到页面",
  'notFound.desc': "该页面不存在或已被移动。请检查地址或返回首页。",
  'notFound.dashboard': "前往仪表盘",
  // ---- 2FA-Erzwingung (serverseitige Pflicht) ------------------------------
  'mfa.gate.title': "需要双重身份验证",
  'mfa.gate.desc': "您的账户必须启用双重身份验证。请立即设置以继续使用 Detailly。",
  'mfa.gate.logout': "退出登录",
  'common.toSubscription': "前往订阅与套餐",

  // ---- Sprachumschalter ----------------------------------------------------
  'switcher.label': "选择语言",
  'switcher.current': "当前语言",

  // ---- Navigation: Gruppen -------------------------------------------------
  'nav.group.overview': "概览",
  'nav.group.operations': "运营",
  'nav.group.intake': "接车与报价",
  'nav.group.masterdata': "主数据",
  'nav.group.finance': "财务",
  'nav.group.material': "物料",
  'nav.group.organization': "组织",
  'nav.group.platform': "平台",

  // ---- Navigation: Einträge ------------------------------------------------
  'nav.item.dashboard': "仪表盘",
  'nav.item.achievements': "成就",
  'nav.item.orders': "工单",
  'nav.item.calculation': "报价",
  'nav.item.intakeQuick': "接车(快速)",
  'nav.item.intake3d': "接车与鉴定(3D)",
  'nav.item.dellenkalkulation': "凹陷报价(PDR)",
  'nav.item.schichtdicke': "漆膜测厚",
  'nav.item.planboard': "排程板",
  'nav.item.requests': "咨询",
  'nav.item.customers': "客户",
  'nav.item.vehicles': "车辆",
  'nav.item.services': "服务",
  'nav.item.invoices': "发票",
  'nav.item.incomingInvoices': "电子发票接收",
  'nav.item.cashbook': "现金账簿",
  'nav.item.reminders': "催款",
  'nav.item.reports': "分析",
  'nav.item.accounting': "会计",
  'nav.item.shop': "物料与库存",
  'nav.item.marketplace': "市场",
  'nav.item.locations': "门店",
  'nav.item.staff': "员工",
  'nav.item.time': "考勤",
  'nav.item.showcase': "展示墙",
  'nav.item.audit': "审计日志",
  'nav.item.settings': "设置",
  'nav.item.help': "帮助与支持",
  'nav.item.assistant': "支持助手",
  'nav.item.subscription': "订阅与套餐",
  'nav.item.cockpit': "驾驶舱",
  'nav.item.platformAnalytics': "平台分析",
  'nav.item.platformMarketplace': "市场维护",
  'nav.item.platformGeraetemarkt': "二手市场审核",
  'nav.item.platformSupport': "支持请求",
  'nav.item.platformSecurity': "安全",
  'nav.item.platformNewsletter': "电子邮件通讯",
  'nav.item.subscriptions': "订阅",

  // ---- Einstellungen: Kalkulation (€/qm) -----------------------------------
  'settings.kalk.title': "报价 · €/㎡",
  'settings.kalk.subtitle': "3D 即时报价的基础单价。在报价页面中每个数值仍可覆盖。",
  'settings.kalk.grouplabel': "每平方米价格(不含税)",
  'settings.kalk.folierung': "改色贴膜",
  'settings.kalk.ppf': "PPF / 漆面保护",
  'settings.kalk.aufbereitung': "美容养护",
  'settings.kalk.help': "这些单价是 3D 模块的默认值(面积 × 车辆尺寸 × €/㎡)。留空或 0 = 内部标准值。",
  'settings.kalender.umsatzZielTitle': "周营业额目标",
  'settings.kalender.umsatzZielSubtitle': "排程板营业额图层的目标值 — 仅所有者和经理可见。",
  'settings.kalender.umsatzZielLabel': "每周目标(€ 含税)",
  'settings.kalender.umsatzZielHelp': "留空 = 无目标。进度条会显示在排程板的周头部。",

  // ---- Einstellungen: Kalender & Online-Buchung (Kalender 2.0 W2) ----------
  'settings.kalender.title': "日历与在线预约",
  'settings.kalender.subtitle': "按工作日设置的营业时间、时段网格以及公开预约门户的提前量。",
  'settings.kalender.von': "从",
  'settings.kalender.bis': "至",
  'settings.kalender.slotDauer': "时段时长(分钟)",
  'settings.kalender.puffer': "预约之间的缓冲(分钟)",
  'settings.kalender.vorlaufMin': "最短提前量(小时)",
  'settings.kalender.vorlaufMax': "最长提前量(天)",
  'settings.kalender.hint': "维护好营业时间后,您的预约门户会显示空闲时段 — 客户可从空闲时段中选择,而无需自行输入期望时间。",
  'settings.error.kalenderZeiten': "请检查营业时间:在启用的日子里「至」必须晚于「从」。",
  'settings.error.kalenderWerte': "请检查日历数值:时段 5–480 分钟,缓冲 0–240 分钟,提前量 0–720 小时或 1–365 天。",

  // ---- Buchungsseite: rechtlicher Abschluss-Modus (§312j BGB) ---------------
  'settings.buchung.modusTitle': "预约页面的成立方式",
  'settings.buchung.modusSubtitle': "设置您的公开预约页面是无约束力的咨询,还是需付费的有约束力预约。",
  'settings.buchung.modusLabel': "模式",
  'settings.buchung.modusAnfrage': "无约束力的预约咨询",
  'settings.buchung.modusVerbindlich': "需付费的有约束力预约",
  'settings.buchung.modusHelp': "咨询:客户发送无约束力的咨询 — 尚未成立合同,由您确认预约。有约束力:在线成立需付费的合同(「付费预约」按钮,含撤回权)。",
  'settings.buchung.modusVerbindlichHint': "在有约束力模式下,客户会在线与您成立需付费的远程销售合同。请仔细核对价格信息、公司信息(Impressum)和撤回须知 — 责任在于您。",
  'settings.buchung.impressumIncomplete': "预约页面不完整:缺少公司信息(Impressum)。客户只能看到提供方(合同相对方)的部分信息。请在下方的公司信息栏中补全。",

  // ---- Öffentliche Buchungsseite: Verbraucherrecht (UI-Chrome) --------------
  // Die eigentlichen Rechtstexte (Widerrufsbelehrung/-formular) bleiben DEUTSCH
  // und werden NICHT übersetzt – hier nur die Bedien-Elemente.
  'buchen.recht.badge.anfrage': "在线预约咨询",
  'buchen.recht.badge.verbindlich': "在线预约",
  'buchen.recht.anbieter.title': "提供方",
  'buchen.recht.anbieter.hint': "合同相对方是上述企业,而非 Detailly。",
  'buchen.recht.pflichtinfo.title': "您的预约概览",
  'buchen.recht.pflichtinfo.leistung': "服务",
  'buchen.recht.pflichtinfo.keineLeistung': "未选择服务",
  'buchen.recht.pflichtinfo.preis': "价格",
  'buchen.recht.pflichtinfo.termin': "时间",
  'buchen.recht.pflichtinfo.keinTermin': "未选择时间",
  'buchen.recht.pflichtinfo.checkbox': "我已阅读必要信息和撤回须知。",
  'buchen.recht.pflichtinfo.checkboxError': "请确认必要信息和撤回须知。",
  'buchen.recht.widerruf.title': "撤回权",
  'buchen.recht.widerruf.deHint': "正式的法律文本仅提供德语版本。",
  'buchen.recht.widerruf.belehrungLabel': "显示撤回须知",
  'buchen.recht.widerruf.formularLabel': "显示撤回示范表格",
  'buchen.recht.vorzeitig.checkbox': "我明确要求企业在 14 天撤回期届满前开始履行。我知悉,合同完全履行后我将失去撤回权。",
  'buchen.recht.vorzeitig.error': "请同意提前开始履行,或选择较晚的时间。",
  'buchen.recht.datenschutz.hintAnfrage': "您的信息由企业为处理您的预约咨询而使用。责任方为上述提供方。",
  'buchen.recht.datenschutz.hintVerbindlich': "您的信息由企业为履行合同而使用。责任方为上述提供方。",
  'buchen.recht.datenschutz.link': "隐私说明",
  'buchen.recht.datenschutz.checkbox': "我已知悉隐私说明。",
  'buchen.recht.verbindlich.emailRequired': "对于需付费的有约束力预约,我们需要您的电子邮件地址 — 我们会将预约确认和撤回须知发送至该地址。",
  'buchen.recht.verbindlich.leistungRequired': "对于有约束力的预约,请选择一项服务。",
  'buchen.recht.anfrage.hinweis': "尚未成立合同;企业会确认您的预约。",
  'buchen.recht.anfrage.button': "无约束力咨询",
  'buchen.recht.anfrage.submitting': "发送中…",
  'buchen.recht.verbindlich.intro': "点击即表示您与企业成立需付费的合同。",
  'buchen.recht.verbindlich.button': "付费预约",
  'buchen.recht.verbindlich.submitting': "预约中…",
  'buchen.recht.success.anfrage.title': "咨询已发送",
  'buchen.recht.success.anfrage.text': "非常感谢!{betrieb} 将与您联系以确认预约。",
  'buchen.recht.success.verbindlich.title': "预约已确认",
  'buchen.recht.success.verbindlich.text': "感谢您在 {betrieb} 的付费预约。含撤回须知的确认将通过电子邮件发送给您。",
  'buchen.recht.success.reference': "您的参考编号:",

  // ---- Tarif-Hinweise (Feature-Gating) -------------------------------------
  'settings.sevdesk.upgrade': "自动 sevDesk 交接功能从 Basic 套餐起可用。",
  'ordertime.upgrade': "工单工时与人工成本包含在 Pro 套餐中。",

  // ---- Einstellungen: Seite ------------------------------------------------
  'settings.title': "设置",
  'settings.subtitle': "外观、个人资料,以及 — 作为所有者 — 企业数据。",
  'settings.tab.appearance': "外观",
  'settings.tab.profile': "个人资料",
  'settings.tab.business': "企业",
  'settings.tab.customerComm': "客户沟通",
  'settings.tab.goals': "目标与提醒",
  'settings.tab.audit': "审计日志",
  'settings.saving': "保存中…",
  'settings.toast.saved': "已保存",

  // Einstellungen: Betrieb – Sekundaer-Navigation (Unterbereiche, je eigener Speichern-Button)
  'settings.bereich.navLabel': "企业设置的各个区域",
  'settings.bereich.stammdaten': "主数据与品牌",
  'settings.bereich.steuer': "税务与公司信息",
  'settings.bereich.rechnung': "银行与发票",
  'settings.bereich.kalender': "报价与日历",
  'settings.bereich.email': "邮件发送",
  'settings.bereich.mahnwesen': "催款",
  'settings.bereich.buchhaltung': "DATEV 与 sevDesk",
  'settings.bereich.sicherheit': "安全",

  // Einstellungen: Status-Mail-Vorlagen (editierbar, je Status Betreff + Text)
  'settings.statusmail.title': "状态邮件模板",
  'settings.statusmail.subtitle': "自定义发给客户的自动状态邮件的主题和正文。",
  'settings.statusmail.reviewNote': "发送触发条件不变:只有在状态开关(客户沟通)打开时才会发送状态邮件。此处您仅调整文本。",
  'settings.statusmail.placeholders': "可用的占位符:",
  'settings.statusmail.status.bestaetigt': "工单已确认",
  'settings.statusmail.status.in_arbeit': "工单进行中",
  'settings.statusmail.status.abholbereit': "车辆可取",
  'settings.statusmail.reset': "恢复默认",
  'settings.statusmail.subject': "主题",
  'settings.statusmail.subjectPlaceholder': "留空以使用默认主题",
  'settings.statusmail.body': "正文",
  'settings.statusmail.bodyPlaceholder': "留空以使用默认正文",
  'settings.statusmail.defaultHint': "留空 = 使用经过验证的默认文本。",
  'settings.statusmail.footerHint': "称呼、工单状态链接和结束语会自动补充 — 您的文本位于其间。",

  // Einstellungen: Benachrichtigungs-Präferenzen je Nutzer (Glocke)
  'settings.benachrichtigungen.title': "通知",
  'settings.benachrichtigungen.subtitle': "希望在您的铃铛中显示哪些提示。",
  'settings.benachrichtigungen.intro': "此设置仅对您生效。默认情况下所有提示均已启用。",
  'settings.benachrichtigungen.rechnungenFaellig': "逾期发票",
  'settings.benachrichtigungen.rechnungenFaelligHint': "发票超过付款期限时的提示。",
  'settings.benachrichtigungen.termineHeute': "今日预约",
  'settings.benachrichtigungen.termineHeuteHint': "今日待办预约的提示。",
  'settings.benachrichtigungen.materialKnapp': "物料不足",
  'settings.benachrichtigungen.materialKnappHint': "商品低于最低库存时的提示。",
  'settings.benachrichtigungen.steuerTermine': "税务期限",
  'settings.benachrichtigungen.steuerTermineHint': "对自行维护的税务期限的提醒。",
  'settings.benachrichtigungen.auslastung': "产能利用率",
  'settings.benachrichtigungen.auslastungHint': "周产能利用率低于目标时的提示。",
  'settings.benachrichtigungen.par19': "§19 营业额上限",
  'settings.benachrichtigungen.par19Hint': "接近小规模经营者营业额上限时的警告。",

  // Einstellungen: Darstellung
  'settings.appearance.title': "外观",
  'settings.appearance.subtitle': "Detailly 呈现给您的样子。",
  'settings.appearance.colorScheme': "配色方案",
  'settings.appearance.dark': "深色",
  'settings.appearance.light': "浅色",
  'settings.appearance.deviceOnly': "仅在此设备和此浏览器上生效。",
  'settings.motion.title': "动效",
  'settings.motion.subtitle': "减少动画 — 更安静、更省心。",
  'settings.motion.reduce': "减少动画",
  'settings.motion.deviceOnly': "此设置仅在此设备和此浏览器上生效。",

  // Einstellungen: Profil
  'settings.profile.title': "我的资料",
  'settings.profile.subtitle': "姓名和电话号码可由您自行维护。",
  'settings.profile.firstName': "名",
  'settings.profile.lastName': "姓",
  'settings.profile.phone': "电话(可选)",
  'settings.profile.email': "电子邮件",
  'settings.profile.role': "角色",
  'settings.profile.emailRoleHint': "电子邮件地址和角色由管理层通过员工管理更改。",

  // Einstellungen: Passwort
  'settings.password.title': "密码",
  'settings.password.subtitle': "通过邮件中的安全链接更改密码。",
  'settings.password.sent': "我们已向您发送重置邮件。",
  'settings.password.sending': "发送中…",
  'settings.password.change': "更改密码",

  // Einstellungen: Kalender-Abo
  'settings.calendar.title': "日历订阅(Apple / Google)",
  'settings.calendar.subtitle': "通过一个会自动更新的秘密订阅链接,将所有预约自动同步到自己的日历。",
  'settings.calendar.appleLabel': "Apple 日历(webcal)",
  'settings.calendar.googleLabel': "Google / 其他(https)",
  'settings.calendar.copy': "复制",
  'settings.calendar.copied': "已复制 ✓",
  'settings.calendar.appleName': "Apple 日历:",
  'settings.calendar.appleHelp': " 文件 → 「新建日历订阅…」 → 粘贴 webcal 链接。",
  'settings.calendar.googleName': "Google 日历:",
  'settings.calendar.googleHelp': " 其他日历 → 「通过网址添加」 → 粘贴 https 链接。",
  'settings.calendar.secretHint': "该链接是保密的,可对预约进行只读访问 — 仅分享给信任的人。",
  'settings.calendar.regenerating': "生成中…",
  'settings.calendar.regenerate': "重新生成链接(使旧链接失效)",
  'settings.calendar.confirmTitle': "重新生成日历链接",
  'settings.calendar.confirmMsg': "将生成一个新的秘密订阅链接。原有链接会因此失效 — 现有的日历订阅需使用新链接重新设置。",
  'settings.calendar.confirmLabel': "重新生成",

  // Einstellungen: Verwaltung (Schnellzugriffe)
  'settings.admin.title': "管理",
  'settings.admin.subtitle': "直达各业务区域。",
  'settings.admin.staffTitle': "员工与角色",
  'settings.admin.staffText': "创建团队,管理角色和访问权限。",
  'settings.admin.locationsTitle': "门店",
  'settings.admin.locationsText': "维护分店并跨门店进行分析。",
  'settings.admin.servicesTitle': "服务与价格",
  'settings.admin.servicesText': "维护自己的服务目录和价格。",
  'settings.admin.subscriptionTitle': "订阅与套餐",
  'settings.admin.subscriptionText': "查看和管理 Detailly 套餐。",

  // Einstellungen: Betriebstyp & Branchen-Look
  'settings.branche.title': "企业类型与行业外观",
  'settings.branche.subtitle': "决定强调色、报价目录和类型专属选项。",
  'settings.branche.help': "保存后,外观(强调色)会立即对企业的所有员工生效。",

  // Einstellungen: Dein Look (Logo & Akzentfarbe)
  'settings.branding.title': "您的外观 — 徽标与颜色",
  'settings.branding.subtitle': "用于客户视图(工单跟踪、交接资料)的徽标和强调色。",
  'settings.branding.logoLabel': "徽标",
  'settings.branding.logoPlaceholder': "无徽标",
  'settings.branding.logoChoose': "选择徽标",
  'settings.branding.logoUploading': "上传中…",
  'settings.branding.logoRemove': "移除徽标",
  'settings.branding.logoHelp': "PNG、JPEG 或 WebP,最大 512 KB。最好使用透明背景。",
  'settings.branding.logoErrorType': "徽标仅允许 PNG、JPEG 或 WebP。",
  'settings.branding.logoErrorSize': "徽标过大(最大 512 KB)。",
  'settings.branding.logoErrorGeneric': "无法保存徽标。",
  'settings.branding.logoUploaded': "徽标已更新",
  'settings.branding.logoRemoved': "徽标已移除",
  'settings.branding.logoRemoveConfirmTitle': "移除徽标?",
  'settings.branding.logoRemoveConfirmMsg': "徽标将从所有客户视图中移除。您可以随时上传新的徽标。",
  'settings.branding.accentLabel': "强调色",
  'settings.branding.accentReset': "恢复默认",
  'settings.branding.accentPreviewButton': "示例按钮",
  'settings.branding.accentHelp': "为客户视图中的页头、状态点和按钮着色。留空 = 行业标准。",
  'settings.branding.accentInvalid': "请输入有效的十六进制颜色(例如 #B5722F)。",

  // Einstellungen: Betrieb & Anschrift
  'settings.address.title': "企业与地址",
  'settings.address.subtitle': "企业名称和地址",
  'settings.address.name': "企业名称",
  'settings.address.email': "电子邮件",
  'settings.address.phone': "电话",
  'settings.address.street': "街道与门牌号",
  'settings.address.postalCode': "邮编",
  'settings.address.city': "城市",
  'settings.address.country': "国家",
  'settings.address.taxHintPre': "§14 UStG:名称、地址和税号 ",
  'settings.address.taxHintOr': "或",
  'settings.address.taxHintPost': " 增值税税号(USt-IdNr.)是有效发票的必填项。",

  // Einstellungen: Steuer
  'settings.tax.title': "税务(§14 UStG)",
  'settings.tax.subtitle': "发票上必须填写税号或增值税税号。",
  'settings.tax.steuernummer': "税号",
  'settings.tax.steuernummerPlaceholder': "例如 12/345/67890",
  'settings.tax.ustId': "增值税税号(USt-IdNr.)",
  'settings.tax.ustIdPlaceholder': "例如 DE123456789",
  // §19 UStG (Kleinunternehmer) + Rechtsform
  'settings.steuer.kleinunternehmer': "小规模经营者(§ 19 UStG)",
  'settings.steuer.kleinunternehmerHint': "不列示增值税。新单据会自动按 0 % 生成。",
  'settings.steuer.hinweisLabel': "单据上的提示文本",
  'settings.steuer.hinweisHelp': "显示在发票/报价单上。留空以使用标准文本。",
  'settings.steuer.standardSatz': "新单据的默认增值税率",
  'settings.steuer.standardSatzHelp': "创建新单据时的预选。每张单据仍可更改(19 / 7 / 0 %)。",
  'settings.steuer.rechtsform': "法律形式",
  'settings.steuer.rechtsform.einzelunternehmen': "个体企业",
  'settings.steuer.rechtsform.gbr': "GbR(民事合伙)",
  'settings.steuer.rechtsform.ug': "UG(有限责任)",
  'settings.steuer.rechtsform.gmbh': "GmbH(有限责任公司)",
  'settings.steuer.rechtsform.ohg': "OHG(无限公司)",
  'settings.steuer.rechtsform.kg': "KG(两合公司)",
  'settings.steuer.rechtsform.gmbh_co_kg': "GmbH & Co. KG",
  'settings.steuer.rechtsform.freiberufler': "自由职业者",
  'settings.steuer.rechtsform.sonstige': "其他",
  'settings.steuer.registergericht': "登记法院",
  'settings.steuer.registergerichtPlaceholder': "例如 夏洛滕堡区法院",
  'settings.steuer.registernummer': "登记号",
  'settings.steuer.registernummerPlaceholder': "例如 HRB 123456",
  'settings.steuer.vertretung': "代表人",
  'settings.steuer.vertretungPlaceholder': "例如 Max Mustermann(总经理)",
  'settings.steuer.infoLinkPre': "不确定哪些适用于您? ",
  'settings.steuer.infoLink': "关于小规模经营者与法律形式的信息",
  'settings.steuer.infoLinkPost': "(非税务咨询)。",

  // ---- Einstellungen: Ziele & Erinnerungen (Tab, nur Inhaber) --------------
  'settings.ziele.intro.title': "目标与提醒",
  'settings.ziele.intro.subtitle': "税务期限和警告 — 作为铃铛中的低调提示。不会向外发送任何内容。",
  // Auslastungsziel
  'settings.ziele.auslastung.title': "产能利用率目标",
  'settings.ziele.auslastung.subtitle': "您企业产能利用率的目标值。",
  'settings.ziele.auslastung.toggle': "启用产能利用率目标",
  'settings.ziele.auslastung.toggleHint': "当您的周产能利用率低于目标时,在铃铛中显示提示。",
  'settings.ziele.auslastung.prozentLabel': "目标利用率(%)",
  'settings.ziele.auslastung.prozentHelp': "在 50 到 100 % 之间。默认:90 %。",
  // §19-Umsatzgrenzen-Warnung
  'settings.ziele.par19.title': "营业额上限警告(§ 19 UStG)",
  'settings.ziele.par19.subtitle': "在达到小规模经营者上限前的早期预警。",
  'settings.ziele.par19.toggle': "在达到营业额上限前警告",
  'settings.ziele.par19.toggleHint': "使用现有的 §19 状态(每年 100,000 €)— 作为铃铛中的提示显示。",
  'settings.ziele.par19.disabledHint': "仅当「企业」标签页中启用了小规模经营者制度(§ 19 UStG)时可用。",
  // Steuer-Termine
  'settings.ziele.termine.title': "税务期限",
  'settings.ziele.termine.subtitle': "由铃铛提前(14 天前)提醒您的自定义期限。",
  'settings.ziele.termine.artLabel': "类型",
  'settings.ziele.termine.artPlaceholder': "例如 增值税预申报",
  'settings.ziele.termine.datumLabel': "日期",
  'settings.ziele.termine.datumPlaceholderRec': "01-10(月-日)",
  'settings.ziele.termine.datumPlaceholderOnce': "2026-06-30(年-月-日)",
  'settings.ziele.termine.datumHelp': "周期性:月-日(例如 01-10)。一次性:年-月-日。",
  'settings.ziele.termine.wiederkehrend': "每年",
  'settings.ziele.termine.aktiv': "启用",
  'settings.ziele.termine.remove': "移除",
  'settings.ziele.termine.add': "添加期限",
  'settings.ziele.termine.empty': "尚未创建任何期限。",
  'settings.ziele.termine.max': "最多 12 个期限。",
  'settings.ziele.termine.disclaimer': "无约束力的提醒,非税务咨询。",
  'settings.ziele.error.datum': "请输入有效日期 — 周期性为月-日,一次性为年-月-日。",

  // Impressum-Generator (§ 5 DDG) – Betrieb-Tab. Pflichtangaben stammen aus den
  // Feldern oben (Adresse/Steuer). Inhalte selbst sind Betriebsdaten (nicht übersetzt).
  'settings.impressum.title': "公司信息(Impressum)",
  'settings.impressum.subtitle': "依据 § 5 DDG 的必填信息,用于您的公开页面(预约、状态、单据)。",
  'settings.impressum.disclaimer': "自动生成器,非法律咨询:Detailly 根据您的主数据生成公司信息。其正确性和完整性由您企业自行负责。",
  'settings.impressum.vertretung.inhaber': "所有者(姓名)",
  'settings.impressum.vertretung.gbr': "合伙人(全部具名)",
  'settings.impressum.vertretung.vertreter': "有代表权的人",
  'settings.impressum.vertretungPlaceholder': "例如 Max Mustermann",
  'settings.impressum.vertretungHelp': "在公司信息中作为负责人显示。如有多人请全部列出。",
  'settings.impressum.complete': "公司信息完整 — 所有必填信息均已填写。",
  'settings.impressum.ustWarn': "建议:一旦获得增值税税号(§ 27a UStG),请补充。",
  'settings.impressum.incomplete': "完整的公司信息尚缺少以下内容:",
  'settings.impressum.incompleteHint': "不完整的公司信息可能被警告(Abmahnung)。缺失字段可在上方各栏(地址、税务/法律形式)中维护。",
  'settings.impressum.feld.firmenname': "公司名称",
  'settings.impressum.feld.strasse': "街道与门牌号",
  'settings.impressum.feld.plz': "邮编",
  'settings.impressum.feld.ort': "城市",
  'settings.impressum.feld.telefon': "电话号码",
  'settings.impressum.feld.email': "电子邮件地址",
  'settings.impressum.feld.vertretungsberechtigte': "负责人(所有者/总经理/合伙人)",
  'settings.impressum.feld.registergericht': "登记法院",
  'settings.impressum.feld.registernummer': "登记号(HRB)",
  'settings.impressum.previewTitle': "预览",
  'settings.impressum.previewHeading': "依据 § 5 DDG 的信息",
  'settings.impressum.placeholderName': "[缺少公司名称]",
  'settings.impressum.previewPhone': "电话",
  'settings.impressum.previewEmail': "电子邮件",
  'settings.impressum.previewRegister': "登记法院",
  'settings.impressum.previewUstId': "增值税税号(USt-IdNr.)",
  'settings.impressum.viewLive': "打开公开视图",
  'settings.impressum.optionalTitle': "可选的补充信息",
  'settings.impressum.optionalHint': "仅特定企业需要 — 对美容养护/贴膜/PPF 通常不相关。",
  'settings.impressum.berufshaftpflicht': "职业责任保险",
  'settings.impressum.berufshaftpflichtPlaceholder': "例如 保险公司、地址、地域适用范围",
  'settings.impressum.aufsichtsbehoerde': "监管机构",
  'settings.impressum.aufsichtsbehoerdePlaceholder': "仅限需许可的经营活动",

  // Einstellungen: Auf detailly.de zeigen (Opt-in Mitgliederliste)
  'settings.mitglied.title': "展示在 detailly.de 上",
  'settings.mitglied.subtitle': "将您的企业作为案例列在我们的首页上 — 自愿且随时可撤回。",
  'settings.mitglied.toggle': "展示在 Detailly 首页上",
  'settings.mitglied.toggleHint': "仅在您同意时展示。显示内容为公司名称、企业类型,以及可选的城市、简短描述和网站 — 绝不显示联系方式。",
  'settings.mitglied.stadt': "城市(可选)",
  'settings.mitglied.stadtPlaceholder': "例如 柏林",
  'settings.mitglied.kurzbeschreibung': "简短描述(可选)",
  'settings.mitglied.kurzbeschreibungPlaceholder': "例如 自 2015 年起的高端美容养护与贴膜",
  'settings.mitglied.kurzbeschreibungHelp': "最多 160 个字符。",
  'settings.mitglied.webseite': "网站(可选)",
  'settings.mitglied.webseitePlaceholder': "https://您的企业.de",
  'settings.mitglied.webseiteHelp': "必须以 http:// 或 https:// 开头。",
  'settings.mitglied.previewLabel': "预览",
  'settings.mitglied.consent': "只有在您同意时,您的企业才会出现在我们的首页上;随时可撤回。",

  // Einstellungen: Bankverbindung
  'settings.bank.title': "银行账户",
  'settings.bank.subtitle': "显示在发票页脚。",
  'settings.bank.bankname': "银行",
  'settings.bank.iban': "IBAN",
  'settings.bank.bic': "BIC",

  // Einstellungen: Rechnungsstellung
  'settings.invoice.title': "开票",
  'settings.invoice.subtitle': "新发票的默认值 — 现有单据保持不变。",
  'settings.invoice.paymentTerm': "付款期限(天)",
  'settings.invoice.paymentTermHelp': "留空 = 14 天。",
  'settings.invoice.paymentLink': "支付链接",
  'settings.invoice.paymentLinkPlaceholder': "https://paypal.me/您的企业",
  'settings.invoice.paymentLinkHelp': "您自己的 PayPal.me 或 Stripe 支付链接。会作为「在线支付」按钮显示在公开单据页面上 — 款项直接进入您的账户,绝不经过 Detailly。必须以 https:// 开头。",
  'settings.invoice.footer': "单据页脚文本",
  'settings.invoice.footerPlaceholder': "例如 感谢您的委托!以我们的条款为准。",
  'settings.invoice.footerHelp': "显示在报价单和发票 PDF 的页脚。",

  // Einstellungen: Mahnwesen
  'settings.mahn.title': "催款",
  'settings.mahn.subtitle': "付款提醒和催款的期限与费用。",
  'settings.mahn.auto': "自动催款",
  'settings.mahn.autoHint': "自动催款 — 否则您在催款驾驶舱中手动催款。",
  'settings.mahn.deadlines': "期限(到期后的天数)",
  'settings.mahn.reminder': "提醒",
  'settings.mahn.dunning1': "第 1 次催款",
  'settings.mahn.dunning2': "第 2 次催款",
  'settings.mahn.deadlinesHelp': "严格递增:提醒 < 第 1 次催款 < 第 2 次催款(各 1–365 天)。",
  'settings.mahn.fees': "催款费(€)",
  'settings.mahn.feesHelp': "每级 0 到 999 €。会作为附加条目显示在催款单上。",

  // Einstellungen: Kunden-Benachrichtigungen
  'settings.notify.title': "客户通知",
  'settings.notify.subtitle': "发给客户的自动邮件 — 随时可关闭。",
  'settings.notify.status': "工单状态邮件",
  'settings.notify.statusHint': "在重要状态变更时,填写了电子邮件地址的客户会自动收到一封带有工单跟踪链接的消息。",
  'settings.notify.appointment': "预约确认",
  'settings.notify.appointmentHint': "当客户的在线预约咨询被接受时,客户会收到一封确认邮件。",

  // Einstellungen: Kundenkommunikation (Termin-Erinnerung, Bewertungs-Bitte, Status-Mails)
  'settings.kk.intro.title': "客户沟通",
  'settings.kk.intro.subtitle': "发给您客户的自动邮件 — 提醒、评价邀请和状态信息。",
  'settings.kk.reviewNote': "不会意外发出任何内容:只有在您有意打开相应开关时,我们才会发送自动客户邮件。此处一切随时可关闭。",
  'settings.kk.reminder.title': "预约提醒",
  'settings.kk.reminder.subtitle': "自动提醒填写了电子邮件地址的客户即将到来的预约。",
  'settings.kk.reminder.toggle': "发送预约提醒",
  'settings.kk.reminder.toggleHint': "客户会在预约前收到友好的提醒 — 每个提醒只发送一次。",
  'settings.kk.reminder.hoursLabel': "提前量(提前多少小时)",
  'settings.kk.reminder.hoursHelp': "在预约开始前多少小时发送提醒(1–168,默认 24)。",
  'settings.kk.review.title': "评价邀请",
  'settings.kk.review.subtitle': "在「车辆可取」邮件后附上评价链接 — 仅在启用且已填写链接时。",
  'settings.kk.review.toggle': "邀请评价",
  'settings.kk.review.toggleHint': "在完成邮件中添加指向您 Google 评价的链接。",
  'settings.kk.review.urlLabel': "Google 评价链接",
  'settings.kk.review.urlHelp': "必须以 https:// 开头。最简单的方式是通过您的 Google 商家资料(「撰写评论」)。",
  'settings.kk.review.urlPlaceholder': "https://g.page/r/...",
  'settings.kk.review.textLabel': "自定义邀请文本(可选)",
  'settings.kk.review.textHelp': "留空以使用标准文本。",
  'settings.kk.review.textPlaceholder': "您满意吗?如能留下简短评价,我们将不胜感激:",
  'settings.kk.error.url': "评价链接必须以 https:// 开头。",

  // Einstellungen: Sicherheit (2FA-Pflicht, Owner-Policy)
  'settings.security.title': "安全",
  'settings.security.subtitle': "为您的团队启用双重身份验证。",
  'settings.security.mfaRequired': "员工强制 2FA",
  'settings.security.mfaRequiredHint': "所有企业角色必须先设置双重身份验证,才能继续工作。",

  // Zwei-Faktor-Authentifizierung (Profil-Sektion + Banner)
  'mfa.title': "双重身份验证",
  'mfa.subtitle': "使用身份验证器应用为您的账户提供额外保护。",
  'mfa.idle.desc': "启用双重身份验证后,登录时您需要额外输入身份验证器应用中的一次性代码。",
  'mfa.idle.setupCta': "设置 2FA",
  'mfa.required.note': "您的企业要求双重身份验证。请立即设置。",
  'mfa.recommended.note': "针对您的角色,强烈建议启用双重身份验证。",
  'mfa.setup.step1': "用身份验证器应用扫描",
  'mfa.setup.step2': "无法扫描?请在应用中手动输入此密钥。",
  'mfa.setup.secretLabel': "设置密钥",
  'mfa.setup.copySecret': "复制",
  'mfa.setup.secretCopied': "已复制",
  'mfa.setup.codeLabel': "应用中的代码",
  'mfa.setup.codeHint': "请输入当前显示的 6 位代码以完成设置。",
  'mfa.setup.activate': "启用",
  'mfa.setup.cancel': "取消",
  'mfa.recovery.title': "恢复代码",
  'mfa.recovery.desc': "请妥善保管这些代码 — 每个代码只能使用一次。",
  'mfa.recovery.warn': "这些代码仅在此刻显示。若没有身份验证器应用,它们是您唯一的访问方式 — 请保存或打印在安全的地方。",
  'mfa.recovery.copy': "全部复制",
  'mfa.recovery.copied': "已复制",
  'mfa.recovery.download': "保存为文件",
  'mfa.recovery.done': "我已保存",
  'mfa.enabled.status': "双重身份验证已启用。",
  'mfa.enabled.deactivate': "停用 2FA",
  'mfa.deact.title': "如需停用,请输入当前的应用代码或您的密码。",
  'mfa.deact.codeLabel': "应用中的代码",
  'mfa.deact.passwordLabel': "密码",
  'mfa.deact.usePassword': "改用密码",
  'mfa.deact.useCode': "改用应用代码",
  'mfa.deact.confirm': "停用",
  'mfa.deact.cancel': "取消",
  'mfa.toast.activated': "已启用双重身份验证。",
  'mfa.toast.deactivated': "已停用双重身份验证。",
  'mfa.error.generic': "操作失败。请重试。",
  'mfa.banner.required': "您的企业要求双重身份验证。请立即设置。",
  'mfa.banner.recommended': "针对您的角色,强烈建议启用双重身份验证。",
  'mfa.banner.setupCta': "立即设置",

  // Einstellungen: Mail-Versand
  'settings.mail.title': "邮件发送(自有发件人)",
  'settings.mail.subtitle': "可选:通过自有 SMTP 服务器和发件人发送客户邮件和单据邮件。",
  'settings.mail.useOwn': "使用自有发件人",
  'settings.mail.useOwnHint': "若未启用配置,Detailly 会继续以标准地址发送。",
  'settings.mail.host': "SMTP 主机",
  'settings.mail.hostPlaceholder': "例如 smtp.您的服务商.de",
  'settings.mail.port': "端口",
  'settings.mail.encryption': "加密",
  'settings.mail.user': "用户",
  'settings.mail.userPlaceholder': "邮件服务器登录名",
  'settings.mail.password': "密码",
  'settings.mail.passwordPlaceholder': "输入 SMTP 密码",
  'settings.mail.passwordPlaceholderSet': "已保存({hint})— 如需更改请输入新密码",
  'settings.mail.passwordHelp': "留空 = 保持不变。将加密保存,且不再显示。",
  'settings.mail.fromEmail': "发件地址(From)",
  'settings.mail.fromEmailPlaceholder': "rechnung@您的企业.de",
  'settings.mail.fromName': "发件人名称",
  'settings.mail.fromNamePlaceholder': "例如 您的企业名称",
  'settings.mail.testInfoPre': "测试邮件会发送到已填写的发件地址,并检查",
  'settings.mail.testInfoEmph': "最近一次保存的",
  'settings.mail.testInfoPost': " 配置。因此请先保存更改,再进行测试。",
  'settings.mail.testTitleOn': "向发件地址发送一封测试邮件",
  'settings.mail.testTitleOff': "请先启用并保存「使用自有发件人」",
  'settings.mail.sending': "发送中…",
  'settings.mail.testSend': "发送测试邮件",
  'settings.mail.confirmMsgPre': "将向已填写的发件地址发送一封测试邮件",
  'settings.mail.confirmMsgPost': "。将检查最近一次保存的 SMTP 配置。",

  // Einstellungen: Eigene Domain & Zustellbarkeit (SPF/DKIM/MX)
  'settings.maildomain.domain': "自有域名",
  'settings.maildomain.domainPlaceholder': "例如 您的企业.de",
  'settings.maildomain.domainHelp': "您发件地址的域名。仅在保存后,您才能查看 DNS 记录并验证域名。",
  'settings.maildomain.title': "检查送达率",
  'settings.maildomain.badgeVerified': "域名已验证",
  'settings.maildomain.badgeUnverified': "未验证",
  'settings.maildomain.spamHint': "若没有已验证的域名(SPF 和 DKIM),您的邮件在收件人处常会进入垃圾邮件。请在您的域名服务商处填入下列 DNS 记录,然后进行验证。",
  'settings.maildomain.showRecords': "显示 DNS 记录",
  'settings.maildomain.hideRecords': "隐藏 DNS 记录",
  'settings.maildomain.record.spf': "SPF 记录",
  'settings.maildomain.record.dkim': "DKIM 记录",
  'settings.maildomain.recordType': "类型",
  'settings.maildomain.recordHost': "名称 / 主机",
  'settings.maildomain.recordValue': "值",
  'settings.maildomain.recordsHint': "在 SPF 记录中,将「IHR-MAILPROVIDER」替换为您邮件服务商的 SPF include(见其文档)。DKIM 值需完全按此填入;有些服务商会自动拆分。",
  'settings.maildomain.copy': "复制",
  'settings.maildomain.copied': "已复制",
  'settings.maildomain.verify': "验证域名",
  'settings.maildomain.verifying': "检查中…",
  'settings.maildomain.verifyTitle': "实时检查 DNS 记录(SPF、DKIM、MX)",
  'settings.maildomain.verifyFailed': "验证失败",
  'settings.maildomain.verifiedToast': "域名验证成功 — 邮件现在会进行 DKIM 签名。",
  'settings.maildomain.lastChecked': "最近检查:{date}",
  'settings.maildomain.check.spf': "SPF",
  'settings.maildomain.check.dkim': "DKIM",
  'settings.maildomain.check.mx': "MX",
  'settings.maildomain.setDomainFirst': "请在上方填入域名并保存,以显示 DNS 记录并检查送达率。",

  // Einstellungen: DATEV / Buchhaltung
  'settings.datev.title': "DATEV / 会计",
  'settings.datev.subtitle': "用于 DATEV 记账批次导出。顾问号/委托方号来自税务顾问;科目已用 SKR03 标准值预填。",
  'settings.datev.beraterNr': "顾问号",
  'settings.datev.beraterNrPlaceholder': "例如 1001",
  'settings.datev.mandantNr': "委托方号",
  'settings.datev.mandantNrPlaceholder': "例如 456",
  'settings.datev.skr': "科目表(SKR)",
  'settings.datev.debitor': "应收账款汇总科目",
  'settings.datev.erloes19': "收入科目 19 %",
  'settings.datev.erloes7': "收入科目 7 %",
  'settings.datev.erloes0': "收入科目 免税 / §19",
  'settings.datev.help': "提示:在首次真正的 DATEV 导入前,请与税务顾问或免费的 DATEV 校验程序核对。",

  // Einstellungen: sevDesk-Anbindung
  'settings.sevdesk.title': "sevDesk 连接",
  'settings.sevdesk.subtitle': "可选:将已开具的发票自动交接到您的 sevDesk 账户。",
  'settings.sevdesk.apiToken': "API 令牌",
  'settings.sevdesk.tokenPlaceholder': "粘贴 sevDesk API 令牌",
  'settings.sevdesk.tokenPlaceholderSet': "已保存({hint})— 如需更改请输入新令牌",
  'settings.sevdesk.help': "位于 sevDesk 的 设置 → 用户 → API 令牌。将加密保存,且不再显示。",
  'settings.sevdesk.testTitle': "测试已保存的令牌",
  'settings.sevdesk.testing': "测试中…",
  'settings.sevdesk.test': "测试连接",
  'settings.sevdesk.remove': "移除令牌",

  // Einstellungen: Fehler / Validierung
  'settings.error.saveFailed': "保存失败",
  'settings.error.loadFailed': "无法加载主数据",
  'settings.error.testFailed': "测试失败",
  'settings.error.removeFailed': "移除失败",
  'settings.error.mahnDaysRange': "催款期限必须是 1 到 365 天之间的整数。",
  'settings.error.mahnDaysOrder': "催款期限必须递增(提醒 < 第 1 次催款 < 第 2 次催款)。",
  'settings.error.mailHostRequired': "使用自有邮件发送需要 SMTP 主机。",
  'settings.error.mailPortRange': "SMTP 端口必须在 1 到 65535 之间。",
  'settings.error.mailFromInvalid': "请填写有效的发件地址(From)。",
  'settings.error.mailDomainMismatch': "发件地址必须位于所填写的域名上。",
  'settings.error.mitgliedWebseite': "网站必须以 http:// 或 https:// 开头。",

  // ---- Login ---------------------------------------------------------------
  'login.subtitle': "Detailing Suite — 美容养护、贴膜与 PPF",
  'login.email': "电子邮件",
  'login.password': "密码",
  'login.forgot': "忘记密码?",
  'login.showPassword': "显示密码",
  'login.hidePassword': "隐藏密码",
  'login.submit': "登录",
  'login.submitting': "登录中…",
  'login.failed': "登录失败",
  'login.noAccount': "还没有账户?",
  'login.registerCta': "注册企业",
  'login.footer': "© {year} Detailly · 独立的美容养护软件",
  // Login: zweite Stufe (2FA)
  'login.mfaSubtitle': "双重验证",
  'login.mfaHint': "请输入您身份验证器应用中的 6 位代码。",
  'login.mfaCode': "验证码",
  'login.mfaSubmit': "验证并登录",
  'login.mfaVerifying': "检查中…",
  'login.mfaUseRecovery': "使用恢复代码",
  'login.mfaUseCode': "返回应用代码",
  'login.mfaRecovery': "恢复代码",
  'login.mfaRecoveryHint': "您在设置时保存的一次性代码之一。",
  'login.mfaBack': "取消",
  'login.mfaFailed': "代码无效或已过期",

  // ===========================================================================
  // LANDING (Route "/")
  // ===========================================================================

  // ---- Kopfleiste ----------------------------------------------------------
  'landing.nav.branchen': "行业",
  'landing.nav.ablauf': "工作方式",
  'landing.nav.funktionen': "功能",
  'landing.nav.faq': "常见问题",
  'landing.nav.login': "登录",
  'landing.nav.trial': "免费试用",

  // ---- Hero ----------------------------------------------------------------
  'landing.hero.badge': "面向美容养护、贴膜与 PPF 的工坊软件",
  'landing.hero.eyebrow': "工坊软件 · 美容养护 / 贴膜 / PPF",
  'landing.hero.headlinePre': "车辆进厂、损伤记录、客户签字 — 仅需 ",
  'landing.hero.headlineEm': "四分钟",
  'landing.hero.headlinePost': "。",
  'landing.hero.title1': "你的手艺讲究精准。",
  'landing.hero.title2': "如今你的软件也一样。",
  'landing.hero.sub': "Detailly 是面向美容养护、贴膜和 PPF 的工坊软件:接车、排程板、结算和现金账簿集于一个系统 — 有据可查,而非全凭记忆。",
  'landing.hero.ctaPrimary': "免费试用 14 天",
  'landing.hero.ctaSecondary': "查看功能",
  'landing.hero.trailer': "无需信用卡 · 几分钟即可上手 · 可按月取消",

  // ---- Signature A: µm-Schichtdicken-Readout -------------------------------
  'landing.messwert.label': "漆膜厚度",
  'landing.messwert.unit': "µm",
  'landing.messwert.measuring': "测量中 …",
  'landing.messwert.status': "在公差范围内",
  'landing.messwert.surface': "漆面 · 发动机盖",
  'landing.messwert.caption': "在接车时,重要的是测量值,而非口头声明。Detailly 也是这样工作的:有记录、可查证。(漆膜测厚本身属于接车时的工具,而非 Detailly 的一部分。)",
  'landing.messwert.aria': "漆膜测厚:测量值处于公差范围内,以绿色锁定。",

  // ---- Funktionen als Datenblatt (Label ↔ Fakt) ----------------------------
  'landing.datenblatt.kicker': "规格表",
  'landing.datenblatt.title': "包含哪些内容 — 作为事实,而非承诺。",
  'landing.datenblatt.sub': "每一行都是产品中如今真实存在的功能。",
  'landing.datenblatt.footnote': "此外:全局搜索、移动端操作,以及每个企业的多名员工。",
  'landing.datenblatt.kunden.label': "客户与车辆",
  'landing.datenblatt.kunden.fact': "车辆档案 · 完整历史",
  'landing.datenblatt.auftraege.label': "工单与排程板",
  'landing.datenblatt.auftraege.fact': "周计划 · 预约 · 进度",
  'landing.datenblatt.schaden.label': "损伤记录",
  'landing.datenblatt.schaden.fact': "3D 模型 · 照片 · 签名",
  'landing.datenblatt.rechnung.label': "发票",
  'landing.datenblatt.rechnung.fact': "GoBD §14 · XRechnung · ZUGFeRD",
  'landing.datenblatt.zahlung.label': "付款",
  'landing.datenblatt.zahlung.fact': "到期日 · 催款",
  'landing.datenblatt.kasse.label': "现金账簿",
  'landing.datenblatt.kasse.fact': "符合 GoBD · 精确到日",
  'landing.datenblatt.kalkulation.label': "报价",
  'landing.datenblatt.kalkulation.fact': "按工种 · 美容养护 / 贴膜 / PPF",
  'landing.datenblatt.datenschutz.label': "数据保护",
  'landing.datenblatt.datenschutz.fact': "DSGVO · 加密 · 按企业隔离",
  'landing.datenblatt.sprachen.label': "语言",
  'landing.datenblatt.sprachen.fact': "4 · DE / EN / RU / PL",
  'landing.datenblatt.zugriff.label': "访问",
  'landing.datenblatt.zugriff.fact': "浏览器 · 平板 · 智能手机",

  // ---- Vertrauens-Leiste ---------------------------------------------------
  'landing.trust.dsgvo': "符合 DSGVO",
  'landing.trust.gobd': "符合 GoBD 的发票",
  'landing.trust.madeInGermany': "德国制造",
  'landing.trust.encrypted': "数据加密",
  'landing.trust.noInstall': "无需安装",

  // ---- Problem -------------------------------------------------------------
  'landing.problem.kicker': "你有同感吗?",
  'landing.problem.title': "现场运转顺畅 — 管理却拖了后腿。",
  'landing.problem.sub': "当车辆上的工作需要精准时,周边事务却淹没在文书工作里。",
  'landing.problem.p1': "车辆历史分散在文件夹、纸条和脑子里。",
  'landing.problem.p2': "发票被搁置 — 让你损失真金白银。",
  'landing.problem.p3': "接车时的损伤,事后几乎无法证明。",
  'landing.problem.p4': "五个互不相通的不同工具。",
  'landing.problem.summaryPre': "Detailly 把这一切汇入 ",
  'landing.problem.summaryEm': "一个",
  'landing.problem.summaryPost': " 系统 — 清晰、快速,在任何设备上。",

  // ---- Branchen-Switcher ---------------------------------------------------
  'landing.branchen.kicker': "为你的工种而打造",
  'landing.branchen.title': "一款懂你工种的软件",
  'landing.branchen.sub': "启动时选择你的主营方向 — Detailly 会据此调整服务目录、报价乃至外观。试试看:选择你的工种,看看页面如何变色。",
  'landing.branchen.selected': "已选择",
  'landing.branchen.cta': "作为{label}开始",
  'landing.branchen.complete': "一站式全包?",
  'landing.branchen.completeCta': "作为全能服务商开始",
  'landing.branchen.aufbereitung.l1': "内外部养护",
  'landing.branchen.aufbereitung.l2': "抛光与陶瓷镀膜",
  'landing.branchen.aufbereitung.l3': "租赁返还检查",
  'landing.branchen.folierung.l1': "整车与局部贴膜",
  'landing.branchen.folierung.l2': "改色与设计",
  'landing.branchen.folierung.l3': "广告字样",
  'landing.branchen.ppf.l1': "前部与整车防护",
  'landing.branchen.ppf.l2': "防石击套餐",
  'landing.branchen.ppf.l3': "精密裁切",

  // ---- So funktioniert's ---------------------------------------------------
  'landing.ablauf.kicker': "就是这么简单",
  'landing.ablauf.title': "三步实现清爽流程",
  'landing.ablauf.step1.title': "接车",
  'landing.ablauf.step1.desc': "几分钟内记录客户、车辆和损伤 — 配 3D 标记、照片和电子签名。",
  'landing.ablauf.step2.title': "处理",
  'landing.ablauf.step2.desc': "对服务进行报价,在排程板上安排预约,随时掌握进度。",
  'landing.ablauf.step3.title': "结算",
  'landing.ablauf.step3.desc': "一键将工单变为符合 GoBD 的发票 PDF — 含到期日和催款。",

  // ---- Funktionen ----------------------------------------------------------
  'landing.funktionen.kicker': "全部工具",
  'landing.funktionen.title': "你的企业所需的一切",
  'landing.funktionen.sub': "一条贯通的流程 — 从车辆接收到发票收款。",
  'landing.funktionen.kunden.title': "客户与车辆",
  'landing.funktionen.kunden.desc': "主数据、车辆档案和每辆车的完整历史 — 立即可查。",
  'landing.funktionen.auftraege.title': "工单与排程板",
  'landing.funktionen.auftraege.desc': "从报价到验收。带预约的周计划 — 一目了然。",
  'landing.funktionen.rechnungen.title': "发票与单据",
  'landing.funktionen.rechnungen.desc': "符合 §14 与 GoBD 的发票和报价单,以 PDF 形式提供,含到期日和催款。",
  'landing.funktionen.schaden3d.title': "3D 损伤记录",
  'landing.funktionen.schaden3d.desc': "直接在车辆模型上标记损伤,用照片记录,并让客户电子签名。",
  'landing.funktionen.kalkulation.title': "按工种报价",
  'landing.funktionen.kalkulation.desc': "面向美容养护、贴膜和 PPF 的服务目录和定价逻辑 — 契合你的主营方向。",
  'landing.funktionen.dsgvo.title': "DSGVO 与安全",
  'landing.funktionen.dsgvo.desc': "敏感数据加密,按企业严格隔离,数据导出和删除一键完成。",
  'landing.funktionen.footnotePre': "此外:闪电般的全局搜索(",
  'landing.funktionen.footnotePost': "),移动端导航,以及每个企业的多名员工。",

  // ---- 3D-Schadenserfassung (Showcase) -------------------------------------
  'landing.schaden.kicker': "亮点",
  'landing.schaden.title': "在损伤变成争议之前先记录下来",
  'landing.schaden.desc': "接车时,你直接在车辆模型上标记划痕、凹陷和石击 — 配照片和客户电子签名。日后若有疑问,你手握证据,白纸黑字。",
  'landing.schaden.point1': "直接在 3D 模型上设置损伤点",
  'landing.schaden.point2': "每处损伤配照片 — 自动关联",
  'landing.schaden.point3': "接车和验收时的电子签名",
  'landing.schaden.cardHeader': "车辆接收 · 损伤记录",
  'landing.schaden.cardBadge': "2 处损伤",
  'landing.schaden.cardPhotos': "已记录 4 张照片",
  'landing.schaden.cardSignature': "已采集签名",

  // ---- Landing: 3D-Showcase (LandingCar3D) --------------------------------
  'landing.showcase.aria': "带有已标记损伤点的交互式 3D 车辆模型",
  'landing.showcase.pin1': "石击 · 2 张照片",
  'landing.showcase.pin2': "划痕 · 左车门",
  'landing.showcase.pin3': "凹陷 · 已记录",
  'landing.showcase.badgeOne': "{count} 处损伤",
  'landing.showcase.badgeMany': "{count} 处损伤",

  // ---- Wachstum ------------------------------------------------------------
  'landing.wachstum.kicker': "可扩展",
  'landing.wachstum.title': "通过掌控实现增长",
  'landing.wachstum.sub': "井然有序、心中有数的人能做出更好的决策 — 从个体店到连锁。",
  'landing.wachstum.echtzeit.title': "实时掌控",
  'landing.wachstum.echtzeit.desc': "营业额、未完成工单和预约在仪表盘中实时呈现 — 你立刻看到哪里顺利、哪里卡壳。",
  'landing.wachstum.standorte.title': "多个门店",
  'landing.wachstum.standorte.desc': "在同一屋檐下管理分店 — 干净隔离却又集中掌控。随着你的成长可随时扩展。",
  'landing.wachstum.team.title': "团队、角色与权限",
  'landing.wachstum.team.desc': "邀请员工并分配角色 — 每个人只看到该看的内容。监管清晰、有据可查。",
  'landing.wachstum.chartVolume': "工单量",
  'landing.wachstum.chartGrowing': "增长中",
  'landing.wachstum.chartLocations': "门店",

  // ---- Zahlen (Count-up) ---------------------------------------------------
  'landing.zahlen.stat1.unit': "种语言",
  'landing.zahlen.stat1.label': "提供德语、英语、俄语和波兰语",
  'landing.zahlen.stat2.unit': "天",
  'landing.zahlen.stat2.label': "免费试用 — 无需信用卡",
  'landing.zahlen.stat3.value': "DSGVO + GoBD",
  'landing.zahlen.stat3.label': "合规地存储和结算",
  'landing.zahlen.stat4.value': "5 → 1",
  'landing.zahlen.stat4.label': "一个系统取代五个孤立方案",

  // ---- Mitglieder (Social Proof, Opt-in) -----------------------------------
  'landing.mitglieder.kicker': "来自实践",
  'landing.mitglieder.title': "这些企业正在使用 Detailly",
  'landing.mitglieder.sub': "每天使用 Detailly,并允许我们在此提及他们的养护师、贴膜师和 PPF 工作室。",

  // ---- Deutschlandkarte (Qualitätssiegel, nur zahlende Opt-in-Betriebe) -----
  'landing.karte.kicker': "遍布全德",
  'landing.karte.title': "遍布全德的 Detailly 企业",
  'landing.karte.sub': "经审核的活跃会员企业 — 在地图上按地区大致分布。点按一个点即可查看该地区的企业。",
  'landing.karte.pin.aria': "邮编区 {region} 有 {anzahl} 家企业",
  'landing.karte.pin.aria.one': "邮编区 {region} 有一家企业",
  'landing.karte.pop.aria': "邮编区 {region} 的企业",
  'landing.karte.pop.region': "邮编区 {region}",
  'landing.karte.pop.website': "网站",
  'landing.karte.legende': "{regionen} 个地区共 {betriebe} 家活跃企业",

  // ---- 企业实时地图（真实数据） --------------------------------------------
  'landing.betriebskarte.kicker': "全德国",
  'landing.betriebskarte.title': "地图上的 Detailly 企业",
  'landing.betriebskarte.sub': "真实、活跃的企业，按地区大致显示。点按圆点可查看该地区的企业。定位精度不高于邮政区。",
  'landing.betriebskarte.zaehler': "家企业遍布全德",
  'landing.betriebskarte.zaehlerEiner': "家企业遍布全德",
  'landing.betriebskarte.laedt': "正在加载地图 …",
  'landing.betriebskarte.leer': "即将来到你所在的地区。",
  'landing.betriebskarte.legende': "在 {regionen} 个地区可见",
  'landing.betriebskarte.pinAria': "邮政区 {region} 的 {anzahl} 家企业",
  'landing.betriebskarte.pinAria.one': "邮政区 {region} 的 {name}",
  'landing.betriebskarte.pop.aria': "邮政区 {region} 的企业",
  'landing.betriebskarte.pop.region': "邮政区 {region}",

  // ---- Warum Detailly ------------------------------------------------------
  'landing.warum.kicker': "为什么选 Detailly",
  'landing.warum.title': "为工坊而非 4S 店打造的软件。",
  'landing.warum.body': "养护师、贴膜师和 PPF 工作室交付的是精密工作,理应拥有同样干净利落的软件。大多数工坊程序都是为大型 4S 店打造的:臃肿、复杂且昂贵。Detailly 有意与众不同 — 精简、贴合你的流程、几分钟即可上手。在德国独立开发,数据保护从底层做起。",

  // ---- News-Teaser ---------------------------------------------------------
  'landing.news.kicker': "Detailly 新闻",
  'landing.news.title': "近期动态",
  'landing.news.sub': "有关 Detailly 的产品更新和新闻。(示例条目 — 很快将是真实消息。)",
  'landing.news.all': "查看全部新闻",

  // ---- FAQ -----------------------------------------------------------------
  'landing.faq.kicker': "常见问题",
  'landing.faq.title': "开始之前你想了解的",
  'landing.faq.q1.q': "我需要技术知识或安装吗?",
  'landing.faq.q1.a': "不需要。你注册企业后,直接在浏览器中开始 — 电脑、平板或智能手机均可。无需安装,无需配置。",
  'landing.faq.q2.q': "我既做美容养护「又」做贴膜 — 该选哪个?",
  'landing.faq.q2.a': "那你就是全能服务商:注册时只需选择「全能服务商」,即可同时获得所有服务目录和报价。",
  'landing.faq.q3.q': "我的客户数据有多安全?",
  'landing.faq.q3.a': "敏感数据加密存储,并与其他企业严格隔离。客户数据你可随时导出或删除 — 完全符合 DSGVO。",
  'landing.faq.q4.q': "14 天之后会怎样?",
  'landing.faq.q4.a': "你无需信用卡、无风险地试用。试用期后,你选择适合你企业的套餐。若试用期结束,你不会产生任何费用。",
  'landing.faq.q5.q': "在工坊的平板上也能用吗?",
  'landing.faq.q5.a': "可以。Detailly 为各种设备而打造 — 从办公室 PC 到车辆接收处的平板。操作会自动适配。",
  'landing.faq.q6.q': "我能把数据再带走吗?",
  'landing.faq.q6.a': "随时可以。你的数据属于你 — 一键即可导出,无需向任何人申请。",

  // ---- Abschluss-CTA -------------------------------------------------------
  'landing.cta.title': "从今天起,让你的企业井然有序。",
  'landing.cta.sub': "几分钟内注册你的企业,免费试用 Detailly 14 天。无需信用卡,无风险。",
  'landing.cta.primary': "立即免费开始",
  'landing.cta.secondary': "我已经有账户",

  // ---- Footer --------------------------------------------------------------
  'landing.footer.tagline': "面向美容养护、贴膜和 PPF 的工坊软件。在德国独立开发。",
  'landing.footer.discover': "探索",
  'landing.footer.product': "产品",
  'landing.footer.account': "账户与法律",
  'landing.footer.news': "新闻",
  'landing.footer.changelog': "更新内容",
  'landing.footer.masterclass': "大师课",
  'landing.footer.gruendung': "创业",
  'landing.footer.grosshaendler': "面向批发商",
  'landing.footer.features': "功能",
  'landing.footer.branchen': "面向你的工种",
  'landing.footer.faq': "常见问题",
  'landing.footer.trial': "免费试用",
  'landing.footer.login': "登录",
  'landing.footer.register': "注册",
  'landing.footer.impressum': "公司信息(Impressum)",
  'landing.footer.datenschutz': "数据保护",
  'landing.footer.copyright': "© {year} Detailly · 保留所有权利",

  // ---- Kundenformular ------------------------------------------------------
  'kunden.form.leitwegId.label': "路由 ID(Leitweg-ID)",
  'kunden.form.leitwegId.help': "仅用于开给政府机关/公共采购方的发票(控制 B2G 路由)。",
  'kunden.form.editTitle': "编辑客户",
  'kunden.form.saving': "保存中…",
  'kunden.form.company': "公司",
  'kunden.form.firstName': "名",
  'kunden.form.lastName': "姓",
  'kunden.form.street': "街道",
  'kunden.form.postalCode': "邮编",
  'kunden.form.noNameHelp': "未填写姓名 — 例如 DSGVO 匿名化之后。",
  'kunden.form.gdprSection': "数据保护(DSGVO)",
  'kunden.form.exportJson': "导出数据(JSON)",
  'kunden.form.anonymizeBtn': "删除 / 匿名化数据",
  'kunden.form.gdprNote': "出于法律原因(GoBD),发票会予以保留,但不再关联到个人。",
  'kunden.form.anonymize.title': "彻底删除客户数据?",
  'kunden.form.anonymize.msgPre': "个人数据将被移除或匿名化。出于法律原因(GoBD,10 年),发票会予以保留,但不再关联到个人。此操作 ",
  'kunden.form.anonymize.msgEmph': "无法撤销",
  'kunden.form.anonymize.msgPost': "。",
  'kunden.form.anonymize.confirm': "彻底删除",
  'kunden.form.error.save': "保存失败",
  'kunden.form.error.export': "导出失败",
  'kunden.form.error.anonymize': "删除失败",
  'kunden.form.gdpr.checking': "正在检查单据…",
  'kunden.form.gdpr.willAnonymize': "存在 {count} 份需保存的单据。因此客户将被匿名化 — 出于法律原因(GoBD/§147 AO),单据会予以保留,但不再关联到个人。此操作 ",
  'kunden.form.gdpr.willDelete': "不存在需保存的单据。客户及其所有车辆、预约、照片和草稿将被彻底删除。此操作 ",
  'kunden.form.gdpr.irreversible': "无法撤销。",
  'kunden.form.gdpr.confirmDelete': "彻底删除",

  // ===========================================================================
  // KUNDEN (Route "/kunden")
  // ===========================================================================
  'kunden.title': "客户",
  'kunden.subtitle': "个人客户与企业客户",
  'kunden.csvImport': "CSV 导入",
  'kunden.new': "新建客户",
  'kunden.searchPlaceholder': "按姓名、邮件、电话搜索…",

  // ---- Leerzustand ---------------------------------------------------------
  'kunden.empty.none': "尚未创建任何客户。",
  'kunden.empty.filtered': "未找到客户。",
  'kunden.empty.cta': "创建第一个客户",

  // ---- Tabellenspalten -----------------------------------------------------
  'kunden.col.name': "姓名",
  'kunden.col.typ': "类型",
  'kunden.col.email': "电子邮件",
  'kunden.col.telefon': "电话",
  'kunden.col.ort': "城市",

  // ---- Kundentyp -----------------------------------------------------------
  'kunden.type.business': "企业",
  'kunden.type.private': "个人",

  // ---- Aktionsmenü ---------------------------------------------------------
  'kunden.actionsFor': "对 {name} 的操作",
  'kunden.action.open': "打开",
  'kunden.action.newOrder': "新建工单",
  'kunden.action.edit': "编辑",

  // ---- Toast / Fehler / Löschen-Bestätigung --------------------------------
  'kunden.toast.deleted': "已删除 {name}",
  'kunden.error.delete': "删除失败",
  'kunden.delete.title': "删除客户",
  'kunden.delete.msg': "确定要删除 {name} 吗?客户将被停用并从列表中移除。已记录的工单和发票会予以保留。",

  // ---- Kundenakte (Route "/kunden/detail") ---------------------------------
  'kunden.detail.businessCustomer': "企业客户",
  'kunden.detail.privateCustomer': "个人客户",
  'kunden.detail.addVehicle': "添加车辆",
  'kunden.detail.contact': "联系方式",
  'kunden.detail.address': "地址",
  'kunden.detail.vatNumber': "增值税税号(USt-IdNr.)",
  'kunden.detail.stat.vehicles': "车辆",
  'kunden.detail.stat.openOrders': "未完成工单",
  'kunden.detail.stat.openInvoices': "未付发票",
  'kunden.detail.stat.paidTotal': "已付总额",
  'kunden.detail.pieces': "{n} 项",
  'kunden.detail.vehicles': "车辆",
  'kunden.detail.vehicleCountOne': "{n} 辆",
  'kunden.detail.vehicleCountMany': "{n} 辆",
  'kunden.detail.emptyVehicles': "未登记车辆。",
  'kunden.detail.openFile': "档案",
  'kunden.detail.appointments': "预约",
  'kunden.detail.newestFirst': "最新优先",
  'kunden.detail.emptyAppts': "无预约。",
  'kunden.detail.orders': "工单",
  'kunden.detail.totalCount': "共 {n} 项",
  'kunden.detail.emptyOrders': "尚无工单。",
  'kunden.detail.invoices': "发票与报价单",
  'kunden.detail.emptyInvoices': "尚无单据。",
  'kunden.detail.pdf': "PDF",
  'kunden.detail.error.load': "无法加载客户",
  'kunden.detail.error.pdf': "无法加载 PDF",

  // ===========================================================================
  // FAHRZEUGE (Route "/fahrzeuge")
  // ===========================================================================
  'fahrzeuge.title': "车辆",
  'fahrzeuge.subtitle': "带车辆档案的车辆库存",
  'fahrzeuge.new': "新建车辆",
  'fahrzeuge.searchPlaceholder': "按车牌、品牌、型号或车主搜索…",

  // ---- Leerzustand ---------------------------------------------------------
  'fahrzeuge.empty.none': "尚未创建任何车辆。",
  'fahrzeuge.empty.filtered': "未找到车辆。",
  'fahrzeuge.empty.cta': "创建第一辆车",

  // ---- Tabellenspalten -----------------------------------------------------
  'fahrzeuge.col.fahrzeug': "车辆",
  'fahrzeuge.col.kennzeichen': "车牌",
  'fahrzeuge.col.halter': "车主",
  'fahrzeuge.col.baujahr': "出厂年份",

  // ---- Aktionsmenü ---------------------------------------------------------
  'fahrzeuge.actionsFor': "对 {name} 的操作",
  'fahrzeuge.action.open': "打开车辆档案",
  'fahrzeuge.action.newOrder': "新建工单",

  // ---- Formular (Neues Fahrzeug) -------------------------------------------
  'fahrzeuge.form.halter': "车主",
  'fahrzeuge.form.selectPlaceholder': "– 选择 –",
  'fahrzeuge.form.marke': "品牌",
  'fahrzeuge.form.modell': "型号",
  'fahrzeuge.form.variante': "版本",
  'fahrzeuge.form.baujahr': "出厂年份",
  'fahrzeuge.form.farbe': "颜色",
  'fahrzeuge.form.kennzeichen': "车牌",
  'fahrzeuge.form.kraftstoff': "燃料",
  'fahrzeuge.form.flaeche': "面积(㎡)",

  // ---- Kraftstoffarten -----------------------------------------------------
  'fahrzeuge.fuel.petrol': "汽油",
  'fahrzeuge.fuel.diesel': "柴油",
  'fahrzeuge.fuel.electric': "纯电",
  'fahrzeuge.fuel.hybrid': "混动",
  'fahrzeuge.saving': "保存中…",

  // ---- Toast / Fehler / Löschen-Bestätigung --------------------------------
  'fahrzeuge.toast.deleted': "已删除 {name}",
  'fahrzeuge.error.delete': "删除失败",
  'fahrzeuge.error.save': "保存失败",
  'fahrzeuge.delete.title': "删除车辆",
  'fahrzeuge.delete.msg': "确定要删除 {name} 吗?车辆将从列表中移除。已记录的工单和预约会予以保留。",

  // ---- Fahrzeugakte (Route "/fahrzeuge/detail") ----------------------------
  'fahrzeuge.detail.subtitle': "车辆档案",
  'fahrzeuge.detail.masterData': "主数据",
  'fahrzeuge.detail.makeModel': "品牌 / 型号",
  'fahrzeuge.detail.area': "面积",
  'fahrzeuge.detail.sqm': "{n} ㎡",
  'fahrzeuge.detail.toOwner': "前往车主",
  'fahrzeuge.detail.orderHistory': "工单历史",
  'fahrzeuge.detail.emptyOrders': "该车辆尚无工单。",

  // ===========================================================================
  // BELEGE / RECHNUNGEN (Route "/rechnungen")
  // ===========================================================================
  'rechnungen.title': "单据",
  'rechnungen.subtitle': "报价单和发票",
  'rechnungen.searchPlaceholder': "按编号或客户搜索…",
  'rechnungen.tab.alle': "全部",

  // ---- Leerzustände --------------------------------------------------------
  'rechnungen.empty.none': "尚无单据。单据由工单生成。",
  'rechnungen.empty.filtered': "此视图中没有单据。",

  // ---- Tabellenspalten -----------------------------------------------------
  'rechnungen.col.nummer': "编号",
  'rechnungen.col.art': "类型",
  'rechnungen.col.kunde': "客户",
  'rechnungen.col.datum': "日期",
  'rechnungen.col.status': "状态",
  'rechnungen.col.brutto': "含税",

  // ---- Art / Status --------------------------------------------------------
  'rechnungen.kind.angebot': "报价单",
  'rechnungen.kind.rechnung': "发票",
  'rechnungen.status.entwurf': "草稿",
  'rechnungen.status.offen': "未付",
  'rechnungen.status.bezahlt': "已付",
  'rechnungen.status.storniert': "已作废",

  // ---- Fälligkeit / Versand-Badges -----------------------------------------
  'rechnungen.overdue': "已逾期 {tage} 天",
  'rechnungen.dueIn': "{tage} 天后到期",
  'rechnungen.sent': "已发送",
  'rechnungen.sentOn': "于 {datum} 发送",

  // ---- Mahnstufen ----------------------------------------------------------
  'rechnungen.mahn.stufe1': "付款提醒",
  'rechnungen.mahn.stufe2': "第 1 次催款",
  'rechnungen.mahn.stufe3': "第 2 次催款",
  'rechnungen.mahn.generic': "催款级别 {stufe}",

  // ---- Zeilen-Aktionen -----------------------------------------------------
  'rechnungen.action.pdf': "下载 PDF",
  'rechnungen.action.xrechnung': "XRechnung(XML)",
  'rechnungen.action.send': "通过邮件发送",
  'rechnungen.action.resend': "通过邮件重新发送",
  'rechnungen.action.markPaid': "标记为已付",
  'rechnungen.action.copyLink': "复制下载链接",
  'rechnungen.action.mahnen': "催款",
  'rechnungen.action.storno': "作废",
  'rechnungen.action.setStatus': "设为「{status}」",
  'rechnungen.actionsFor': "对 {nummer} 的操作",
  'rechnungen.linkPrompt': "复制下载链接:",

  // ---- Storno-Bestätigung --------------------------------------------------
  'rechnungen.storno.title': "作废单据",
  'rechnungen.storno.msg': "确定要作废单据 {nummer} 吗?已作废的单据无法再次激活。",
  'rechnungen.storno.msgPaid': "确定要作废已付发票 {nummer} 吗?作废无法撤销 — 退款或返还可能需另行处理。",

  // ---- Toast-Meldungen -----------------------------------------------------
  'rechnungen.toast.statusUpdated': "状态已更新",
  'rechnungen.toast.storniert': "单据已作废",
  'rechnungen.toast.paid': "已标记为已付",
  'rechnungen.toast.sent': "单据已通过邮件发送",
  'rechnungen.toast.linkCopied': "已复制下载链接",
  'rechnungen.toast.mahnSent': "催款已发送",

  // ---- Fehlermeldungen -----------------------------------------------------
  'rechnungen.error.statusChange': "状态更改失败",
  'rechnungen.error.pdf': "无法加载 PDF",
  'rechnungen.error.xrechnung': "无法生成 XRechnung",
  'rechnungen.error.paid': "无法标记为已付",
  'rechnungen.error.send': "邮件发送失败",
  'rechnungen.error.link': "无法生成链接",
  'rechnungen.error.mahn': "催款失败",

  // ===========================================================================
  // AUFTRÄGE (Route "/auftraege")
  // ===========================================================================
  'auftraege.title': "工单",

  // ---- Leerzustände --------------------------------------------------------

  // ---- Tabellenspalten -----------------------------------------------------

  // ---- Zeilen-Aktionen -----------------------------------------------------

  // ---- Status --------------------------------------------------------------

  // ---- Leistungsart --------------------------------------------------------

  // ---- Formular (Neuer Auftrag) --------------------------------------------

  // ---- Toast / Fehler ------------------------------------------------------

  // ---- Löschen-Bestätigung -------------------------------------------------

  // ---- Auftragsdetail (Route "/auftraege/detail") --------------------------

  // ---- Fotos (Komponente FotoBereich) --------------------------------------

  // ===========================================================================
  // KALKULATION (Route "/kalkulation")
  // ===========================================================================

  // ---- Katalog-Hinweis (fixer Betriebstyp) ---------------------------------

  // ---- Rahmenparameter -----------------------------------------------------

  // ---- Keramik-Option ------------------------------------------------------

  // ---- Live-Summe ----------------------------------------------------------

  // ---- Modus-Umschalter (Folierer) -----------------------------------------

  // ---- Material-Rechner (Folie: Fläche → Laufmeter → Kosten) ----------------

  // ===========================================================================
  // BUCHHALTUNG (Route "/buchhaltung")
  // ===========================================================================

  // ---- Zeitraum ------------------------------------------------------------

  // ---- Format --------------------------------------------------------------

  // ---- Export --------------------------------------------------------------

  // ---- Einnahmenübersicht (EÜR-orientiert) ---------------------------------

  // ---- Arbeitszeiten -------------------------------------------------------

  // ---- Toast / Fehler ------------------------------------------------------

  // ===========================================================================
  // MAHNUNGEN (Route "/mahnungen")
  // ===========================================================================

  // ---- Mahnstufe (nächste zu versendende Stufe) ----------------------------

  // ---- Kennzahlen ----------------------------------------------------------

  // ---- Tabelle -------------------------------------------------------------

  // ---- Bestätigungen -------------------------------------------------------

  // ---- Toast / Fehler ------------------------------------------------------

  // ===========================================================================
  // FAHRZEUGANNAHME (Route "/fahrzeugannahme")
  // ===========================================================================

  // ---- Querverweis 3D-Schadenserfassung ------------------------------------

  // ---- Annahme-Formular ----------------------------------------------------

  // ---- Schadensdiagramm ----------------------------------------------------

  // ---- Letzte Annahmen -----------------------------------------------------

  // ---- Marker-Editor -------------------------------------------------------

  // ---- Schadensart (Enum) --------------------------------------------------

  // ---- Schweregrad (Enum) --------------------------------------------------

  // ---- Inspektions-Status (Enum) -------------------------------------------

  // ---- Toast / Fehler ------------------------------------------------------
  // Ansichten des 2D-Diagramms (FahrzeugDiagramm)

  // ===========================================================================
  // SCHADENSERFASSUNG (Route "/schadenserfassung") – 3D/2D + Kalkulieren
  // ===========================================================================
  // Querverweis zur klassischen 2D-Annahme
  // Warnhinweis: nicht alle Schäden übernommen
  // Gesperrter (unterschriebener) Beleg
  // Leerzustand: keine Inspektion
  // Bühne (3D/2D-Ansicht)
  // Sofort-Kalkulation (Panel)
  // Leistungsarten der Kalkulation (KALK_LEISTUNGEN)
  // Fahrzeuggrößen (FAHRZEUG_GROESSEN)
  // Zwischenablage-Text der Kalkulation
  // Schaden-Editor (Seitenpanel)
  // Unterschrift (SignaturePad + Modal-Titel)
  // Unterschrift widerrufen (Dialog)
  // Schaden löschen (Dialog)
  // Einwilligungstext (Client-Spiegel des serverseitigen CONSENT_TEXT)
  // Fehlermeldungen
  // Neue Inspektion (NeueInspektionModal)

  // ===========================================================================
  // LEISTUNGEN (Route "/leistungen")
  // ===========================================================================

  // ---- Leerzustände --------------------------------------------------------

  // ---- Tabelle -------------------------------------------------------------

  // ---- Aktionsmenü ---------------------------------------------------------

  // ---- Formular ------------------------------------------------------------

  // ---- Kategorie (Enum) ----------------------------------------------------

  // ---- Einheit (Enum) ------------------------------------------------------

  // ---- Fehler --------------------------------------------------------------

  // ---- Starter-Katalog: Leerzustand-CTA ------------------------------------

  // ===========================================================================
  // STARTER-KATALOG (Onboarding-Dialog: Leistungen je Gewerk übernehmen)
  // ===========================================================================

  // ===========================================================================
  // ABO & TARIF (Route "/abo")
  // ===========================================================================

  // ---- Toast / Fehler ------------------------------------------------------

  // ---- Aktueller Stand -----------------------------------------------------

  // ---- Zahlweise-Umschalter ------------------------------------------------

  // ---- Tarif-Karten --------------------------------------------------------

  // ---- Zubuchbare Erweiterungen (à-la-carte Add-ons) -----------------------

  // ---- Module (Feature-Codes → Beschriftung) -------------------------------

  // ---- Zugriffsstufe (Enum) ------------------------------------------------

  // ---- Abo-Status (Enum) ---------------------------------------------------

  // ---- Gewerke-Empfehlung (Bundles, Preismodell V3) ------------------------
  // Bundle-Namen sind Markennamen -> in allen Sprachen gleich; nur die
  // Beschreibungen werden übersetzt.

  // ---- Registrierung: Start-Paket-Hinweis (rein informativ) ----------------

  // ---- Registrierung: Rechts-Zustimmung (AGB / Datenschutz / AVV) -----------

  // ===========================================================================
  // Plantafel (Termin-Kalender)
  // ===========================================================================

  // ===========================================================================
  // Standorte (Filialverwaltung)
  // ===========================================================================

  // ===========================================================================
  // Mitarbeiter (Benutzerverwaltung)
  // ===========================================================================
  // Tarif-Kontingent (maxUsers): X von Y genutzt + Upgrade-Weg bei Erreichen.

  // ===========================================================================
  // Zeiterfassung (Stempeluhr, Route "/zeiterfassung")
  // ===========================================================================

  // ===========================================================================
  // Audit-Log (Route "/audit")
  // ===========================================================================

  // ===========================================================================
  // Auswertungen (Berichte, Route "/auswertungen")
  // ===========================================================================

  // ===========================================================================
  // Dashboard (Route "/dashboard")
  // ===========================================================================

  // ---- §19-Umsatzgrenzen-Wächter (nur Kleinunternehmer + Leitung) ----------

  // ---- Dashboard anpassen (Kacheln anordnen + ein-/ausblenden je Nutzer) ----

  // ===========================================================================
  // Shop & Lager (Route "/shop")
  // ===========================================================================
  // ---- Welle 2: Bestand (Buchen, Historie, Produkt bearbeiten) --------------
  // ---- Welle 2: Folien-Bibliothek + Restrollen ------------------------------
  // ---- Welle 2: Vermietung ---------------------------------------------------

  // ===========================================================================
  // Marktplatz (Route "/marktplatz")
  // ===========================================================================

  // Marktplatz-Shop (PR5): Kategorie-Navigation, Filter, Sortierung, Detailseite

  // Bewertung schreiben (nur verifizierte Käufer)

  // Marktplatz-Pflege: Großhändler-Bewerbungen (Route "/plattform-marktplatz")
  // ---------------------------------------------------------------------------

  // KYB-Vorprüfung der Gewerbeanmeldung (Welle 5)

  // Betreiber-Admin (PR7): Kategorien, Moderation, Highlights, Händler-Logins
  // ---------------------------------------------------------------------------
  // Kategorien
  // Highlights
  // Moderation
  // Händler-Login-Verwaltung

  // ===========================================================================
  // GETEILTE UI-CHROME-KOMPONENTEN (components/*) – eigener Text der Bausteine
  // ===========================================================================

  // ---- Generisch -----------------------------------------------------------

  // ---- Pager ---------------------------------------------------------------

  // ---- Aktionsmenü (Kebab) -------------------------------------------------

  // ---- Topbar --------------------------------------------------------------

  // ---- Navigation (mobil/Sidebar geteilt) ----------------------------------

  // ---- Command-Palette (globale Suche) -------------------------------------

  // ---- Command-Palette: Befehle & feste Aktionen ---------------------------

  // ---- Hinweise (Glocke) ---------------------------------------------------

  // Ziele-/Erinnerungs-Nudges (client-seitig, nur Inhaber). Steuer-Hinweise
  // tragen IMMER den Haftungshinweis (keine Steuerberatung).
  // Auslastungs-Nudge (Welle 2): Wochen-Auslastung unter Ziel -> Luft im Kalender.

  // ---- E-Mail-Bestätigungs-Banner ------------------------------------------

  // ---- Onboarding-Checkliste -----------------------------------------------

  // ---- Wirtschaftlichkeit (Profitability) ----------------------------------

  // ---- Auftragszeiten (OrderTimeCard) --------------------------------------

  // ---- Material am Auftrag (OrderMaterialCard) -----------------------------
  // lfm-Helfer: aus Fläche + Verschnitt die Laufmeter-Menge der gewählten Folie berechnen.

  // ---- Verschnitt am Auftrag: Restrolle wählen + Ampel geplant/verbraucht --

  // ---- Leistungsdetails am Auftrag (LeistungDetailsEditor) -----------------

  // ---- CSV-Import (ImportModal) --------------------------------------------

  // ===========================================================================
  // Zentrale Enum-/Status-Labels (kanonische Quelle für labels.ts & branche.tsx)
  // ---------------------------------------------------------------------------
  // Aufrufer nutzen die *_KEY-Maps aus @/lib/labels: t(KEY[wert] ?? wert).
  // Farb-/Badge-/NEXT-Maps bleiben sprachneutral in labels.ts.
  // ===========================================================================
  // ---- Auftrags-Status -----------------------------------------------------

  // ---- Leistungsart --------------------------------------------------------
  // ---- Rollen (Plattform + Betrieb) ----------------------------------------

  // ---- Ticket-Status -------------------------------------------------------
  // ---- Ticket-Kategorie ----------------------------------------------------
  // ---- Termin-Status -------------------------------------------------------
  // ---- Rechnungs-Status ----------------------------------------------------
  // ---- Schweregrad ---------------------------------------------------------
  // ---- Abo-Status ----------------------------------------------------------
  // ---- Zugriffsstufe -------------------------------------------------------
  // ---- Schadensart (3D-Erfassung) ------------------------------------------
  // ---- Schadensherkunft ----------------------------------------------------
  // ---- Inspektions-Typ -----------------------------------------------------
  // ---- Inspektions-Status --------------------------------------------------
  // ---- Marktplatz-Bereiche -------------------------------------------------
  // ---- Betriebstyp (Branchen-Theming) --------------------------------------
  // ---- Generischer Inspektions-Fallback ------------------------------------

  // ---------------------------------------------------------------------------
  // Welle 1: Angebots-Varianten, Annahme, Freigabe-Link, Anzahlung, Garantie
  // ---------------------------------------------------------------------------

  // Dokumente & Vorlagen (druckbare Auftragskarte + Annahme-/Übergabeprotokoll).

  // ---- Fahrzeug-Wechsel (wiederverwendbarer Dialog) ------------------------

  // Auftrags-Detail: Fahrzeug des Auftrags (und daraus erzeugter Angebote) wechseln.

  // Fahrzeugannahme: Warnung, wenn beim Wechsel bereits Schäden erfasst sind.

  // Schadenserfassung: Fahrzeug der aktiven Inspektion anzeigen/wechseln.

  // ---- Erfolge & Bestenliste (Gamification, betriebsintern) ---------------

  // ---- Einstellungen · Über / Version -------------------------------------

  // ---- Changelog · Öffentliche Seite „Was ist neu" -------------------------

  // ---- Diagramm-Export (CSV / PNG) -----------------------------------------

  // ---- Newsletter · Landing-Anmeldung (Double-Opt-in) ----------------------

  // ---- Newsletter · Bestätigungs-Seite -------------------------------------

  // ---- Newsletter · Abmelde-Seite ------------------------------------------

  // ---- Newsletter · Status-Labels ------------------------------------------

  // ---- Newsletter · Admin (Plattform-Betreiber) ----------------------------

  // --- Schichtdicken-Messprotokoll (Lackschichtdicke, µm; Pro-Add-on) ---

  // Dellenkalkulation (Smart Repair / PDR – Hagel-/Parkdellen).

  // E-Rechnungs-Eingang (Empfang + Lesen empfangener E-Rechnungen, §14 UStG).

  // ---- Fahrzeugannahme · Kennzeichen-Schnellstart (Welle 4, Paket F) -------
  // Schnellanlage bei "kein Treffer": Minimalfelder + optional aufklappbarer Rest.
  // Preisvorschlag aus der eigenen Auftragshistorie (Welle 4, Paket G).
  // ---- Datenpannen-Register (Art. 33/34 DSGVO) -----------------------------

  // --- Sentinel Teil 2: Betreiber-Sicht „Sicherheit" ---
  // ---------------------------------------------------------------------------
  // Betreiber-Cockpit (Detailly-Plattform, read-only). Nur Plattform-Rollen.
  // ---------------------------------------------------------------------------

  // Übersicht

  // Standorte

  // Betriebe (Liste + Detail)

  // Nutzer-Lookup (nur Plattform-Admin)

  // ---- Cockpit: Pilot-Verwaltung (nur Plattform-Admin) ---------------------

  // Protokoll (nur Plattform-Admin)
  // ---- Händler-Portal (angemeldet, Marktplatz-Ausbau PR8) ------------------
  // PR9: neu freigegebene Katalog-Felder im Produktformular
  // ---- Geräte-Gebrauchtmarkt ----------------------------------------------

  // ---- Kassenbuch (GoBD, Barzahlungen) -------------------------------------

  // ===========================================================================
  // DATENSCHUTZ-COCKPIT (Route "/datenschutz-cockpit", DSGVO Art. 5/15/17)
  // ===========================================================================

  // ---- Gebrauchtmarkt · Regeln + Melden (PR5) -----------------------------
  // ---- Betreiber-Moderation Gebrauchtmarkt (Plattform-Rollen) -------------

  // ---- Empfehlungs-/Affiliate-Programm (Weiterempfehlen) -------------------

  // ---- Schaufenster / Referenzen (Vorher/Nachher) --------------------------
  // Öffentliche Schaufenster-Seite
};
