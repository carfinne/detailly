// ===========================================================================
// ES – WÖRTERBUCH (Partial<Dict>) · Español
// ---------------------------------------------------------------------------
// MT-gestützte Erstübersetzung — professionelle Prüfung vor breitem Rollout empfohlen.
// Enthält die UI-Keys aus de.ts, nach Español übersetzt. Bleibt technisch
// `Partial<Dict>`: fehlende/neue Keys fallen automatisch auf DE zurück
// (siehe ../provider, t() → de[key]) — nie ein leerer String oder der rohe Key.
// Juristische Volltexte (AGB, AVV, Datenschutz, Widerrufsbelehrung, Impressum)
// liegen NICHT in diesem Wörterbuch, sondern in den jeweiligen Seiten-Komponenten
// und bleiben bewusst auf Deutsch.
//
// Platzhalter wie {name}/{year} bleiben unverändert (werden zur Laufzeit ersetzt).
// ===========================================================================

import type { Dict } from './de';

export const es: Partial<Dict> = {
  // Fahrzeugtyp (3D-Karosserie-Auswahl)
  'fahrzeugtyp.label': "Tipo de vehículo",
  'fahrzeugtyp.hint': "Elige la forma de carrocería para el modelo 3D",
  'fahrzeugtyp.limousine': "Sedán",
  'fahrzeugtyp.kombi': "Familiar",
  'fahrzeugtyp.suv': "SUV/todoterreno",
  'fahrzeugtyp.coupe': "Cupé",
  'fahrzeugtyp.kompakt': "Compacto/utilitario",
  'fahrzeugtyp.transporter': "Furgoneta/Van",
  'fahrzeugtyp.pickup': "Pickup",
  'fahrzeugtyp.error.save': "No se ha podido guardar el tipo de vehículo.",
  // ---- Gemeinsame UI-Texte -------------------------------------------------
  'common.save': "Guardar",
  'common.cancel': "Cancelar",
  'common.confirm': "Confirmar",
  'common.delete': "Eliminar",
  'common.close': "Cerrar",
  'common.back': "Atrás",
  'common.loading': "Cargando",
  'common.loadingEllipsis': "Cargando…",
  'common.loadingBrand': "Cargando Detailly…",
  'common.error': "Error",
  'common.toStart': "A la página de inicio",
  // ---- Fehler-/Leerzustaende (App-Router error/not-found Boundaries) --------
  'errorBoundary.title': "Algo salió mal",
  'errorBoundary.desc': "Se ha producido un error inesperado. Puedes volver a intentarlo o recargar la página.",
  'errorBoundary.retry': "Reintentar",
  'errorBoundary.reload': "Recargar la página",
  'errorBoundary.reference': "Referencia",
  'notFound.title': "Página no encontrada",
  'notFound.desc': "Esta página no existe o ha sido movida. Comprueba la dirección o vuelve a la página de inicio.",
  'notFound.dashboard': "Al panel",
  // ---- 2FA-Erzwingung (serverseitige Pflicht) ------------------------------
  'mfa.gate.title': "Se requiere autenticación de dos factores",
  'mfa.gate.desc': "La autenticación de dos factores es obligatoria para tu cuenta. Configúrala ahora para seguir usando Detailly.",
  'mfa.gate.logout': "Cerrar sesión",
  'common.toSubscription': "A suscripción y plan",

  // ---- Sprachumschalter ----------------------------------------------------
  'switcher.label': "Elegir idioma",
  'switcher.current': "Idioma actual",

  // ---- Navigation: Gruppen -------------------------------------------------
  'nav.group.overview': "Resumen",
  'nav.group.operations': "Operación",
  'nav.group.intake': "Recepción y cálculo",
  'nav.group.masterdata': "Datos maestros",
  'nav.group.finance': "Finanzas",
  'nav.group.material': "Material",
  'nav.group.organization': "Organización",
  'nav.group.platform': "Plataforma",

  // ---- Navigation: Einträge ------------------------------------------------
  'nav.item.dashboard': "Panel",
  'nav.item.achievements': "Logros",
  'nav.item.orders': "Órdenes",
  'nav.item.calculation': "Cálculo",
  'nav.item.intakeQuick': "Recepción (rápida)",
  'nav.item.intake3d': "Recepción y peritaje (3D)",
  'nav.item.dellenkalkulation': "Cálculo de abolladuras (PDR)",
  'nav.item.schichtdicke': "Medir espesor de capa",
  'nav.item.planboard': "Tablero de planificación",
  'nav.item.requests': "Solicitudes",
  'nav.item.customers': "Clientes",
  'nav.item.vehicles': "Vehículos",
  'nav.item.services': "Servicios",
  'nav.item.invoices': "Facturas",
  'nav.item.incomingInvoices': "Recepción de e-facturas",
  'nav.item.cashbook': "Libro de caja",
  'nav.item.reminders': "Recordatorios de pago",
  'nav.item.reports': "Informes",
  'nav.item.accounting': "Contabilidad",
  'nav.item.shop': "Material y almacén",
  'nav.item.marketplace': "Mercado",
  'nav.item.locations': "Sedes",
  'nav.item.staff': "Personal",
  'nav.item.time': "Control horario",
  'nav.item.showcase': "Escaparate",
  'nav.item.audit': "Registro de auditoría",
  'nav.item.settings': "Configuración",
  'nav.item.help': "Ayuda y soporte",
  'nav.item.assistant': "Asistente de soporte",
  'nav.item.subscription': "Suscripción y plan",
  'nav.item.cockpit': "Cockpit",
  'nav.item.platformAnalytics': "Analíticas de plataforma",
  'nav.item.platformMarketplace': "Mantenimiento del mercado",
  'nav.item.platformGeraetemarkt': "Moderación del mercado de ocasión",
  'nav.item.platformSupport': "Solicitudes de soporte",
  'nav.item.platformSecurity': "Seguridad",
  'nav.item.platformNewsletter': "Boletín",
  'nav.item.subscriptions': "Suscripciones",

  // ---- Einstellungen: Kalkulation (€/qm) -----------------------------------
  'settings.kalk.title': "Cálculo · €/m²",
  'settings.kalk.subtitle': "Tarifas base para el cálculo instantáneo 3D. En el cálculo, cada valor sigue siendo modificable.",
  'settings.kalk.grouplabel': "Precio por metro cuadrado (neto)",
  'settings.kalk.folierung': "Vinilado",
  'settings.kalk.ppf': "PPF / protección de pintura",
  'settings.kalk.aufbereitung': "Detallado",
  'settings.kalk.help': "Estas tarifas son el valor predeterminado en el módulo 3D (superficie × tamaño del vehículo × €/m²). Vacío o 0 = valor estándar interno.",
  'settings.kalender.umsatzZielTitle': "Objetivo de facturación semanal",
  'settings.kalender.umsatzZielSubtitle': "Valor objetivo para la capa de facturación del tablero de planificación, visible solo para propietarios y gerentes.",
  'settings.kalender.umsatzZielLabel': "Objetivo por semana (€ bruto)",
  'settings.kalender.umsatzZielHelp': "Dejar vacío = sin objetivo. La barra de progreso aparece en la cabecera semanal del tablero.",

  // ---- Einstellungen: Kalender & Online-Buchung (Kalender 2.0 W2) ----------
  'settings.kalender.title': "Calendario y reserva online",
  'settings.kalender.subtitle': "Horarios de trabajo por día de la semana, rejilla de franjas y antelación para el portal de reservas público.",
  'settings.kalender.von': "desde",
  'settings.kalender.bis': "hasta",
  'settings.kalender.slotDauer': "Duración de la franja (minutos)",
  'settings.kalender.puffer': "Margen entre citas (minutos)",
  'settings.kalender.vorlaufMin': "Antelación mínima (horas)",
  'settings.kalender.vorlaufMax': "Antelación máxima (días)",
  'settings.kalender.hint': "Con horarios de trabajo bien definidos, tu portal de reservas muestra las citas libres: los clientes eligen entre las franjas disponibles en lugar de escribir una fecha deseada.",
  'settings.error.kalenderZeiten': "Revisa los horarios: «hasta» debe ser posterior a «desde» en los días activos.",
  'settings.error.kalenderWerte': "Revisa los valores del calendario: franja 5–480 min, margen 0–240 min, antelación 0–720 h o 1–365 días.",

  // ---- Buchungsseite: rechtlicher Abschluss-Modus (§312j BGB) ---------------
  'settings.buchung.modusTitle': "Cierre de la página de reservas",
  'settings.buchung.modusSubtitle': "Define si tu página de reservas pública es una solicitud sin compromiso o una reserva vinculante y de pago.",
  'settings.buchung.modusLabel': "Modo",
  'settings.buchung.modusAnfrage': "Solicitud de cita sin compromiso",
  'settings.buchung.modusVerbindlich': "Reserva vinculante y de pago",
  'settings.buchung.modusHelp': "Solicitud: los clientes envían una solicitud sin compromiso; aún no se formaliza ningún contrato y tú confirmas la cita. Vinculante: se celebra online un contrato de pago (botón «Reservar con pago», derecho de desistimiento).",
  'settings.buchung.modusVerbindlichHint': "En el modo vinculante, los clientes celebran contigo online un contrato de venta a distancia de pago. Revisa cuidadosamente los precios, el aviso legal y la información sobre el derecho de desistimiento: la responsabilidad es tuya.",
  'settings.buchung.impressumIncomplete': "Página de reservas incompleta: faltan datos del aviso legal. Los clientes solo ven parcialmente al proveedor (parte contratante). Complétalos en la sección de aviso legal más abajo.",

  // ---- Öffentliche Buchungsseite: Verbraucherrecht (UI-Chrome) --------------
  // Die eigentlichen Rechtstexte (Widerrufsbelehrung/-formular) bleiben DEUTSCH
  // und werden NICHT übersetzt – hier nur die Bedien-Elemente.
  'buchen.recht.badge.anfrage': "Solicitud de cita online",
  'buchen.recht.badge.verbindlich': "Reserva online",
  'buchen.recht.anbieter.title': "Proveedor",
  'buchen.recht.anbieter.hint': "La parte contratante es el taller indicado arriba, no Detailly.",
  'buchen.recht.pflichtinfo.title': "Resumen de tu reserva",
  'buchen.recht.pflichtinfo.leistung': "Servicio",
  'buchen.recht.pflichtinfo.keineLeistung': "No se ha seleccionado ningún servicio",
  'buchen.recht.pflichtinfo.preis': "Precio",
  'buchen.recht.pflichtinfo.termin': "Cita",
  'buchen.recht.pflichtinfo.keinTermin': "No se ha seleccionado ninguna cita",
  'buchen.recht.pflichtinfo.checkbox': "He leído la información obligatoria y la información sobre el derecho de desistimiento.",
  'buchen.recht.pflichtinfo.checkboxError': "Confirma la información obligatoria y la información sobre el derecho de desistimiento.",
  'buchen.recht.widerruf.title': "Derecho de desistimiento",
  'buchen.recht.widerruf.deHint': "El texto legal oficial solo está disponible en alemán.",
  'buchen.recht.widerruf.belehrungLabel': "Mostrar la información sobre el derecho de desistimiento",
  'buchen.recht.widerruf.formularLabel': "Mostrar el modelo de formulario de desistimiento",
  'buchen.recht.vorzeitig.checkbox': "Solicito expresamente que el taller comience la ejecución antes de que finalice el plazo de desistimiento de 14 días. Soy consciente de que, con el cumplimiento íntegro del contrato, pierdo mi derecho de desistimiento.",
  'buchen.recht.vorzeitig.error': "Acepta el inicio anticipado del servicio o elige una cita posterior.",
  'buchen.recht.datenschutz.hintAnfrage': "El taller trata tus datos para gestionar tu solicitud de cita. El responsable es el proveedor indicado arriba.",
  'buchen.recht.datenschutz.hintVerbindlich': "El taller trata tus datos para la ejecución del contrato. El responsable es el proveedor indicado arriba.",
  'buchen.recht.datenschutz.link': "Información sobre protección de datos",
  'buchen.recht.datenschutz.checkbox': "He tomado conocimiento de la información sobre protección de datos.",
  'buchen.recht.verbindlich.emailRequired': "Para una reserva vinculante y de pago necesitamos tu dirección de correo electrónico: allí enviaremos la confirmación de la reserva y la información sobre el derecho de desistimiento.",
  'buchen.recht.verbindlich.leistungRequired': "Para una reserva vinculante, selecciona un servicio.",
  'buchen.recht.anfrage.hinweis': "Aún no se formaliza ningún contrato; el taller confirmará tu cita.",
  'buchen.recht.anfrage.button': "Solicitar sin compromiso",
  'buchen.recht.anfrage.submitting': "Enviando…",
  'buchen.recht.verbindlich.intro': "Al hacer clic, celebras un contrato de pago con el taller.",
  'buchen.recht.verbindlich.button': "Reservar con pago",
  'buchen.recht.verbindlich.submitting': "Procesando la reserva…",
  'buchen.recht.success.anfrage.title': "Solicitud enviada",
  'buchen.recht.success.anfrage.text': "¡Gracias! {betrieb} se pondrá en contacto contigo para confirmar la cita.",
  'buchen.recht.success.verbindlich.title': "Reserva confirmada",
  'buchen.recht.success.verbindlich.text': "Gracias por tu reserva de pago en {betrieb}. Recibirás por correo electrónico la confirmación con la información sobre el derecho de desistimiento.",
  'buchen.recht.success.reference': "Tu referencia:",

  // ---- Tarif-Hinweise (Feature-Gating) -------------------------------------
  'settings.sevdesk.upgrade': "La transferencia automática a sevDesk está disponible a partir del plan Basic.",
  'ordertime.upgrade': "Los tiempos de trabajo y los costes de mano de obra están incluidos en el plan Pro.",

  // ---- Einstellungen: Seite ------------------------------------------------
  'settings.title': "Configuración",
  'settings.subtitle': "Apariencia, perfil y —como propietario— los datos del taller.",
  'settings.tab.appearance': "Apariencia",
  'settings.tab.profile': "Perfil",
  'settings.tab.business': "Taller",
  'settings.tab.customerComm': "Comunicación con clientes",
  'settings.tab.goals': "Objetivos y recordatorios",
  'settings.tab.audit': "Registro de auditoría",
  'settings.saving': "Guardando…",
  'settings.toast.saved': "Guardado",

  // Einstellungen: Betrieb – Sekundaer-Navigation (Unterbereiche, je eigener Speichern-Button)
  'settings.bereich.navLabel': "Áreas de la configuración del taller",
  'settings.bereich.stammdaten': "Datos maestros y marca",
  'settings.bereich.steuer': "Impuestos y aviso legal",
  'settings.bereich.rechnung': "Banco y facturación",
  'settings.bereich.kalender': "Cálculo y calendario",
  'settings.bereich.email': "Envío de correos",
  'settings.bereich.mahnwesen': "Gestión de reclamaciones",
  'settings.bereich.buchhaltung': "DATEV y sevDesk",
  'settings.bereich.sicherheit': "Seguridad",

  // Einstellungen: Status-Mail-Vorlagen (editierbar, je Status Betreff + Text)
  'settings.statusmail.title': "Plantillas de correos de estado",
  'settings.statusmail.subtitle': "Adapta el asunto y el texto de los correos de estado automáticos a tus clientes.",
  'settings.statusmail.reviewNote': "El desencadenante de envío no cambia: los correos de estado solo se envían si el interruptor de estado (comunicación con clientes) está activado. Aquí solo adaptas el texto.",
  'settings.statusmail.placeholders': "Marcadores disponibles:",
  'settings.statusmail.status.bestaetigt': "Orden confirmada",
  'settings.statusmail.status.in_arbeit': "Orden en curso",
  'settings.statusmail.status.abholbereit': "Vehículo listo para recoger",
  'settings.statusmail.reset': "Restablecer valores predeterminados",
  'settings.statusmail.subject': "Asunto",
  'settings.statusmail.subjectPlaceholder': "Dejar vacío para el asunto estándar",
  'settings.statusmail.body': "Texto",
  'settings.statusmail.bodyPlaceholder': "Dejar vacío para el texto estándar",
  'settings.statusmail.defaultHint': "Vacío = se usa el texto estándar probado.",
  'settings.statusmail.footerHint': "El saludo, el enlace al estado del pedido y la despedida se añaden automáticamente; tu texto va en medio.",

  // Einstellungen: Benachrichtigungs-Präferenzen je Nutzer (Glocke)
  'settings.benachrichtigungen.title': "Notificaciones",
  'settings.benachrichtigungen.subtitle': "Qué avisos deben aparecer en tu campana.",
  'settings.benachrichtigungen.intro': "Este ajuste solo se aplica a ti. De forma predeterminada, todos los avisos están activos.",
  'settings.benachrichtigungen.rechnungenFaellig': "Facturas vencidas",
  'settings.benachrichtigungen.rechnungenFaelligHint': "Aviso cuando las facturas han superado su fecha de pago.",
  'settings.benachrichtigungen.termineHeute': "Citas de hoy",
  'settings.benachrichtigungen.termineHeuteHint': "Aviso de las citas previstas para hoy.",
  'settings.benachrichtigungen.materialKnapp': "Material escaso",
  'settings.benachrichtigungen.materialKnappHint': "Aviso cuando los productos caen por debajo del stock mínimo.",
  'settings.benachrichtigungen.steuerTermine': "Fechas fiscales",
  'settings.benachrichtigungen.steuerTermineHint': "Recordatorio de las fechas fiscales próximas que tú mismo gestionas.",
  'settings.benachrichtigungen.auslastung': "Ocupación",
  'settings.benachrichtigungen.auslastungHint': "Aviso cuando la ocupación semanal está por debajo de tu objetivo.",
  'settings.benachrichtigungen.par19': "Límite de facturación §19",
  'settings.benachrichtigungen.par19Hint': "Advertencia cuando te acercas al límite de facturación de pequeño empresario.",

  // Einstellungen: Darstellung
  'settings.appearance.title': "Apariencia",
  'settings.appearance.subtitle': "Cómo se ve Detailly para ti.",
  'settings.appearance.colorScheme': "Esquema de color",
  'settings.appearance.dark': "Oscuro",
  'settings.appearance.light': "Claro",
  'settings.appearance.deviceOnly': "Se aplica solo a este dispositivo y navegador.",
  'settings.motion.title': "Movimiento",
  'settings.motion.subtitle': "Reducir animaciones: más tranquilo y suave.",
  'settings.motion.reduce': "Reducir animaciones",
  'settings.motion.deviceOnly': "Este ajuste se aplica solo a este dispositivo y navegador.",

  // Einstellungen: Profil
  'settings.profile.title': "Mi perfil",
  'settings.profile.subtitle': "Puedes gestionar tú mismo tu nombre y número de teléfono.",
  'settings.profile.firstName': "Nombre",
  'settings.profile.lastName': "Apellidos",
  'settings.profile.phone': "Teléfono (opcional)",
  'settings.profile.email': "Correo electrónico",
  'settings.profile.role': "Rol",
  'settings.profile.emailRoleHint': "La dirección de correo y el rol los cambia la dirección del taller en la gestión de personal.",

  // Einstellungen: Passwort
  'settings.password.title': "Contraseña",
  'settings.password.subtitle': "Cambia la contraseña mediante un enlace seguro por correo electrónico.",
  'settings.password.sent': "Te hemos enviado un correo para restablecerla.",
  'settings.password.sending': "Enviando…",
  'settings.password.change': "Cambiar contraseña",

  // Einstellungen: Kalender-Abo
  'settings.calendar.title': "Suscripción de calendario (Apple / Google)",
  'settings.calendar.subtitle': "Todas las citas automáticamente en tu propio calendario, mediante un enlace de suscripción secreto que se actualiza solo.",
  'settings.calendar.appleLabel': "Calendario de Apple (webcal)",
  'settings.calendar.googleLabel': "Google / otros (https)",
  'settings.calendar.copy': "Copiar",
  'settings.calendar.copied': "Copiado ✓",
  'settings.calendar.appleName': "Calendario de Apple:",
  'settings.calendar.appleHelp': " Archivo → «Nueva suscripción de calendario…» → pega el enlace webcal.",
  'settings.calendar.googleName': "Calendario de Google:",
  'settings.calendar.googleHelp': " Otros calendarios → «Añadir mediante URL» → pega el enlace https.",
  'settings.calendar.secretHint': "El enlace es secreto y da acceso de lectura a las citas: compártelo solo con personas de confianza.",
  'settings.calendar.regenerating': "Generando…",
  'settings.calendar.regenerate': "Regenerar enlace (invalidar el anterior)",
  'settings.calendar.confirmTitle': "Regenerar enlace de calendario",
  'settings.calendar.confirmMsg': "Se generará un nuevo enlace de suscripción secreto. El enlace anterior dejará de ser válido; las suscripciones de calendario existentes deberán volver a configurarse con el nuevo enlace.",
  'settings.calendar.confirmLabel': "Regenerar",

  // Einstellungen: Verwaltung (Schnellzugriffe)
  'settings.admin.title': "Administración",
  'settings.admin.subtitle': "Acceso directo a las áreas del taller.",
  'settings.admin.staffTitle': "Personal y roles",
  'settings.admin.staffText': "Crear el equipo, gestionar roles y accesos.",
  'settings.admin.locationsTitle': "Sedes",
  'settings.admin.locationsText': "Gestionar sucursales y analizar entre sedes.",
  'settings.admin.servicesTitle': "Servicios y precios",
  'settings.admin.servicesText': "Gestionar tu propio catálogo de servicios y precios.",
  'settings.admin.subscriptionTitle': "Suscripción y plan",
  'settings.admin.subscriptionText': "Consultar y gestionar tu plan de Detailly.",

  // Einstellungen: Betriebstyp & Branchen-Look
  'settings.branche.title': "Tipo de taller y estilo del sector",
  'settings.branche.subtitle': "Determina el color de acento, el catálogo de cálculo y las opciones específicas del tipo.",
  'settings.branche.help': "El estilo (color de acento) cambia inmediatamente para todos los empleados del taller tras guardar.",

  // Einstellungen: Dein Look (Logo & Akzentfarbe)
  'settings.branding.title': "Tu estilo: logotipo y color",
  'settings.branding.subtitle': "Logotipo y color de acento para las vistas de cliente (seguimiento del pedido, carpeta de entrega).",
  'settings.branding.logoLabel': "Logotipo",
  'settings.branding.logoPlaceholder': "Sin logotipo",
  'settings.branding.logoChoose': "Seleccionar logotipo",
  'settings.branding.logoUploading': "Subiendo…",
  'settings.branding.logoRemove': "Quitar logotipo",
  'settings.branding.logoHelp': "PNG, JPEG o WebP, máx. 512 KB. Preferiblemente con fondo transparente.",
  'settings.branding.logoErrorType': "Solo se permiten PNG, JPEG o WebP como logotipo.",
  'settings.branding.logoErrorSize': "El logotipo es demasiado grande (máx. 512 KB).",
  'settings.branding.logoErrorGeneric': "No se ha podido guardar el logotipo.",
  'settings.branding.logoUploaded': "Logotipo actualizado",
  'settings.branding.logoRemoved': "Logotipo eliminado",
  'settings.branding.logoRemoveConfirmTitle': "¿Quitar el logotipo?",
  'settings.branding.logoRemoveConfirmMsg': "El logotipo se eliminará de todas las vistas de cliente. Puedes subir uno nuevo cuando quieras.",
  'settings.branding.accentLabel': "Color de acento",
  'settings.branding.accentReset': "Restablecer valores predeterminados",
  'settings.branding.accentPreviewButton': "Botón de ejemplo",
  'settings.branding.accentHelp': "Colorea el encabezado, los puntos de estado y los botones en las vistas de cliente. Vacío = estándar del sector.",
  'settings.branding.accentInvalid': "Indica un color hexadecimal válido (p. ej. #B5722F).",

  // Einstellungen: Betrieb & Anschrift
  'settings.address.title': "Taller y dirección",
  'settings.address.subtitle': "Nombre y dirección del taller",
  'settings.address.name': "Nombre del taller",
  'settings.address.email': "Correo electrónico",
  'settings.address.phone': "Teléfono",
  'settings.address.street': "Calle y número",
  'settings.address.postalCode': "Código postal",
  'settings.address.city': "Localidad",
  'settings.address.country': "País",
  'settings.address.taxHintPre': "§ 14 UStG: nombre, dirección y número fiscal ",
  'settings.address.taxHintOr': "o",
  'settings.address.taxHintPost': " USt-IdNr. son datos obligatorios para facturas válidas.",

  // Einstellungen: Steuer
  'settings.tax.title': "Impuestos (§ 14 UStG)",
  'settings.tax.subtitle': "El número fiscal o el USt-IdNr. es obligatorio en las facturas.",
  'settings.tax.steuernummer': "Número fiscal",
  'settings.tax.steuernummerPlaceholder': "p. ej. 12/345/67890",
  'settings.tax.ustId': "USt-IdNr.",
  'settings.tax.ustIdPlaceholder': "p. ej. DE123456789",
  // §19 UStG (Kleinunternehmer) + Rechtsform
  'settings.steuer.kleinunternehmer': "Pequeño empresario (§ 19 UStG)",
  'settings.steuer.kleinunternehmerHint': "No repercutir IVA. Los nuevos documentos se crean automáticamente con 0 %.",
  'settings.steuer.hinweisLabel': "Texto de aviso en los documentos",
  'settings.steuer.hinweisHelp': "Aparece en facturas/presupuestos. Deja vacío para el texto estándar.",
  'settings.steuer.standardSatz': "Tipo de IVA estándar para nuevos documentos",
  'settings.steuer.standardSatzHelp': "Preselección al crear nuevos documentos. Sigue siendo modificable por documento (19 / 7 / 0 %).",
  'settings.steuer.rechtsform': "Forma jurídica",
  'settings.steuer.rechtsform.einzelunternehmen': "Empresa individual",
  'settings.steuer.rechtsform.gbr': "GbR",
  'settings.steuer.rechtsform.ug': "UG (haftungsbeschränkt)",
  'settings.steuer.rechtsform.gmbh': "GmbH",
  'settings.steuer.rechtsform.ohg': "OHG",
  'settings.steuer.rechtsform.kg': "KG",
  'settings.steuer.rechtsform.gmbh_co_kg': "GmbH & Co. KG",
  'settings.steuer.rechtsform.freiberufler': "Profesional liberal",
  'settings.steuer.rechtsform.sonstige': "Otra",
  'settings.steuer.registergericht': "Registro mercantil",
  'settings.steuer.registergerichtPlaceholder': "p. ej. Amtsgericht Charlottenburg",
  'settings.steuer.registernummer': "Número de registro",
  'settings.steuer.registernummerPlaceholder': "p. ej. HRB 123456",
  'settings.steuer.vertretung': "Representantes legales",
  'settings.steuer.vertretungPlaceholder': "p. ej. Max Mustermann (gerente)",
  'settings.steuer.infoLinkPre': "¿No sabes qué aplica en tu caso? ",
  'settings.steuer.infoLink': "Información sobre pequeño empresario y forma jurídica",
  'settings.steuer.infoLinkPost': " (no es asesoramiento fiscal).",

  // ---- Einstellungen: Ziele & Erinnerungen (Tab, nur Inhaber) --------------
  'settings.ziele.intro.title': "Objetivos y recordatorios",
  'settings.ziele.intro.subtitle': "Fechas fiscales y avisos, como discretas notificaciones en la campana. No se envía nada al exterior.",
  // Auslastungsziel
  'settings.ziele.auslastung.title': "Objetivo de ocupación",
  'settings.ziele.auslastung.subtitle': "Valor objetivo para la ocupación de la capacidad de tu taller.",
  'settings.ziele.auslastung.toggle': "Activar objetivo de ocupación",
  'settings.ziele.auslastung.toggleHint': "Muestra un aviso en la campana cuando tu ocupación semanal está por debajo del objetivo.",
  'settings.ziele.auslastung.prozentLabel': "Ocupación objetivo (%)",
  'settings.ziele.auslastung.prozentHelp': "Entre 50 y 100 %. Estándar: 90 %.",
  // §19-Umsatzgrenzen-Warnung
  'settings.ziele.par19.title': "Advertencia de límite de facturación (§ 19 UStG)",
  'settings.ziele.par19.subtitle': "Aviso temprano antes de alcanzar el límite de pequeño empresario.",
  'settings.ziele.par19.toggle': "Avisar antes de alcanzar el límite de facturación",
  'settings.ziele.par19.toggleHint': "Usa el estado §19 existente (100.000 €/año); aparece como aviso en la campana.",
  'settings.ziele.par19.disabledHint': "Solo disponible si el régimen de pequeño empresario (§ 19 UStG) está activo en la pestaña «Taller».",
  // Steuer-Termine
  'settings.ziele.termine.title': "Fechas fiscales",
  'settings.ziele.termine.subtitle': "Fechas propias de las que la campana te recuerda a tiempo (14 días antes).",
  'settings.ziele.termine.artLabel': "Tipo",
  'settings.ziele.termine.artPlaceholder': "p. ej. declaración anticipada de IVA",
  'settings.ziele.termine.datumLabel': "Fecha",
  'settings.ziele.termine.datumPlaceholderRec': "01-10 (MM-DD)",
  'settings.ziele.termine.datumPlaceholderOnce': "2026-06-30 (AAAA-MM-DD)",
  'settings.ziele.termine.datumHelp': "Recurrente: MM-DD (p. ej. 01-10). Puntual: AAAA-MM-DD.",
  'settings.ziele.termine.wiederkehrend': "Anual",
  'settings.ziele.termine.aktiv': "Activo",
  'settings.ziele.termine.remove': "Quitar",
  'settings.ziele.termine.add': "Añadir fecha",
  'settings.ziele.termine.empty': "Aún no hay fechas creadas.",
  'settings.ziele.termine.max': "Máximo 12 fechas.",
  'settings.ziele.termine.disclaimer': "Recordatorios sin compromiso, no es asesoramiento fiscal.",
  'settings.ziele.error.datum': "Indica una fecha válida: recurrente MM-DD, puntual AAAA-MM-DD.",

  // Impressum-Generator (§ 5 DDG) – Betrieb-Tab. Pflichtangaben stammen aus den
  // Feldern oben (Adresse/Steuer). Inhalte selbst sind Betriebsdaten (nicht übersetzt).
  'settings.impressum.title': "Aviso legal",
  'settings.impressum.subtitle': "Datos obligatorios según § 5 DDG para tus páginas públicas (reserva, estado, documento).",
  'settings.impressum.disclaimer': "Generador automático, no es asesoramiento jurídico: Detailly genera el aviso legal a partir de tus datos maestros. Como taller, eres responsable de su exactitud e integridad.",
  'settings.impressum.vertretung.inhaber': "Propietario/a (nombre y apellidos)",
  'settings.impressum.vertretung.gbr': "Socios (todos con nombre)",
  'settings.impressum.vertretung.vertreter': "Representante(s) legal(es)",
  'settings.impressum.vertretungPlaceholder': "p. ej. Max Mustermann",
  'settings.impressum.vertretungHelp': "Aparece en el aviso legal como persona responsable. Si hay varias, indícalas todas.",
  'settings.impressum.complete': "Aviso legal completo: todos los datos obligatorios están registrados.",
  'settings.impressum.ustWarn': "Recomendación: añade el USt-IdNr. (§ 27a UStG) en cuanto lo tengas.",
  'settings.impressum.incomplete': "Faltan estos datos para un aviso legal completo:",
  'settings.impressum.incompleteHint': "Un aviso legal incompleto puede ser objeto de requerimiento. Los campos que faltan se gestionan en las secciones de arriba (dirección, impuestos/forma jurídica).",
  'settings.impressum.feld.firmenname': "Nombre de la empresa",
  'settings.impressum.feld.strasse': "Calle y número",
  'settings.impressum.feld.plz': "Código postal",
  'settings.impressum.feld.ort': "Localidad",
  'settings.impressum.feld.telefon': "Número de teléfono",
  'settings.impressum.feld.email': "Dirección de correo electrónico",
  'settings.impressum.feld.vertretungsberechtigte': "Persona responsable (propietario/gerente/socio)",
  'settings.impressum.feld.registergericht': "Registro mercantil",
  'settings.impressum.feld.registernummer': "Número de registro (HRB)",
  'settings.impressum.previewTitle': "Vista previa",
  'settings.impressum.previewHeading': "Datos según § 5 DDG",
  'settings.impressum.placeholderName': "[Falta el nombre de la empresa]",
  'settings.impressum.previewPhone': "Teléfono",
  'settings.impressum.previewEmail': "Correo electrónico",
  'settings.impressum.previewRegister': "Registro mercantil",
  'settings.impressum.previewUstId': "USt-IdNr.",
  'settings.impressum.viewLive': "Abrir vista pública",
  'settings.impressum.optionalTitle': "Datos adicionales opcionales",
  'settings.impressum.optionalHint': "Solo necesarios para ciertos talleres; para detallado/vinilado/PPF normalmente no son relevantes.",
  'settings.impressum.berufshaftpflicht': "Seguro de responsabilidad civil profesional",
  'settings.impressum.berufshaftpflichtPlaceholder': "p. ej. aseguradora, dirección, ámbito territorial",
  'settings.impressum.aufsichtsbehoerde': "Autoridad de supervisión",
  'settings.impressum.aufsichtsbehoerdePlaceholder': "solo para actividades sujetas a autorización",

  // Einstellungen: Auf detailly.de zeigen (Opt-in Mitgliederliste)
  'settings.mitglied.title': "Mostrar en detailly.de",
  'settings.mitglied.subtitle': "Incluir tu taller como referencia en nuestra página de inicio: voluntario y revocable en cualquier momento.",
  'settings.mitglied.toggle': "Mostrar en la página de inicio de Detailly",
  'settings.mitglied.toggleHint': "Solo con tu consentimiento. Se muestran el nombre de la empresa, el tipo de taller y, opcionalmente, ciudad, descripción breve y sitio web; nunca datos de contacto.",
  'settings.mitglied.stadt': "Ciudad (opcional)",
  'settings.mitglied.stadtPlaceholder': "p. ej. Berlín",
  'settings.mitglied.kurzbeschreibung': "Descripción breve (opcional)",
  'settings.mitglied.kurzbeschreibungPlaceholder': "p. ej. Detallado premium y vinilado desde 2015",
  'settings.mitglied.kurzbeschreibungHelp': "Máx. 160 caracteres.",
  'settings.mitglied.webseite': "Sitio web (opcional)",
  'settings.mitglied.webseitePlaceholder': "https://tu-taller.de",
  'settings.mitglied.webseiteHelp': "Debe empezar por http:// o https://.",
  'settings.mitglied.previewLabel': "Vista previa",
  'settings.mitglied.consent': "Tu taller solo aparece en nuestra página de inicio con tu consentimiento; revocable en cualquier momento.",

  // Einstellungen: Bankverbindung
  'settings.bank.title': "Datos bancarios",
  'settings.bank.subtitle': "Aparece en el pie de la factura.",
  'settings.bank.bankname': "Banco",
  'settings.bank.iban': "IBAN",
  'settings.bank.bic': "BIC",

  // Einstellungen: Rechnungsstellung
  'settings.invoice.title': "Facturación",
  'settings.invoice.subtitle': "Valores predeterminados para nuevas facturas; los documentos existentes no se modifican.",
  'settings.invoice.paymentTerm': "Plazo de pago (días)",
  'settings.invoice.paymentTermHelp': "Dejar vacío = 14 días.",
  'settings.invoice.paymentLink': "Enlace de pago",
  'settings.invoice.paymentLinkPlaceholder': "https://paypal.me/tu-taller",
  'settings.invoice.paymentLinkHelp': "Tu propio enlace de pago de PayPal.me o Stripe. Aparece como botón «Pagar online» en la página pública del documento; los pagos van directamente a vosotros, nunca a través de Detailly. Debe empezar por https://.",
  'settings.invoice.footer': "Texto de pie en los documentos",
  'settings.invoice.footerPlaceholder': "p. ej. ¡Gracias por tu pedido! Se aplican nuestras condiciones generales.",
  'settings.invoice.footerHelp': "Aparece en el pie de los PDF de presupuestos y facturas.",

  // Einstellungen: Mahnwesen
  'settings.mahn.title': "Gestión de reclamaciones",
  'settings.mahn.subtitle': "Plazos y tasas para recordatorios de pago y reclamaciones.",
  'settings.mahn.auto': "Reclamar automáticamente",
  'settings.mahn.autoHint': "Reclamaciones automáticas; de lo contrario reclamas manualmente en el cockpit de reclamaciones.",
  'settings.mahn.deadlines': "Plazos (días tras el vencimiento)",
  'settings.mahn.reminder': "Recordatorio",
  'settings.mahn.dunning1': "1.ª reclamación",
  'settings.mahn.dunning2': "2.ª reclamación",
  'settings.mahn.deadlinesHelp': "Estrictamente ascendente: recordatorio < 1.ª reclamación < 2.ª reclamación (cada uno 1–365 días).",
  'settings.mahn.fees': "Tasas de reclamación (€)",
  'settings.mahn.feesHelp': "De 0 a 999 € por nivel. Aparece como posición adicional en la reclamación.",

  // Einstellungen: Kunden-Benachrichtigungen
  'settings.notify.title': "Notificaciones a clientes",
  'settings.notify.subtitle': "Correos automáticos a clientes, desactivables en cualquier momento.",
  'settings.notify.status': "Correos de estado del pedido",
  'settings.notify.statusHint': "Los clientes con dirección de correo reciben automáticamente un mensaje con enlace al seguimiento del pedido en los cambios de estado importantes.",
  'settings.notify.appointment': "Confirmación de cita",
  'settings.notify.appointmentHint': "Los clientes reciben un correo de confirmación cuando se acepta su solicitud de cita online.",

  // Einstellungen: Kundenkommunikation (Termin-Erinnerung, Bewertungs-Bitte, Status-Mails)
  'settings.kk.intro.title': "Comunicación con clientes",
  'settings.kk.intro.subtitle': "Correos automáticos a tus clientes: recordatorios, petición de valoración e información de estado.",
  'settings.kk.reviewNote': "Nada se envía sin querer: los correos automáticos a clientes solo se envían cuando activas conscientemente el interruptor correspondiente. Todo aquí es desactivable en cualquier momento.",
  'settings.kk.reminder.title': "Recordatorio de cita",
  'settings.kk.reminder.subtitle': "Recuerda automáticamente su cita a los clientes con dirección de correo.",
  'settings.kk.reminder.toggle': "Enviar recordatorio de cita",
  'settings.kk.reminder.toggleHint': "Los clientes reciben un recordatorio amable antes de la cita; cada recordatorio se envía solo una vez.",
  'settings.kk.reminder.hoursLabel': "Antelación (horas antes)",
  'settings.kk.reminder.hoursHelp': "Cuántas horas antes del inicio de la cita se envía el recordatorio (1–168, estándar 24).",
  'settings.kk.review.title': "Petición de valoración",
  'settings.kk.review.subtitle': "Añade un enlace de valoración al correo «Vehículo listo para recoger», solo si está activo y hay un enlace configurado.",
  'settings.kk.review.toggle': "Pedir una valoración",
  'settings.kk.review.toggleHint': "Añade al correo de cierre un enlace a tu valoración de Google.",
  'settings.kk.review.urlLabel': "Enlace de valoración de Google",
  'settings.kk.review.urlHelp': "Debe empezar por https://. Lo más fácil es a través de tu perfil de empresa en Google («Escribir reseña»).",
  'settings.kk.review.urlPlaceholder': "https://g.page/r/...",
  'settings.kk.review.textLabel': "Texto de invitación propio (opcional)",
  'settings.kk.review.textHelp': "Deja vacío para el texto estándar.",
  'settings.kk.review.textPlaceholder': "¿Has quedado satisfecho? Nos alegraría mucho una breve valoración:",
  'settings.kk.error.url': "El enlace de valoración debe empezar por https://.",

  // Einstellungen: Sicherheit (2FA-Pflicht, Owner-Policy)
  'settings.security.title': "Seguridad",
  'settings.security.subtitle': "Autenticación de dos factores para tu equipo.",
  'settings.security.mfaRequired': "2FA obligatoria para empleados",
  'settings.security.mfaRequiredHint': "Todos los roles del taller deben configurar la autenticación de dos factores antes de poder seguir trabajando.",

  // Zwei-Faktor-Authentifizierung (Profil-Sektion + Banner)
  'mfa.title': "Autenticación de dos factores",
  'mfa.subtitle': "Protección adicional de tu cuenta con una app de autenticación.",
  'mfa.idle.desc': "Con la autenticación de dos factores activa, al iniciar sesión necesitas además un código de un solo uso de tu app de autenticación.",
  'mfa.idle.setupCta': "Configurar 2FA",
  'mfa.required.note': "Tu taller exige la autenticación de dos factores. Configúrala ahora.",
  'mfa.recommended.note': "Para tu rol se recomienda encarecidamente la autenticación de dos factores.",
  'mfa.setup.step1': "Escanear con la app de autenticación",
  'mfa.setup.step2': "¿No puedes escanear? Introduce esta clave manualmente en la app.",
  'mfa.setup.secretLabel': "Clave de configuración",
  'mfa.setup.copySecret': "Copiar",
  'mfa.setup.secretCopied': "Copiado",
  'mfa.setup.codeLabel': "Código de la app",
  'mfa.setup.codeHint': "Introduce el código de 6 dígitos que se muestra ahora para completar la configuración.",
  'mfa.setup.activate': "Activar",
  'mfa.setup.cancel': "Cancelar",
  'mfa.recovery.title': "Códigos de recuperación",
  'mfa.recovery.desc': "Guarda estos códigos en un lugar seguro; cada uno funciona una sola vez.",
  'mfa.recovery.warn': "Estos códigos solo se muestran ahora. Sin la app de autenticación son tu único acceso: guárdalos o imprímelos en un lugar seguro.",
  'mfa.recovery.copy': "Copiar todos",
  'mfa.recovery.copied': "Copiado",
  'mfa.recovery.download': "Guardar como archivo",
  'mfa.recovery.done': "Los he guardado",
  'mfa.enabled.status': "La autenticación de dos factores está activa.",
  'mfa.enabled.deactivate': "Desactivar 2FA",
  'mfa.deact.title': "Para desactivarla, introduce un código actual de la app o tu contraseña.",
  'mfa.deact.codeLabel': "Código de la app",
  'mfa.deact.passwordLabel': "Contraseña",
  'mfa.deact.usePassword': "Usar la contraseña en su lugar",
  'mfa.deact.useCode': "Usar el código de la app en su lugar",
  'mfa.deact.confirm': "Desactivar",
  'mfa.deact.cancel': "Cancelar",
  'mfa.toast.activated': "Autenticación de dos factores activada.",
  'mfa.toast.deactivated': "Autenticación de dos factores desactivada.",
  'mfa.error.generic': "La acción ha fallado. Inténtalo de nuevo.",
  'mfa.banner.required': "Tu taller exige la autenticación de dos factores. Configúrala ahora.",
  'mfa.banner.recommended': "Para tu rol se recomienda encarecidamente la autenticación de dos factores.",
  'mfa.banner.setupCta': "Configurar ahora",

  // Einstellungen: Mail-Versand
  'settings.mail.title': "Envío de correo (remitente propio)",
  'settings.mail.subtitle': "Opcional: enviar correos a clientes y de documentos a través de tu propio servidor SMTP y remitente.",
  'settings.mail.useOwn': "Usar remitente propio",
  'settings.mail.useOwnHint': "Sin una configuración activa, Detailly sigue enviando desde la dirección estándar.",
  'settings.mail.host': "Host SMTP",
  'settings.mail.hostPlaceholder': "p. ej. smtp.tu-proveedor.de",
  'settings.mail.port': "Puerto",
  'settings.mail.encryption': "Cifrado",
  'settings.mail.user': "Usuario",
  'settings.mail.userPlaceholder': "Nombre de acceso al servidor de correo",
  'settings.mail.password': "Contraseña",
  'settings.mail.passwordPlaceholder': "Introduce la contraseña SMTP",
  'settings.mail.passwordPlaceholderSet': "Configurada ({hint}) – para cambiarla, introduce una nueva contraseña",
  'settings.mail.passwordHelp': "Dejar vacío = sin cambios. Se guarda cifrada y no se vuelve a mostrar.",
  'settings.mail.fromEmail': "Dirección de remitente (From)",
  'settings.mail.fromEmailPlaceholder': "factura@tu-taller.de",
  'settings.mail.fromName': "Nombre del remitente",
  'settings.mail.fromNamePlaceholder': "p. ej. el nombre de tu taller",
  'settings.mail.testInfoPre': "El correo de prueba se envía a la dirección de remitente configurada y verifica la ",
  'settings.mail.testInfoEmph': "última guardada",
  'settings.mail.testInfoPost': " configuración. Guarda primero los cambios y luego prueba.",
  'settings.mail.testTitleOn': "Envía un correo de prueba a la dirección de remitente",
  'settings.mail.testTitleOff': "Primero activa y guarda «Usar remitente propio»",
  'settings.mail.sending': "Enviando…",
  'settings.mail.testSend': "Enviar correo de prueba",
  'settings.mail.confirmMsgPre': "Se enviará un correo de prueba a la dirección de remitente configurada",
  'settings.mail.confirmMsgPost': ". Se verifica la última configuración SMTP guardada.",

  // Einstellungen: Eigene Domain & Zustellbarkeit (SPF/DKIM/MX)
  'settings.maildomain.domain': "Dominio propio",
  'settings.maildomain.domainPlaceholder': "p. ej. tu-taller.de",
  'settings.maildomain.domainHelp': "El dominio de tu dirección de remitente. Solo después de guardar podrás ver los registros DNS y verificar el dominio.",
  'settings.maildomain.title': "Comprobar la entregabilidad",
  'settings.maildomain.badgeVerified': "Dominio verificado",
  'settings.maildomain.badgeUnverified': "No verificado",
  'settings.maildomain.spamHint': "Sin un dominio verificado (SPF y DKIM), tus correos suelen acabar en la carpeta de spam del destinatario. Introduce los registros DNS de abajo en tu proveedor de dominio y verifica después.",
  'settings.maildomain.showRecords': "Mostrar registros DNS",
  'settings.maildomain.hideRecords': "Ocultar registros DNS",
  'settings.maildomain.record.spf': "Registro SPF",
  'settings.maildomain.record.dkim': "Registro DKIM",
  'settings.maildomain.recordType': "Tipo",
  'settings.maildomain.recordHost': "Nombre / host",
  'settings.maildomain.recordValue': "Valor",
  'settings.maildomain.recordsHint': "En el registro SPF, sustituye «TU-PROVEEDOR-DE-CORREO» por el include SPF de tu proveedor de correo (consulta su documentación). El valor DKIM debe introducirse exactamente así; algunos proveedores lo dividen automáticamente.",
  'settings.maildomain.copy': "Copiar",
  'settings.maildomain.copied': "Copiado",
  'settings.maildomain.verify': "Verificar dominio",
  'settings.maildomain.verifying': "Comprobando…",
  'settings.maildomain.verifyTitle': "Comprueba los registros DNS (SPF, DKIM, MX) en vivo",
  'settings.maildomain.verifyFailed': "Verificación fallida",
  'settings.maildomain.verifiedToast': "Dominio verificado correctamente: los correos se firman ahora con DKIM.",
  'settings.maildomain.lastChecked': "Última comprobación: {date}",
  'settings.maildomain.check.spf': "SPF",
  'settings.maildomain.check.dkim': "DKIM",
  'settings.maildomain.check.mx': "MX",
  'settings.maildomain.setDomainFirst': "Introduce arriba un dominio y guárdalo para ver los registros DNS y comprobar la entregabilidad.",

  // Einstellungen: DATEV / Buchhaltung
  'settings.datev.title': "DATEV / contabilidad",
  'settings.datev.subtitle': "Para la exportación del lote de asientos DATEV. Número de asesor/cliente del asesor fiscal; cuentas predefinidas con los valores estándar del SKR03.",
  'settings.datev.beraterNr': "N.º de asesor",
  'settings.datev.beraterNrPlaceholder': "p. ej. 1001",
  'settings.datev.mandantNr': "N.º de cliente",
  'settings.datev.mandantNrPlaceholder': "p. ej. 456",
  'settings.datev.skr': "Plan de cuentas (SKR)",
  'settings.datev.debitor': "Cuenta colectiva de deudores",
  'settings.datev.erloes19': "Cuenta de ingresos 19 %",
  'settings.datev.erloes7': "Cuenta de ingresos 7 %",
  'settings.datev.erloes0': "Cuenta de ingresos exenta / §19",
  'settings.datev.help': "Nota: antes de la primera importación DATEV real, contrástalo con el asesor fiscal o con el programa gratuito de verificación de DATEV.",

  // Einstellungen: sevDesk-Anbindung
  'settings.sevdesk.title': "Conexión con sevDesk",
  'settings.sevdesk.subtitle': "Opcional: transferir automáticamente las facturas emitidas a tu cuenta de sevDesk.",
  'settings.sevdesk.apiToken': "Token de API",
  'settings.sevdesk.tokenPlaceholder': "Introduce el token de API de sevDesk",
  'settings.sevdesk.tokenPlaceholderSet': "Configurado ({hint}) – para cambiarlo, introduce un nuevo token",
  'settings.sevdesk.help': "Se encuentra en sevDesk en Configuración → Usuario → Token de API. Se guarda cifrado y no se vuelve a mostrar.",
  'settings.sevdesk.testTitle': "Prueba el token guardado",
  'settings.sevdesk.testing': "Probando…",
  'settings.sevdesk.test': "Probar conexión",
  'settings.sevdesk.remove': "Quitar token",

  // Einstellungen: Fehler / Validierung
  'settings.error.saveFailed': "Error al guardar",
  'settings.error.loadFailed': "No se han podido cargar los datos maestros",
  'settings.error.testFailed': "Prueba fallida",
  'settings.error.removeFailed': "Error al quitar",
  'settings.error.mahnDaysRange': "Los plazos de reclamación deben ser números enteros entre 1 y 365 días.",
  'settings.error.mahnDaysOrder': "Los plazos de reclamación deben ser ascendentes (recordatorio < 1.ª reclamación < 2.ª reclamación).",
  'settings.error.mailHostRequired': "Para el envío de correo propio se requiere un host SMTP.",
  'settings.error.mailPortRange': "El puerto SMTP debe estar entre 1 y 65535.",
  'settings.error.mailFromInvalid': "Indica una dirección de remitente (From) válida.",
  'settings.error.mailDomainMismatch': "La dirección de remitente debe pertenecer al dominio registrado.",
  'settings.error.mitgliedWebseite': "El sitio web debe empezar por http:// o https://.",

  // ---- Login ---------------------------------------------------------------
  'login.subtitle': "Detailing Suite — detallado, vinilado y PPF",
  'login.email': "Correo electrónico",
  'login.password': "Contraseña",
  'login.forgot': "¿Contraseña olvidada?",
  'login.showPassword': "Mostrar contraseña",
  'login.hidePassword': "Ocultar contraseña",
  'login.submit': "Iniciar sesión",
  'login.submitting': "Iniciando sesión…",
  'login.failed': "Error al iniciar sesión",
  'login.noAccount': "¿Aún no tienes cuenta?",
  'login.registerCta': "Registrar taller",
  'login.footer': "© {year} Detailly · Software de detallado independiente",
  // Login: zweite Stufe (2FA)
  'login.mfaSubtitle': "Confirmación de dos factores",
  'login.mfaHint': "Introduce el código de 6 dígitos de tu app de autenticación.",
  'login.mfaCode': "Código de confirmación",
  'login.mfaSubmit': "Confirmar e iniciar sesión",
  'login.mfaVerifying': "Comprobando…",
  'login.mfaUseRecovery': "Usar código de recuperación",
  'login.mfaUseCode': "Volver al código de la app",
  'login.mfaRecovery': "Código de recuperación",
  'login.mfaRecoveryHint': "Uno de los códigos de un solo uso que guardaste durante la configuración.",
  'login.mfaBack': "Cancelar",
  'login.mfaFailed': "Código no válido o caducado",

  // ===========================================================================
  // LANDING (Route "/")
  // ===========================================================================

  // ---- Kopfleiste ----------------------------------------------------------
  'landing.nav.branchen': "Sectores",
  'landing.nav.ablauf': "Cómo funciona",
  'landing.nav.funktionen': "Funciones",
  'landing.nav.faq': "Preguntas frecuentes",
  'landing.nav.login': "Iniciar sesión",
  'landing.nav.trial': "Prueba gratis",

  // ---- Hero ----------------------------------------------------------------
  'landing.hero.badge': "El software de taller para detallado, vinilado y PPF",
  'landing.hero.eyebrow': "Software de taller · Detallado / Vinilado / PPF",
  'landing.hero.headlinePre': "Más tiempo ",
  'landing.hero.headlineEm': "en el vehículo",
  'landing.hero.headlinePost': ". Menos tiempo en la oficina.",
  'landing.hero.title1': "Tu oficio es la precisión.",
  'landing.hero.title2': "Ahora tu software también.",
  'landing.hero.sub': "Recepción con captura de daños en 3D y firma en cuatro minutos: el trabajo, la factura y el recordatorio se generan al instante.",
  'landing.hero.ctaPrimary': "Prueba 14 días gratis",
  'landing.hero.ctaSecondary': "Ver funciones",
  'landing.hero.trailer': "Sin tarjeta de crédito · Listo en minutos · Cancelable cada mes",

  // ---- Signature A: µm-Schichtdicken-Readout -------------------------------
  'landing.messwert.label': "Espesor de capa",
  'landing.messwert.unit': "µm",
  'landing.messwert.measuring': "midiendo …",
  'landing.messwert.status': "dentro de tolerancia",
  'landing.messwert.surface': "Superficie pintada · Capó",
  'landing.messwert.caption': "En la recepción cuenta el valor medido, no la afirmación. Así trabaja Detailly: documentado y demostrable. (La medición del espesor de capa forma parte de la herramienta de recepción, no de Detailly.)",
  'landing.messwert.aria': "Medición del espesor de capa: valor medido dentro del rango de tolerancia, marcado en verde.",

  // ---- Funktionen als Datenblatt (Label ↔ Fakt) ----------------------------
  'landing.datenblatt.kicker': "Ficha técnica",
  'landing.datenblatt.title': "Lo que incluye — como hechos, no como promesas.",
  'landing.datenblatt.sub': "Cada línea es una función que hoy está en el producto.",
  'landing.datenblatt.footnote': "Además: búsqueda global, manejo móvil y varios empleados por taller.",
  'landing.datenblatt.kunden.label': "Clientes y vehículos",
  'landing.datenblatt.kunden.fact': "Ficha del vehículo · historial completo",
  'landing.datenblatt.auftraege.label': "Órdenes y tablero de planificación",
  'landing.datenblatt.auftraege.fact': "Planificación semanal · citas · progreso",
  'landing.datenblatt.schaden.label': "Registro de daños",
  'landing.datenblatt.schaden.fact': "Modelo 3D · foto · firma",
  'landing.datenblatt.rechnung.label': "Facturas",
  'landing.datenblatt.rechnung.fact': "GoBD §14 · XRechnung · ZUGFeRD",
  'landing.datenblatt.zahlung.label': "Pagos",
  'landing.datenblatt.zahlung.fact': "Vencimientos · reclamaciones",
  'landing.datenblatt.kasse.label': "Libro de caja",
  'landing.datenblatt.kasse.fact': "Conforme a GoBD · al día",
  'landing.datenblatt.kalkulation.label': "Cálculo",
  'landing.datenblatt.kalkulation.fact': "por oficio · detallado / vinilado / PPF",
  'landing.datenblatt.datenschutz.label': "Protección de datos",
  'landing.datenblatt.datenschutz.fact': "RGPD · cifrado · separado por taller",
  'landing.datenblatt.sprachen.label': "Idiomas",
  'landing.datenblatt.sprachen.fact': "4 · DE / EN / RU / PL",
  'landing.datenblatt.zugriff.label': "Acceso",
  'landing.datenblatt.zugriff.fact': "Navegador · tablet · smartphone",
  'landing.datenblatt.dellen.label': "Cálculo de abolladuras",
  'landing.datenblatt.dellen.fact': "Smart Repair / PDR · precio al instante",
  'landing.datenblatt.buchhaltung.label': "Contabilidad",
  'landing.datenblatt.buchhaltung.fact': "DATEV · sevDesk · CSV",
  'landing.datenblatt.shop.label': "Tienda y marketplace",
  'landing.datenblatt.shop.fact': "Compra B2B · biblioteca de láminas",

  // ---- Vertrauens-Leiste ---------------------------------------------------
  'landing.trust.dsgvo': "Conforme al RGPD",
  'landing.trust.gobd': "Facturas conformes a GoBD",
  'landing.trust.madeInGermany': "Made in Germany",
  'landing.trust.encrypted': "Datos cifrados",
  'landing.trust.noInstall': "Sin instalación",

  // ---- Problem -------------------------------------------------------------
  'landing.problem.kicker': "¿Te suena?",
  'landing.problem.title': "El taller funciona — la administración frena.",
  'landing.problem.sub': "Mientras el trabajo en el vehículo exige precisión, todo lo demás se hunde en el papeleo.",
  'landing.problem.p1': "El historial del vehículo está repartido en carpetas, notas y en la cabeza.",
  'landing.problem.p2': "Las facturas se quedan sin emitir — y te cuestan dinero contante.",
  'landing.problem.p3': "Los daños en la recepción luego apenas pueden demostrarse.",
  'landing.problem.p4': "Cinco herramientas distintas que no se hablan entre sí.",
  'landing.problem.summaryPre': "Detailly reúne todo eso en ",
  'landing.problem.summaryEm': "un",
  'landing.problem.summaryPost': " sistema — claro, rápido y en cualquier dispositivo.",

  // ---- Branchen-Switcher ---------------------------------------------------
  'landing.branchen.kicker': "Hecho para tu oficio",
  'landing.branchen.title': "Un software que habla el idioma de tu oficio",
  'landing.branchen.sub': "Al empezar eliges tu especialidad — Detailly ajusta el catálogo de servicios, el cálculo e incluso el aspecto. Pruébalo: elige tu oficio y observa cómo cambia de color la página.",
  'landing.branchen.selected': "Seleccionado",
  'landing.branchen.cta': "Empezar como {label}",
  'landing.branchen.complete': "¿Todo de un solo proveedor?",
  'landing.branchen.completeCta': "Empezar como proveedor integral",
  'landing.branchen.aufbereitung.l1': "Detallado interior y exterior",
  'landing.branchen.aufbereitung.l2': "Pulido y sellado cerámico",
  'landing.branchen.aufbereitung.l3': "Revisiones de devolución de leasing",
  'landing.branchen.folierung.l1': "Vinilado total y parcial",
  'landing.branchen.folierung.l2': "Cambio de color y diseño",
  'landing.branchen.folierung.l3': "Rotulación publicitaria",
  'landing.branchen.ppf.l1': "Protección frontal e integral",
  'landing.branchen.ppf.l2': "Paquetes de protección antigravilla",
  'landing.branchen.ppf.l3': "Cortes precisos",

  // ---- So funktioniert's ---------------------------------------------------
  'landing.ablauf.kicker': "Así de fácil es",
  'landing.ablauf.title': "En tres pasos hacia un flujo limpio",
  'landing.ablauf.step1.title': "Recepcionar",
  'landing.ablauf.step1.desc': "Cliente, vehículo y daños registrados en minutos — con marcado 3D, fotos y firma digital.",
  'landing.ablauf.step2.title': "Gestionar",
  'landing.ablauf.step2.desc': "Calcular servicios, planificar citas en el tablero y mantener el progreso siempre a la vista.",
  'landing.ablauf.step3.title': "Facturar",
  'landing.ablauf.step3.desc': "De la orden sale con un clic la factura conforme a GoBD en PDF — incluidos vencimientos y reclamaciones.",

  // ---- Funktionen ----------------------------------------------------------
  'landing.funktionen.kicker': "Todas las herramientas",
  'landing.funktionen.title': "Todo lo que tu taller necesita",
  'landing.funktionen.sub': "Un flujo continuo — desde la recepción del vehículo hasta la factura pagada.",
  'landing.funktionen.kunden.title': "Clientes y vehículos",
  'landing.funktionen.kunden.desc': "Datos maestros, ficha del vehículo e historial completo por vehículo — localizables al instante.",
  'landing.funktionen.auftraege.title': "Órdenes y tablero de planificación",
  'landing.funktionen.auftraege.desc': "Del presupuesto a la entrega. Planificación semanal con citas — todo a la vista.",
  'landing.funktionen.rechnungen.title': "Facturas y documentos",
  'landing.funktionen.rechnungen.desc': "Facturas y presupuestos conformes a §14 y GoBD en PDF, incl. vencimientos y reclamaciones.",
  'landing.funktionen.schaden3d.title': "Registro de daños en 3D",
  'landing.funktionen.schaden3d.desc': "Marca los daños directamente en el modelo del vehículo, documéntalos con fotos y hazlos firmar digitalmente.",
  'landing.funktionen.kalkulation.title': "Cálculo por oficio",
  'landing.funktionen.kalkulation.desc': "Catálogos de servicios y lógica de precios para detallado, vinilado y PPF — según tu especialidad.",
  'landing.funktionen.dsgvo.title': "RGPD y seguridad",
  'landing.funktionen.dsgvo.desc': "Datos sensibles cifrados, estrictamente separados por taller, con exportación y borrado de datos con un botón.",
  'landing.funktionen.footnotePre': "Además: búsqueda global ultrarrápida (",
  'landing.funktionen.footnotePost': "), navegación móvil y varios empleados por taller.",
  'landing.funktionen.buchhaltung.title': "Contabilidad y asesor fiscal",
  'landing.funktionen.buchhaltung.desc': "Exporta facturas como lote DATEV (EXTF) o CSV universal, conecta sevDesk y obtén un resumen de ingresos (tipo EÜR) con análisis del negocio.",
  'landing.funktionen.shop.title': "Tienda y marketplace",
  'landing.funktionen.shop.desc': "Marketplace B2B integrado: pide material y láminas directamente a mayoristas. Además, gestión de stock y biblioteca de láminas en tu tienda.",
  'landing.finanzShop.kicker': "Más que pedidos",
  'landing.finanzShop.title': "Contabilidad y material — integrados directamente",
  'landing.finanzShop.buchhaltung.nutzen': "Tus cifras van directas al asesor fiscal — sin doble registro.",
  'landing.finanzShop.shop.nutzen': "Reabastece material sin salir del software.",
  'landing.dellen.kicker': "Smart Repair / PDR",
  'landing.dellen.title': "Haz clic en la abolladura y aparece el precio",
  'landing.dellen.desc': "Daños de aparcamiento y granizo calculados en segundos: marca la abolladura en el vehículo — Detailly calcula el precio al instante según tamaño, borde, aluminio y daño de pintura.",
  'landing.dellen.cardHeader': "Cálculo de abolladuras · PDR",
  'landing.dellen.priceLabel': "Precio al instante",
  'landing.dellen.item': "Abolladura",
  'landing.dellen.marker1': "Puerta",
  'landing.dellen.marker2': "Aleta",
  'landing.dellen.marker3': "Capó",
  'landing.dellen.note': "Valores de ejemplo — tú defines tus propias tarifas.",
  'landing.dellen.aria': "Cálculo de abolladuras ilustrado: se marcan tres abolladuras y el precio se suma.",

  // ---- 3D-Schadenserfassung (Showcase) -------------------------------------
  'landing.schaden.kicker': "El punto fuerte",
  'landing.schaden.title': "Documenta los daños antes de que se conviertan en disputa",
  'landing.schaden.desc': "En la recepción marcas arañazos, abolladuras e impactos de piedra directamente en el modelo del vehículo — con fotos y firma digital del cliente. Si luego surgen preguntas, tienes las pruebas. Negro sobre blanco.",
  'landing.schaden.point1': "Colocar los puntos de daño directamente en el modelo 3D",
  'landing.schaden.point2': "Fotos por daño — asignadas automáticamente",
  'landing.schaden.point3': "Firma digital en la recepción y en la entrega",
  'landing.schaden.cardHeader': "Recepción del vehículo · registro de daños",
  'landing.schaden.cardBadge': "2 daños",
  'landing.schaden.cardPhotos': "4 fotos documentadas",
  'landing.schaden.cardSignature': "Firma registrada",

  // ---- Landing: 3D-Showcase (LandingCar3D) --------------------------------
  'landing.showcase.aria': "Modelo 3D interactivo del vehículo con puntos de daño marcados",
  'landing.showcase.pin1': "Impacto de piedra · 2 fotos",
  'landing.showcase.pin2': "Arañazo · puerta izquierda",
  'landing.showcase.pin3': "Abolladura · documentada",
  'landing.showcase.badgeOne': "{count} daño",
  'landing.showcase.badgeMany': "{count} daños",

  // ---- Wachstum ------------------------------------------------------------
  'landing.wachstum.kicker': "Escalable",
  'landing.wachstum.title': "Crecimiento gracias a la visión de conjunto",
  'landing.wachstum.sub': "Quien está organizado y conoce sus números toma mejores decisiones — desde el taller individual hasta la cadena.",
  'landing.wachstum.echtzeit.title': "Visión en tiempo real",
  'landing.wachstum.echtzeit.desc': "Facturación, órdenes abiertas y citas en vivo en el panel — ves al instante dónde va bien y dónde se atasca.",
  'landing.wachstum.standorte.title': "Varias sedes",
  'landing.wachstum.standorte.desc': "Gestiona sucursales bajo un mismo techo — bien separadas y aun así centralizadas. Ampliable siempre que crezcas.",
  'landing.wachstum.team.title': "Equipo, roles y permisos",
  'landing.wachstum.team.desc': "Invita a empleados y asigna roles — cada uno ve exactamente lo que debe. Supervisado y documentado de forma limpia.",
  'landing.wachstum.chartVolume': "Volumen de órdenes",
  'landing.wachstum.chartGrowing': "crece",
  'landing.wachstum.chartLocations': "Sedes",

  // ---- Zahlen (Count-up) ---------------------------------------------------
  'landing.zahlen.stat1.unit': "Idiomas",
  'landing.zahlen.stat1.label': "en alemán, inglés, ruso y polaco",
  'landing.zahlen.stat2.unit': "Días",
  'landing.zahlen.stat2.label': "de prueba gratis — sin tarjeta de crédito",
  'landing.zahlen.stat3.value': "RGPD + GoBD",
  'landing.zahlen.stat3.label': "almacenado y facturado de forma conforme",
  'landing.zahlen.stat4.value': "5 → 1",
  'landing.zahlen.stat4.label': "un sistema en lugar de cinco soluciones aisladas",

  // ---- Mitglieder (Social Proof, Opt-in) -----------------------------------
  'landing.mitglieder.kicker': "De la práctica",
  'landing.mitglieder.title': "Estos talleres trabajan con Detailly",
  'landing.mitglieder.sub': "Detallistas, viniladores y estudios de PPF que usan Detailly a diario — y que nos han permitido nombrarlos aquí.",

  // ---- Deutschlandkarte (Qualitätssiegel, nur zahlende Opt-in-Betriebe) -----
  'landing.karte.kicker': "Presencia en todo el país",
  'landing.karte.title': "Talleres Detailly por toda Alemania",
  'landing.karte.sub': "Talleres miembros verificados y activos — en el mapa aproximadamente por región. Toca un punto para ver los talleres de la región.",
  'landing.karte.pin.aria': "{anzahl} talleres en la región postal {region}",
  'landing.karte.pin.aria.one': "Un taller en la región postal {region}",
  'landing.karte.pop.aria': "Talleres en la región postal {region}",
  'landing.karte.pop.region': "Región postal {region}",
  'landing.karte.pop.website': "Sitio web",
  'landing.karte.legende': "{betriebe} talleres activos en {regionen} regiones",

  // ---- Mapa en vivo de talleres (datos reales) -----------------------------
  'landing.betriebskarte.kicker': "En toda Alemania",
  'landing.betriebskarte.title': "Talleres Detailly en el mapa",
  'landing.betriebskarte.sub': "Talleres reales y activos, aproximadamente por región. Toca un punto para ver los talleres de la región. Ninguna ubicación más precisa que la zona postal.",
  'landing.betriebskarte.zaehler': "talleres en toda Alemania",
  'landing.betriebskarte.zaehlerEiner': "taller en toda Alemania",
  'landing.betriebskarte.laedt': "Cargando el mapa …",
  'landing.betriebskarte.leer': "Pronto en tu región.",
  'landing.betriebskarte.legende': "Visible en {regionen} regiones",
  'landing.betriebskarte.pinAria': "{anzahl} talleres en la zona postal {region}",
  'landing.betriebskarte.pinAria.one': "{name} en la zona postal {region}",
  'landing.betriebskarte.pop.aria': "Talleres en la zona postal {region}",
  'landing.betriebskarte.pop.region': "Zona postal {region}",

  // ---- Warum Detailly ------------------------------------------------------
  'landing.warum.kicker': "Por qué Detailly",
  'landing.warum.title': "Software para el taller — no para el concesionario.",
  'landing.warum.body': "Los detallistas, viniladores y estudios de PPF hacen un trabajo de precisión y merecen un software que trabaje con la misma limpieza. La mayoría de los programas de taller están hechos para grandes concesionarios: sobrecargados, complicados y caros. Detailly es deliberadamente distinto — ligero, adaptado a vuestros procesos y listo en minutos. Desarrollado de forma independiente, en Alemania, con protección de datos desde la base.",

  // ---- News-Teaser ---------------------------------------------------------
  'landing.news.kicker': "Noticias de Detailly",
  'landing.news.title': "Lo que se está moviendo",
  'landing.news.sub': "Actualizaciones de producto y novedades sobre Detailly. (Entradas de ejemplo — pronto con noticias reales.)",
  'landing.news.all': "Ver todas las noticias",

  // ---- FAQ -----------------------------------------------------------------
  'landing.faq.kicker': "Preguntas frecuentes",
  'landing.faq.title': "Lo que quieres saber antes de empezar",
  'landing.faq.q1.q': "¿Necesito conocimientos técnicos o una instalación?",
  'landing.faq.q1.a': "No. Registras tu taller y empiezas directamente en el navegador — en ordenador, tablet o smartphone. No hay nada que instalar ni que configurar.",
  'landing.faq.q2.q': "Hago detallado Y vinilado — ¿qué elijo?",
  'landing.faq.q2.a': "Entonces eres proveedor integral: al registrarte, simplemente eliges «Proveedor integral» y obtienes todos los catálogos de servicios y cálculos juntos.",
  'landing.faq.q3.q': "¿Qué seguridad tienen los datos de mis clientes?",
  'landing.faq.q3.a': "Los datos sensibles se guardan cifrados y están estrictamente separados de otros talleres. Puedes exportar o borrar los datos de clientes en cualquier momento — totalmente conforme al RGPD.",
  'landing.faq.q4.q': "¿Qué pasa después de los 14 días?",
  'landing.faq.q4.a': "Pruebas sin tarjeta de crédito y sin riesgo. Tras el periodo de prueba eliges el plan que se adapta a tu taller. Si el periodo de prueba termina, no tienes ningún coste.",
  'landing.faq.q5.q': "¿Funciona también en la tablet del taller?",
  'landing.faq.q5.a': "Sí. Detailly está hecho para cualquier dispositivo — desde el PC de oficina hasta la tablet en la recepción del vehículo. El manejo se adapta automáticamente.",
  'landing.faq.q6.q': "¿Puedo llevarme mis datos de nuevo?",
  'landing.faq.q6.a': "En cualquier momento. Tus datos son tuyos — una exportación es posible con un botón, sin tener que pedir permiso a nadie.",

  // ---- Abschluss-CTA -------------------------------------------------------
  'landing.cta.title': "Pon orden en tu taller — desde hoy.",
  'landing.cta.sub': "Registra tu taller en pocos minutos y prueba Detailly 14 días gratis. Sin tarjeta de crédito, sin riesgo.",
  'landing.cta.primary': "Empezar gratis ahora",
  'landing.cta.secondary': "Ya tengo una cuenta",

  // ---- Footer --------------------------------------------------------------
  'landing.footer.tagline': "El software de taller para detallado, vinilado y PPF. Desarrollado de forma independiente en Alemania.",
  'landing.footer.discover': "Descubrir",
  'landing.footer.product': "Producto",
  'landing.footer.account': "Cuenta y aspectos legales",
  'landing.footer.news': "Noticias",
  'landing.footer.changelog': "Novedades",
  'landing.footer.masterclass': "Masterclass",
  'landing.footer.gruendung': "Creación de empresa",
  'landing.footer.grosshaendler': "Para mayoristas",
  'landing.footer.features': "Funciones",
  'landing.footer.branchen': "Para tu oficio",
  'landing.footer.faq': "Preguntas frecuentes",
  'landing.footer.trial': "Prueba gratis",
  'landing.footer.login': "Iniciar sesión",
  'landing.footer.register': "Registrarse",
  'landing.footer.impressum': "Aviso legal",
  'landing.footer.datenschutz': "Protección de datos",
  'landing.footer.copyright': "© {year} Detailly · Todos los derechos reservados",

  // ---- Kundenformular ------------------------------------------------------
  'kunden.form.leitwegId.label': "Leitweg-ID",
  'kunden.form.leitwegId.help': "Solo para facturas a administraciones/organismos públicos (controla el enrutamiento B2G).",
  'kunden.form.editTitle': "Editar cliente",
  'kunden.form.saving': "Guardando…",
  'kunden.form.company': "Empresa",
  'kunden.form.firstName': "Nombre",
  'kunden.form.lastName': "Apellidos",
  'kunden.form.street': "Calle",
  'kunden.form.postalCode': "Código postal",
  'kunden.form.noNameHelp': "No hay nombre registrado — p. ej. tras la anonimización según el RGPD.",
  'kunden.form.gdprSection': "Protección de datos (RGPD)",
  'kunden.form.exportJson': "Exportar datos (JSON)",
  'kunden.form.anonymizeBtn': "Borrar / anonimizar datos",
  'kunden.form.gdprNote': "Las facturas se conservan por motivos legales (GoBD), pero sin datos personales.",
  'kunden.form.anonymize.title': "¿Borrar definitivamente los datos del cliente?",
  'kunden.form.anonymize.msgPre': "Los datos personales se eliminan o anonimizan. Las facturas se conservan por motivos legales (GoBD, 10 años), pero sin datos personales. Esta acción no se puede ",
  'kunden.form.anonymize.msgEmph': "deshacer",
  'kunden.form.anonymize.msgPost': ".",
  'kunden.form.anonymize.confirm': "Borrar definitivamente",
  'kunden.form.error.save': "Error al guardar",
  'kunden.form.error.export': "Error de exportación",
  'kunden.form.error.anonymize': "Error al borrar",
  'kunden.form.gdpr.checking': "Comprobando documentos…",
  'kunden.form.gdpr.willAnonymize': "Existen {count} documentos sujetos a conservación. Por ello, el cliente se anonimiza — los documentos se conservan por motivos legales (GoBD/§147 AO), pero sin datos personales. Esta acción no se puede ",
  'kunden.form.gdpr.willDelete': "No existen documentos sujetos a conservación. El cliente se borra por completo con todos sus vehículos, citas, fotos y borradores. Esta acción no se puede ",
  'kunden.form.gdpr.irreversible': "deshacer.",
  'kunden.form.gdpr.confirmDelete': "Borrar definitivamente",

  // ===========================================================================
  // KUNDEN (Route "/kunden")
  // ===========================================================================
  'kunden.title': "Clientes",
  'kunden.subtitle': "Clientes particulares y de empresa",
  'kunden.csvImport': "Importar CSV",
  'kunden.new': "Nuevo cliente",
  'kunden.searchPlaceholder': "Buscar por nombre, correo, teléfono…",

  // ---- Leerzustand ---------------------------------------------------------
  'kunden.empty.none': "Aún no hay clientes creados.",
  'kunden.empty.filtered': "No se han encontrado clientes.",
  'kunden.empty.cta': "Crear el primer cliente",

  // ---- Tabellenspalten -----------------------------------------------------
  'kunden.col.name': "Nombre",
  'kunden.col.typ': "Tipo",
  'kunden.col.email': "Correo electrónico",
  'kunden.col.telefon': "Teléfono",
  'kunden.col.ort': "Localidad",

  // ---- Kundentyp -----------------------------------------------------------
  'kunden.type.business': "Empresa",
  'kunden.type.private': "Particular",

  // ---- Aktionsmenü ---------------------------------------------------------
  'kunden.actionsFor': "Acciones para {name}",
  'kunden.action.open': "Abrir",
  'kunden.action.newOrder': "Nueva orden",
  'kunden.action.edit': "Editar",

  // ---- Toast / Fehler / Löschen-Bestätigung --------------------------------
  'kunden.toast.deleted': "{name} eliminado",
  'kunden.error.delete': "Error al eliminar",
  'kunden.delete.title': "Eliminar cliente",
  'kunden.delete.msg': "¿Eliminar realmente a {name}? El cliente se desactiva y se quita de la lista. Las órdenes y facturas ya registradas se conservan.",

  // ---- Kundenakte (Route "/kunden/detail") ---------------------------------
  'kunden.detail.businessCustomer': "Cliente de empresa",
  'kunden.detail.privateCustomer': "Cliente particular",
  'kunden.detail.addVehicle': "Añadir vehículo",
  'kunden.detail.contact': "Contacto",
  'kunden.detail.address': "Dirección",
  'kunden.detail.vatNumber': "USt-IdNr.",
  'kunden.detail.stat.vehicles': "Vehículos",
  'kunden.detail.stat.openOrders': "Órdenes abiertas",
  'kunden.detail.stat.openInvoices': "Facturas abiertas",
  'kunden.detail.stat.paidTotal': "Pagado en total",
  'kunden.detail.pieces': "{n} unidades",
  'kunden.detail.vehicles': "Vehículos",
  'kunden.detail.vehicleCountOne': "{n} vehículo",
  'kunden.detail.vehicleCountMany': "{n} vehículos",
  'kunden.detail.emptyVehicles': "No hay vehículos registrados.",
  'kunden.detail.openFile': "Ficha",
  'kunden.detail.appointments': "Citas",
  'kunden.detail.newestFirst': "Más recientes primero",
  'kunden.detail.emptyAppts': "Sin citas.",
  'kunden.detail.orders': "Órdenes",
  'kunden.detail.totalCount': "{n} en total",
  'kunden.detail.emptyOrders': "Aún no hay órdenes.",
  'kunden.detail.invoices': "Facturas y presupuestos",
  'kunden.detail.emptyInvoices': "Aún no hay documentos.",
  'kunden.detail.pdf': "PDF",
  'kunden.detail.error.load': "No se ha podido cargar el cliente",
  'kunden.detail.error.pdf': "No se ha podido cargar el PDF",

  // ===========================================================================
  // FAHRZEUGE (Route "/fahrzeuge")
  // ===========================================================================
  'fahrzeuge.title': "Vehículos",
  'fahrzeuge.subtitle': "Parque de vehículos con ficha del vehículo",
  'fahrzeuge.new': "Nuevo vehículo",
  'fahrzeuge.searchPlaceholder': "Buscar por matrícula, marca, modelo o titular…",

  // ---- Leerzustand ---------------------------------------------------------
  'fahrzeuge.empty.none': "Aún no hay vehículos creados.",
  'fahrzeuge.empty.filtered': "No se han encontrado vehículos.",
  'fahrzeuge.empty.cta': "Crear el primer vehículo",

  // ---- Tabellenspalten -----------------------------------------------------
  'fahrzeuge.col.fahrzeug': "Vehículo",
  'fahrzeuge.col.kennzeichen': "Matrícula",
  'fahrzeuge.col.halter': "Titular",
  'fahrzeuge.col.baujahr': "Año",

  // ---- Aktionsmenü ---------------------------------------------------------
  'fahrzeuge.actionsFor': "Acciones para {name}",
  'fahrzeuge.action.open': "Abrir ficha del vehículo",
  'fahrzeuge.action.newOrder': "Nueva orden",

  // ---- Formular (Neues Fahrzeug) -------------------------------------------
  'fahrzeuge.form.halter': "Titular",
  'fahrzeuge.form.selectPlaceholder': "– seleccionar –",
  'fahrzeuge.form.marke': "Marca",
  'fahrzeuge.form.modell': "Modelo",
  'fahrzeuge.form.variante': "Variante",
  'fahrzeuge.form.baujahr': "Año",
  'fahrzeuge.form.farbe': "Color",
  'fahrzeuge.form.kennzeichen': "Matrícula",
  'fahrzeuge.form.kraftstoff': "Combustible",
  'fahrzeuge.form.flaeche': "Superficie (m²)",

  // ---- Kraftstoffarten -----------------------------------------------------
  'fahrzeuge.fuel.petrol': "Gasolina",
  'fahrzeuge.fuel.diesel': "Diésel",
  'fahrzeuge.fuel.electric': "Eléctrico",
  'fahrzeuge.fuel.hybrid': "Híbrido",
  'fahrzeuge.saving': "Guardando…",

  // ---- Toast / Fehler / Löschen-Bestätigung --------------------------------
  'fahrzeuge.toast.deleted': "{name} eliminado",
  'fahrzeuge.error.delete': "Error al eliminar",
  'fahrzeuge.error.save': "Error al guardar",
  'fahrzeuge.delete.title': "Eliminar vehículo",
  'fahrzeuge.delete.msg': "¿Eliminar realmente {name}? El vehículo se quita de la lista. Las órdenes y citas ya registradas se conservan.",

  // ---- Fahrzeugakte (Route "/fahrzeuge/detail") ----------------------------
  'fahrzeuge.detail.subtitle': "Ficha del vehículo",
  'fahrzeuge.detail.masterData': "Datos maestros",
  'fahrzeuge.detail.makeModel': "Marca / modelo",
  'fahrzeuge.detail.area': "Superficie",
  'fahrzeuge.detail.sqm': "{n} m²",
  'fahrzeuge.detail.toOwner': "Ir al titular",
  'fahrzeuge.detail.orderHistory': "Historial de órdenes",
  'fahrzeuge.detail.emptyOrders': "Aún no hay órdenes para este vehículo.",

  // ===========================================================================
  // BELEGE / RECHNUNGEN (Route "/rechnungen")
  // ===========================================================================
  'rechnungen.title': "Documentos",
  'rechnungen.subtitle': "Presupuestos y facturas",
  'rechnungen.searchPlaceholder': "Buscar por número o cliente…",
  'rechnungen.tab.alle': "Todos",

  // ---- Leerzustände --------------------------------------------------------
  'rechnungen.empty.none': "Aún no hay documentos. Los documentos surgen de las órdenes.",
  'rechnungen.empty.filtered': "No hay documentos en esta vista.",

  // ---- Tabellenspalten -----------------------------------------------------
  'rechnungen.col.nummer': "Número",
  'rechnungen.col.art': "Tipo",
  'rechnungen.col.kunde': "Cliente",
  'rechnungen.col.datum': "Fecha",
  'rechnungen.col.status': "Estado",
  'rechnungen.col.brutto': "Bruto",

  // ---- Art / Status --------------------------------------------------------
  'rechnungen.kind.angebot': "Presupuesto",
  'rechnungen.kind.rechnung': "Factura",
  'rechnungen.status.entwurf': "Borrador",
  'rechnungen.status.offen': "Abierta",
  'rechnungen.status.bezahlt': "Pagada",
  'rechnungen.status.storniert': "Anulada",

  // ---- Fälligkeit / Versand-Badges -----------------------------------------
  'rechnungen.overdue': "Vencida hace {tage} días",
  'rechnungen.dueIn': "vence en {tage} días",
  'rechnungen.sent': "Enviada",
  'rechnungen.sentOn': "Enviada el {datum}",

  // ---- Mahnstufen ----------------------------------------------------------
  'rechnungen.mahn.stufe1': "Recordatorio de pago",
  'rechnungen.mahn.stufe2': "1.ª reclamación",
  'rechnungen.mahn.stufe3': "2.ª reclamación",
  'rechnungen.mahn.generic': "Nivel de reclamación {stufe}",

  // ---- Zeilen-Aktionen -----------------------------------------------------
  'rechnungen.action.pdf': "Descargar PDF",
  'rechnungen.action.xrechnung': "XRechnung (XML)",
  'rechnungen.action.send': "Enviar por correo",
  'rechnungen.action.resend': "Reenviar por correo",
  'rechnungen.action.markPaid': "Marcar como pagada",
  'rechnungen.action.copyLink': "Copiar enlace de descarga",
  'rechnungen.action.mahnen': "Reclamar",
  'rechnungen.action.storno': "Anular",
  'rechnungen.action.setStatus': "Poner en «{status}»",
  'rechnungen.actionsFor': "Acciones para {nummer}",
  'rechnungen.linkPrompt': "Copiar enlace de descarga:",

  // ---- Storno-Bestätigung --------------------------------------------------
  'rechnungen.storno.title': "Anular documento",
  'rechnungen.storno.msg': "¿Anular realmente el documento {nummer}? Un documento anulado no se puede reactivar.",
  'rechnungen.storno.msgPaid': "¿Anular realmente la factura pagada {nummer}? La anulación no se puede deshacer — un abono o reembolso debe aclararse por separado si procede.",

  // ---- Toast-Meldungen -----------------------------------------------------
  'rechnungen.toast.statusUpdated': "Estado actualizado",
  'rechnungen.toast.storniert': "Documento anulado",
  'rechnungen.toast.paid': "Marcada como pagada",
  'rechnungen.toast.sent': "Documento enviado por correo",
  'rechnungen.toast.linkCopied': "Enlace de descarga copiado",
  'rechnungen.toast.mahnSent': "Reclamación enviada",

  // ---- Fehlermeldungen -----------------------------------------------------
  'rechnungen.error.statusChange': "Error al cambiar el estado",
  'rechnungen.error.pdf': "No se ha podido cargar el PDF",
  'rechnungen.error.xrechnung': "No se ha podido crear la XRechnung",
  'rechnungen.error.paid': "No se ha podido marcar como pagada",
  'rechnungen.error.send': "Error al enviar el correo",
  'rechnungen.error.link': "No se ha podido crear el enlace",
  'rechnungen.error.mahn': "Error en la reclamación",

  // ===========================================================================
  // AUFTRÄGE (Route "/auftraege")
  // ===========================================================================
  'auftraege.title': "Órdenes",

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
