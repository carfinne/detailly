// ===========================================================================
// JA – WÖRTERBUCH (Partial<Dict>) · 日本語 (Japanisch)
// ---------------------------------------------------------------------------
// MT-gestützte Erstübersetzung — professionelle Prüfung empfohlen.
// Enthält die UI-Keys aus de.ts, nach Japanisch übersetzt. Bleibt technisch
// `Partial<Dict>`: fehlende/neue Keys fallen automatisch auf DE zurück
// (siehe ../provider, t() → de[key]) — nie ein leerer String oder der rohe Key.
// Juristische Volltexte (AGB, AVV, Datenschutz, Widerrufsbelehrung, Impressum)
// liegen NICHT in diesem Wörterbuch, sondern in den jeweiligen Seiten-Komponenten
// und bleiben bewusst auf Deutsch.
//
// Platzhalter wie {name}/{year} bleiben unverändert (werden zur Laufzeit ersetzt).
// ===========================================================================

import type { Dict } from './de';

export const ja: Partial<Dict> = {
  // ---- Gemeinsame UI-Texte -------------------------------------------------
  'common.save': "保存",
  'common.cancel': "キャンセル",
  'common.confirm': "確認",
  'common.delete': "削除",
  'common.close': "閉じる",
  'common.back': "戻る",
  'common.loading': "読み込み中",
  'common.loadingEllipsis': "読み込み中…",
  'common.loadingBrand': "Detailly を読み込んでいます…",
  'common.error': "エラー",
  'common.toStart': "スタートページへ",
  // ---- Fehler-/Leerzustaende (App-Router error/not-found Boundaries) --------
  'errorBoundary.title': "問題が発生しました",
  'errorBoundary.desc': "予期しないエラーが発生しました。もう一度お試しいただくか、ページを再読み込みしてください。",
  'errorBoundary.retry': "再試行",
  'errorBoundary.reload': "ページを再読み込み",
  'errorBoundary.reference': "参照番号",
  'notFound.title': "ページが見つかりません",
  'notFound.desc': "このページは存在しないか、移動されました。アドレスをご確認いただくか、スタートページに戻ってください。",
  'notFound.dashboard': "ダッシュボードへ",
  // ---- 2FA-Erzwingung (serverseitige Pflicht) ------------------------------
  'mfa.gate.title': "二要素認証が必要です",
  'mfa.gate.desc': "お使いのアカウントでは二要素認証が必須です。Detailly を引き続きご利用いただくため、今すぐ設定してください。",
  'mfa.gate.logout': "ログアウト",
  'common.toSubscription': "契約・プランへ",

  // ---- Sprachumschalter ----------------------------------------------------
  'switcher.label': "言語を選択",
  'switcher.current': "現在の言語",

  // ---- Navigation: Gruppen -------------------------------------------------
  'nav.group.overview': "概要",
  'nav.group.operations': "業務",
  'nav.group.intake': "受付・見積",
  'nav.group.masterdata': "マスタデータ",
  'nav.group.finance': "会計",
  'nav.group.material': "資材",
  'nav.group.organization': "組織",
  'nav.group.platform': "プラットフォーム",

  // ---- Navigation: Einträge ------------------------------------------------
  'nav.item.dashboard': "ダッシュボード",
  'nav.item.achievements': "実績",
  'nav.item.orders': "作業指示",
  'nav.item.calculation': "見積",
  'nav.item.intakeQuick': "受付(クイック)",
  'nav.item.intake3d': "受付・鑑定(3D)",
  'nav.item.dellenkalkulation': "デント見積(PDR)",
  'nav.item.schichtdicke': "膜厚測定",
  'nav.item.planboard': "予定表",
  'nav.item.requests': "問い合わせ",
  'nav.item.customers': "顧客",
  'nav.item.vehicles': "車両",
  'nav.item.services': "サービス",
  'nav.item.invoices': "請求書",
  'nav.item.incomingInvoices': "電子請求書の受信",
  'nav.item.cashbook': "現金出納帳",
  'nav.item.reminders': "督促",
  'nav.item.reports': "分析",
  'nav.item.accounting': "経理",
  'nav.item.shop': "資材・在庫",
  'nav.item.marketplace': "マーケットプレイス",
  'nav.item.locations': "拠点",
  'nav.item.staff': "従業員",
  'nav.item.time': "勤怠管理",
  'nav.item.showcase': "ショーケース",
  'nav.item.audit': "監査ログ",
  'nav.item.settings': "設定",
  'nav.item.help': "ヘルプ・サポート",
  'nav.item.assistant': "サポートアシスタント",
  'nav.item.subscription': "契約・プラン",
  'nav.item.cockpit': "コックピット",
  'nav.item.platformAnalytics': "プラットフォーム分析",
  'nav.item.platformMarketplace': "マーケットプレイス管理",
  'nav.item.platformGeraetemarkt': "中古市場のモデレーション",
  'nav.item.platformSupport': "サポート依頼",
  'nav.item.platformSecurity': "セキュリティ",
  'nav.item.platformNewsletter': "ニュースレター",
  'nav.item.subscriptions': "契約一覧",

  // ---- Einstellungen: Kalkulation (€/qm) -----------------------------------
  'settings.kalk.title': "見積 · €/㎡",
  'settings.kalk.subtitle': "3D 即時見積の基本単価です。見積画面では各値をいつでも上書きできます。",
  'settings.kalk.grouplabel': "1 平方メートルあたりの価格(税抜)",
  'settings.kalk.folierung': "ラッピング",
  'settings.kalk.ppf': "PPF / 塗装保護",
  'settings.kalk.aufbereitung': "ディテーリング",
  'settings.kalk.help': "これらの単価は 3D モジュールの初期値です(面積 × 車両サイズ × €/㎡)。空欄または 0 = 内部の標準値。",
  'settings.kalender.umsatzZielTitle': "週間売上目標",
  'settings.kalender.umsatzZielSubtitle': "予定表の売上レイヤー用の目標値 — オーナーとマネージャーにのみ表示されます。",
  'settings.kalender.umsatzZielLabel': "週あたりの目標(€ 税込)",
  'settings.kalender.umsatzZielHelp': "空欄 = 目標なし。進捗バーは予定表の週ヘッダーに表示されます。",

  // ---- Einstellungen: Kalender & Online-Buchung (Kalender 2.0 W2) ----------
  'settings.kalender.title': "カレンダー・オンライン予約",
  'settings.kalender.subtitle': "曜日ごとの営業時間、スロット間隔、公開予約ポータル用のリードタイム。",
  'settings.kalender.von': "から",
  'settings.kalender.bis': "まで",
  'settings.kalender.slotDauer': "スロットの長さ(分)",
  'settings.kalender.puffer': "予約間のバッファ(分)",
  'settings.kalender.vorlaufMin': "最短リードタイム(時間)",
  'settings.kalender.vorlaufMax': "最長リードタイム(日)",
  'settings.kalender.hint': "営業時間を設定すると、予約ポータルに空き枠が表示されます。お客様は希望日時を入力する代わりに、空きスロットから選べます。",
  'settings.error.kalenderZeiten': "営業時間をご確認ください:有効な曜日では「まで」が「から」より後である必要があります。",
  'settings.error.kalenderWerte': "カレンダーの値をご確認ください:スロット 5〜480 分、バッファ 0〜240 分、リードタイム 0〜720 時間または 1〜365 日。",

  // ---- Buchungsseite: rechtlicher Abschluss-Modus (§312j BGB) ---------------
  'settings.buchung.modusTitle': "予約ページの成立方法",
  'settings.buchung.modusSubtitle': "公開予約ページが「拘束力のない問い合わせ」か「有償で拘束力のある予約」かを設定します。",
  'settings.buchung.modusLabel': "モード",
  'settings.buchung.modusAnfrage': "拘束力のない予約問い合わせ",
  'settings.buchung.modusVerbindlich': "拘束力のある有償予約",
  'settings.buchung.modusHelp': "問い合わせ:お客様は拘束力のない問い合わせを送信します — まだ契約は成立せず、あなたが予約を確定します。拘束力あり:オンラインで有償契約が成立します(「有償で予約」ボタン、撤回権あり)。",
  'settings.buchung.modusVerbindlichHint': "拘束力ありモードでは、お客様はオンラインであなたと有償の通信販売契約を結びます。価格表示、インプリント、撤回に関する説明を慎重にご確認ください — 責任はあなたにあります。",
  'settings.buchung.impressumIncomplete': "予約ページが不完全です:インプリント情報が不足しています。お客様には提供者(契約相手)が一部しか表示されません。下のインプリント欄で補完してください。",

  // ---- Öffentliche Buchungsseite: Verbraucherrecht (UI-Chrome) --------------
  // Die eigentlichen Rechtstexte (Widerrufsbelehrung/-formular) bleiben DEUTSCH
  // und werden NICHT übersetzt – hier nur die Bedien-Elemente.
  'buchen.recht.badge.anfrage': "オンライン予約問い合わせ",
  'buchen.recht.badge.verbindlich': "オンライン予約",
  'buchen.recht.anbieter.title': "提供者",
  'buchen.recht.anbieter.hint': "契約相手は上記の事業者であり、Detailly ではありません。",
  'buchen.recht.pflichtinfo.title': "ご予約内容の概要",
  'buchen.recht.pflichtinfo.leistung': "サービス",
  'buchen.recht.pflichtinfo.keineLeistung': "サービスが未選択です",
  'buchen.recht.pflichtinfo.preis': "価格",
  'buchen.recht.pflichtinfo.termin': "日時",
  'buchen.recht.pflichtinfo.keinTermin': "日時が未選択です",
  'buchen.recht.pflichtinfo.checkbox': "必須情報および撤回に関する説明を読みました。",
  'buchen.recht.pflichtinfo.checkboxError': "必須情報および撤回に関する説明をご確認ください。",
  'buchen.recht.widerruf.title': "撤回権",
  'buchen.recht.widerruf.deHint': "正式な法的文書はドイツ語のみで提供されます。",
  'buchen.recht.widerruf.belehrungLabel': "撤回に関する説明を表示",
  'buchen.recht.widerruf.formularLabel': "撤回書式のひな型を表示",
  'buchen.recht.vorzeitig.checkbox': "14 日間の撤回期間の満了前に事業者が履行を開始することを明示的に求めます。契約が完全に履行された時点で撤回権を失うことを承知しています。",
  'buchen.recht.vorzeitig.error': "早期の履行開始に同意いただくか、より遅い日時をお選びください。",
  'buchen.recht.datenschutz.hintAnfrage': "ご入力内容は、予約問い合わせの対応のために事業者が処理します。責任者は上記の提供者です。",
  'buchen.recht.datenschutz.hintVerbindlich': "ご入力内容は、契約の履行のために事業者が処理します。責任者は上記の提供者です。",
  'buchen.recht.datenschutz.link': "プライバシーに関する説明",
  'buchen.recht.datenschutz.checkbox': "プライバシーに関する説明を確認しました。",
  'buchen.recht.verbindlich.emailRequired': "拘束力のある有償予約には、メールアドレスが必要です — 予約確認および撤回に関する説明をそちらへ送信します。",
  'buchen.recht.verbindlich.leistungRequired': "拘束力のある予約には、サービスを選択してください。",
  'buchen.recht.anfrage.hinweis': "まだ契約は成立しません。事業者があなたの予約を確定します。",
  'buchen.recht.anfrage.button': "拘束力なく問い合わせる",
  'buchen.recht.anfrage.submitting': "送信中…",
  'buchen.recht.verbindlich.intro': "クリックすると、事業者との有償契約が成立します。",
  'buchen.recht.verbindlich.button': "有償で予約",
  'buchen.recht.verbindlich.submitting': "予約処理中…",
  'buchen.recht.success.anfrage.title': "問い合わせを送信しました",
  'buchen.recht.success.anfrage.text': "ありがとうございます。{betrieb} より予約確定のためにご連絡いたします。",
  'buchen.recht.success.verbindlich.title': "予約が確定しました",
  'buchen.recht.success.verbindlich.text': "{betrieb} での有償予約をありがとうございます。撤回に関する説明を含む確認をメールでお送りします。",
  'buchen.recht.success.reference': "参照番号:",

  // ---- Tarif-Hinweise (Feature-Gating) -------------------------------------
  'settings.sevdesk.upgrade': "sevDesk への自動連携は Basic プラン以上でご利用いただけます。",
  'ordertime.upgrade': "作業時間と人件費は Pro プランに含まれます。",

  // ---- Einstellungen: Seite ------------------------------------------------
  'settings.title': "設定",
  'settings.subtitle': "表示、プロフィール、そして — オーナーとして — 事業者データ。",
  'settings.tab.appearance': "表示",
  'settings.tab.profile': "プロフィール",
  'settings.tab.business': "事業者",
  'settings.tab.customerComm': "顧客コミュニケーション",
  'settings.tab.goals': "目標・リマインダー",
  'settings.tab.audit': "監査ログ",
  'settings.saving': "保存中…",
  'settings.toast.saved': "保存しました",

  // Einstellungen: Betrieb – Sekundaer-Navigation (Unterbereiche, je eigener Speichern-Button)
  'settings.bereich.navLabel': "事業者設定の各エリア",
  'settings.bereich.stammdaten': "基本データ・ブランド",
  'settings.bereich.steuer': "税務・インプリント",
  'settings.bereich.rechnung': "銀行・請求",
  'settings.bereich.kalender': "見積・カレンダー",
  'settings.bereich.email': "メール送信",
  'settings.bereich.mahnwesen': "督促",
  'settings.bereich.buchhaltung': "DATEV・sevDesk",
  'settings.bereich.sicherheit': "セキュリティ",

  // Einstellungen: Status-Mail-Vorlagen (editierbar, je Status Betreff + Text)
  'settings.statusmail.title': "ステータスメールのテンプレート",
  'settings.statusmail.subtitle': "お客様への自動ステータスメールの件名と本文をカスタマイズします。",
  'settings.statusmail.reviewNote': "送信のトリガーは変わりません:ステータスメールはステータス用スイッチ(顧客コミュニケーション)がオンの場合のみ送信されます。ここでは文面のみを調整します。",
  'settings.statusmail.placeholders': "利用可能なプレースホルダー:",
  'settings.statusmail.status.bestaetigt': "作業を確定",
  'settings.statusmail.status.in_arbeit': "作業中",
  'settings.statusmail.status.abholbereit': "車両の引き取り準備完了",
  'settings.statusmail.reset': "標準に戻す",
  'settings.statusmail.subject': "件名",
  'settings.statusmail.subjectPlaceholder': "標準の件名を使う場合は空欄",
  'settings.statusmail.body': "本文",
  'settings.statusmail.bodyPlaceholder': "標準の本文を使う場合は空欄",
  'settings.statusmail.defaultHint': "空欄 = 実績のある標準文が使われます。",
  'settings.statusmail.footerHint': "宛名、作業ステータスへのリンク、結びの言葉は自動で追加されます — あなたの文面はその間に入ります。",

  // Einstellungen: Benachrichtigungs-Präferenzen je Nutzer (Glocke)
  'settings.benachrichtigungen.title': "通知",
  'settings.benachrichtigungen.subtitle': "ベルにどの通知を表示するか。",
  'settings.benachrichtigungen.intro': "この設定はあなた専用です。初期状態ではすべての通知が有効です。",
  'settings.benachrichtigungen.rechnungenFaellig': "支払期限超過の請求書",
  'settings.benachrichtigungen.rechnungenFaelligHint': "請求書が支払期限を過ぎたときの通知。",
  'settings.benachrichtigungen.termineHeute': "本日の予定",
  'settings.benachrichtigungen.termineHeuteHint': "本日予定されている予約の通知。",
  'settings.benachrichtigungen.materialKnapp': "資材が残りわずか",
  'settings.benachrichtigungen.materialKnappHint': "商品が最低在庫を下回ったときの通知。",
  'settings.benachrichtigungen.steuerTermine': "税務の期日",
  'settings.benachrichtigungen.steuerTermineHint': "自分で登録した税務の期日のリマインダー。",
  'settings.benachrichtigungen.auslastung': "稼働率",
  'settings.benachrichtigungen.auslastungHint': "週の稼働率が目標を下回ったときの通知。",
  'settings.benachrichtigungen.par19': "§19 売上上限",
  'settings.benachrichtigungen.par19Hint': "小規模事業者の売上上限に近づいたときの警告。",

  // Einstellungen: Darstellung
  'settings.appearance.title': "外観",
  'settings.appearance.subtitle': "Detailly の見え方。",
  'settings.appearance.colorScheme': "カラースキーム",
  'settings.appearance.dark': "ダーク",
  'settings.appearance.light': "ライト",
  'settings.appearance.deviceOnly': "この端末とこのブラウザにのみ適用されます。",
  'settings.motion.title': "モーション",
  'settings.motion.subtitle': "アニメーションを控えめに — より静かで負担の少ない表示に。",
  'settings.motion.reduce': "アニメーションを控える",
  'settings.motion.deviceOnly': "この設定はこの端末とこのブラウザにのみ適用されます。",

  // Einstellungen: Profil
  'settings.profile.title': "マイプロフィール",
  'settings.profile.subtitle': "氏名と電話番号はご自身で管理できます。",
  'settings.profile.firstName': "名",
  'settings.profile.lastName': "姓",
  'settings.profile.phone': "電話(任意)",
  'settings.profile.email': "メール",
  'settings.profile.role': "役割",
  'settings.profile.emailRoleHint': "メールアドレスと役割は、経営者が従業員管理から変更します。",

  // Einstellungen: Passwort
  'settings.password.title': "パスワード",
  'settings.password.subtitle': "メールで届く安全なリンクからパスワードを変更します。",
  'settings.password.sent': "リセット用のメールをお送りしました。",
  'settings.password.sending': "送信中…",
  'settings.password.change': "パスワードを変更",

  // Einstellungen: Kalender-Abo
  'settings.calendar.title': "カレンダー購読(Apple / Google)",
  'settings.calendar.subtitle': "すべての予定を自動でご自身のカレンダーに — 自動更新される秘密の購読リンク経由。",
  'settings.calendar.appleLabel': "Apple カレンダー(webcal)",
  'settings.calendar.googleLabel': "Google / その他(https)",
  'settings.calendar.copy': "コピー",
  'settings.calendar.copied': "コピーしました ✓",
  'settings.calendar.appleName': "Apple カレンダー:",
  'settings.calendar.appleHelp': " ファイル → 「新規カレンダー購読…」 → webcal リンクを貼り付け。",
  'settings.calendar.googleName': "Google カレンダー:",
  'settings.calendar.googleHelp': " 他のカレンダー → 「URL で追加」 → https リンクを貼り付け。",
  'settings.calendar.secretHint': "このリンクは秘密で、予定への読み取りアクセスを付与します — 信頼できる相手にのみ共有してください。",
  'settings.calendar.regenerating': "生成中…",
  'settings.calendar.regenerate': "リンクを再生成(旧リンクを無効化)",
  'settings.calendar.confirmTitle': "カレンダーリンクを再生成",
  'settings.calendar.confirmMsg': "新しい秘密の購読リンクを生成します。これにより従来のリンクは無効になります — 既存のカレンダー購読は新しいリンクで再設定が必要です。",
  'settings.calendar.confirmLabel': "再生成",

  // Einstellungen: Verwaltung (Schnellzugriffe)
  'settings.admin.title': "管理",
  'settings.admin.subtitle': "各業務エリアへ直接。",
  'settings.admin.staffTitle': "従業員・役割",
  'settings.admin.staffText': "チームを作成し、役割とアクセスを管理します。",
  'settings.admin.locationsTitle': "拠点",
  'settings.admin.locationsText': "店舗を管理し、拠点横断で分析します。",
  'settings.admin.servicesTitle': "サービス・価格",
  'settings.admin.servicesText': "自社のサービスカタログと価格を管理します。",
  'settings.admin.subscriptionTitle': "契約・プラン",
  'settings.admin.subscriptionText': "Detailly のプランを確認・管理します。",

  // Einstellungen: Betriebstyp & Branchen-Look
  'settings.branche.title': "事業タイプ・業種の見た目",
  'settings.branche.subtitle': "アクセントカラー、見積カタログ、タイプ別オプションを決定します。",
  'settings.branche.help': "見た目(アクセントカラー)は保存後すぐに、事業者の全従業員に反映されます。",

  // Einstellungen: Dein Look (Logo & Akzentfarbe)
  'settings.branding.title': "あなたの見た目 — ロゴと色",
  'settings.branding.subtitle': "顧客向け画面(作業トラッキング、引き渡しフォルダ)用のロゴとアクセントカラー。",
  'settings.branding.logoLabel': "ロゴ",
  'settings.branding.logoPlaceholder': "ロゴなし",
  'settings.branding.logoChoose': "ロゴを選択",
  'settings.branding.logoUploading': "アップロード中…",
  'settings.branding.logoRemove': "ロゴを削除",
  'settings.branding.logoHelp': "PNG、JPEG、WebP、最大 512 KB。透過背景がおすすめです。",
  'settings.branding.logoErrorType': "ロゴには PNG、JPEG、WebP のみ使用できます。",
  'settings.branding.logoErrorSize': "ロゴが大きすぎます(最大 512 KB)。",
  'settings.branding.logoErrorGeneric': "ロゴを保存できませんでした。",
  'settings.branding.logoUploaded': "ロゴを更新しました",
  'settings.branding.logoRemoved': "ロゴを削除しました",
  'settings.branding.logoRemoveConfirmTitle': "ロゴを削除しますか?",
  'settings.branding.logoRemoveConfirmMsg': "ロゴはすべての顧客向け画面から削除されます。いつでも新しいロゴをアップロードできます。",
  'settings.branding.accentLabel': "アクセントカラー",
  'settings.branding.accentReset': "標準に戻す",
  'settings.branding.accentPreviewButton': "サンプルボタン",
  'settings.branding.accentHelp': "顧客向け画面のヘッダー、ステータス点、ボタンに色を付けます。空欄 = 業種の標準。",
  'settings.branding.accentInvalid': "有効な 16 進カラーを入力してください(例:#B5722F)。",

  // Einstellungen: Betrieb & Anschrift
  'settings.address.title': "事業者・住所",
  'settings.address.subtitle': "事業者の名称と住所",
  'settings.address.name': "事業者名",
  'settings.address.email': "メール",
  'settings.address.phone': "電話",
  'settings.address.street': "番地",
  'settings.address.postalCode': "郵便番号",
  'settings.address.city': "市区町村",
  'settings.address.country': "国",
  'settings.address.taxHintPre': "§14 UStG:名称、住所、税番号 ",
  'settings.address.taxHintOr': "または",
  'settings.address.taxHintPost': " 付加価値税番号(USt-IdNr.)は有効な請求書の必須事項です。",

  // Einstellungen: Steuer
  'settings.tax.title': "税務(§14 UStG)",
  'settings.tax.subtitle': "税番号または付加価値税番号は請求書に必須です。",
  'settings.tax.steuernummer': "税番号",
  'settings.tax.steuernummerPlaceholder': "例:12/345/67890",
  'settings.tax.ustId': "付加価値税番号(USt-IdNr.)",
  'settings.tax.ustIdPlaceholder': "例:DE123456789",
  // §19 UStG (Kleinunternehmer) + Rechtsform
  'settings.steuer.kleinunternehmer': "小規模事業者(§ 19 UStG)",
  'settings.steuer.kleinunternehmerHint': "付加価値税を表示しません。新しい書類は自動的に 0 % で作成されます。",
  'settings.steuer.hinweisLabel': "書類に表示する注記",
  'settings.steuer.hinweisHelp': "請求書・見積書に表示されます。標準文を使う場合は空欄にしてください。",
  'settings.steuer.standardSatz': "新しい書類の標準税率",
  'settings.steuer.standardSatzHelp': "新しい書類作成時の初期選択。書類ごとに変更可能(19 / 7 / 0 %)。",
  'settings.steuer.rechtsform': "法的形態",
  'settings.steuer.rechtsform.einzelunternehmen': "個人事業",
  'settings.steuer.rechtsform.gbr': "GbR(民法上の組合)",
  'settings.steuer.rechtsform.ug': "UG(有限責任)",
  'settings.steuer.rechtsform.gmbh': "GmbH(有限会社)",
  'settings.steuer.rechtsform.ohg': "OHG(合名会社)",
  'settings.steuer.rechtsform.kg': "KG(合資会社)",
  'settings.steuer.rechtsform.gmbh_co_kg': "GmbH & Co. KG",
  'settings.steuer.rechtsform.freiberufler': "自由業",
  'settings.steuer.rechtsform.sonstige': "その他",
  'settings.steuer.registergericht': "登記裁判所",
  'settings.steuer.registergerichtPlaceholder': "例:シャルロッテンブルク区裁判所",
  'settings.steuer.registernummer': "登記番号",
  'settings.steuer.registernummerPlaceholder': "例:HRB 123456",
  'settings.steuer.vertretung': "代表者",
  'settings.steuer.vertretungPlaceholder': "例:Max Mustermann(業務執行者)",
  'settings.steuer.infoLinkPre': "自分に何が当てはまるか不明ですか? ",
  'settings.steuer.infoLink': "小規模事業者・法的形態に関する情報",
  'settings.steuer.infoLinkPost': "(税務アドバイスではありません)。",

  // ---- Einstellungen: Ziele & Erinnerungen (Tab, nur Inhaber) --------------
  'settings.ziele.intro.title': "目標・リマインダー",
  'settings.ziele.intro.subtitle': "税務の期日と警告 — ベルに控えめな通知として表示。外部には何も送信されません。",
  // Auslastungsziel
  'settings.ziele.auslastung.title': "稼働率の目標",
  'settings.ziele.auslastung.subtitle': "事業所の稼働率に対する目標値。",
  'settings.ziele.auslastung.toggle': "稼働率の目標を有効にする",
  'settings.ziele.auslastung.toggleHint': "週の稼働率が目標を下回ると、ベルに通知が表示されます。",
  'settings.ziele.auslastung.prozentLabel': "目標稼働率(%)",
  'settings.ziele.auslastung.prozentHelp': "50〜100 %。標準:90 %。",
  // §19-Umsatzgrenzen-Warnung
  'settings.ziele.par19.title': "売上上限の警告(§ 19 UStG)",
  'settings.ziele.par19.subtitle': "小規模事業者の上限に達する前の早期警告。",
  'settings.ziele.par19.toggle': "売上上限に達する前に警告する",
  'settings.ziele.par19.toggleHint': "既存の §19 ステータス(年 100,000 €)を利用 — ベルに通知として表示されます。",
  'settings.ziele.par19.disabledHint': "「事業者」タブで小規模事業者制度(§ 19 UStG)が有効な場合のみ利用できます。",
  // Steuer-Termine
  'settings.ziele.termine.title': "税務の期日",
  'settings.ziele.termine.subtitle': "ベルが余裕をもって(14 日前に)お知らせする、自分で登録する期日。",
  'settings.ziele.termine.artLabel': "種類",
  'settings.ziele.termine.artPlaceholder': "例:付加価値税の予定申告",
  'settings.ziele.termine.datumLabel': "日付",
  'settings.ziele.termine.datumPlaceholderRec': "01-10(月-日)",
  'settings.ziele.termine.datumPlaceholderOnce': "2026-06-30(年-月-日)",
  'settings.ziele.termine.datumHelp': "繰り返し:月-日(例:01-10)。単発:年-月-日。",
  'settings.ziele.termine.wiederkehrend': "毎年",
  'settings.ziele.termine.aktiv': "有効",
  'settings.ziele.termine.remove': "削除",
  'settings.ziele.termine.add': "期日を追加",
  'settings.ziele.termine.empty': "まだ期日が登録されていません。",
  'settings.ziele.termine.max': "最大 12 件まで。",
  'settings.ziele.termine.disclaimer': "拘束力のないリマインダーであり、税務アドバイスではありません。",
  'settings.ziele.error.datum': "有効な日付を入力してください — 繰り返しは月-日、単発は年-月-日。",

  // Impressum-Generator (§ 5 DDG) – Betrieb-Tab. Pflichtangaben stammen aus den
  // Feldern oben (Adresse/Steuer). Inhalte selbst sind Betriebsdaten (nicht übersetzt).
  'settings.impressum.title': "インプリント",
  'settings.impressum.subtitle': "公開ページ(予約、ステータス、書類)向けの § 5 DDG に基づく必須事項。",
  'settings.impressum.disclaimer': "自動生成であり、法律アドバイスではありません:Detailly は基本データからインプリントを生成します。正確性と完全性については事業者ご自身が責任を負います。",
  'settings.impressum.vertretung.inhaber': "オーナー(姓名)",
  'settings.impressum.vertretung.gbr': "出資者(全員を氏名で)",
  'settings.impressum.vertretung.vertreter': "代表権者",
  'settings.impressum.vertretungPlaceholder': "例:Max Mustermann",
  'settings.impressum.vertretungHelp': "インプリントに責任者として表示されます。複数の場合は全員を記載してください。",
  'settings.impressum.complete': "インプリントは完全です — すべての必須事項が登録されています。",
  'settings.impressum.ustWarn': "推奨:付加価値税番号(§ 27a UStG)が用意でき次第、補完してください。",
  'settings.impressum.incomplete': "完全なインプリントには次の情報が不足しています:",
  'settings.impressum.incompleteHint': "不完全なインプリントは警告を受ける可能性があります。不足している項目は上のセクション(住所、税務・法的形態)で入力します。",
  'settings.impressum.feld.firmenname': "会社名",
  'settings.impressum.feld.strasse': "番地",
  'settings.impressum.feld.plz': "郵便番号",
  'settings.impressum.feld.ort': "市区町村",
  'settings.impressum.feld.telefon': "電話番号",
  'settings.impressum.feld.email': "メールアドレス",
  'settings.impressum.feld.vertretungsberechtigte': "責任者(オーナー/業務執行者/出資者)",
  'settings.impressum.feld.registergericht': "登記裁判所",
  'settings.impressum.feld.registernummer': "登記番号(HRB)",
  'settings.impressum.previewTitle': "プレビュー",
  'settings.impressum.previewHeading': "§ 5 DDG に基づく記載",
  'settings.impressum.placeholderName': "[会社名が未入力]",
  'settings.impressum.previewPhone': "電話",
  'settings.impressum.previewEmail': "メール",
  'settings.impressum.previewRegister': "登記裁判所",
  'settings.impressum.previewUstId': "付加価値税番号(USt-IdNr.)",
  'settings.impressum.viewLive': "公開ビューを開く",
  'settings.impressum.optionalTitle': "任意の追加情報",
  'settings.impressum.optionalHint': "特定の事業者のみ必要 — ディテーリング/ラッピング/PPF ではほとんど関係ありません。",
  'settings.impressum.berufshaftpflicht': "職業賠償責任保険",
  'settings.impressum.berufshaftpflichtPlaceholder': "例:保険会社、住所、適用地域",
  'settings.impressum.aufsichtsbehoerde': "監督官庁",
  'settings.impressum.aufsichtsbehoerdePlaceholder': "許可を要する事業の場合のみ",

  // Einstellungen: Auf detailly.de zeigen (Opt-in Mitgliederliste)
  'settings.mitglied.title': "detailly.de に掲載",
  'settings.mitglied.subtitle': "あなたの事業所を当社のスタートページに実績として掲載 — 任意でいつでも撤回可能です。",
  'settings.mitglied.toggle': "Detailly のスタートページに掲載する",
  'settings.mitglied.toggleHint': "あなたの同意がある場合のみ。会社名、事業タイプ、任意で市区町村、短い説明、ウェブサイトが表示されます — 連絡先は決して表示されません。",
  'settings.mitglied.stadt': "都市(任意)",
  'settings.mitglied.stadtPlaceholder': "例:ベルリン",
  'settings.mitglied.kurzbeschreibung': "短い説明(任意)",
  'settings.mitglied.kurzbeschreibungPlaceholder': "例:2015 年からのプレミアム・ディテーリング & ラッピング",
  'settings.mitglied.kurzbeschreibungHelp': "最大 160 文字。",
  'settings.mitglied.webseite': "ウェブサイト(任意)",
  'settings.mitglied.webseitePlaceholder': "https://あなたの事業所.de",
  'settings.mitglied.webseiteHelp': "http:// または https:// で始める必要があります。",
  'settings.mitglied.previewLabel': "プレビュー",
  'settings.mitglied.consent': "あなたの事業所は同意がある場合のみスタートページに表示され、いつでも撤回できます。",

  // Einstellungen: Bankverbindung
  'settings.bank.title': "銀行口座",
  'settings.bank.subtitle': "請求書のフッターに表示されます。",
  'settings.bank.bankname': "銀行",
  'settings.bank.iban': "IBAN",
  'settings.bank.bic': "BIC",

  // Einstellungen: Rechnungsstellung
  'settings.invoice.title': "請求",
  'settings.invoice.subtitle': "新しい請求書の初期値 — 既存の書類は変更されません。",
  'settings.invoice.paymentTerm': "支払期限(日)",
  'settings.invoice.paymentTermHelp': "空欄 = 14 日。",
  'settings.invoice.paymentLink': "支払リンク",
  'settings.invoice.paymentLinkPlaceholder': "https://paypal.me/あなたの事業所",
  'settings.invoice.paymentLinkHelp': "自社の PayPal.me または Stripe の支払リンク。公開書類ページに「オンラインで支払う」ボタンとして表示されます — 支払いは Detailly を経由せず、直接あなたに届きます。https:// で始める必要があります。",
  'settings.invoice.footer': "書類のフッター文",
  'settings.invoice.footerPlaceholder': "例:ご依頼ありがとうございます!当社の利用規約が適用されます。",
  'settings.invoice.footerHelp': "見積・請求 PDF のフッターに表示されます。",

  // Einstellungen: Mahnwesen
  'settings.mahn.title': "督促",
  'settings.mahn.subtitle': "支払リマインダーおよび督促の期限と手数料。",
  'settings.mahn.auto': "自動で督促する",
  'settings.mahn.autoHint': "自動督促 — オフの場合は督促コックピットで手動で督促します。",
  'settings.mahn.deadlines': "期限(支払期限からの日数)",
  'settings.mahn.reminder': "リマインダー",
  'settings.mahn.dunning1': "第 1 督促",
  'settings.mahn.dunning2': "第 2 督促",
  'settings.mahn.deadlinesHelp': "厳密に昇順:リマインダー < 第 1 督促 < 第 2 督促(各 1〜365 日)。",
  'settings.mahn.fees': "督促手数料(€)",
  'settings.mahn.feesHelp': "段階ごとに 0〜999 €。督促に追加項目として表示されます。",

  // Einstellungen: Kunden-Benachrichtigungen
  'settings.notify.title': "顧客通知",
  'settings.notify.subtitle': "お客様への自動メール — いつでもオフにできます。",
  'settings.notify.status': "作業のステータスメール",
  'settings.notify.statusHint': "メールアドレスのあるお客様には、重要なステータス変更時に作業トラッキングへのリンク付きメッセージが自動送信されます。",
  'settings.notify.appointment': "予約確認",
  'settings.notify.appointmentHint': "オンライン予約問い合わせが承認されると、お客様に確認メールが届きます。",

  // Einstellungen: Kundenkommunikation (Termin-Erinnerung, Bewertungs-Bitte, Status-Mails)
  'settings.kk.intro.title': "顧客コミュニケーション",
  'settings.kk.intro.subtitle': "お客様への自動メール — リマインダー、レビュー依頼、ステータス情報。",
  'settings.kk.reviewNote': "意図せず送信されることはありません:自動の顧客メールは、各スイッチを意図的にオンにした場合のみ送信します。ここのすべてはいつでもオフにできます。",
  'settings.kk.reminder.title': "予約リマインダー",
  'settings.kk.reminder.subtitle': "メールアドレスのあるお客様に、近づく予約を自動でお知らせします。",
  'settings.kk.reminder.toggle': "予約リマインダーを送る",
  'settings.kk.reminder.toggleHint': "お客様は予約前に丁寧なリマインダーを受け取ります — 各リマインダーは一度だけ送信されます。",
  'settings.kk.reminder.hoursLabel': "リードタイム(何時間前)",
  'settings.kk.reminder.hoursHelp': "予約開始の何時間前にリマインダーを送るか(1〜168、標準 24)。",
  'settings.kk.review.title': "レビュー依頼",
  'settings.kk.review.subtitle': "「車両の引き取り準備完了」メールにレビューリンクを付けます — 有効かつリンクが登録されている場合のみ。",
  'settings.kk.review.toggle': "レビューをお願いする",
  'settings.kk.review.toggleHint': "完了メールに Google レビューへのリンクを追加します。",
  'settings.kk.review.urlLabel': "Google レビューのリンク",
  'settings.kk.review.urlHelp': "https:// で始める必要があります。Google ビジネスプロフィール(「クチコミを書く」)から取得するのが最も簡単です。",
  'settings.kk.review.urlPlaceholder': "https://g.page/r/...",
  'settings.kk.review.textLabel': "独自の案内文(任意)",
  'settings.kk.review.textHelp': "標準文を使う場合は空欄にしてください。",
  'settings.kk.review.textPlaceholder': "ご満足いただけましたか?短いレビューをいただけますと大変うれしく思います:",
  'settings.kk.error.url': "レビューのリンクは https:// で始める必要があります。",

  // Einstellungen: Sicherheit (2FA-Pflicht, Owner-Policy)
  'settings.security.title': "セキュリティ",
  'settings.security.subtitle': "チームのための二要素認証。",
  'settings.security.mfaRequired': "従業員に 2FA を必須化",
  'settings.security.mfaRequiredHint': "すべての事業者ロールは、作業を続ける前に二要素認証を設定する必要があります。",

  // Zwei-Faktor-Authentifizierung (Profil-Sektion + Banner)
  'mfa.title': "二要素認証",
  'mfa.subtitle': "認証アプリでアカウントをさらに保護します。",
  'mfa.idle.desc': "二要素認証が有効な場合、ログイン時に認証アプリのワンタイムコードが追加で必要になります。",
  'mfa.idle.setupCta': "2FA を設定",
  'mfa.required.note': "あなたの事業所は二要素認証を求めています。今すぐ設定してください。",
  'mfa.recommended.note': "あなたの役割には二要素認証を強くおすすめします。",
  'mfa.setup.step1': "認証アプリでスキャン",
  'mfa.setup.step2': "スキャンできない場合は、このキーをアプリに手動で入力してください。",
  'mfa.setup.secretLabel': "設定キー",
  'mfa.setup.copySecret': "コピー",
  'mfa.setup.secretCopied': "コピーしました",
  'mfa.setup.codeLabel': "アプリのコード",
  'mfa.setup.codeHint': "設定を完了するには、現在表示されている 6 桁のコードを入力してください。",
  'mfa.setup.activate': "有効にする",
  'mfa.setup.cancel': "キャンセル",
  'mfa.recovery.title': "リカバリーコード",
  'mfa.recovery.desc': "これらのコードは安全に保管してください — 各コードはちょうど一度だけ使えます。",
  'mfa.recovery.warn': "これらのコードは今だけ表示されます。認証アプリがない場合、これらが唯一のアクセス手段です — 安全な場所に保存または印刷してください。",
  'mfa.recovery.copy': "すべてコピー",
  'mfa.recovery.copied': "コピーしました",
  'mfa.recovery.download': "ファイルとして保存",
  'mfa.recovery.done': "保存しました",
  'mfa.enabled.status': "二要素認証は有効です。",
  'mfa.enabled.deactivate': "2FA を無効にする",
  'mfa.deact.title': "無効にするには、現在のアプリコードまたはパスワードを入力してください。",
  'mfa.deact.codeLabel': "アプリのコード",
  'mfa.deact.passwordLabel': "パスワード",
  'mfa.deact.usePassword': "代わりにパスワードを使う",
  'mfa.deact.useCode': "代わりにアプリコードを使う",
  'mfa.deact.confirm': "無効にする",
  'mfa.deact.cancel': "キャンセル",
  'mfa.toast.activated': "二要素認証を有効にしました。",
  'mfa.toast.deactivated': "二要素認証を無効にしました。",
  'mfa.error.generic': "操作に失敗しました。もう一度お試しください。",
  'mfa.banner.required': "あなたの事業所は二要素認証を求めています。今すぐ設定してください。",
  'mfa.banner.recommended': "あなたの役割には二要素認証を強くおすすめします。",
  'mfa.banner.setupCta': "今すぐ設定",

  // Einstellungen: Mail-Versand
  'settings.mail.title': "メール送信(独自の送信者)",
  'settings.mail.subtitle': "任意:顧客メールや書類メールを独自の SMTP サーバーと送信者から送ります。",
  'settings.mail.useOwn': "独自の送信者を使う",
  'settings.mail.useOwnHint': "設定が有効でない場合、Detailly は引き続き標準アドレスで送信します。",
  'settings.mail.host': "SMTP ホスト",
  'settings.mail.hostPlaceholder': "例:smtp.あなたのプロバイダ.de",
  'settings.mail.port': "ポート",
  'settings.mail.encryption': "暗号化",
  'settings.mail.user': "ユーザー",
  'settings.mail.userPlaceholder': "メールサーバーのログイン名",
  'settings.mail.password': "パスワード",
  'settings.mail.passwordPlaceholder': "SMTP パスワードを入力",
  'settings.mail.passwordPlaceholderSet': "登録済み({hint}) — 変更するには新しいパスワードを入力",
  'settings.mail.passwordHelp': "空欄 = 変更なし。暗号化して保存され、二度と表示されません。",
  'settings.mail.fromEmail': "送信元アドレス(From)",
  'settings.mail.fromEmailPlaceholder': "rechnung@あなたの事業所.de",
  'settings.mail.fromName': "送信者名",
  'settings.mail.fromNamePlaceholder': "例:あなたの事業所名",
  'settings.mail.testInfoPre': "テストメールは登録済みの送信元アドレスに送られ、",
  'settings.mail.testInfoEmph': "最後に保存された",
  'settings.mail.testInfoPost': " 設定を確認します。変更はまず保存してからテストしてください。",
  'settings.mail.testTitleOn': "送信元アドレスにテストメールを送ります",
  'settings.mail.testTitleOff': "まず「独自の送信者を使う」を有効にして保存してください",
  'settings.mail.sending': "送信中…",
  'settings.mail.testSend': "テストメールを送信",
  'settings.mail.confirmMsgPre': "登録済みの送信元アドレスにテストメールを",
  'settings.mail.confirmMsgPost': " 送信します。最後に保存された SMTP 設定を確認します。",

  // Einstellungen: Eigene Domain & Zustellbarkeit (SPF/DKIM/MX)
  'settings.maildomain.domain': "独自ドメイン",
  'settings.maildomain.domainPlaceholder': "例:あなたの事業所.de",
  'settings.maildomain.domainHelp': "送信元アドレスのドメイン。保存後にのみ DNS レコードを表示し、ドメインを検証できます。",
  'settings.maildomain.title': "到達性を確認",
  'settings.maildomain.badgeVerified': "ドメイン検証済み",
  'settings.maildomain.badgeUnverified': "未検証",
  'settings.maildomain.spamHint': "検証済みドメイン(SPF & DKIM)がないと、メールが受信者側でスパム扱いになりがちです。下の DNS レコードをドメイン事業者に登録し、その後検証してください。",
  'settings.maildomain.showRecords': "DNS レコードを表示",
  'settings.maildomain.hideRecords': "DNS レコードを隠す",
  'settings.maildomain.record.spf': "SPF レコード",
  'settings.maildomain.record.dkim': "DKIM レコード",
  'settings.maildomain.recordType': "種類",
  'settings.maildomain.recordHost': "名前 / ホスト",
  'settings.maildomain.recordValue': "値",
  'settings.maildomain.recordsHint': "SPF レコードの「IHR-MAILPROVIDER」を、お使いのメール事業者の SPF include に置き換えてください(事業者のドキュメント参照)。DKIM 値は正確にそのまま登録します。事業者によっては自動で分割されます。",
  'settings.maildomain.copy': "コピー",
  'settings.maildomain.copied': "コピーしました",
  'settings.maildomain.verify': "ドメインを検証",
  'settings.maildomain.verifying': "確認中…",
  'settings.maildomain.verifyTitle': "DNS レコード(SPF、DKIM、MX)をリアルタイムで確認します",
  'settings.maildomain.verifyFailed': "検証に失敗しました",
  'settings.maildomain.verifiedToast': "ドメインの検証に成功しました — メールは DKIM 署名されるようになります。",
  'settings.maildomain.lastChecked': "最終確認:{date}",
  'settings.maildomain.check.spf': "SPF",
  'settings.maildomain.check.dkim': "DKIM",
  'settings.maildomain.check.mx': "MX",
  'settings.maildomain.setDomainFirst': "DNS レコードを表示し到達性を確認するには、上にドメインを入力して保存してください。",

  // Einstellungen: DATEV / Buchhaltung
  'settings.datev.title': "DATEV / 経理",
  'settings.datev.subtitle': "DATEV 仕訳バッチのエクスポート用。税理士から受け取るアドバイザー番号・クライアント番号。勘定科目は SKR03 の標準値で初期設定済み。",
  'settings.datev.beraterNr': "アドバイザー番号",
  'settings.datev.beraterNrPlaceholder': "例:1001",
  'settings.datev.mandantNr': "クライアント番号",
  'settings.datev.mandantNrPlaceholder': "例:456",
  'settings.datev.skr': "勘定科目表(SKR)",
  'settings.datev.debitor': "得意先集合勘定",
  'settings.datev.erloes19': "売上勘定 19 %",
  'settings.datev.erloes7': "売上勘定 7 %",
  'settings.datev.erloes0': "売上勘定 非課税 / §19",
  'settings.datev.help': "ヒント:最初の実際の DATEV インポート前に、税理士または無料の DATEV 検証プログラムで照合してください。",

  // Einstellungen: sevDesk-Anbindung
  'settings.sevdesk.title': "sevDesk 連携",
  'settings.sevdesk.subtitle': "任意:発行した請求書を自動で sevDesk アカウントに引き渡します。",
  'settings.sevdesk.apiToken': "API トークン",
  'settings.sevdesk.tokenPlaceholder': "sevDesk API トークンを貼り付け",
  'settings.sevdesk.tokenPlaceholderSet': "登録済み({hint}) — 変更するには新しいトークンを入力",
  'settings.sevdesk.help': "sevDesk の 設定 → ユーザー → API トークン にあります。暗号化して保存され、二度と表示されません。",
  'settings.sevdesk.testTitle': "保存されたトークンをテストします",
  'settings.sevdesk.testing': "テスト中…",
  'settings.sevdesk.test': "接続をテスト",
  'settings.sevdesk.remove': "トークンを削除",

  // Einstellungen: Fehler / Validierung
  'settings.error.saveFailed': "保存に失敗しました",
  'settings.error.loadFailed': "基本データを読み込めませんでした",
  'settings.error.testFailed': "テストに失敗しました",
  'settings.error.removeFailed': "削除に失敗しました",
  'settings.error.mahnDaysRange': "督促期限は 1〜365 日の整数である必要があります。",
  'settings.error.mahnDaysOrder': "督促期限は昇順である必要があります(リマインダー < 第 1 督促 < 第 2 督促)。",
  'settings.error.mailHostRequired': "独自メール送信には SMTP ホストが必要です。",
  'settings.error.mailPortRange': "SMTP ポートは 1〜65535 の範囲である必要があります。",
  'settings.error.mailFromInvalid': "有効な送信元アドレス(From)を入力してください。",
  'settings.error.mailDomainMismatch': "送信元アドレスは登録したドメイン上にある必要があります。",
  'settings.error.mitgliedWebseite': "ウェブサイトは http:// または https:// で始める必要があります。",

  // ---- Login ---------------------------------------------------------------
  'login.subtitle': "Detailing Suite — ディテーリング、ラッピング & PPF",
  'login.email': "メール",
  'login.password': "パスワード",
  'login.forgot': "パスワードをお忘れですか?",
  'login.showPassword': "パスワードを表示",
  'login.hidePassword': "パスワードを隠す",
  'login.submit': "ログイン",
  'login.submitting': "ログイン中…",
  'login.failed': "ログインに失敗しました",
  'login.noAccount': "アカウントをお持ちでないですか?",
  'login.registerCta': "事業者を登録",
  'login.footer': "© {year} Detailly · 独立系ディテーリングソフトウェア",
  // Login: zweite Stufe (2FA)
  'login.mfaSubtitle': "二要素認証",
  'login.mfaHint': "認証アプリの 6 桁のコードを入力してください。",
  'login.mfaCode': "確認コード",
  'login.mfaSubmit': "確認してログイン",
  'login.mfaVerifying': "確認中…",
  'login.mfaUseRecovery': "リカバリーコードを使う",
  'login.mfaUseCode': "アプリコードに戻る",
  'login.mfaRecovery': "リカバリーコード",
  'login.mfaRecoveryHint': "設定時に保存したワンタイムコードのいずれか。",
  'login.mfaBack': "キャンセル",
  'login.mfaFailed': "コードが無効か期限切れです",

  // ===========================================================================
  // LANDING (Route "/")
  // ===========================================================================

  // ---- Kopfleiste ----------------------------------------------------------
  'landing.nav.branchen': "業種",
  'landing.nav.ablauf': "使い方",
  'landing.nav.funktionen': "機能",
  'landing.nav.faq': "FAQ",
  'landing.nav.login': "ログイン",
  'landing.nav.trial': "無料で試す",

  // ---- Hero ----------------------------------------------------------------
  'landing.hero.badge': "ディテーリング、ラッピング & PPF のための工房ソフトウェア",
  'landing.hero.eyebrow': "工房ソフトウェア · ディテーリング / ラッピング / PPF",
  'landing.hero.headlinePre': "車両を入庫、損傷を記録、お客様が署名 — わずか ",
  'landing.hero.headlineEm': "4 分",
  'landing.hero.headlinePost': "で。",
  'landing.hero.title1': "あなたの仕事は精密。",
  'landing.hero.title2': "ソフトウェアも、これからは。",
  'landing.hero.sub': "Detailly はディテーリング、ラッピング、PPF のための工房ソフトウェアです:受付、予定表、請求、現金出納帳を一つのシステムに — 記憶ではなく記録で。",
  'landing.hero.ctaPrimary': "14 日間無料で試す",
  'landing.hero.ctaSecondary': "機能を見る",
  'landing.hero.trailer': "クレジットカード不要 · 数分で開始 · 月単位で解約可能",

  // ---- Signature A: µm-Schichtdicken-Readout -------------------------------
  'landing.messwert.label': "膜厚",
  'landing.messwert.unit': "µm",
  'landing.messwert.measuring': "測定中 …",
  'landing.messwert.status': "許容範囲内",
  'landing.messwert.surface': "塗装面 · ボンネット",
  'landing.messwert.caption': "受付で大切なのは、主張ではなく測定値です。Detailly も同じように働きます:記録され、証明できる。(膜厚測定そのものは受付の道具に属し、Detailly の一部ではありません。)",
  'landing.messwert.aria': "膜厚測定:測定値は許容範囲内、緑でロック。",

  // ---- Funktionen als Datenblatt (Label ↔ Fakt) ----------------------------
  'landing.datenblatt.kicker': "データシート",
  'landing.datenblatt.title': "何が入っているか — 約束ではなく、事実として。",
  'landing.datenblatt.sub': "各行は、今日の製品に実際にある機能です。",
  'landing.datenblatt.footnote': "さらに:グローバル検索、モバイル操作、事業者ごとの複数従業員。",
  'landing.datenblatt.kunden.label': "顧客・車両",
  'landing.datenblatt.kunden.fact': "車両カルテ · 完全な履歴",
  'landing.datenblatt.auftraege.label': "作業指示・予定表",
  'landing.datenblatt.auftraege.fact': "週間計画 · 予約 · 進捗",
  'landing.datenblatt.schaden.label': "損傷の記録",
  'landing.datenblatt.schaden.fact': "3D モデル · 写真 · 署名",
  'landing.datenblatt.rechnung.label': "請求書",
  'landing.datenblatt.rechnung.fact': "GoBD §14 · XRechnung · ZUGFeRD",
  'landing.datenblatt.zahlung.label': "支払い",
  'landing.datenblatt.zahlung.fact': "支払期限 · 督促",
  'landing.datenblatt.kasse.label': "現金出納帳",
  'landing.datenblatt.kasse.fact': "GoBD 準拠 · 日次で正確",
  'landing.datenblatt.kalkulation.label': "見積",
  'landing.datenblatt.kalkulation.fact': "作業ごと · ディテーリング / ラッピング / PPF",
  'landing.datenblatt.datenschutz.label': "データ保護",
  'landing.datenblatt.datenschutz.fact': "DSGVO · 暗号化 · 事業者ごとに分離",
  'landing.datenblatt.sprachen.label': "言語",
  'landing.datenblatt.sprachen.fact': "4 · DE / EN / RU / PL",
  'landing.datenblatt.zugriff.label': "アクセス",
  'landing.datenblatt.zugriff.fact': "ブラウザ · タブレット · スマートフォン",

  // ---- Vertrauens-Leiste ---------------------------------------------------
  'landing.trust.dsgvo': "DSGVO 準拠",
  'landing.trust.gobd': "GoBD 準拠の請求書",
  'landing.trust.madeInGermany': "Made in Germany",
  'landing.trust.encrypted': "データ暗号化",
  'landing.trust.noInstall': "インストール不要",

  // ---- Problem -------------------------------------------------------------
  'landing.problem.kicker': "心当たりありませんか?",
  'landing.problem.title': "現場は回る — 管理が足を引っ張る。",
  'landing.problem.sub': "車両の作業は精密さを求められる一方で、その周りは書類の山に埋もれています。",
  'landing.problem.p1': "車両の履歴がファイル、メモ、そして頭の中にばらばらに散らばっている。",
  'landing.problem.p2': "請求書が放置され — 現金の損失につながる。",
  'landing.problem.p3': "受付時の損傷を、後から証明するのがほぼ不可能。",
  'landing.problem.p4': "互いに連携しない 5 つの異なるツール。",
  'landing.problem.summaryPre': "Detailly はそのすべてを ",
  'landing.problem.summaryEm': "一つの",
  'landing.problem.summaryPost': " システムに — 見やすく、速く、あらゆる端末で。",

  // ---- Branchen-Switcher ---------------------------------------------------
  'landing.branchen.kicker': "あなたの作業のために作られた",
  'landing.branchen.title': "あなたの仕事の言葉を話すソフトウェア",
  'landing.branchen.sub': "開始時に専門分野を選ぶと — Detailly がサービスカタログ、見積、さらには見た目まで合わせます。試してみてください:あなたの作業を選ぶと、ページの色が変わります。",
  'landing.branchen.selected': "選択中",
  'landing.branchen.cta': "{label} として始める",
  'landing.branchen.complete': "すべて一手に?",
  'landing.branchen.completeCta': "総合事業者として始める",
  'landing.branchen.aufbereitung.l1': "内装・外装ディテーリング",
  'landing.branchen.aufbereitung.l2': "ポリッシュ・セラミックコーティング",
  'landing.branchen.aufbereitung.l3': "リース返却チェック",
  'landing.branchen.folierung.l1': "フル・パートラッピング",
  'landing.branchen.folierung.l2': "カラーチェンジ・デザイン",
  'landing.branchen.folierung.l3': "広告レタリング",
  'landing.branchen.ppf.l1': "フロント・フルプロテクション",
  'landing.branchen.ppf.l2': "飛び石対策パッケージ",
  'landing.branchen.ppf.l3': "精密カット",

  // ---- So funktioniert's ---------------------------------------------------
  'landing.ablauf.kicker': "こんなに簡単",
  'landing.ablauf.title': "3 ステップですっきりした流れに",
  'landing.ablauf.step1.title': "受け付ける",
  'landing.ablauf.step1.desc': "顧客、車両、損傷を数分で記録 — 3D マーキング、写真、電子署名付き。",
  'landing.ablauf.step2.title': "進める",
  'landing.ablauf.step2.desc': "サービスを見積り、予定表で予約を計画し、進捗を常に把握。",
  'landing.ablauf.step3.title': "請求する",
  'landing.ablauf.step3.desc': "作業指示からワンクリックで GoBD 準拠の請求書 PDF に — 支払期限と督促を含めて。",

  // ---- Funktionen ----------------------------------------------------------
  'landing.funktionen.kicker': "すべての道具",
  'landing.funktionen.title': "あなたの事業に必要なすべて",
  'landing.funktionen.sub': "一貫した流れ — 車両の受付から、支払われた請求書まで。",
  'landing.funktionen.kunden.title': "顧客・車両",
  'landing.funktionen.kunden.desc': "基本データ、車両カルテ、車両ごとの完全な履歴 — すぐに見つかります。",
  'landing.funktionen.auftraege.title': "作業指示・予定表",
  'landing.funktionen.auftraege.desc': "見積から検収まで。予約付きの週間計画 — すべてを一目で。",
  'landing.funktionen.rechnungen.title': "請求書・書類",
  'landing.funktionen.rechnungen.desc': "§14・GoBD 準拠の請求書と見積を PDF で、支払期限と督促を含めて。",
  'landing.funktionen.schaden3d.title': "3D 損傷記録",
  'landing.funktionen.schaden3d.desc': "損傷を車両モデル上で直接マークし、写真で記録し、電子署名してもらいます。",
  'landing.funktionen.kalkulation.title': "作業別の見積",
  'landing.funktionen.kalkulation.desc': "ディテーリング、ラッピング、PPF のためのサービスカタログと価格ロジック — あなたの専門分野に合わせて。",
  'landing.funktionen.dsgvo.title': "DSGVO・セキュリティ",
  'landing.funktionen.dsgvo.desc': "機微なデータは暗号化し、事業者ごとに厳格に分離。データのエクスポートと削除もワンクリック。",
  'landing.funktionen.footnotePre': "さらに:超高速のグローバル検索(",
  'landing.funktionen.footnotePost': ")、モバイルナビゲーション、事業者ごとの複数従業員。",

  // ---- 3D-Schadenserfassung (Showcase) -------------------------------------
  'landing.schaden.kicker': "ハイライト",
  'landing.schaden.title': "争いになる前に、損傷を記録する",
  'landing.schaden.desc': "受付時に、傷、へこみ、飛び石を車両モデル上で直接マーク — 写真とお客様の電子署名付き。後から疑問が出ても、証拠があります。白黒はっきりと。",
  'landing.schaden.point1': "損傷点を 3D モデル上に直接設定",
  'landing.schaden.point2': "損傷ごとの写真 — 自動で紐付け",
  'landing.schaden.point3': "受付と検収での電子署名",
  'landing.schaden.cardHeader': "車両受付 · 損傷の記録",
  'landing.schaden.cardBadge': "損傷 2 件",
  'landing.schaden.cardPhotos': "写真 4 枚を記録",
  'landing.schaden.cardSignature': "署名を取得",

  // ---- Landing: 3D-Showcase (LandingCar3D) --------------------------------
  'landing.showcase.aria': "損傷点をマークしたインタラクティブな 3D 車両モデル",
  'landing.showcase.pin1': "飛び石 · 写真 2 枚",
  'landing.showcase.pin2': "傷 · 左ドア",
  'landing.showcase.pin3': "へこみ · 記録済み",
  'landing.showcase.badgeOne': "損傷 {count} 件",
  'landing.showcase.badgeMany': "損傷 {count} 件",

  // ---- Wachstum ------------------------------------------------------------
  'landing.wachstum.kicker': "スケーラブル",
  'landing.wachstum.title': "把握することで成長する",
  'landing.wachstum.sub': "整理され、数字を把握している人は、より良い判断ができます — 個人事業からチェーンまで。",
  'landing.wachstum.echtzeit.title': "リアルタイムの把握",
  'landing.wachstum.echtzeit.desc': "売上、未完了の作業、予約をダッシュボードでライブに — どこが順調でどこが滞っているか、すぐに分かります。",
  'landing.wachstum.standorte.title': "複数拠点",
  'landing.wachstum.standorte.desc': "店舗を一つの屋根の下で管理 — きれいに分離しつつ、中央で把握。成長に合わせていつでも拡張可能。",
  'landing.wachstum.team.title': "チーム、役割、権限",
  'landing.wachstum.team.desc': "従業員を招待して役割を割り当て — 各自が見るべきものだけを見ます。きれいに監視・記録されます。",
  'landing.wachstum.chartVolume': "作業量",
  'landing.wachstum.chartGrowing': "成長中",
  'landing.wachstum.chartLocations': "拠点",

  // ---- Zahlen (Count-up) ---------------------------------------------------
  'landing.zahlen.stat1.unit': "言語",
  'landing.zahlen.stat1.label': "ドイツ語、英語、ロシア語、ポーランド語で",
  'landing.zahlen.stat2.unit': "日間",
  'landing.zahlen.stat2.label': "無料で試す — クレジットカード不要",
  'landing.zahlen.stat3.value': "DSGVO + GoBD",
  'landing.zahlen.stat3.label': "準拠して保存・請求",
  'landing.zahlen.stat4.value': "5 → 1",
  'landing.zahlen.stat4.label': "5 つの個別ツールではなく、一つのシステム",

  // ---- Mitglieder (Social Proof, Opt-in) -----------------------------------
  'landing.mitglieder.kicker': "現場から",
  'landing.mitglieder.title': "これらの事業者が Detailly を使っています",
  'landing.mitglieder.sub': "Detailly を毎日使い、ここで名前を挙げることを許可してくださったディテーラー、ラッパー、PPF スタジオ。",

  // ---- Deutschlandkarte (Qualitätssiegel, nur zahlende Opt-in-Betriebe) -----
  'landing.karte.kicker': "全国に展開",
  'landing.karte.title': "ドイツ全土の Detailly 事業者",
  'landing.karte.sub': "審査済みの活動中メンバー事業者 — 地図上に地域ごとにおおまかに。点をタップすると、その地域の事業者が見られます。",
  'landing.karte.pin.aria': "郵便番号地域 {region} の {anzahl} 事業者",
  'landing.karte.pin.aria.one': "郵便番号地域 {region} の 1 事業者",
  'landing.karte.pop.aria': "郵便番号地域 {region} の事業者",
  'landing.karte.pop.region': "郵便番号地域 {region}",
  'landing.karte.pop.website': "ウェブサイト",
  'landing.karte.legende': "{regionen} 地域に {betriebe} の活動中事業者",

  // ---- Warum Detailly ------------------------------------------------------
  'landing.warum.kicker': "なぜ Detailly か",
  'landing.warum.title': "ディーラーではなく、工房のためのソフトウェア。",
  'landing.warum.body': "ディテーラー、ラッパー、PPF スタジオは精密な仕事を提供し、同じくらいきれいに働くソフトウェアに値します。多くの工房プログラムは大規模ディーラー向けに作られており、過剰で、複雑で、高価です。Detailly はあえて異なります — スリムで、あなたの流れに合わせて作られ、数分で使える。ドイツで独自に開発され、はじめからデータ保護を備えています。",

  // ---- News-Teaser ---------------------------------------------------------
  'landing.news.kicker': "Detailly ニュース",
  'landing.news.title': "いま起きていること",
  'landing.news.sub': "Detailly の製品アップデートとお知らせ。(サンプル項目 — まもなく実際のお知らせに。)",
  'landing.news.all': "すべてのニュースを見る",

  // ---- FAQ -----------------------------------------------------------------
  'landing.faq.kicker': "よくある質問",
  'landing.faq.title': "始める前に知りたいこと",
  'landing.faq.q1.q': "技術的な知識やインストールは必要ですか?",
  'landing.faq.q1.a': "いいえ。事業者を登録すれば、ブラウザですぐに始められます — パソコン、タブレット、スマートフォンで。インストールも設定も不要です。",
  'landing.faq.q2.q': "ディテーリング「と」ラッピングの両方をやっています — 何を選べば?",
  'landing.faq.q2.a': "その場合は総合事業者です:登録時に「総合事業者」を選ぶだけで、すべてのサービスカタログと見積がまとめて手に入ります。",
  'landing.faq.q3.q': "顧客データはどれくらい安全ですか?",
  'landing.faq.q3.a': "機微なデータは暗号化して保存され、他の事業者と厳格に分離されます。顧客データはいつでもエクスポートまたは削除できます — 完全に DSGVO 準拠です。",
  'landing.faq.q4.q': "14 日後はどうなりますか?",
  'landing.faq.q4.a': "クレジットカードなし、リスクなしで試せます。試用後に、あなたの事業に合ったプランを選びます。試用が終了しても費用は発生しません。",
  'landing.faq.q5.q': "工房のタブレットでも動きますか?",
  'landing.faq.q5.a': "はい。Detailly はあらゆる端末向けに作られています — オフィスの PC から車両受付のタブレットまで。操作は自動的に適応します。",
  'landing.faq.q6.q': "自分のデータをまた持ち出せますか?",
  'landing.faq.q6.a': "いつでも。データはあなたのものです — 誰にも尋ねることなく、ワンクリックでエクスポートできます。",

  // ---- Abschluss-CTA -------------------------------------------------------
  'landing.cta.title': "今日から、あなたの事業に秩序を。",
  'landing.cta.sub': "数分で事業者を登録し、Detailly を 14 日間無料で試しましょう。クレジットカードなし、リスクなし。",
  'landing.cta.primary': "今すぐ無料で始める",
  'landing.cta.secondary': "すでにアカウントを持っています",

  // ---- Footer --------------------------------------------------------------
  'landing.footer.tagline': "ディテーリング、ラッピング、PPF のための工房ソフトウェア。ドイツで独自に開発。",
  'landing.footer.discover': "見つける",
  'landing.footer.product': "製品",
  'landing.footer.account': "アカウント・法的事項",
  'landing.footer.news': "ニュース",
  'landing.footer.changelog': "新着情報",
  'landing.footer.masterclass': "マスタークラス",
  'landing.footer.gruendung': "創業",
  'landing.footer.grosshaendler': "卸売業者向け",
  'landing.footer.features': "機能",
  'landing.footer.branchen': "あなたの作業向け",
  'landing.footer.faq': "よくある質問",
  'landing.footer.trial': "無料で試す",
  'landing.footer.login': "ログイン",
  'landing.footer.register': "登録",
  'landing.footer.impressum': "インプリント",
  'landing.footer.datenschutz': "データ保護",
  'landing.footer.copyright': "© {year} Detailly · 無断複製を禁じます",

  // ---- Kundenformular ------------------------------------------------------
  'kunden.form.leitwegId.label': "ルーティング ID(Leitweg-ID)",
  'kunden.form.leitwegId.help': "官公庁・公共発注者への請求書のみ(B2G ルーティングを制御します)。",
  'kunden.form.editTitle': "顧客を編集",
  'kunden.form.saving': "保存中…",
  'kunden.form.company': "会社",
  'kunden.form.firstName': "名",
  'kunden.form.lastName': "姓",
  'kunden.form.street': "番地",
  'kunden.form.postalCode': "郵便番号",
  'kunden.form.noNameHelp': "名前が未登録 — 例:DSGVO による匿名化後。",
  'kunden.form.gdprSection': "データ保護(DSGVO)",
  'kunden.form.exportJson': "データをエクスポート(JSON)",
  'kunden.form.anonymizeBtn': "データを削除 / 匿名化",
  'kunden.form.gdprNote': "請求書は法的理由(GoBD)により保持されますが、個人との関連はなくなります。",
  'kunden.form.anonymize.title': "顧客データを完全に削除しますか?",
  'kunden.form.anonymize.msgPre': "個人データが削除または匿名化されます。請求書は法的理由(GoBD、10 年)により保持されますが、個人との関連はなくなります。この操作は ",
  'kunden.form.anonymize.msgEmph': "元に戻せません",
  'kunden.form.anonymize.msgPost': "。",
  'kunden.form.anonymize.confirm': "完全に削除",
  'kunden.form.error.save': "保存に失敗しました",
  'kunden.form.error.export': "エクスポートに失敗しました",
  'kunden.form.error.anonymize': "削除に失敗しました",
  'kunden.form.gdpr.checking': "書類を確認中…",
  'kunden.form.gdpr.willAnonymize': "保存義務のある書類が {count} 件あります。そのため顧客は匿名化されます — 書類は法的理由(GoBD/§147 AO)により保持されますが、個人との関連はなくなります。この操作は ",
  'kunden.form.gdpr.willDelete': "保存義務のある書類はありません。顧客はすべての車両、予約、写真、下書きとともに完全に削除されます。この操作は ",
  'kunden.form.gdpr.irreversible': "元に戻せません。",
  'kunden.form.gdpr.confirmDelete': "完全に削除",

  // ===========================================================================
  // KUNDEN (Route "/kunden")
  // ===========================================================================
  'kunden.title': "顧客",
  'kunden.subtitle': "個人・法人のお客様",
  'kunden.csvImport': "CSV インポート",
  'kunden.new': "新規顧客",
  'kunden.searchPlaceholder': "名前、メール、電話で検索…",

  // ---- Leerzustand ---------------------------------------------------------
  'kunden.empty.none': "まだ顧客が登録されていません。",
  'kunden.empty.filtered': "顧客が見つかりません。",
  'kunden.empty.cta': "最初の顧客を登録",

  // ---- Tabellenspalten -----------------------------------------------------
  'kunden.col.name': "名前",
  'kunden.col.typ': "種別",
  'kunden.col.email': "メール",
  'kunden.col.telefon': "電話",
  'kunden.col.ort': "市区町村",

  // ---- Kundentyp -----------------------------------------------------------
  'kunden.type.business': "法人",
  'kunden.type.private': "個人",

  // ---- Aktionsmenü ---------------------------------------------------------
  'kunden.actionsFor': "{name} の操作",
  'kunden.action.open': "開く",
  'kunden.action.newOrder': "新規作業指示",
  'kunden.action.edit': "編集",

  // ---- Toast / Fehler / Löschen-Bestätigung --------------------------------
  'kunden.toast.deleted': "{name} を削除しました",
  'kunden.error.delete': "削除に失敗しました",
  'kunden.delete.title': "顧客を削除",
  'kunden.delete.msg': "本当に {name} を削除しますか?顧客は無効化され、一覧から削除されます。すでに記録された作業指示や請求書は保持されます。",

  // ---- Kundenakte (Route "/kunden/detail") ---------------------------------
  'kunden.detail.businessCustomer': "法人のお客様",
  'kunden.detail.privateCustomer': "個人のお客様",
  'kunden.detail.addVehicle': "車両を追加",
  'kunden.detail.contact': "連絡先",
  'kunden.detail.address': "住所",
  'kunden.detail.vatNumber': "付加価値税番号(USt-IdNr.)",
  'kunden.detail.stat.vehicles': "車両",
  'kunden.detail.stat.openOrders': "未完了の作業指示",
  'kunden.detail.stat.openInvoices': "未払いの請求書",
  'kunden.detail.stat.paidTotal': "支払済み合計",
  'kunden.detail.pieces': "{n} 件",
  'kunden.detail.vehicles': "車両",
  'kunden.detail.vehicleCountOne': "{n} 台",
  'kunden.detail.vehicleCountMany': "{n} 台",
  'kunden.detail.emptyVehicles': "車両が登録されていません。",
  'kunden.detail.openFile': "カルテ",
  'kunden.detail.appointments': "予約",
  'kunden.detail.newestFirst': "新しい順",
  'kunden.detail.emptyAppts': "予約はありません。",
  'kunden.detail.orders': "作業指示",
  'kunden.detail.totalCount': "合計 {n} 件",
  'kunden.detail.emptyOrders': "まだ作業指示はありません。",
  'kunden.detail.invoices': "請求書・見積",
  'kunden.detail.emptyInvoices': "まだ書類はありません。",
  'kunden.detail.pdf': "PDF",
  'kunden.detail.error.load': "顧客を読み込めませんでした",
  'kunden.detail.error.pdf': "PDF を読み込めませんでした",

  // ===========================================================================
  // FAHRZEUGE (Route "/fahrzeuge")
  // ===========================================================================
  'fahrzeuge.title': "車両",
  'fahrzeuge.subtitle': "車両カルテ付きの車両一覧",
  'fahrzeuge.new': "新規車両",
  'fahrzeuge.searchPlaceholder': "ナンバー、メーカー、モデル、所有者で検索…",

  // ---- Leerzustand ---------------------------------------------------------
  'fahrzeuge.empty.none': "まだ車両が登録されていません。",
  'fahrzeuge.empty.filtered': "車両が見つかりません。",
  'fahrzeuge.empty.cta': "最初の車両を登録",

  // ---- Tabellenspalten -----------------------------------------------------
  'fahrzeuge.col.fahrzeug': "車両",
  'fahrzeuge.col.kennzeichen': "ナンバー",
  'fahrzeuge.col.halter': "所有者",
  'fahrzeuge.col.baujahr': "年式",

  // ---- Aktionsmenü ---------------------------------------------------------
  'fahrzeuge.actionsFor': "{name} の操作",
  'fahrzeuge.action.open': "車両カルテを開く",
  'fahrzeuge.action.newOrder': "新規作業指示",

  // ---- Formular (Neues Fahrzeug) -------------------------------------------
  'fahrzeuge.form.halter': "所有者",
  'fahrzeuge.form.selectPlaceholder': "– 選択 –",
  'fahrzeuge.form.marke': "メーカー",
  'fahrzeuge.form.modell': "モデル",
  'fahrzeuge.form.variante': "バリエーション",
  'fahrzeuge.form.baujahr': "年式",
  'fahrzeuge.form.farbe': "色",
  'fahrzeuge.form.kennzeichen': "ナンバー",
  'fahrzeuge.form.kraftstoff': "燃料",
  'fahrzeuge.form.flaeche': "面積(㎡)",

  // ---- Kraftstoffarten -----------------------------------------------------
  'fahrzeuge.fuel.petrol': "ガソリン",
  'fahrzeuge.fuel.diesel': "ディーゼル",
  'fahrzeuge.fuel.electric': "電気",
  'fahrzeuge.fuel.hybrid': "ハイブリッド",
  'fahrzeuge.saving': "保存中…",

  // ---- Toast / Fehler / Löschen-Bestätigung --------------------------------
  'fahrzeuge.toast.deleted': "{name} を削除しました",
  'fahrzeuge.error.delete': "削除に失敗しました",
  'fahrzeuge.error.save': "保存に失敗しました",
  'fahrzeuge.delete.title': "車両を削除",
  'fahrzeuge.delete.msg': "本当に {name} を削除しますか?車両は一覧から削除されます。すでに記録された作業指示や予約は保持されます。",

  // ---- Fahrzeugakte (Route "/fahrzeuge/detail") ----------------------------
  'fahrzeuge.detail.subtitle': "車両カルテ",
  'fahrzeuge.detail.masterData': "基本データ",
  'fahrzeuge.detail.makeModel': "メーカー / モデル",
  'fahrzeuge.detail.area': "面積",
  'fahrzeuge.detail.sqm': "{n} ㎡",
  'fahrzeuge.detail.toOwner': "所有者へ",
  'fahrzeuge.detail.orderHistory': "作業履歴",
  'fahrzeuge.detail.emptyOrders': "この車両にはまだ作業指示がありません。",

  // ===========================================================================
  // BELEGE / RECHNUNGEN (Route "/rechnungen")
  // ===========================================================================
  'rechnungen.title': "書類",
  'rechnungen.subtitle': "見積と請求書",
  'rechnungen.searchPlaceholder': "番号または顧客で検索…",
  'rechnungen.tab.alle': "すべて",

  // ---- Leerzustände --------------------------------------------------------
  'rechnungen.empty.none': "まだ書類がありません。書類は作業指示から作成されます。",
  'rechnungen.empty.filtered': "このビューに書類はありません。",

  // ---- Tabellenspalten -----------------------------------------------------
  'rechnungen.col.nummer': "番号",
  'rechnungen.col.art': "種類",
  'rechnungen.col.kunde': "顧客",
  'rechnungen.col.datum': "日付",
  'rechnungen.col.status': "ステータス",
  'rechnungen.col.brutto': "税込",

  // ---- Art / Status --------------------------------------------------------
  'rechnungen.kind.angebot': "見積",
  'rechnungen.kind.rechnung': "請求書",
  'rechnungen.status.entwurf': "下書き",
  'rechnungen.status.offen': "未払い",
  'rechnungen.status.bezahlt': "支払済み",
  'rechnungen.status.storniert': "取消済み",

  // ---- Fälligkeit / Versand-Badges -----------------------------------------
  'rechnungen.overdue': "{tage} 日超過",
  'rechnungen.dueIn': "あと {tage} 日で期限",
  'rechnungen.sent': "送信済み",
  'rechnungen.sentOn': "{datum} に送信",

  // ---- Mahnstufen ----------------------------------------------------------
  'rechnungen.mahn.stufe1': "支払リマインダー",
  'rechnungen.mahn.stufe2': "第 1 督促",
  'rechnungen.mahn.stufe3': "第 2 督促",
  'rechnungen.mahn.generic': "督促段階 {stufe}",

  // ---- Zeilen-Aktionen -----------------------------------------------------
  'rechnungen.action.pdf': "PDF をダウンロード",
  'rechnungen.action.xrechnung': "XRechnung(XML)",
  'rechnungen.action.send': "メールで送信",
  'rechnungen.action.resend': "メールで再送信",
  'rechnungen.action.markPaid': "支払済みにする",
  'rechnungen.action.copyLink': "ダウンロードリンクをコピー",
  'rechnungen.action.mahnen': "督促する",
  'rechnungen.action.storno': "取り消す",
  'rechnungen.action.setStatus': "「{status}」に設定",
  'rechnungen.actionsFor': "{nummer} の操作",
  'rechnungen.linkPrompt': "ダウンロードリンクをコピー:",

  // ---- Storno-Bestätigung --------------------------------------------------
  'rechnungen.storno.title': "書類を取り消す",
  'rechnungen.storno.msg': "本当に書類 {nummer} を取り消しますか?取り消した書類は再び有効にできません。",
  'rechnungen.storno.msgPaid': "支払済みの請求書 {nummer} を本当に取り消しますか?取消は元に戻せません — 返金や払い戻しは別途調整が必要な場合があります。",

  // ---- Toast-Meldungen -----------------------------------------------------
  'rechnungen.toast.statusUpdated': "ステータスを更新しました",
  'rechnungen.toast.storniert': "書類を取り消しました",
  'rechnungen.toast.paid': "支払済みにしました",
  'rechnungen.toast.sent': "書類をメールで送信しました",
  'rechnungen.toast.linkCopied': "ダウンロードリンクをコピーしました",
  'rechnungen.toast.mahnSent': "督促を送信しました",

  // ---- Fehlermeldungen -----------------------------------------------------
  'rechnungen.error.statusChange': "ステータス変更に失敗しました",
  'rechnungen.error.pdf': "PDF を読み込めませんでした",
  'rechnungen.error.xrechnung': "XRechnung を作成できませんでした",
  'rechnungen.error.paid': "支払済みにできませんでした",
  'rechnungen.error.send': "メール送信に失敗しました",
  'rechnungen.error.link': "リンクを作成できませんでした",
  'rechnungen.error.mahn': "督促に失敗しました",

  // ===========================================================================
  // AUFTRÄGE (Route "/auftraege")
  // ===========================================================================
  'auftraege.title': "作業指示",

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

  // ---- Minispiel „Detailly-Truck" (Easter-Egg) ----------------------------

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
