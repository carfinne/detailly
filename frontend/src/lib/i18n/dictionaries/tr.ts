// ===========================================================================
// TR – WÖRTERBUCH (Partial<Dict>) · Türkçe
// ---------------------------------------------------------------------------
// MT-gestützte Erstübersetzung — professionelle Prüfung vor breitem Rollout empfohlen.
// Enthält die UI-Keys aus de.ts, nach Türkçe übersetzt. Bleibt technisch
// `Partial<Dict>`: fehlende/neue Keys fallen automatisch auf DE zurück
// (siehe ../provider, t() → de[key]) — nie ein leerer String oder der rohe Key.
// Juristische Volltexte (AGB, AVV, Datenschutz, Widerrufsbelehrung, Impressum)
// liegen NICHT in diesem Wörterbuch, sondern in den jeweiligen Seiten-Komponenten
// und bleiben bewusst auf Deutsch.
//
// Platzhalter wie {name}/{year} bleiben unverändert (werden zur Laufzeit ersetzt).
// ===========================================================================

import type { Dict } from './de';

export const tr: Partial<Dict> = {
  // Fahrzeugtyp (3D-Karosserie-Auswahl)
  'fahrzeugtyp.label': "Araç tipi",
  'fahrzeugtyp.hint': "3D model için kaporta biçimini seçin",
  'fahrzeugtyp.limousine': "Sedan",
  'fahrzeugtyp.kombi': "Station wagon",
  'fahrzeugtyp.suv': "SUV/arazi",
  'fahrzeugtyp.coupe': "Coupé",
  'fahrzeugtyp.kompakt': "Kompakt/küçük",
  'fahrzeugtyp.transporter': "Panelvan/Van",
  'fahrzeugtyp.pickup': "Pickup",
  'fahrzeugtyp.error.save': "Araç tipi kaydedilemedi.",
  // ---- Gemeinsame UI-Texte -------------------------------------------------
  'common.save': "Kaydet",
  'common.cancel': "İptal",
  'common.confirm': "Onayla",
  'common.delete': "Sil",
  'common.close': "Kapat",
  'common.back': "Geri",
  'common.loading': "Yükleniyor",
  'common.loadingEllipsis': "Yükleniyor…",
  'common.loadingBrand': "Detailly yükleniyor…",
  'common.error': "Hata",
  'common.toStart': "Ana sayfaya",
  // ---- Fehler-/Leerzustaende (App-Router error/not-found Boundaries) --------
  'errorBoundary.title': "Bir şeyler ters gitti",
  'errorBoundary.desc': "Beklenmeyen bir hata oluştu. Tekrar deneyebilir veya sayfayı yeniden yükleyebilirsiniz.",
  'errorBoundary.retry': "Tekrar dene",
  'errorBoundary.reload': "Sayfayı yeniden yükle",
  'errorBoundary.reference': "Referans",
  'notFound.title': "Sayfa bulunamadı",
  'notFound.desc': "Bu sayfa mevcut değil veya taşınmış. Adresi kontrol edin ya da ana sayfaya dönün.",
  'notFound.dashboard': "Panoya git",
  // ---- 2FA-Erzwingung (serverseitige Pflicht) ------------------------------
  'mfa.gate.title': "İki faktörlü kimlik doğrulama gerekli",
  'mfa.gate.desc': "Hesabınız için iki faktörlü kimlik doğrulama zorunludur. Detailly'i kullanmaya devam etmek için şimdi kurun.",
  'mfa.gate.logout': "Çıkış yap",
  'common.toSubscription': "Abonelik ve tarifeye",

  // ---- Sprachumschalter ----------------------------------------------------
  'switcher.label': "Dil seçin",
  'switcher.current': "Geçerli dil",

  // ---- Navigation: Gruppen -------------------------------------------------
  'nav.group.overview': "Genel bakış",
  'nav.group.operations': "İşletme",
  'nav.group.intake': "Kabul ve hesaplama",
  'nav.group.masterdata': "Ana veriler",
  'nav.group.finance': "Finans",
  'nav.group.material': "Malzeme",
  'nav.group.organization': "Organizasyon",
  'nav.group.platform': "Platform",

  // ---- Navigation: Einträge ------------------------------------------------
  'nav.item.dashboard': "Pano",
  'nav.item.achievements': "Başarılar",
  'nav.item.orders': "İş emirleri",
  'nav.item.calculation': "Hesaplama",
  'nav.item.intakeQuick': "Kabul (hızlı)",
  'nav.item.intake3d': "Kabul ve ekspertiz (3D)",
  'nav.item.dellenkalkulation': "Göçük hesaplama (PDR)",
  'nav.item.schichtdicke': "Kaplama kalınlığı ölç",
  'nav.item.planboard': "Planlama panosu",
  'nav.item.requests': "Talepler",
  'nav.item.customers': "Müşteriler",
  'nav.item.vehicles': "Araçlar",
  'nav.item.services': "Hizmetler",
  'nav.item.invoices': "Faturalar",
  'nav.item.incomingInvoices': "E-fatura girişi",
  'nav.item.cashbook': "Kasa defteri",
  'nav.item.reminders': "Ödeme hatırlatmaları",
  'nav.item.reports': "Değerlendirmeler",
  'nav.item.accounting': "Muhasebe",
  'nav.item.shop': "Malzeme ve depo",
  'nav.item.marketplace': "Pazar yeri",
  'nav.item.locations': "Şubeler",
  'nav.item.staff': "Personel",
  'nav.item.time': "Zaman takibi",
  'nav.item.showcase': "Vitrin",
  'nav.item.audit': "Denetim günlüğü",
  'nav.item.settings': "Ayarlar",
  'nav.item.help': "Yardım ve destek",
  'nav.item.assistant': "Destek asistanı",
  'nav.item.subscription': "Abonelik ve tarife",
  'nav.item.cockpit': "Kokpit",
  'nav.item.platformAnalytics': "Platform analizleri",
  'nav.item.platformMarketplace': "Pazar yeri yönetimi",
  'nav.item.platformGeraetemarkt': "İkinci el pazar moderasyonu",
  'nav.item.platformSupport': "Destek talepleri",
  'nav.item.platformSecurity': "Güvenlik",
  'nav.item.platformNewsletter': "Bülten",
  'nav.item.subscriptions': "Abonelikler",

  // ---- Einstellungen: Kalkulation (€/qm) -----------------------------------
  'settings.kalk.title': "Hesaplama · €/m²",
  'settings.kalk.subtitle': "3D anlık hesaplama için temel oranlar. Hesaplamada her değer yine de değiştirilebilir.",
  'settings.kalk.grouplabel': "Metrekare başına fiyat (net)",
  'settings.kalk.folierung': "Folyo kaplama",
  'settings.kalk.ppf': "PPF / boya koruma",
  'settings.kalk.aufbereitung': "Detailing",
  'settings.kalk.help': "Bu oranlar 3D modülünde varsayılan değerdir (alan × araç boyutu × €/m²). Boş veya 0 = dahili standart değer.",
  'settings.kalender.umsatzZielTitle': "Haftalık ciro hedefi",
  'settings.kalender.umsatzZielSubtitle': "Planlama panosunun ciro katmanı için hedef değer — yalnızca işletme sahipleri ve yöneticiler tarafından görülebilir.",
  'settings.kalender.umsatzZielLabel': "Haftalık hedef (€ brüt)",
  'settings.kalender.umsatzZielHelp': "Boş bırakın = hedef yok. İlerleme çubuğu panonun haftalık başlığında görünür.",

  // ---- Einstellungen: Kalender & Online-Buchung (Kalender 2.0 W2) ----------
  'settings.kalender.title': "Takvim ve çevrimiçi randevu",
  'settings.kalender.subtitle': "Haftanın günlerine göre çalışma saatleri, slot ızgarası ve genel randevu portalı için ön süre.",
  'settings.kalender.von': "başlangıç",
  'settings.kalender.bis': "bitiş",
  'settings.kalender.slotDauer': "Slot süresi (dakika)",
  'settings.kalender.puffer': "Randevular arası tampon (dakika)",
  'settings.kalender.vorlaufMin': "Minimum ön süre (saat)",
  'settings.kalender.vorlaufMax': "Maksimum ön süre (gün)",
  'settings.kalender.hint': "Çalışma saatleri tanımlıysa randevu portalınız boş randevuları gösterir — müşteriler istedikleri bir tarihi serbestçe yazmak yerine boş slotlardan seçer.",
  'settings.error.kalenderZeiten': "Çalışma saatlerini kontrol edin: aktif günlerde «bitiş», «başlangıç»tan sonra olmalıdır.",
  'settings.error.kalenderWerte': "Takvim değerlerini kontrol edin: slot 5–480 dk, tampon 0–240 dk, ön süre 0–720 saat veya 1–365 gün.",

  // ---- Buchungsseite: rechtlicher Abschluss-Modus (§312j BGB) ---------------
  'settings.buchung.modusTitle': "Randevu sayfasının tamamlanması",
  'settings.buchung.modusSubtitle': "Genel randevu sayfanızın bağlayıcı olmayan bir talep mi yoksa bağlayıcı, ücretli bir rezervasyon mu olduğunu belirler.",
  'settings.buchung.modusLabel': "Mod",
  'settings.buchung.modusAnfrage': "Bağlayıcı olmayan randevu talebi",
  'settings.buchung.modusVerbindlich': "Bağlayıcı, ücretli rezervasyon",
  'settings.buchung.modusHelp': "Talep: müşteriler bağlayıcı olmayan bir talep gönderir — henüz sözleşme kurulmaz, randevuyu siz onaylarsınız. Bağlayıcı: çevrimiçi ücretli bir sözleşme kurulur («Ücretli rezerve et» düğmesi, cayma hakkı).",
  'settings.buchung.modusVerbindlichHint': "Bağlayıcı modda müşteriler sizinle çevrimiçi ücretli bir mesafeli satış sözleşmesi kurar. Fiyatları, künye bilgilerini ve cayma hakkı bildirimini dikkatle kontrol edin — sorumluluk size aittir.",
  'settings.buchung.impressumIncomplete': "Randevu sayfası eksik: künye bilgileri eksik. Müşteriler sağlayıcıyı (sözleşme tarafı) yalnızca kısmen görür. Lütfen aşağıdaki künye bölümünde tamamlayın.",

  // ---- Öffentliche Buchungsseite: Verbraucherrecht (UI-Chrome) --------------
  // Die eigentlichen Rechtstexte (Widerrufsbelehrung/-formular) bleiben DEUTSCH
  // und werden NICHT übersetzt – hier nur die Bedien-Elemente.
  'buchen.recht.badge.anfrage': "Çevrimiçi randevu talebi",
  'buchen.recht.badge.verbindlich': "Çevrimiçi rezervasyon",
  'buchen.recht.anbieter.title': "Sağlayıcı",
  'buchen.recht.anbieter.hint': "Sözleşme tarafı, yukarıda belirtilen işletmedir, Detailly değildir.",
  'buchen.recht.pflichtinfo.title': "Rezervasyonunuza genel bakış",
  'buchen.recht.pflichtinfo.leistung': "Hizmet",
  'buchen.recht.pflichtinfo.keineLeistung': "Hizmet seçilmedi",
  'buchen.recht.pflichtinfo.preis': "Fiyat",
  'buchen.recht.pflichtinfo.termin': "Randevu",
  'buchen.recht.pflichtinfo.keinTermin': "Randevu seçilmedi",
  'buchen.recht.pflichtinfo.checkbox': "Zorunlu bilgileri ve cayma hakkı bildirimini okudum.",
  'buchen.recht.pflichtinfo.checkboxError': "Lütfen zorunlu bilgileri ve cayma hakkı bildirimini onaylayın.",
  'buchen.recht.widerruf.title': "Cayma hakkı",
  'buchen.recht.widerruf.deHint': "Resmi hukuki metin yalnızca Almanca olarak mevcuttur.",
  'buchen.recht.widerruf.belehrungLabel': "Cayma hakkı bildirimini göster",
  'buchen.recht.widerruf.formularLabel': "Örnek cayma formunu göster",
  'buchen.recht.vorzeitig.checkbox': "İşletmenin, 14 günlük cayma süresi dolmadan hizmete başlamasını açıkça talep ediyorum. Sözleşmenin tam olarak ifasıyla cayma hakkımı kaybedeceğimin farkındayım.",
  'buchen.recht.vorzeitig.error': "Lütfen hizmetin erken başlamasını kabul edin veya daha geç bir randevu seçin.",
  'buchen.recht.datenschutz.hintAnfrage': "İşletme, randevu talebinizi işlemek için verilerinizi işler. Sorumlu, yukarıda belirtilen sağlayıcıdır.",
  'buchen.recht.datenschutz.hintVerbindlich': "İşletme, sözleşmeyi yerine getirmek için verilerinizi işler. Sorumlu, yukarıda belirtilen sağlayıcıdır.",
  'buchen.recht.datenschutz.link': "Veri koruma bilgileri",
  'buchen.recht.datenschutz.checkbox': "Veri koruma bilgilerini bilgime aldım.",
  'buchen.recht.verbindlich.emailRequired': "Bağlayıcı, ücretli bir rezervasyon için e-posta adresinize ihtiyacımız var — rezervasyon onayını ve cayma hakkı bildirimini oraya göndeririz.",
  'buchen.recht.verbindlich.leistungRequired': "Bağlayıcı bir rezervasyon için lütfen bir hizmet seçin.",
  'buchen.recht.anfrage.hinweis': "Henüz bir sözleşme kurulmaz; işletme randevunuzu onaylar.",
  'buchen.recht.anfrage.button': "Bağlayıcı olmadan talep et",
  'buchen.recht.anfrage.submitting': "Gönderiliyor…",
  'buchen.recht.verbindlich.intro': "Tıklayarak işletmeyle ücretli bir sözleşme kurarsınız.",
  'buchen.recht.verbindlich.button': "Ücretli rezerve et",
  'buchen.recht.verbindlich.submitting': "Rezervasyon işleniyor…",
  'buchen.recht.success.anfrage.title': "Talep gönderildi",
  'buchen.recht.success.anfrage.text': "Teşekkürler! {betrieb} randevuyu onaylamak için sizinle iletişime geçecek.",
  'buchen.recht.success.verbindlich.title': "Rezervasyon onaylandı",
  'buchen.recht.success.verbindlich.text': "{betrieb} işletmesindeki ücretli rezervasyonunuz için teşekkürler. Cayma hakkı bildirimini içeren onayı e-posta ile alacaksınız.",
  'buchen.recht.success.reference': "Referansınız:",

  // ---- Tarif-Hinweise (Feature-Gating) -------------------------------------
  'settings.sevdesk.upgrade': "Otomatik sevDesk aktarımı Basic tarifeden itibaren kullanılabilir.",
  'ordertime.upgrade': "Çalışma süreleri ve işçilik maliyetleri Pro tarifeye dahildir.",

  // ---- Einstellungen: Seite ------------------------------------------------
  'settings.title': "Ayarlar",
  'settings.subtitle': "Görünüm, profil ve — işletme sahibi olarak — işletme verileri.",
  'settings.tab.appearance': "Görünüm",
  'settings.tab.profile': "Profil",
  'settings.tab.business': "İşletme",
  'settings.tab.customerComm': "Müşteri iletişimi",
  'settings.tab.goals': "Hedefler ve hatırlatmalar",
  'settings.tab.audit': "Denetim günlüğü",
  'settings.saving': "Kaydediliyor…",
  'settings.toast.saved': "Kaydedildi",

  // Einstellungen: Betrieb – Sekundaer-Navigation (Unterbereiche, je eigener Speichern-Button)
  'settings.bereich.navLabel': "İşletme ayarları alanları",
  'settings.bereich.stammdaten': "Ana veriler ve marka",
  'settings.bereich.steuer': "Vergi ve künye",
  'settings.bereich.rechnung': "Banka ve faturalama",
  'settings.bereich.kalender': "Hesaplama ve takvim",
  'settings.bereich.email': "E-posta gönderimi",
  'settings.bereich.mahnwesen': "Ödeme takibi",
  'settings.bereich.buchhaltung': "DATEV ve sevDesk",
  'settings.bereich.sicherheit': "Güvenlik",

  // Einstellungen: Status-Mail-Vorlagen (editierbar, je Status Betreff + Text)
  'settings.statusmail.title': "Durum e-postası şablonları",
  'settings.statusmail.subtitle': "Otomatik durum e-postalarının konu ve metnini müşterilerinize göre uyarlayın.",
  'settings.statusmail.reviewNote': "Gönderim tetikleyicisi değişmez: durum e-postaları yalnızca durum anahtarı (müşteri iletişimi) açıkken gönderilir. Burada yalnızca metni uyarlarsınız.",
  'settings.statusmail.placeholders': "Kullanılabilir yer tutucular:",
  'settings.statusmail.status.bestaetigt': "İş emri onaylandı",
  'settings.statusmail.status.in_arbeit': "İş emri işlemde",
  'settings.statusmail.status.abholbereit': "Araç teslime hazır",
  'settings.statusmail.reset': "Varsayılana sıfırla",
  'settings.statusmail.subject': "Konu",
  'settings.statusmail.subjectPlaceholder': "Standart konu için boş bırakın",
  'settings.statusmail.body': "Metin",
  'settings.statusmail.bodyPlaceholder': "Standart metin için boş bırakın",
  'settings.statusmail.defaultHint': "Boş = denenmiş standart metin kullanılır.",
  'settings.statusmail.footerHint': "Selamlama, iş emri durumuna bağlantı ve kapanış otomatik eklenir — metniniz aralarına yerleşir.",

  // Einstellungen: Benachrichtigungs-Präferenzen je Nutzer (Glocke)
  'settings.benachrichtigungen.title': "Bildirimler",
  'settings.benachrichtigungen.subtitle': "Zilinizde hangi uyarıların görüneceği.",
  'settings.benachrichtigungen.intro': "Bu ayar yalnızca sizin için geçerlidir. Varsayılan olarak tüm uyarılar açıktır.",
  'settings.benachrichtigungen.rechnungenFaellig': "Vadesi geçmiş faturalar",
  'settings.benachrichtigungen.rechnungenFaelligHint': "Faturalar ödeme vadesini aştığında uyarı.",
  'settings.benachrichtigungen.termineHeute': "Bugünkü randevular",
  'settings.benachrichtigungen.termineHeuteHint': "Bugün için planlanan randevulara ilişkin uyarı.",
  'settings.benachrichtigungen.materialKnapp': "Malzeme az",
  'settings.benachrichtigungen.materialKnappHint': "Ürünler minimum stokun altına düştüğünde uyarı.",
  'settings.benachrichtigungen.steuerTermine': "Vergi tarihleri",
  'settings.benachrichtigungen.steuerTermineHint': "Kendi girdiğiniz yaklaşan vergi tarihleri için hatırlatma.",
  'settings.benachrichtigungen.auslastung': "Doluluk",
  'settings.benachrichtigungen.auslastungHint': "Haftalık doluluk hedefinizin altında kaldığında uyarı.",
  'settings.benachrichtigungen.par19': "§19 ciro sınırı",
  'settings.benachrichtigungen.par19Hint': "Küçük işletme ciro sınırına yaklaştığınızda uyarı.",

  // Einstellungen: Darstellung
  'settings.appearance.title': "Görünüm",
  'settings.appearance.subtitle': "Detailly'in sizin için görünümü.",
  'settings.appearance.colorScheme': "Renk şeması",
  'settings.appearance.dark': "Koyu",
  'settings.appearance.light': "Açık",
  'settings.appearance.deviceOnly': "Yalnızca bu cihaz ve tarayıcı için geçerlidir.",
  'settings.motion.title': "Hareket",
  'settings.motion.subtitle': "Animasyonları azalt — daha sakin ve yumuşak.",
  'settings.motion.reduce': "Animasyonları azalt",
  'settings.motion.deviceOnly': "Bu ayar yalnızca bu cihaz ve tarayıcı için geçerlidir.",

  // Einstellungen: Profil
  'settings.profile.title': "Profilim",
  'settings.profile.subtitle': "Adınızı ve telefon numaranızı kendiniz yönetebilirsiniz.",
  'settings.profile.firstName': "Ad",
  'settings.profile.lastName': "Soyad",
  'settings.profile.phone': "Telefon (isteğe bağlı)",
  'settings.profile.email': "E-posta",
  'settings.profile.role': "Rol",
  'settings.profile.emailRoleHint': "E-posta adresini ve rolü işletme yönetimi, personel yönetiminden değiştirir.",

  // Einstellungen: Passwort
  'settings.password.title': "Parola",
  'settings.password.subtitle': "Parolayı e-posta ile güvenli bir bağlantı üzerinden değiştirin.",
  'settings.password.sent': "Size sıfırlama için bir e-posta gönderdik.",
  'settings.password.sending': "Gönderiliyor…",
  'settings.password.change': "Parolayı değiştir",

  // Einstellungen: Kalender-Abo
  'settings.calendar.title': "Takvim aboneliği (Apple / Google)",
  'settings.calendar.subtitle': "Tüm randevular otomatik olarak kendi takviminizde — kendini güncelleyen gizli bir abonelik bağlantısıyla.",
  'settings.calendar.appleLabel': "Apple Takvim (webcal)",
  'settings.calendar.googleLabel': "Google / diğer (https)",
  'settings.calendar.copy': "Kopyala",
  'settings.calendar.copied': "Kopyalandı ✓",
  'settings.calendar.appleName': "Apple Takvim:",
  'settings.calendar.appleHelp': " Dosya → «Yeni Takvim Aboneliği…» → webcal bağlantısını yapıştırın.",
  'settings.calendar.googleName': "Google Takvim:",
  'settings.calendar.googleHelp': " Diğer takvimler → «URL ile ekle» → https bağlantısını yapıştırın.",
  'settings.calendar.secretHint': "Bağlantı gizlidir ve randevulara okuma erişimi verir — yalnızca güvendiğiniz kişilerle paylaşın.",
  'settings.calendar.regenerating': "Oluşturuluyor…",
  'settings.calendar.regenerate': "Bağlantıyı yeniden oluştur (eskisini geçersiz kıl)",
  'settings.calendar.confirmTitle': "Takvim bağlantısını yeniden oluştur",
  'settings.calendar.confirmMsg': "Yeni bir gizli abonelik bağlantısı oluşturulur. Önceki bağlantı geçersiz olur — mevcut takvim abonelikleri yeni bağlantıyla yeniden kurulmalıdır.",
  'settings.calendar.confirmLabel': "Yeniden oluştur",

  // Einstellungen: Verwaltung (Schnellzugriffe)
  'settings.admin.title': "Yönetim",
  'settings.admin.subtitle': "İşletme alanlarına doğrudan erişim.",
  'settings.admin.staffTitle': "Personel ve roller",
  'settings.admin.staffText': "Ekip oluşturun, rolleri ve erişimleri yönetin.",
  'settings.admin.locationsTitle': "Şubeler",
  'settings.admin.locationsText': "Şubeleri yönetin ve şubeler arası değerlendirin.",
  'settings.admin.servicesTitle': "Hizmetler ve fiyatlar",
  'settings.admin.servicesText': "Kendi hizmet kataloğunuzu ve fiyatlarınızı yönetin.",
  'settings.admin.subscriptionTitle': "Abonelik ve tarife",
  'settings.admin.subscriptionText': "Detailly tarifenizi görüntüleyin ve yönetin.",

  // Einstellungen: Betriebstyp & Branchen-Look
  'settings.branche.title': "İşletme türü ve sektör görünümü",
  'settings.branche.subtitle': "Vurgu rengini, hesaplama kataloğunu ve türe özgü seçenekleri belirler.",
  'settings.branche.help': "Görünüm (vurgu rengi) kaydettikten sonra işletmenin tüm çalışanları için anında değişir.",

  // Einstellungen: Dein Look (Logo & Akzentfarbe)
  'settings.branding.title': "Görünümünüz: logo ve renk",
  'settings.branding.subtitle': "Müşteri görünümleri için logo ve vurgu rengi (iş emri takibi, teslim dosyası).",
  'settings.branding.logoLabel': "Logo",
  'settings.branding.logoPlaceholder': "Logo yok",
  'settings.branding.logoChoose': "Logo seç",
  'settings.branding.logoUploading': "Yükleniyor…",
  'settings.branding.logoRemove': "Logoyu kaldır",
  'settings.branding.logoHelp': "PNG, JPEG veya WebP, en fazla 512 KB. Tercihen şeffaf arka planlı.",
  'settings.branding.logoErrorType': "Logo olarak yalnızca PNG, JPEG veya WebP kullanılabilir.",
  'settings.branding.logoErrorSize': "Logo çok büyük (en fazla 512 KB).",
  'settings.branding.logoErrorGeneric': "Logo kaydedilemedi.",
  'settings.branding.logoUploaded': "Logo güncellendi",
  'settings.branding.logoRemoved': "Logo kaldırıldı",
  'settings.branding.logoRemoveConfirmTitle': "Logo kaldırılsın mı?",
  'settings.branding.logoRemoveConfirmMsg': "Logo tüm müşteri görünümlerinden kaldırılır. İstediğiniz zaman yeni bir tane yükleyebilirsiniz.",
  'settings.branding.accentLabel': "Vurgu rengi",
  'settings.branding.accentReset': "Varsayılana sıfırla",
  'settings.branding.accentPreviewButton': "Örnek düğme",
  'settings.branding.accentHelp': "Müşteri görünümlerinde başlığı, durum noktalarını ve düğmeleri renklendirir. Boş = sektör standardı.",
  'settings.branding.accentInvalid': "Lütfen geçerli bir onaltılık renk girin (örn. #B5722F).",

  // Einstellungen: Betrieb & Anschrift
  'settings.address.title': "İşletme ve adres",
  'settings.address.subtitle': "İşletmenin adı ve adresi",
  'settings.address.name': "İşletme adı",
  'settings.address.email': "E-posta",
  'settings.address.phone': "Telefon",
  'settings.address.street': "Cadde ve numara",
  'settings.address.postalCode': "Posta kodu",
  'settings.address.city': "Şehir",
  'settings.address.country': "Ülke",
  'settings.address.taxHintPre': "§ 14 UStG: Ad, adres ve vergi numarası ",
  'settings.address.taxHintOr': "veya",
  'settings.address.taxHintPost': " USt-IdNr., geçerli faturalar için zorunlu bilgilerdir.",

  // Einstellungen: Steuer
  'settings.tax.title': "Vergi (§ 14 UStG)",
  'settings.tax.subtitle': "Vergi numarası veya USt-IdNr. faturalarda zorunludur.",
  'settings.tax.steuernummer': "Vergi numarası",
  'settings.tax.steuernummerPlaceholder': "örn. 12/345/67890",
  'settings.tax.ustId': "USt-IdNr.",
  'settings.tax.ustIdPlaceholder': "örn. DE123456789",
  // §19 UStG (Kleinunternehmer) + Rechtsform
  'settings.steuer.kleinunternehmer': "Küçük işletme (§ 19 UStG)",
  'settings.steuer.kleinunternehmerHint': "KDV gösterme. Yeni belgeler otomatik olarak %0 ile oluşturulur.",
  'settings.steuer.hinweisLabel': "Belgelerdeki bilgi metni",
  'settings.steuer.hinweisHelp': "Faturalarda/tekliflerde görünür. Standart metin için boş bırakın.",
  'settings.steuer.standardSatz': "Yeni belgeler için standart KDV oranı",
  'settings.steuer.standardSatzHelp': "Yeni belge oluştururken ön seçim. Belge başına değiştirilebilir kalır (%19 / %7 / %0).",
  'settings.steuer.rechtsform': "Hukuki biçim",
  'settings.steuer.rechtsform.einzelunternehmen': "Şahıs işletmesi",
  'settings.steuer.rechtsform.gbr': "GbR",
  'settings.steuer.rechtsform.ug': "UG (haftungsbeschränkt)",
  'settings.steuer.rechtsform.gmbh': "GmbH",
  'settings.steuer.rechtsform.ohg': "OHG",
  'settings.steuer.rechtsform.kg': "KG",
  'settings.steuer.rechtsform.gmbh_co_kg': "GmbH & Co. KG",
  'settings.steuer.rechtsform.freiberufler': "Serbest meslek",
  'settings.steuer.rechtsform.sonstige': "Diğer",
  'settings.steuer.registergericht': "Sicil mahkemesi",
  'settings.steuer.registergerichtPlaceholder': "örn. Amtsgericht Charlottenburg",
  'settings.steuer.registernummer': "Sicil numarası",
  'settings.steuer.registernummerPlaceholder': "örn. HRB 123456",
  'settings.steuer.vertretung': "Yasal temsilciler",
  'settings.steuer.vertretungPlaceholder': "örn. Max Mustermann (müdür)",
  'settings.steuer.infoLinkPre': "Sizin için neyin geçerli olduğundan emin değil misiniz? ",
  'settings.steuer.infoLink': "Küçük işletme ve hukuki biçim hakkında bilgiler",
  'settings.steuer.infoLinkPost': " (vergi danışmanlığı değildir).",

  // ---- Einstellungen: Ziele & Erinnerungen (Tab, nur Inhaber) --------------
  'settings.ziele.intro.title': "Hedefler ve hatırlatmalar",
  'settings.ziele.intro.subtitle': "Vergi tarihleri ve uyarılar — zilinizde ölçülü bildirimler olarak. Dışarıya hiçbir şey gönderilmez.",
  // Auslastungsziel
  'settings.ziele.auslastung.title': "Doluluk hedefi",
  'settings.ziele.auslastung.subtitle': "İşletmenizin kapasite doluluğu için hedef değer.",
  'settings.ziele.auslastung.toggle': "Doluluk hedefini etkinleştir",
  'settings.ziele.auslastung.toggleHint': "Haftalık dolulukunuz hedefin altındayken zilde bir uyarı gösterir.",
  'settings.ziele.auslastung.prozentLabel': "Hedef doluluk (%)",
  'settings.ziele.auslastung.prozentHelp': "%50 ile %100 arası. Standart: %90.",
  // §19-Umsatzgrenzen-Warnung
  'settings.ziele.par19.title': "Ciro sınırı uyarısı (§ 19 UStG)",
  'settings.ziele.par19.subtitle': "Küçük işletme sınırına ulaşılmadan önce erken uyarı.",
  'settings.ziele.par19.toggle': "Ciro sınırına ulaşmadan önce uyar",
  'settings.ziele.par19.toggleHint': "Mevcut §19 durumunu kullanır (100.000 €/yıl) — zilde uyarı olarak görünür.",
  'settings.ziele.par19.disabledHint': "Yalnızca «İşletme» sekmesinde küçük işletme düzenlemesi (§ 19 UStG) etkinse kullanılabilir.",
  // Steuer-Termine
  'settings.ziele.termine.title': "Vergi tarihleri",
  'settings.ziele.termine.subtitle': "Zilin size zamanında (14 gün önce) hatırlattığı kendi tarihleriniz.",
  'settings.ziele.termine.artLabel': "Tür",
  'settings.ziele.termine.artPlaceholder': "örn. KDV ön beyanı",
  'settings.ziele.termine.datumLabel': "Tarih",
  'settings.ziele.termine.datumPlaceholderRec': "01-10 (AA-GG)",
  'settings.ziele.termine.datumPlaceholderOnce': "2026-06-30 (YYYY-AA-GG)",
  'settings.ziele.termine.datumHelp': "Yinelenen: AA-GG (örn. 01-10). Tek seferlik: YYYY-AA-GG.",
  'settings.ziele.termine.wiederkehrend': "Yıllık",
  'settings.ziele.termine.aktiv': "Aktif",
  'settings.ziele.termine.remove': "Kaldır",
  'settings.ziele.termine.add': "Tarih ekle",
  'settings.ziele.termine.empty': "Henüz tarih oluşturulmadı.",
  'settings.ziele.termine.max': "En fazla 12 tarih.",
  'settings.ziele.termine.disclaimer': "Bağlayıcı olmayan hatırlatmalar, vergi danışmanlığı değildir.",
  'settings.ziele.error.datum': "Lütfen geçerli bir tarih girin — yinelenen AA-GG, tek seferlik YYYY-AA-GG.",

  // Impressum-Generator (§ 5 DDG) – Betrieb-Tab. Pflichtangaben stammen aus den
  // Feldern oben (Adresse/Steuer). Inhalte selbst sind Betriebsdaten (nicht übersetzt).
  'settings.impressum.title': "Künye",
  'settings.impressum.subtitle': "Genel sayfalarınız için § 5 DDG uyarınca zorunlu bilgiler (randevu, durum, belge).",
  'settings.impressum.disclaimer': "Otomatik oluşturucu, hukuki danışmanlık değildir: Detailly künyeyi ana verilerinizden oluşturur. Doğruluk ve eksiksizlikten işletme olarak siz sorumlusunuz.",
  'settings.impressum.vertretung.inhaber': "Sahibi (ad ve soyad)",
  'settings.impressum.vertretung.gbr': "Ortaklar (tümü isimle)",
  'settings.impressum.vertretung.vertreter': "Yasal temsilci(ler)",
  'settings.impressum.vertretungPlaceholder': "örn. Max Mustermann",
  'settings.impressum.vertretungHelp': "Künyede sorumlu kişi olarak görünür. Birden fazlaysa lütfen hepsini belirtin.",
  'settings.impressum.complete': "Künye eksiksiz — tüm zorunlu bilgiler girildi.",
  'settings.impressum.ustWarn': "Öneri: USt-IdNr.'yi (§ 27a UStG) elinize geçer geçmez ekleyin.",
  'settings.impressum.incomplete': "Eksiksiz bir künye için şu bilgiler eksik:",
  'settings.impressum.incompleteHint': "Eksik bir künye ihtarname konusu olabilir. Eksik alanları yukarıdaki bölümlerde (adres, vergi/hukuki biçim) doldurursunuz.",
  'settings.impressum.feld.firmenname': "Firma adı",
  'settings.impressum.feld.strasse': "Cadde ve numara",
  'settings.impressum.feld.plz': "Posta kodu",
  'settings.impressum.feld.ort': "Şehir",
  'settings.impressum.feld.telefon': "Telefon numarası",
  'settings.impressum.feld.email': "E-posta adresi",
  'settings.impressum.feld.vertretungsberechtigte': "Sorumlu kişi (sahip/müdür/ortak)",
  'settings.impressum.feld.registergericht': "Sicil mahkemesi",
  'settings.impressum.feld.registernummer': "Sicil numarası (HRB)",
  'settings.impressum.previewTitle': "Önizleme",
  'settings.impressum.previewHeading': "§ 5 DDG uyarınca bilgiler",
  'settings.impressum.placeholderName': "[Firma adı eksik]",
  'settings.impressum.previewPhone': "Telefon",
  'settings.impressum.previewEmail': "E-posta",
  'settings.impressum.previewRegister': "Sicil mahkemesi",
  'settings.impressum.previewUstId': "USt-IdNr.",
  'settings.impressum.viewLive': "Genel görünümü aç",
  'settings.impressum.optionalTitle': "İsteğe bağlı ek bilgiler",
  'settings.impressum.optionalHint': "Yalnızca belirli işletmeler için gereklidir — detailing/kaplama/PPF için genellikle önemli değildir.",
  'settings.impressum.berufshaftpflicht': "Mesleki sorumluluk sigortası",
  'settings.impressum.berufshaftpflichtPlaceholder': "örn. sigortacı, adres, coğrafi kapsam",
  'settings.impressum.aufsichtsbehoerde': "Denetim makamı",
  'settings.impressum.aufsichtsbehoerdePlaceholder': "yalnızca izne tabi faaliyetlerde",

  // Einstellungen: Auf detailly.de zeigen (Opt-in Mitgliederliste)
  'settings.mitglied.title': "detailly.de'de göster",
  'settings.mitglied.subtitle': "İşletmenizi ana sayfamızda referans olarak listeleyin — gönüllü ve istediğiniz zaman geri alınabilir.",
  'settings.mitglied.toggle': "Detailly ana sayfasında göster",
  'settings.mitglied.toggleHint': "Yalnızca onayınızla. Firma adı, işletme türü ve isteğe bağlı olarak şehir, kısa açıklama ve web sitesi gösterilir — iletişim bilgileri asla.",
  'settings.mitglied.stadt': "Şehir (isteğe bağlı)",
  'settings.mitglied.stadtPlaceholder': "örn. Berlin",
  'settings.mitglied.kurzbeschreibung': "Kısa açıklama (isteğe bağlı)",
  'settings.mitglied.kurzbeschreibungPlaceholder': "örn. 2015'ten beri premium detailing ve kaplama",
  'settings.mitglied.kurzbeschreibungHelp': "En fazla 160 karakter.",
  'settings.mitglied.webseite': "Web sitesi (isteğe bağlı)",
  'settings.mitglied.webseitePlaceholder': "https://isletmeniz.de",
  'settings.mitglied.webseiteHelp': "http:// veya https:// ile başlamalıdır.",
  'settings.mitglied.previewLabel': "Önizleme",
  'settings.mitglied.consent': "İşletmeniz ana sayfamızda yalnızca onayınızla görünür; istediğiniz zaman geri alınabilir.",

  // Einstellungen: Bankverbindung
  'settings.bank.title': "Banka bilgileri",
  'settings.bank.subtitle': "Faturanın altında görünür.",
  'settings.bank.bankname': "Banka",
  'settings.bank.iban': "IBAN",
  'settings.bank.bic': "BIC",

  // Einstellungen: Rechnungsstellung
  'settings.invoice.title': "Faturalama",
  'settings.invoice.subtitle': "Yeni faturalar için varsayılan değerler — mevcut belgeler değişmeden kalır.",
  'settings.invoice.paymentTerm': "Ödeme vadesi (gün)",
  'settings.invoice.paymentTermHelp': "Boş bırakın = 14 gün.",
  'settings.invoice.paymentLink': "Ödeme bağlantısı",
  'settings.invoice.paymentLinkPlaceholder': "https://paypal.me/isletmeniz",
  'settings.invoice.paymentLinkHelp': "Kendi PayPal.me veya Stripe ödeme bağlantınız. Belgenin genel sayfasında «Çevrimiçi öde» düğmesi olarak görünür — ödemeler doğrudan size gelir, asla Detailly üzerinden geçmez. https:// ile başlamalıdır.",
  'settings.invoice.footer': "Belgelerdeki alt bilgi metni",
  'settings.invoice.footerPlaceholder': "örn. Siparişiniz için teşekkürler! Genel işlem koşullarımız geçerlidir.",
  'settings.invoice.footerHelp': "Teklif ve fatura PDF'lerinin alt bilgisinde görünür.",

  // Einstellungen: Mahnwesen
  'settings.mahn.title': "Ödeme takibi",
  'settings.mahn.subtitle': "Ödeme hatırlatmaları ve ihtarlar için süreler ve ücretler.",
  'settings.mahn.auto': "Otomatik ihtar gönder",
  'settings.mahn.autoHint': "Otomatik ihtarlar — aksi halde ihtar kokpitinden manuel ihtar gönderirsiniz.",
  'settings.mahn.deadlines': "Süreler (vadeden sonraki gün)",
  'settings.mahn.reminder': "Hatırlatma",
  'settings.mahn.dunning1': "1. ihtar",
  'settings.mahn.dunning2': "2. ihtar",
  'settings.mahn.deadlinesHelp': "Kesin artan sırada: hatırlatma < 1. ihtar < 2. ihtar (her biri 1–365 gün).",
  'settings.mahn.fees': "İhtar ücretleri (€)",
  'settings.mahn.feesHelp': "Kademe başına 0 ile 999 € arası. İhtarda ek kalem olarak görünür.",

  // Einstellungen: Kunden-Benachrichtigungen
  'settings.notify.title': "Müşteri bildirimleri",
  'settings.notify.subtitle': "Müşterilere otomatik e-postalar — istediğiniz zaman kapatılabilir.",
  'settings.notify.status': "İş emri durum e-postaları",
  'settings.notify.statusHint': "E-posta adresi olan müşteriler, önemli durum değişikliklerinde iş emri takibine bağlantı içeren bir mesajı otomatik alır.",
  'settings.notify.appointment': "Randevu onayı",
  'settings.notify.appointmentHint': "Çevrimiçi randevu talebi kabul edildiğinde müşteriler bir onay e-postası alır.",

  // Einstellungen: Kundenkommunikation (Termin-Erinnerung, Bewertungs-Bitte, Status-Mails)
  'settings.kk.intro.title': "Müşteri iletişimi",
  'settings.kk.intro.subtitle': "Müşterilerinize otomatik e-postalar: hatırlatmalar, değerlendirme isteği ve durum bilgileri.",
  'settings.kk.reviewNote': "Hiçbir şey istem dışı gitmez: müşterilere otomatik e-postaları yalnızca ilgili anahtarı bilinçli olarak açtığınızda göndeririz. Buradaki her şey istediğiniz zaman kapatılabilir.",
  'settings.kk.reminder.title': "Randevu hatırlatması",
  'settings.kk.reminder.subtitle': "E-posta adresi olan müşterilere yaklaşan randevularını otomatik hatırlatır.",
  'settings.kk.reminder.toggle': "Randevu hatırlatması gönder",
  'settings.kk.reminder.toggleHint': "Müşteriler randevudan önce nazik bir hatırlatma alır — her hatırlatma yalnızca bir kez gönderilir.",
  'settings.kk.reminder.hoursLabel': "Ön süre (saat önce)",
  'settings.kk.reminder.hoursHelp': "Hatırlatmanın randevu başlangıcından kaç saat önce gönderileceği (1–168, standart 24).",
  'settings.kk.review.title': "Değerlendirme isteği",
  'settings.kk.review.subtitle': "«Araç teslime hazır» e-postasına bir değerlendirme bağlantısı ekler — yalnızca etkinse ve bir bağlantı tanımlıysa.",
  'settings.kk.review.toggle': "Değerlendirme iste",
  'settings.kk.review.toggleHint': "Kapanış e-postasına Google değerlendirmenize bir bağlantı ekler.",
  'settings.kk.review.urlLabel': "Google değerlendirme bağlantısı",
  'settings.kk.review.urlHelp': "https:// ile başlamalıdır. En kolayı Google işletme profiliniz üzerinden («Yorum yaz»).",
  'settings.kk.review.urlPlaceholder': "https://g.page/r/...",
  'settings.kk.review.textLabel': "Kendi davet metniniz (isteğe bağlı)",
  'settings.kk.review.textHelp': "Standart metin için boş bırakın.",
  'settings.kk.review.textPlaceholder': "Memnun kaldınız mı? Kısa bir değerlendirme bizi çok mutlu eder:",
  'settings.kk.error.url': "Değerlendirme bağlantısı https:// ile başlamalıdır.",

  // Einstellungen: Sicherheit (2FA-Pflicht, Owner-Policy)
  'settings.security.title': "Güvenlik",
  'settings.security.subtitle': "Ekibiniz için iki faktörlü kimlik doğrulama.",
  'settings.security.mfaRequired': "Çalışanlar için 2FA zorunluluğu",
  'settings.security.mfaRequiredHint': "Tüm işletme rolleri, çalışmaya devam etmeden önce iki faktörlü kimlik doğrulamayı kurmalıdır.",

  // Zwei-Faktor-Authentifizierung (Profil-Sektion + Banner)
  'mfa.title': "İki faktörlü kimlik doğrulama",
  'mfa.subtitle': "Bir kimlik doğrulama uygulamasıyla hesabınıza ek koruma.",
  'mfa.idle.desc': "İki faktörlü kimlik doğrulama etkinken oturum açarken ayrıca kimlik doğrulama uygulamanızdan tek kullanımlık bir koda ihtiyacınız olur.",
  'mfa.idle.setupCta': "2FA kur",
  'mfa.required.note': "İşletmeniz iki faktörlü kimlik doğrulamayı gerektiriyor. Lütfen şimdi kurun.",
  'mfa.recommended.note': "Rolünüz için iki faktörlü kimlik doğrulama şiddetle önerilir.",
  'mfa.setup.step1': "Kimlik doğrulama uygulamasıyla tarayın",
  'mfa.setup.step2': "Tarayamıyor musunuz? Bu anahtarı uygulamaya manuel olarak girin.",
  'mfa.setup.secretLabel': "Kurulum anahtarı",
  'mfa.setup.copySecret': "Kopyala",
  'mfa.setup.secretCopied': "Kopyalandı",
  'mfa.setup.codeLabel': "Uygulamadaki kod",
  'mfa.setup.codeHint': "Kurulumu tamamlamak için şu anda gösterilen 6 haneli kodu girin.",
  'mfa.setup.activate': "Etkinleştir",
  'mfa.setup.cancel': "İptal",
  'mfa.recovery.title': "Kurtarma kodları",
  'mfa.recovery.desc': "Bu kodları güvenli bir yerde saklayın — her biri yalnızca bir kez çalışır.",
  'mfa.recovery.warn': "Bu kodlar yalnızca şimdi gösterilir. Kimlik doğrulama uygulaması olmadan tek erişiminizdir — güvenli bir yere kaydedin veya yazdırın.",
  'mfa.recovery.copy': "Tümünü kopyala",
  'mfa.recovery.copied': "Kopyalandı",
  'mfa.recovery.download': "Dosya olarak kaydet",
  'mfa.recovery.done': "Onları güvene aldım",
  'mfa.enabled.status': "İki faktörlü kimlik doğrulama etkin.",
  'mfa.enabled.deactivate': "2FA'yı devre dışı bırak",
  'mfa.deact.title': "Devre dışı bırakmak için uygulamadan güncel bir kod veya parolanızı girin.",
  'mfa.deact.codeLabel': "Uygulamadaki kod",
  'mfa.deact.passwordLabel': "Parola",
  'mfa.deact.usePassword': "Bunun yerine parolayı kullan",
  'mfa.deact.useCode': "Bunun yerine uygulama kodunu kullan",
  'mfa.deact.confirm': "Devre dışı bırak",
  'mfa.deact.cancel': "İptal",
  'mfa.toast.activated': "İki faktörlü kimlik doğrulama etkinleştirildi.",
  'mfa.toast.deactivated': "İki faktörlü kimlik doğrulama devre dışı bırakıldı.",
  'mfa.error.generic': "İşlem başarısız oldu. Lütfen tekrar deneyin.",
  'mfa.banner.required': "İşletmeniz iki faktörlü kimlik doğrulamayı gerektiriyor. Lütfen şimdi kurun.",
  'mfa.banner.recommended': "Rolünüz için iki faktörlü kimlik doğrulama şiddetle önerilir.",
  'mfa.banner.setupCta': "Şimdi kur",

  // Einstellungen: Mail-Versand
  'settings.mail.title': "E-posta gönderimi (kendi göndericiniz)",
  'settings.mail.subtitle': "İsteğe bağlı: müşteri ve belge e-postalarını kendi SMTP sunucunuz ve göndericiniz üzerinden gönderin.",
  'settings.mail.useOwn': "Kendi göndericini kullan",
  'settings.mail.useOwnHint': "Etkin bir yapılandırma olmadan Detailly, standart adresten göndermeye devam eder.",
  'settings.mail.host': "SMTP ana bilgisayarı",
  'settings.mail.hostPlaceholder': "örn. smtp.saglayiciniz.de",
  'settings.mail.port': "Bağlantı noktası",
  'settings.mail.encryption': "Şifreleme",
  'settings.mail.user': "Kullanıcı",
  'settings.mail.userPlaceholder': "E-posta sunucusundaki oturum açma adı",
  'settings.mail.password': "Parola",
  'settings.mail.passwordPlaceholder': "SMTP parolasını girin",
  'settings.mail.passwordPlaceholderSet': "Kayıtlı ({hint}) – değiştirmek için yeni parola girin",
  'settings.mail.passwordHelp': "Boş bırakın = değişmez. Şifreli olarak saklanır ve bir daha gösterilmez.",
  'settings.mail.fromEmail': "Gönderici adresi (From)",
  'settings.mail.fromEmailPlaceholder': "fatura@isletmeniz.de",
  'settings.mail.fromName': "Gönderici adı",
  'settings.mail.fromNamePlaceholder': "örn. işletmenizin adı",
  'settings.mail.testInfoPre': "Test e-postası, kayıtlı gönderici adresine gider ve ",
  'settings.mail.testInfoEmph': "en son kaydedilen",
  'settings.mail.testInfoPost': " yapılandırmayı kontrol eder. Yani önce değişiklikleri kaydedin, sonra test edin.",
  'settings.mail.testTitleOn': "Gönderici adresine bir test e-postası gönderir",
  'settings.mail.testTitleOff': "Önce «Kendi göndericini kullan»ı etkinleştirip kaydedin",
  'settings.mail.sending': "Gönderiliyor…",
  'settings.mail.testSend': "Test e-postası gönder",
  'settings.mail.confirmMsgPre': "Kayıtlı gönderici adresine bir test e-postası gönderilecek",
  'settings.mail.confirmMsgPost': ". En son kaydedilen SMTP yapılandırması kontrol edilir.",

  // Einstellungen: Eigene Domain & Zustellbarkeit (SPF/DKIM/MX)
  'settings.maildomain.domain': "Kendi alan adı",
  'settings.maildomain.domainPlaceholder': "örn. isletmeniz.de",
  'settings.maildomain.domainHelp': "Gönderici adresinizin alan adı. DNS kayıtlarını yalnızca kaydettikten sonra görüntüleyip alan adını doğrulayabilirsiniz.",
  'settings.maildomain.title': "Teslim edilebilirliği kontrol et",
  'settings.maildomain.badgeVerified': "Alan adı doğrulandı",
  'settings.maildomain.badgeUnverified': "Doğrulanmadı",
  'settings.maildomain.spamHint': "Doğrulanmış bir alan adı (SPF ve DKIM) olmadan e-postalarınız alıcıda genellikle spam klasörüne düşer. Aşağıdaki DNS kayıtlarını alan adı sağlayıcınıza girin ve ardından doğrulayın.",
  'settings.maildomain.showRecords': "DNS kayıtlarını göster",
  'settings.maildomain.hideRecords': "DNS kayıtlarını gizle",
  'settings.maildomain.record.spf': "SPF kaydı",
  'settings.maildomain.record.dkim': "DKIM kaydı",
  'settings.maildomain.recordType': "Tür",
  'settings.maildomain.recordHost': "Ad / ana bilgisayar",
  'settings.maildomain.recordValue': "Değer",
  'settings.maildomain.recordsHint': "SPF kaydında «E-POSTA-SAĞLAYICINIZ» ifadesini e-posta sağlayıcınızın SPF include değeriyle değiştirin (belgelerine bakın). DKIM değeri tam olarak bu şekilde girilmelidir; bazı sağlayıcılar bunu otomatik olarak böler.",
  'settings.maildomain.copy': "Kopyala",
  'settings.maildomain.copied': "Kopyalandı",
  'settings.maildomain.verify': "Alan adını doğrula",
  'settings.maildomain.verifying': "Kontrol ediliyor…",
  'settings.maildomain.verifyTitle': "DNS kayıtlarını (SPF, DKIM, MX) canlı olarak kontrol eder",
  'settings.maildomain.verifyFailed': "Doğrulama başarısız",
  'settings.maildomain.verifiedToast': "Alan adı başarıyla doğrulandı – e-postalar artık DKIM ile imzalanır.",
  'settings.maildomain.lastChecked': "Son kontrol: {date}",
  'settings.maildomain.check.spf': "SPF",
  'settings.maildomain.check.dkim': "DKIM",
  'settings.maildomain.check.mx': "MX",
  'settings.maildomain.setDomainFirst': "DNS kayıtlarını görüntülemek ve teslim edilebilirliği kontrol etmek için yukarıya bir alan adı girip kaydedin.",

  // Einstellungen: DATEV / Buchhaltung
  'settings.datev.title': "DATEV / muhasebe",
  'settings.datev.subtitle': "DATEV kayıt yığını dışa aktarımı için. Danışman/müvekkil numarası mali müşavirden; hesaplar SKR03 standart değerleriyle önceden doldurulmuştur.",
  'settings.datev.beraterNr': "Danışman no.",
  'settings.datev.beraterNrPlaceholder': "örn. 1001",
  'settings.datev.mandantNr': "Müvekkil no.",
  'settings.datev.mandantNrPlaceholder': "örn. 456",
  'settings.datev.skr': "Hesap planı (SKR)",
  'settings.datev.debitor': "Alıcılar toplu hesabı",
  'settings.datev.erloes19': "Gelir hesabı %19",
  'settings.datev.erloes7': "Gelir hesabı %7",
  'settings.datev.erloes0': "Vergiden muaf gelir hesabı / §19",
  'settings.datev.help': "Not: İlk gerçek DATEV içe aktarımından önce lütfen mali müşavir veya ücretsiz DATEV kontrol programıyla karşılaştırın.",

  // Einstellungen: sevDesk-Anbindung
  'settings.sevdesk.title': "sevDesk bağlantısı",
  'settings.sevdesk.subtitle': "İsteğe bağlı: kesilen faturaları otomatik olarak sevDesk hesabınıza aktarın.",
  'settings.sevdesk.apiToken': "API anahtarı",
  'settings.sevdesk.tokenPlaceholder': "sevDesk API anahtarını yapıştırın",
  'settings.sevdesk.tokenPlaceholderSet': "Kayıtlı ({hint}) – değiştirmek için yeni anahtar girin",
  'settings.sevdesk.help': "sevDesk'te Ayarlar → Kullanıcı → API anahtarı altında bulunur. Şifreli olarak saklanır ve bir daha gösterilmez.",
  'settings.sevdesk.testTitle': "Kayıtlı anahtarı test eder",
  'settings.sevdesk.testing': "Test ediliyor…",
  'settings.sevdesk.test': "Bağlantıyı test et",
  'settings.sevdesk.remove': "Anahtarı kaldır",

  // Einstellungen: Fehler / Validierung
  'settings.error.saveFailed': "Kaydetme başarısız",
  'settings.error.loadFailed': "Ana veriler yüklenemedi",
  'settings.error.testFailed': "Test başarısız",
  'settings.error.removeFailed': "Kaldırma başarısız",
  'settings.error.mahnDaysRange': "İhtar süreleri 1 ile 365 gün arasında tam sayı olmalıdır.",
  'settings.error.mahnDaysOrder': "İhtar süreleri artan sırada olmalıdır (hatırlatma < 1. ihtar < 2. ihtar).",
  'settings.error.mailHostRequired': "Kendi e-posta gönderimi için bir SMTP ana bilgisayarı gereklidir.",
  'settings.error.mailPortRange': "SMTP bağlantı noktası 1 ile 65535 arasında olmalıdır.",
  'settings.error.mailFromInvalid': "Lütfen geçerli bir gönderici adresi (From) girin.",
  'settings.error.mailDomainMismatch': "Gönderici adresi, kayıtlı alan adına ait olmalıdır.",
  'settings.error.mitgliedWebseite': "Web sitesi http:// veya https:// ile başlamalıdır.",

  // ---- Login ---------------------------------------------------------------
  'login.subtitle': "Detailing Suite — detailing, kaplama & PPF",
  'login.email': "E-posta",
  'login.password': "Parola",
  'login.forgot': "Parolanızı mı unuttunuz?",
  'login.showPassword': "Parolayı göster",
  'login.hidePassword': "Parolayı gizle",
  'login.submit': "Oturum aç",
  'login.submitting': "Oturum açılıyor…",
  'login.failed': "Oturum açma başarısız",
  'login.noAccount': "Hesabınız yok mu?",
  'login.registerCta': "İşletme kaydet",
  'login.footer': "© {year} Detailly · Bağımsız detailing yazılımı",
  // Login: zweite Stufe (2FA)
  'login.mfaSubtitle': "İki faktörlü doğrulama",
  'login.mfaHint': "Kimlik doğrulama uygulamanızdaki 6 haneli kodu girin.",
  'login.mfaCode': "Doğrulama kodu",
  'login.mfaSubmit': "Onayla ve oturum aç",
  'login.mfaVerifying': "Kontrol ediliyor…",
  'login.mfaUseRecovery': "Kurtarma kodu kullan",
  'login.mfaUseCode': "Uygulama koduna dön",
  'login.mfaRecovery': "Kurtarma kodu",
  'login.mfaRecoveryHint': "Kurulum sırasında kaydettiğiniz tek kullanımlık kodlardan biri.",
  'login.mfaBack': "İptal",
  'login.mfaFailed': "Kod geçersiz veya süresi dolmuş",

  // ===========================================================================
  // LANDING (Route "/")
  // ===========================================================================

  // ---- Kopfleiste ----------------------------------------------------------
  'landing.nav.branchen': "Sektörler",
  'landing.nav.ablauf': "Nasıl çalışır",
  'landing.nav.funktionen': "Özellikler",
  'landing.nav.faq': "SSS",
  'landing.nav.login': "Oturum aç",
  'landing.nav.trial': "Ücretsiz dene",

  // ---- Hero ----------------------------------------------------------------
  'landing.hero.badge': "Detailing, kaplama & PPF için atölye yazılımı",
  'landing.hero.eyebrow': "Atölye yazılımı · Detailing / Kaplama / PPF",
  'landing.hero.headlinePre': "Araç girdi, hasar belgelendi, müşteri imzaladı — ",
  'landing.hero.headlineEm': "dört dakikada",
  'landing.hero.headlinePost': ".",
  'landing.hero.title1': "Sizin işiniz hassasiyet.",
  'landing.hero.title2': "Artık yazılımınız da öyle.",
  'landing.hero.sub': "Detailly, detailing, kaplama ve PPF için atölye yazılımıdır: kabul, planlama panosu, faturalama ve kasa defteri tek bir sistemde — akıldan değil, kanıtlı.",
  'landing.hero.ctaPrimary': "14 gün ücretsiz dene",
  'landing.hero.ctaSecondary': "Özellikleri gör",
  'landing.hero.trailer': "Kredi kartı gerekmez · Dakikalar içinde hazır · Aylık iptal edilebilir",

  // ---- Signature A: µm-Schichtdicken-Readout -------------------------------
  'landing.messwert.label': "Kaplama kalınlığı",
  'landing.messwert.unit': "µm",
  'landing.messwert.measuring': "ölçüyor …",
  'landing.messwert.status': "tolerans içinde",
  'landing.messwert.surface': "Boyalı yüzey · Kaput",
  'landing.messwert.caption': "Kabulde iddia değil, ölçülen değer önemlidir. Detailly de tam böyle çalışır: belgelenmiş ve kanıtlı. (Kaplama kalınlığı ölçümünün kendisi kabuldeki alete aittir, Detailly'e değil.)",
  'landing.messwert.aria': "Kaplama kalınlığı ölçümü: değer tolerans aralığında, yeşile sabitlenmiş.",

  // ---- Funktionen als Datenblatt (Label ↔ Fakt) ----------------------------
  'landing.datenblatt.kicker': "Teknik föy",
  'landing.datenblatt.title': "İçinde ne var — vaat değil, gerçekler olarak.",
  'landing.datenblatt.sub': "Her satır, bugün üründe bulunan bir işlevdir.",
  'landing.datenblatt.footnote': "Ayrıca: global arama, mobil kullanım ve işletme başına birden fazla çalışan.",
  'landing.datenblatt.kunden.label': "Müşteriler & araçlar",
  'landing.datenblatt.kunden.fact': "Araç dosyası · eksiksiz geçmiş",
  'landing.datenblatt.auftraege.label': "İş emirleri & planlama panosu",
  'landing.datenblatt.auftraege.fact': "Haftalık planlama · randevular · ilerleme",
  'landing.datenblatt.schaden.label': "Hasar kaydı",
  'landing.datenblatt.schaden.fact': "3D model · fotoğraf · imza",
  'landing.datenblatt.rechnung.label': "Faturalar",
  'landing.datenblatt.rechnung.fact': "GoBD §14 · XRechnung · ZUGFeRD",
  'landing.datenblatt.zahlung.label': "Ödemeler",
  'landing.datenblatt.zahlung.fact': "Vadeler · ihtarlar",
  'landing.datenblatt.kasse.label': "Kasa defteri",
  'landing.datenblatt.kasse.fact': "GoBD uyumlu · günlük",
  'landing.datenblatt.kalkulation.label': "Hesaplama",
  'landing.datenblatt.kalkulation.fact': "iş koluna göre · detailing / kaplama / PPF",
  'landing.datenblatt.datenschutz.label': "Veri koruma",
  'landing.datenblatt.datenschutz.fact': "GDPR · şifreli · işletmeye göre ayrı",
  'landing.datenblatt.sprachen.label': "Diller",
  'landing.datenblatt.sprachen.fact': "4 · DE / EN / RU / PL",
  'landing.datenblatt.zugriff.label': "Erişim",
  'landing.datenblatt.zugriff.fact': "Tarayıcı · tablet · akıllı telefon",

  // ---- Vertrauens-Leiste ---------------------------------------------------
  'landing.trust.dsgvo': "GDPR uyumlu",
  'landing.trust.gobd': "GoBD uyumlu faturalar",
  'landing.trust.madeInGermany': "Made in Germany",
  'landing.trust.encrypted': "Veriler şifreli",
  'landing.trust.noInstall': "Kurulum yok",

  // ---- Problem -------------------------------------------------------------
  'landing.problem.kicker': "Tanıdık mı?",
  'landing.problem.title': "İşletme yürüyor — idari işler frenliyor.",
  'landing.problem.sub': "Araç üzerindeki iş hassasiyet gerektirirken, geri kalan her şey evrak işine gömülüyor.",
  'landing.problem.p1': "Araç geçmişi klasörlere, kâğıtlara ve kafaya dağılmış durumda.",
  'landing.problem.p2': "Faturalar kesilmeden kalıyor — ve size peşin para kaybettiriyor.",
  'landing.problem.p3': "Kabuldeki hasarlar sonradan neredeyse kanıtlanamıyor.",
  'landing.problem.p4': "Birbiriyle konuşmayan beş farklı araç.",
  'landing.problem.summaryPre': "Detailly bunların hepsini ",
  'landing.problem.summaryEm': "tek bir",
  'landing.problem.summaryPost': " sistemde toplar — anlaşılır, hızlı, her cihazda.",

  // ---- Branchen-Switcher ---------------------------------------------------
  'landing.branchen.kicker': "İşiniz için yapıldı",
  'landing.branchen.title': "İşinizin dilini konuşan bir yazılım",
  'landing.branchen.sub': "Başlarken uzmanlığınızı seçersiniz — Detailly hizmet kataloğunu, hesaplamayı ve hatta görünümü buna göre ayarlar. Deneyin: iş kolunuzu seçin ve sayfanın nasıl renk değiştirdiğini izleyin.",
  'landing.branchen.selected': "Seçildi",
  'landing.branchen.cta': "{label} olarak başla",
  'landing.branchen.complete': "Her şey tek elden mi?",
  'landing.branchen.completeCta': "Tam hizmet sağlayıcı olarak başla",
  'landing.branchen.aufbereitung.l1': "İç & dış detailing",
  'landing.branchen.aufbereitung.l2': "Cila & seramik kaplama",
  'landing.branchen.aufbereitung.l3': "Leasing iade kontrolleri",
  'landing.branchen.folierung.l1': "Tam & kısmi kaplama",
  'landing.branchen.folierung.l2': "Renk değişimi & tasarım",
  'landing.branchen.folierung.l3': "Reklam yazıları",
  'landing.branchen.ppf.l1': "Ön & tam koruma",
  'landing.branchen.ppf.l2': "Taş çarpma koruma paketleri",
  'landing.branchen.ppf.l3': "Hassas kesimler",

  // ---- So funktioniert's ---------------------------------------------------
  'landing.ablauf.kicker': "İşte bu kadar kolay",
  'landing.ablauf.title': "Üç adımda düzenli bir akışa",
  'landing.ablauf.step1.title': "Kabul et",
  'landing.ablauf.step1.desc': "Müşteri, araç ve hasarlar dakikalar içinde kaydedilir — 3D işaretleme, fotoğraflar ve dijital imza ile.",
  'landing.ablauf.step2.title': "Yürüt",
  'landing.ablauf.step2.desc': "Hizmetleri hesaplayın, randevuları planlama panosunda planlayın, ilerlemeyi her an göz önünde tutun.",
  'landing.ablauf.step3.title': "Faturala",
  'landing.ablauf.step3.desc': "İş emrinden tek tıkla GoBD uyumlu fatura PDF olarak çıkar — vadeler ve ihtarlar dahil.",

  // ---- Funktionen ----------------------------------------------------------
  'landing.funktionen.kicker': "Tüm araçlar",
  'landing.funktionen.title': "İşletmenizin ihtiyacı olan her şey",
  'landing.funktionen.sub': "Kesintisiz bir akış — araç kabulünden ödenmiş faturaya kadar.",
  'landing.funktionen.kunden.title': "Müşteriler & araçlar",
  'landing.funktionen.kunden.desc': "Ana veriler, araç dosyası ve araç başına eksiksiz geçmiş — anında bulunabilir.",
  'landing.funktionen.auftraege.title': "İş emirleri & planlama panosu",
  'landing.funktionen.auftraege.desc': "Tekliften teslime. Randevularla haftalık planlama — hepsi göz önünde.",
  'landing.funktionen.rechnungen.title': "Faturalar & belgeler",
  'landing.funktionen.rechnungen.desc': "§14 & GoBD uyumlu faturalar ve teklifler PDF olarak, vadeler ve ihtarlar dahil.",
  'landing.funktionen.schaden3d.title': "3D hasar kaydı",
  'landing.funktionen.schaden3d.desc': "Hasarları doğrudan araç modeli üzerinde işaretleyin, fotoğraflarla belgeleyin ve dijital olarak imzalatın.",
  'landing.funktionen.kalkulation.title': "İş koluna göre hesaplama",
  'landing.funktionen.kalkulation.desc': "Detailing, kaplama ve PPF için hizmet katalogları ve fiyat mantığı — uzmanlığınıza uygun.",
  'landing.funktionen.dsgvo.title': "GDPR & güvenlik",
  'landing.funktionen.dsgvo.desc': "Hassas veriler şifreli, işletmeye göre kesin ayrılmış, tek tıkla veri dışa aktarma ve silme ile.",
  'landing.funktionen.footnotePre': "Ayrıca: yıldırım hızında global arama (",
  'landing.funktionen.footnotePost': "), mobil gezinme ve işletme başına birden fazla çalışan.",

  // ---- 3D-Schadenserfassung (Showcase) -------------------------------------
  'landing.schaden.kicker': "Öne çıkan özellik",
  'landing.schaden.title': "Hasarları anlaşmazlığa dönüşmeden kayıt altına alın",
  'landing.schaden.desc': "Kabulde çizikleri, göçükleri ve taş çarpmalarını doğrudan araç modeli üzerinde işaretlersiniz — fotoğraflar ve müşterinin dijital imzasıyla. Sonradan sorular gelirse, kanıtlar elinizde. Siyah beyaz.",
  'landing.schaden.point1': "Hasar noktalarını doğrudan 3D model üzerine koyun",
  'landing.schaden.point2': "Hasar başına fotoğraflar — otomatik olarak atanır",
  'landing.schaden.point3': "Kabulde ve teslimde dijital imza",
  'landing.schaden.cardHeader': "Araç kabulü · hasar kaydı",
  'landing.schaden.cardBadge': "2 hasar",
  'landing.schaden.cardPhotos': "4 fotoğraf belgelendi",
  'landing.schaden.cardSignature': "İmza alındı",

  // ---- Landing: 3D-Showcase (LandingCar3D) --------------------------------
  'landing.showcase.aria': "İşaretli hasar noktaları olan etkileşimli 3D araç modeli",
  'landing.showcase.pin1': "Taş çarpması · 2 fotoğraf",
  'landing.showcase.pin2': "Çizik · sol kapı",
  'landing.showcase.pin3': "Göçük · belgelendi",
  'landing.showcase.badgeOne': "{count} hasar",
  'landing.showcase.badgeMany': "{count} hasar",

  // ---- Wachstum ------------------------------------------------------------
  'landing.wachstum.kicker': "Ölçeklenebilir",
  'landing.wachstum.title': "Genel bakışla büyüme",
  'landing.wachstum.sub': "Düzenli olan ve rakamlarını bilen daha iyi kararlar verir — tek işletmeden zincire kadar.",
  'landing.wachstum.echtzeit.title': "Gerçek zamanlı genel bakış",
  'landing.wachstum.echtzeit.desc': "Ciro, açık iş emirleri ve randevular panoda canlı — nerede iyi gittiğini ve nerede takıldığını anında görürsünüz.",
  'landing.wachstum.standorte.title': "Birden fazla şube",
  'landing.wachstum.standorte.desc': "Şubeleri tek çatı altında yönetin — düzgün ayrılmış ama yine de merkezi. Büyüdükçe genişletilebilir.",
  'landing.wachstum.team.title': "Ekip, roller & yetkiler",
  'landing.wachstum.team.desc': "Çalışanları davet edin ve roller atayın — herkes tam olarak görmesi gerekeni görür. Düzgün şekilde izlenir ve belgelenir.",
  'landing.wachstum.chartVolume': "İş emri hacmi",
  'landing.wachstum.chartGrowing': "büyüyor",
  'landing.wachstum.chartLocations': "Şubeler",

  // ---- Zahlen (Count-up) ---------------------------------------------------
  'landing.zahlen.stat1.unit': "Dil",
  'landing.zahlen.stat1.label': "Almanca, İngilizce, Rusça ve Lehçe",
  'landing.zahlen.stat2.unit': "Gün",
  'landing.zahlen.stat2.label': "ücretsiz deneme — kredi kartı olmadan",
  'landing.zahlen.stat3.value': "GDPR + GoBD",
  'landing.zahlen.stat3.label': "uyumlu şekilde saklanır ve faturalanır",
  'landing.zahlen.stat4.value': "5 → 1",
  'landing.zahlen.stat4.label': "beş ayrı çözüm yerine tek bir sistem",

  // ---- Mitglieder (Social Proof, Opt-in) -----------------------------------
  'landing.mitglieder.kicker': "Sahadan",
  'landing.mitglieder.title': "Bu işletmeler Detailly ile çalışıyor",
  'landing.mitglieder.sub': "Detailly'i her gün kullanan ve burada adlarını anmamıza izin veren detailing uzmanları, kaplamacılar ve PPF stüdyoları.",

  // ---- Deutschlandkarte (Qualitätssiegel, nur zahlende Opt-in-Betriebe) -----
  'landing.karte.kicker': "Ülke genelinde",
  'landing.karte.title': "Almanya'nın her yerinde Detailly işletmeleri",
  'landing.karte.sub': "Doğrulanmış, aktif üye işletmeler – haritada kabaca bölgeye göre. Bölgenin işletmelerini görmek için bir noktaya dokunun.",
  'landing.karte.pin.aria': "{region} posta kodu bölgesinde {anzahl} işletme",
  'landing.karte.pin.aria.one': "{region} posta kodu bölgesinde bir işletme",
  'landing.karte.pop.aria': "{region} posta kodu bölgesindeki işletmeler",
  'landing.karte.pop.region': "Posta kodu bölgesi {region}",
  'landing.karte.pop.website': "Web sitesi",
  'landing.karte.legende': "{regionen} bölgede {betriebe} aktif işletme",

  // ---- Canlı işletme haritası (gerçek veriler) -----------------------------
  'landing.betriebskarte.kicker': "Almanya genelinde",
  'landing.betriebskarte.title': "Haritada Detailly işletmeleri",
  'landing.betriebskarte.sub': "Gerçek, aktif işletmeler – kabaca bölgeye göre. Bölgedeki işletmeleri görmek için bir noktaya dokunun. Posta bölgesinden daha kesin bir konum yok.",
  'landing.betriebskarte.zaehler': "işletme Almanya genelinde",
  'landing.betriebskarte.zaehlerEiner': "işletme Almanya genelinde",
  'landing.betriebskarte.laedt': "Harita yükleniyor …",
  'landing.betriebskarte.leer': "Yakında sizin bölgenizde de.",
  'landing.betriebskarte.legende': "{regionen} bölgede görünür",
  'landing.betriebskarte.pinAria': "{region} posta bölgesinde {anzahl} işletme",
  'landing.betriebskarte.pinAria.one': "{region} posta bölgesinde {name}",
  'landing.betriebskarte.pop.aria': "{region} posta bölgesindeki işletmeler",
  'landing.betriebskarte.pop.region': "Posta bölgesi {region}",

  // ---- Warum Detailly ------------------------------------------------------
  'landing.warum.kicker': "Neden Detailly",
  'landing.warum.title': "Atölye için yazılım — galeri için değil.",
  'landing.warum.body': "Detailing uzmanları, kaplamacılar ve PPF stüdyoları hassas işler yapar ve aynı özenle çalışan bir yazılımı hak eder. Çoğu atölye programı büyük galeriler için yapılmıştır: aşırı yüklü, karmaşık ve pahalı. Detailly bilinçli olarak farklıdır — sade, sizin süreçlerinize göre uyarlanmış ve dakikalar içinde hazır. Almanya'da bağımsız olarak geliştirildi, temelinden veri korumasıyla.",

  // ---- News-Teaser ---------------------------------------------------------
  'landing.news.kicker': "Detailly Haberler",
  'landing.news.title': "Şu anda neler oluyor",
  'landing.news.sub': "Detailly ile ilgili ürün güncellemeleri ve haberler. (Örnek girişler — yakında gerçek duyurularla.)",
  'landing.news.all': "Tüm haberleri gör",

  // ---- FAQ -----------------------------------------------------------------
  'landing.faq.kicker': "Sık sorulan sorular",
  'landing.faq.title': "Başlamadan önce bilmek istedikleriniz",
  'landing.faq.q1.q': "Teknik bilgiye veya kuruluma ihtiyacım var mı?",
  'landing.faq.q1.a': "Hayır. İşletmenizi kaydeder ve doğrudan tarayıcıda başlarsınız — bilgisayarda, tablette veya akıllı telefonda. Kurulacak veya ayarlanacak hiçbir şey yok.",
  'landing.faq.q2.q': "Hem detailing HEM kaplama yapıyorum — hangisini seçmeliyim?",
  'landing.faq.q2.a': "O zaman tam hizmet sağlayıcısınız: kayıt sırasında sadece «Tam hizmet sağlayıcı»yı seçin ve tüm hizmet kataloglarını ve hesaplamaları birlikte alın.",
  'landing.faq.q3.q': "Müşteri verilerim ne kadar güvende?",
  'landing.faq.q3.a': "Hassas veriler şifreli olarak saklanır ve diğer işletmelerden kesin şekilde ayrılır. Müşteri verilerini istediğiniz zaman dışa aktarabilir veya silebilirsiniz — tamamen GDPR uyumlu.",
  'landing.faq.q4.q': "14 günün ardından ne olur?",
  'landing.faq.q4.a': "Kredi kartı olmadan ve risksiz denersiniz. Deneme süresinden sonra işletmenize uygun tarifeyi seçersiniz. Deneme süresi biterse hiçbir masrafınız olmaz.",
  'landing.faq.q5.q': "Atölyedeki tablette de çalışır mı?",
  'landing.faq.q5.a': "Evet. Detailly her cihaz için yapıldı — ofis bilgisayarından araç kabulündeki tablete kadar. Kullanım otomatik olarak uyum sağlar.",
  'landing.faq.q6.q': "Verilerimi tekrar yanımda götürebilir miyim?",
  'landing.faq.q6.a': "İstediğiniz zaman. Verileriniz size aittir — dışa aktarma tek tıkla mümkündür, kimseye sormanıza gerek yok.",

  // ---- Abschluss-CTA -------------------------------------------------------
  'landing.cta.title': "İşletmenize düzen getirin — bugünden itibaren.",
  'landing.cta.sub': "İşletmenizi birkaç dakikada kaydedin ve Detailly'i 14 gün ücretsiz deneyin. Kredi kartı olmadan, risksiz.",
  'landing.cta.primary': "Şimdi ücretsiz başla",
  'landing.cta.secondary': "Zaten bir hesabım var",

  // ---- Footer --------------------------------------------------------------
  'landing.footer.tagline': "Detailing, kaplama ve PPF için atölye yazılımı. Almanya'da bağımsız olarak geliştirildi.",
  'landing.footer.discover': "Keşfet",
  'landing.footer.product': "Ürün",
  'landing.footer.account': "Hesap & yasal",
  'landing.footer.news': "Haberler",
  'landing.footer.changelog': "Yenilikler",
  'landing.footer.masterclass': "Masterclass",
  'landing.footer.gruendung': "Şirket kuruluşu",
  'landing.footer.grosshaendler': "Toptancılar için",
  'landing.footer.features': "Özellikler",
  'landing.footer.branchen': "İşiniz için",
  'landing.footer.faq': "Sık sorulan sorular",
  'landing.footer.trial': "Ücretsiz dene",
  'landing.footer.login': "Oturum aç",
  'landing.footer.register': "Kayıt ol",
  'landing.footer.impressum': "Künye",
  'landing.footer.datenschutz': "Veri koruma",
  'landing.footer.copyright': "© {year} Detailly · Tüm hakları saklıdır",

  // ---- Kundenformular ------------------------------------------------------
  'kunden.form.leitwegId.label': "Leitweg-ID",
  'kunden.form.leitwegId.help': "Yalnızca kamu kurumlarına/kamu ihale makamlarına kesilen faturalar için (B2G yönlendirmesini kontrol eder).",
  'kunden.form.editTitle': "Müşteriyi düzenle",
  'kunden.form.saving': "Kaydediliyor…",
  'kunden.form.company': "Firma",
  'kunden.form.firstName': "Ad",
  'kunden.form.lastName': "Soyad",
  'kunden.form.street': "Cadde",
  'kunden.form.postalCode': "Posta kodu",
  'kunden.form.noNameHelp': "Ad kaydedilmemiş – örn. GDPR anonimleştirmesinden sonra.",
  'kunden.form.gdprSection': "Veri koruma (GDPR)",
  'kunden.form.exportJson': "Verileri dışa aktar (JSON)",
  'kunden.form.anonymizeBtn': "Verileri sil / anonimleştir",
  'kunden.form.gdprNote': "Faturalar yasal nedenlerle (GoBD) saklanır, ancak kişisel bağ olmadan.",
  'kunden.form.anonymize.title': "Müşteri verileri kalıcı olarak silinsin mi?",
  'kunden.form.anonymize.msgPre': "Kişisel veriler kaldırılır veya anonimleştirilir. Faturalar yasal nedenlerle (GoBD, 10 yıl) saklanır, ancak kişisel bağ olmadan. Bu işlem ",
  'kunden.form.anonymize.msgEmph': "geri alınamaz",
  'kunden.form.anonymize.msgPost': ".",
  'kunden.form.anonymize.confirm': "Kalıcı olarak sil",
  'kunden.form.error.save': "Kaydetme başarısız",
  'kunden.form.error.export': "Dışa aktarma başarısız",
  'kunden.form.error.anonymize': "Silme başarısız",
  'kunden.form.gdpr.checking': "Belgeler kontrol ediliyor…",
  'kunden.form.gdpr.willAnonymize': "Saklama yükümlülüğü olan {count} belge var. Bu nedenle müşteri anonimleştirilir – belgeler yasal nedenlerle (GoBD/§147 AO) saklanır, ancak kişisel bağ olmadan. Bu işlem ",
  'kunden.form.gdpr.willDelete': "Saklama yükümlülüğü olan belge yok. Müşteri, tüm araçları, randevuları, fotoğrafları ve taslaklarıyla birlikte tamamen silinir. Bu işlem ",
  'kunden.form.gdpr.irreversible': "geri alınamaz.",
  'kunden.form.gdpr.confirmDelete': "Kalıcı olarak sil",

  // ===========================================================================
  // KUNDEN (Route "/kunden")
  // ===========================================================================
  'kunden.title': "Müşteriler",
  'kunden.subtitle': "Bireysel ve kurumsal müşteriler",
  'kunden.csvImport': "CSV içe aktarma",
  'kunden.new': "Yeni müşteri",
  'kunden.searchPlaceholder': "Ad, e-posta, telefon ile ara…",

  // ---- Leerzustand ---------------------------------------------------------
  'kunden.empty.none': "Henüz müşteri oluşturulmadı.",
  'kunden.empty.filtered': "Müşteri bulunamadı.",
  'kunden.empty.cta': "İlk müşteriyi oluştur",

  // ---- Tabellenspalten -----------------------------------------------------
  'kunden.col.name': "Ad",
  'kunden.col.typ': "Tür",
  'kunden.col.email': "E-posta",
  'kunden.col.telefon': "Telefon",
  'kunden.col.ort': "Şehir",

  // ---- Kundentyp -----------------------------------------------------------
  'kunden.type.business': "Kurumsal",
  'kunden.type.private': "Bireysel",

  // ---- Aktionsmenü ---------------------------------------------------------
  'kunden.actionsFor': "{name} için işlemler",
  'kunden.action.open': "Aç",
  'kunden.action.newOrder': "Yeni iş emri",
  'kunden.action.edit': "Düzenle",

  // ---- Toast / Fehler / Löschen-Bestätigung --------------------------------
  'kunden.toast.deleted': "{name} silindi",
  'kunden.error.delete': "Silme başarısız",
  'kunden.delete.title': "Müşteriyi sil",
  'kunden.delete.msg': "{name} gerçekten silinsin mi? Müşteri devre dışı bırakılır ve listeden kaldırılır. Halihazırda kaydedilmiş iş emirleri ve faturalar korunur.",

  // ---- Kundenakte (Route "/kunden/detail") ---------------------------------
  'kunden.detail.businessCustomer': "Kurumsal müşteri",
  'kunden.detail.privateCustomer': "Bireysel müşteri",
  'kunden.detail.addVehicle': "Araç ekle",
  'kunden.detail.contact': "İletişim",
  'kunden.detail.address': "Adres",
  'kunden.detail.vatNumber': "USt-IdNr.",
  'kunden.detail.stat.vehicles': "Araçlar",
  'kunden.detail.stat.openOrders': "Açık iş emirleri",
  'kunden.detail.stat.openInvoices': "Açık faturalar",
  'kunden.detail.stat.paidTotal': "Toplam ödenen",
  'kunden.detail.pieces': "{n} adet",
  'kunden.detail.vehicles': "Araçlar",
  'kunden.detail.vehicleCountOne': "{n} araç",
  'kunden.detail.vehicleCountMany': "{n} araç",
  'kunden.detail.emptyVehicles': "Kayıtlı araç yok.",
  'kunden.detail.openFile': "Dosya",
  'kunden.detail.appointments': "Randevular",
  'kunden.detail.newestFirst': "Önce en yeniler",
  'kunden.detail.emptyAppts': "Randevu yok.",
  'kunden.detail.orders': "İş emirleri",
  'kunden.detail.totalCount': "toplam {n}",
  'kunden.detail.emptyOrders': "Henüz iş emri yok.",
  'kunden.detail.invoices': "Faturalar & teklifler",
  'kunden.detail.emptyInvoices': "Henüz belge yok.",
  'kunden.detail.pdf': "PDF",
  'kunden.detail.error.load': "Müşteri yüklenemedi",
  'kunden.detail.error.pdf': "PDF yüklenemedi",

  // ===========================================================================
  // FAHRZEUGE (Route "/fahrzeuge")
  // ===========================================================================
  'fahrzeuge.title': "Araçlar",
  'fahrzeuge.subtitle': "Araç dosyalı araç envanteri",
  'fahrzeuge.new': "Yeni araç",
  'fahrzeuge.searchPlaceholder': "Plaka, marka, model veya sahip ile ara…",

  // ---- Leerzustand ---------------------------------------------------------
  'fahrzeuge.empty.none': "Henüz araç oluşturulmadı.",
  'fahrzeuge.empty.filtered': "Araç bulunamadı.",
  'fahrzeuge.empty.cta': "İlk aracı oluştur",

  // ---- Tabellenspalten -----------------------------------------------------
  'fahrzeuge.col.fahrzeug': "Araç",
  'fahrzeuge.col.kennzeichen': "Plaka",
  'fahrzeuge.col.halter': "Sahibi",
  'fahrzeuge.col.baujahr': "Model yılı",

  // ---- Aktionsmenü ---------------------------------------------------------
  'fahrzeuge.actionsFor': "{name} için işlemler",
  'fahrzeuge.action.open': "Araç dosyasını aç",
  'fahrzeuge.action.newOrder': "Yeni iş emri",

  // ---- Formular (Neues Fahrzeug) -------------------------------------------
  'fahrzeuge.form.halter': "Sahibi",
  'fahrzeuge.form.selectPlaceholder': "– seçin –",
  'fahrzeuge.form.marke': "Marka",
  'fahrzeuge.form.modell': "Model",
  'fahrzeuge.form.variante': "Varyant",
  'fahrzeuge.form.baujahr': "Model yılı",
  'fahrzeuge.form.farbe': "Renk",
  'fahrzeuge.form.kennzeichen': "Plaka",
  'fahrzeuge.form.kraftstoff': "Yakıt",
  'fahrzeuge.form.flaeche': "Alan (m²)",

  // ---- Kraftstoffarten -----------------------------------------------------
  'fahrzeuge.fuel.petrol': "Benzin",
  'fahrzeuge.fuel.diesel': "Dizel",
  'fahrzeuge.fuel.electric': "Elektrik",
  'fahrzeuge.fuel.hybrid': "Hibrit",
  'fahrzeuge.saving': "Kaydediliyor…",

  // ---- Toast / Fehler / Löschen-Bestätigung --------------------------------
  'fahrzeuge.toast.deleted': "{name} silindi",
  'fahrzeuge.error.delete': "Silme başarısız",
  'fahrzeuge.error.save': "Kaydetme başarısız",
  'fahrzeuge.delete.title': "Aracı sil",
  'fahrzeuge.delete.msg': "{name} gerçekten silinsin mi? Araç listeden kaldırılır. Halihazırda kaydedilmiş iş emirleri ve randevular korunur.",

  // ---- Fahrzeugakte (Route "/fahrzeuge/detail") ----------------------------
  'fahrzeuge.detail.subtitle': "Araç dosyası",
  'fahrzeuge.detail.masterData': "Ana veriler",
  'fahrzeuge.detail.makeModel': "Marka / model",
  'fahrzeuge.detail.area': "Alan",
  'fahrzeuge.detail.sqm': "{n} m²",
  'fahrzeuge.detail.toOwner': "Sahibine git",
  'fahrzeuge.detail.orderHistory': "İş emri geçmişi",
  'fahrzeuge.detail.emptyOrders': "Bu araç için henüz iş emri yok.",

  // ===========================================================================
  // BELEGE / RECHNUNGEN (Route "/rechnungen")
  // ===========================================================================
  'rechnungen.title': "Belgeler",
  'rechnungen.subtitle': "Teklifler ve faturalar",
  'rechnungen.searchPlaceholder': "Numara veya müşteri ile ara…",
  'rechnungen.tab.alle': "Tümü",

  // ---- Leerzustände --------------------------------------------------------
  'rechnungen.empty.none': "Henüz belge yok. Belgeler iş emirlerinden oluşur.",
  'rechnungen.empty.filtered': "Bu görünümde belge yok.",

  // ---- Tabellenspalten -----------------------------------------------------
  'rechnungen.col.nummer': "Numara",
  'rechnungen.col.art': "Tür",
  'rechnungen.col.kunde': "Müşteri",
  'rechnungen.col.datum': "Tarih",
  'rechnungen.col.status': "Durum",
  'rechnungen.col.brutto': "Brüt",

  // ---- Art / Status --------------------------------------------------------
  'rechnungen.kind.angebot': "Teklif",
  'rechnungen.kind.rechnung': "Fatura",
  'rechnungen.status.entwurf': "Taslak",
  'rechnungen.status.offen': "Açık",
  'rechnungen.status.bezahlt': "Ödendi",
  'rechnungen.status.storniert': "İptal edildi",

  // ---- Fälligkeit / Versand-Badges -----------------------------------------
  'rechnungen.overdue': "{tage} gündür gecikmiş",
  'rechnungen.dueIn': "{tage} gün içinde vadesi geliyor",
  'rechnungen.sent': "Gönderildi",
  'rechnungen.sentOn': "{datum} tarihinde gönderildi",

  // ---- Mahnstufen ----------------------------------------------------------
  'rechnungen.mahn.stufe1': "Ödeme hatırlatması",
  'rechnungen.mahn.stufe2': "1. ihtar",
  'rechnungen.mahn.stufe3': "2. ihtar",
  'rechnungen.mahn.generic': "İhtar kademesi {stufe}",

  // ---- Zeilen-Aktionen -----------------------------------------------------
  'rechnungen.action.pdf': "PDF indir",
  'rechnungen.action.xrechnung': "XRechnung (XML)",
  'rechnungen.action.send': "E-posta ile gönder",
  'rechnungen.action.resend': "E-posta ile yeniden gönder",
  'rechnungen.action.markPaid': "Ödendi olarak işaretle",
  'rechnungen.action.copyLink': "İndirme bağlantısını kopyala",
  'rechnungen.action.mahnen': "İhtar gönder",
  'rechnungen.action.storno': "İptal et",
  'rechnungen.action.setStatus': "«{status}» olarak ayarla",
  'rechnungen.actionsFor': "{nummer} için işlemler",
  'rechnungen.linkPrompt': "İndirme bağlantısını kopyala:",

  // ---- Storno-Bestätigung --------------------------------------------------
  'rechnungen.storno.title': "Belgeyi iptal et",
  'rechnungen.storno.msg': "{nummer} belgesi gerçekten iptal edilsin mi? İptal edilen bir belge yeniden etkinleştirilemez.",
  'rechnungen.storno.msgPaid': "Ödenmiş {nummer} faturası gerçekten iptal edilsin mi? İptal geri alınamaz — gerekirse bir alacak dekontu veya iade ayrıca ele alınmalıdır.",

  // ---- Toast-Meldungen -----------------------------------------------------
  'rechnungen.toast.statusUpdated': "Durum güncellendi",
  'rechnungen.toast.storniert': "Belge iptal edildi",
  'rechnungen.toast.paid': "Ödendi olarak işaretlendi",
  'rechnungen.toast.sent': "Belge e-posta ile gönderildi",
  'rechnungen.toast.linkCopied': "İndirme bağlantısı kopyalandı",
  'rechnungen.toast.mahnSent': "İhtar gönderildi",

  // ---- Fehlermeldungen -----------------------------------------------------
  'rechnungen.error.statusChange': "Durum değişikliği başarısız",
  'rechnungen.error.pdf': "PDF yüklenemedi",
  'rechnungen.error.xrechnung': "XRechnung oluşturulamadı",
  'rechnungen.error.paid': "Ödendi olarak işaretlenemedi",
  'rechnungen.error.send': "E-posta gönderimi başarısız",
  'rechnungen.error.link': "Bağlantı oluşturulamadı",
  'rechnungen.error.mahn': "İhtar başarısız",

  // ===========================================================================
  // AUFTRÄGE (Route "/auftraege")
  // ===========================================================================
  'auftraege.title': "İş emirleri",

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
