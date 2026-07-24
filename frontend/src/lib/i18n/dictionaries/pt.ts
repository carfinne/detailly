// ===========================================================================
// PT – WÖRTERBUCH (Partial<Dict>) · Português
// ---------------------------------------------------------------------------
// MT-gestützte Erstübersetzung — professionelle Prüfung vor breitem Rollout empfohlen.
// Enthält die UI-Keys aus de.ts, nach Português übersetzt. Bleibt technisch
// `Partial<Dict>`: fehlende/neue Keys fallen automatisch auf DE zurück
// (siehe ../provider, t() → de[key]) — nie ein leerer String oder der rohe Key.
// Juristische Volltexte (AGB, AVV, Datenschutz, Widerrufsbelehrung, Impressum)
// liegen NICHT in diesem Wörterbuch, sondern in den jeweiligen Seiten-Komponenten
// und bleiben bewusst auf Deutsch.
//
// Platzhalter wie {name}/{year} bleiben unverändert (werden zur Laufzeit ersetzt).
// ===========================================================================

import type { Dict } from './de';

export const pt: Partial<Dict> = {
  // ---- Gemeinsame UI-Texte -------------------------------------------------
  'common.save': "Guardar",
  'common.cancel': "Cancelar",
  'common.confirm': "Confirmar",
  'common.delete': "Eliminar",
  'common.close': "Fechar",
  'common.back': "Voltar",
  'common.loading': "A carregar",
  'common.loadingEllipsis': "A carregar…",
  'common.loadingBrand': "A carregar o Detailly…",
  'common.error': "Erro",
  'common.toStart': "Para a página inicial",
  // ---- Fehler-/Leerzustaende (App-Router error/not-found Boundaries) --------
  'errorBoundary.title': "Algo correu mal",
  'errorBoundary.desc': "Ocorreu um erro inesperado. Pode tentar novamente ou recarregar a página.",
  'errorBoundary.retry': "Tentar novamente",
  'errorBoundary.reload': "Recarregar a página",
  'errorBoundary.reference': "Referência",
  'notFound.title': "Página não encontrada",
  'notFound.desc': "Esta página não existe ou foi movida. Verifique o endereço ou volte à página inicial.",
  'notFound.dashboard': "Para o painel",
  // ---- 2FA-Erzwingung (serverseitige Pflicht) ------------------------------
  'mfa.gate.title': "Autenticação de dois fatores necessária",
  'mfa.gate.desc': "A autenticação de dois fatores é obrigatória para a sua conta. Configure-a agora para continuar a utilizar o Detailly.",
  'mfa.gate.logout': "Terminar sessão",
  'common.toSubscription': "Para subscrição e plano",

  // ---- Sprachumschalter ----------------------------------------------------
  'switcher.label': "Escolher idioma",
  'switcher.current': "Idioma atual",

  // ---- Navigation: Gruppen -------------------------------------------------
  'nav.group.overview': "Visão geral",
  'nav.group.operations': "Operação",
  'nav.group.intake': "Receção e cálculo",
  'nav.group.masterdata': "Dados mestre",
  'nav.group.finance': "Finanças",
  'nav.group.material': "Material",
  'nav.group.organization': "Organização",
  'nav.group.platform': "Plataforma",

  // ---- Navigation: Einträge ------------------------------------------------
  'nav.item.dashboard': "Painel",
  'nav.item.achievements': "Conquistas",
  'nav.item.orders': "Ordens",
  'nav.item.calculation': "Cálculo",
  'nav.item.intakeQuick': "Receção (rápida)",
  'nav.item.intake3d': "Receção e peritagem (3D)",
  'nav.item.dellenkalkulation': "Cálculo de amolgadelas (PDR)",
  'nav.item.schichtdicke': "Medir espessura de camada",
  'nav.item.planboard': "Quadro de planeamento",
  'nav.item.requests': "Pedidos",
  'nav.item.customers': "Clientes",
  'nav.item.vehicles': "Veículos",
  'nav.item.services': "Serviços",
  'nav.item.invoices': "Faturas",
  'nav.item.incomingInvoices': "Receção de e-faturas",
  'nav.item.cashbook': "Livro de caixa",
  'nav.item.reminders': "Avisos de pagamento",
  'nav.item.reports': "Relatórios",
  'nav.item.accounting': "Contabilidade",
  'nav.item.shop': "Material e armazém",
  'nav.item.marketplace': "Mercado",
  'nav.item.locations': "Instalações",
  'nav.item.staff': "Pessoal",
  'nav.item.time': "Registo de tempo",
  'nav.item.showcase': "Montra",
  'nav.item.audit': "Registo de auditoria",
  'nav.item.settings': "Definições",
  'nav.item.help': "Ajuda e suporte",
  'nav.item.assistant': "Assistente de suporte",
  'nav.item.subscription': "Subscrição e plano",
  'nav.item.cockpit': "Cockpit",
  'nav.item.platformAnalytics': "Análises da plataforma",
  'nav.item.platformMarketplace': "Gestão do mercado",
  'nav.item.platformGeraetemarkt': "Moderação do mercado de usados",
  'nav.item.platformSupport': "Pedidos de suporte",
  'nav.item.platformSecurity': "Segurança",
  'nav.item.platformNewsletter': "Newsletter",
  'nav.item.subscriptions': "Subscrições",

  // ---- Einstellungen: Kalkulation (€/qm) -----------------------------------
  'settings.kalk.title': "Cálculo · €/m²",
  'settings.kalk.subtitle': "Tarifas base para o cálculo instantâneo 3D. No cálculo, cada valor permanece editável.",
  'settings.kalk.grouplabel': "Preço por metro quadrado (líquido)",
  'settings.kalk.folierung': "Envelopamento",
  'settings.kalk.ppf': "PPF / proteção de pintura",
  'settings.kalk.aufbereitung': "Detailing",
  'settings.kalk.help': "Estas tarifas são o valor predefinido no módulo 3D (área × tamanho do veículo × €/m²). Vazio ou 0 = valor padrão interno.",
  'settings.kalender.umsatzZielTitle': "Objetivo de faturação semanal",
  'settings.kalender.umsatzZielSubtitle': "Valor-alvo para a camada de faturação do quadro de planeamento, visível apenas para proprietários e gestores.",
  'settings.kalender.umsatzZielLabel': "Objetivo por semana (€ bruto)",
  'settings.kalender.umsatzZielHelp': "Deixar vazio = sem objetivo. A barra de progresso aparece no cabeçalho semanal do quadro.",

  // ---- Einstellungen: Kalender & Online-Buchung (Kalender 2.0 W2) ----------
  'settings.kalender.title': "Calendário e reserva online",
  'settings.kalender.subtitle': "Horários de trabalho por dia da semana, grelha de intervalos e antecedência para o portal de reservas público.",
  'settings.kalender.von': "das",
  'settings.kalender.bis': "às",
  'settings.kalender.slotDauer': "Duração do intervalo (minutos)",
  'settings.kalender.puffer': "Margem entre marcações (minutos)",
  'settings.kalender.vorlaufMin': "Antecedência mínima (horas)",
  'settings.kalender.vorlaufMax': "Antecedência máxima (dias)",
  'settings.kalender.hint': "Com horários de trabalho definidos, o seu portal de reservas mostra as marcações livres — os clientes escolhem entre os intervalos disponíveis em vez de escrever livremente uma data pretendida.",
  'settings.error.kalenderZeiten': "Verifique os horários: «às» tem de ser posterior a «das» nos dias ativos.",
  'settings.error.kalenderWerte': "Verifique os valores do calendário: intervalo 5–480 min, margem 0–240 min, antecedência 0–720 h ou 1–365 dias.",

  // ---- Buchungsseite: rechtlicher Abschluss-Modus (§312j BGB) ---------------
  'settings.buchung.modusTitle': "Finalização da página de reservas",
  'settings.buchung.modusSubtitle': "Define se a sua página de reservas pública é um pedido sem compromisso ou uma reserva vinculativa e paga.",
  'settings.buchung.modusLabel': "Modo",
  'settings.buchung.modusAnfrage': "Pedido de marcação sem compromisso",
  'settings.buchung.modusVerbindlich': "Reserva vinculativa e paga",
  'settings.buchung.modusHelp': "Pedido: os clientes enviam um pedido sem compromisso — ainda não se celebra qualquer contrato e o senhor confirma a marcação. Vinculativo: é celebrado online um contrato pago (botão «Reservar com pagamento», direito de livre resolução).",
  'settings.buchung.modusVerbindlichHint': "No modo vinculativo, os clientes celebram consigo online um contrato à distância pago. Verifique cuidadosamente os preços, o aviso legal e a informação sobre o direito de livre resolução — a responsabilidade é sua.",
  'settings.buchung.impressumIncomplete': "Página de reservas incompleta: faltam dados do aviso legal. Os clientes veem apenas parcialmente o prestador (parte contratante). Complete-os na secção de aviso legal abaixo.",

  // ---- Öffentliche Buchungsseite: Verbraucherrecht (UI-Chrome) --------------
  // Die eigentlichen Rechtstexte (Widerrufsbelehrung/-formular) bleiben DEUTSCH
  // und werden NICHT übersetzt – hier nur die Bedien-Elemente.
  'buchen.recht.badge.anfrage': "Pedido de marcação online",
  'buchen.recht.badge.verbindlich': "Reserva online",
  'buchen.recht.anbieter.title': "Prestador",
  'buchen.recht.anbieter.hint': "A parte contratante é a oficina indicada acima, não o Detailly.",
  'buchen.recht.pflichtinfo.title': "Resumo da sua reserva",
  'buchen.recht.pflichtinfo.leistung': "Serviço",
  'buchen.recht.pflichtinfo.keineLeistung': "Nenhum serviço selecionado",
  'buchen.recht.pflichtinfo.preis': "Preço",
  'buchen.recht.pflichtinfo.termin': "Marcação",
  'buchen.recht.pflichtinfo.keinTermin': "Nenhuma marcação selecionada",
  'buchen.recht.pflichtinfo.checkbox': "Li as informações obrigatórias e a informação sobre o direito de livre resolução.",
  'buchen.recht.pflichtinfo.checkboxError': "Confirme as informações obrigatórias e a informação sobre o direito de livre resolução.",
  'buchen.recht.widerruf.title': "Direito de livre resolução",
  'buchen.recht.widerruf.deHint': "O texto legal oficial só está disponível em alemão.",
  'buchen.recht.widerruf.belehrungLabel': "Mostrar a informação sobre o direito de livre resolução",
  'buchen.recht.widerruf.formularLabel': "Mostrar o modelo de formulário de livre resolução",
  'buchen.recht.vorzeitig.checkbox': "Solicito expressamente que a oficina inicie a execução antes de terminar o prazo de livre resolução de 14 dias. Estou ciente de que, com o cumprimento integral do contrato, perco o meu direito de livre resolução.",
  'buchen.recht.vorzeitig.error': "Aceite o início antecipado do serviço ou escolha uma marcação posterior.",
  'buchen.recht.datenschutz.hintAnfrage': "A oficina trata os seus dados para gerir o seu pedido de marcação. O responsável é o prestador indicado acima.",
  'buchen.recht.datenschutz.hintVerbindlich': "A oficina trata os seus dados para a execução do contrato. O responsável é o prestador indicado acima.",
  'buchen.recht.datenschutz.link': "Informações sobre proteção de dados",
  'buchen.recht.datenschutz.checkbox': "Tomei conhecimento das informações sobre proteção de dados.",
  'buchen.recht.verbindlich.emailRequired': "Para uma reserva vinculativa e paga, necessitamos do seu endereço de e-mail — é para aí que enviaremos a confirmação da reserva e a informação sobre o direito de livre resolução.",
  'buchen.recht.verbindlich.leistungRequired': "Para uma reserva vinculativa, selecione um serviço.",
  'buchen.recht.anfrage.hinweis': "Ainda não se celebra qualquer contrato; a oficina confirma a sua marcação.",
  'buchen.recht.anfrage.button': "Pedir sem compromisso",
  'buchen.recht.anfrage.submitting': "A enviar…",
  'buchen.recht.verbindlich.intro': "Ao clicar, celebra um contrato pago com a oficina.",
  'buchen.recht.verbindlich.button': "Reservar com pagamento",
  'buchen.recht.verbindlich.submitting': "A processar a reserva…",
  'buchen.recht.success.anfrage.title': "Pedido enviado",
  'buchen.recht.success.anfrage.text': "Obrigado! {betrieb} entrará em contacto consigo para confirmar a marcação.",
  'buchen.recht.success.verbindlich.title': "Reserva confirmada",
  'buchen.recht.success.verbindlich.text': "Obrigado pela sua reserva paga em {betrieb}. Receberá por e-mail a confirmação com a informação sobre o direito de livre resolução.",
  'buchen.recht.success.reference': "A sua referência:",

  // ---- Tarif-Hinweise (Feature-Gating) -------------------------------------
  'settings.sevdesk.upgrade': "A transferência automática para o sevDesk está disponível a partir do plano Basic.",
  'ordertime.upgrade': "Os tempos de trabalho e os custos de mão de obra estão incluídos no plano Pro.",

  // ---- Einstellungen: Seite ------------------------------------------------
  'settings.title': "Definições",
  'settings.subtitle': "Aparência, perfil e — enquanto proprietário — os dados da oficina.",
  'settings.tab.appearance': "Aparência",
  'settings.tab.profile': "Perfil",
  'settings.tab.business': "Oficina",
  'settings.tab.customerComm': "Comunicação com clientes",
  'settings.tab.goals': "Objetivos e lembretes",
  'settings.tab.audit': "Registo de auditoria",
  'settings.saving': "A guardar…",
  'settings.toast.saved': "Guardado",

  // Einstellungen: Betrieb – Sekundaer-Navigation (Unterbereiche, je eigener Speichern-Button)
  'settings.bereich.navLabel': "Áreas das definições da oficina",
  'settings.bereich.stammdaten': "Dados mestre e marca",
  'settings.bereich.steuer': "Impostos e aviso legal",
  'settings.bereich.rechnung': "Banco e faturação",
  'settings.bereich.kalender': "Cálculo e calendário",
  'settings.bereich.email': "Envio de e-mails",
  'settings.bereich.mahnwesen': "Gestão de avisos de pagamento",
  'settings.bereich.buchhaltung': "DATEV e sevDesk",
  'settings.bereich.sicherheit': "Segurança",

  // Einstellungen: Status-Mail-Vorlagen (editierbar, je Status Betreff + Text)
  'settings.statusmail.title': "Modelos de e-mails de estado",
  'settings.statusmail.subtitle': "Adapte o assunto e o texto dos e-mails de estado automáticos aos seus clientes.",
  'settings.statusmail.reviewNote': "O acionador de envio permanece inalterado: os e-mails de estado só são enviados se o interruptor de estado (comunicação com clientes) estiver ativado. Aqui apenas adapta o texto.",
  'settings.statusmail.placeholders': "Marcadores disponíveis:",
  'settings.statusmail.status.bestaetigt': "Ordem confirmada",
  'settings.statusmail.status.in_arbeit': "Ordem em curso",
  'settings.statusmail.status.abholbereit': "Veículo pronto a levantar",
  'settings.statusmail.reset': "Repor valores predefinidos",
  'settings.statusmail.subject': "Assunto",
  'settings.statusmail.subjectPlaceholder': "Deixar vazio para o assunto padrão",
  'settings.statusmail.body': "Texto",
  'settings.statusmail.bodyPlaceholder': "Deixar vazio para o texto padrão",
  'settings.statusmail.defaultHint': "Vazio = é utilizado o texto padrão comprovado.",
  'settings.statusmail.footerHint': "A saudação, a ligação para o estado da ordem e a despedida são adicionadas automaticamente — o seu texto fica no meio.",

  // Einstellungen: Benachrichtigungs-Präferenzen je Nutzer (Glocke)
  'settings.benachrichtigungen.title': "Notificações",
  'settings.benachrichtigungen.subtitle': "Que avisos devem aparecer no seu sino.",
  'settings.benachrichtigungen.intro': "Esta definição aplica-se apenas a si. Por predefinição, todos os avisos estão ativos.",
  'settings.benachrichtigungen.rechnungenFaellig': "Faturas vencidas",
  'settings.benachrichtigungen.rechnungenFaelligHint': "Aviso quando as faturas ultrapassam o prazo de pagamento.",
  'settings.benachrichtigungen.termineHeute': "Marcações de hoje",
  'settings.benachrichtigungen.termineHeuteHint': "Aviso das marcações previstas para hoje.",
  'settings.benachrichtigungen.materialKnapp': "Material escasso",
  'settings.benachrichtigungen.materialKnappHint': "Aviso quando os produtos ficam abaixo do stock mínimo.",
  'settings.benachrichtigungen.steuerTermine': "Prazos fiscais",
  'settings.benachrichtigungen.steuerTermineHint': "Lembrete dos prazos fiscais próximos que gere por conta própria.",
  'settings.benachrichtigungen.auslastung': "Ocupação",
  'settings.benachrichtigungen.auslastungHint': "Aviso quando a ocupação semanal está abaixo do seu objetivo.",
  'settings.benachrichtigungen.par19': "Limite de faturação §19",
  'settings.benachrichtigungen.par19Hint': "Aviso quando se aproxima do limite de faturação do regime de pequeno empresário.",

  // Einstellungen: Darstellung
  'settings.appearance.title': "Aparência",
  'settings.appearance.subtitle': "Como o Detailly aparece para si.",
  'settings.appearance.colorScheme': "Esquema de cores",
  'settings.appearance.dark': "Escuro",
  'settings.appearance.light': "Claro",
  'settings.appearance.deviceOnly': "Aplica-se apenas a este dispositivo e navegador.",
  'settings.motion.title': "Movimento",
  'settings.motion.subtitle': "Reduzir animações: mais calmo e suave.",
  'settings.motion.reduce': "Reduzir animações",
  'settings.motion.deviceOnly': "Esta definição aplica-se apenas a este dispositivo e navegador.",

  // Einstellungen: Profil
  'settings.profile.title': "O meu perfil",
  'settings.profile.subtitle': "Pode gerir por conta própria o seu nome e número de telefone.",
  'settings.profile.firstName': "Nome próprio",
  'settings.profile.lastName': "Apelido",
  'settings.profile.phone': "Telefone (opcional)",
  'settings.profile.email': "E-mail",
  'settings.profile.role': "Função",
  'settings.profile.emailRoleHint': "O endereço de e-mail e a função são alterados pela direção da oficina na gestão de pessoal.",

  // Einstellungen: Passwort
  'settings.password.title': "Palavra-passe",
  'settings.password.subtitle': "Altere a palavra-passe através de uma ligação segura por e-mail.",
  'settings.password.sent': "Enviámos-lhe um e-mail para a repor.",
  'settings.password.sending': "A enviar…",
  'settings.password.change': "Alterar palavra-passe",

  // Einstellungen: Kalender-Abo
  'settings.calendar.title': "Subscrição de calendário (Apple / Google)",
  'settings.calendar.subtitle': "Todas as marcações automaticamente no seu próprio calendário — através de uma ligação de subscrição secreta que se atualiza sozinha.",
  'settings.calendar.appleLabel': "Calendário Apple (webcal)",
  'settings.calendar.googleLabel': "Google / outros (https)",
  'settings.calendar.copy': "Copiar",
  'settings.calendar.copied': "Copiado ✓",
  'settings.calendar.appleName': "Calendário Apple:",
  'settings.calendar.appleHelp': " Ficheiro → «Nova subscrição de calendário…» → cole a ligação webcal.",
  'settings.calendar.googleName': "Calendário Google:",
  'settings.calendar.googleHelp': " Outros calendários → «Adicionar por URL» → cole a ligação https.",
  'settings.calendar.secretHint': "A ligação é secreta e concede acesso de leitura às marcações — partilhe-a apenas com pessoas de confiança.",
  'settings.calendar.regenerating': "A gerar…",
  'settings.calendar.regenerate': "Regenerar ligação (invalidar a anterior)",
  'settings.calendar.confirmTitle': "Regenerar ligação de calendário",
  'settings.calendar.confirmMsg': "Será gerada uma nova ligação de subscrição secreta. A ligação anterior deixará de ser válida — as subscrições de calendário existentes terão de ser reconfiguradas com a nova ligação.",
  'settings.calendar.confirmLabel': "Regenerar",

  // Einstellungen: Verwaltung (Schnellzugriffe)
  'settings.admin.title': "Administração",
  'settings.admin.subtitle': "Acesso direto às áreas da oficina.",
  'settings.admin.staffTitle': "Pessoal e funções",
  'settings.admin.staffText': "Criar a equipa, gerir funções e acessos.",
  'settings.admin.locationsTitle': "Instalações",
  'settings.admin.locationsText': "Gerir filiais e analisar entre instalações.",
  'settings.admin.servicesTitle': "Serviços e preços",
  'settings.admin.servicesText': "Gerir o seu próprio catálogo de serviços e preços.",
  'settings.admin.subscriptionTitle': "Subscrição e plano",
  'settings.admin.subscriptionText': "Consultar e gerir o seu plano Detailly.",

  // Einstellungen: Betriebstyp & Branchen-Look
  'settings.branche.title': "Tipo de oficina e estilo do setor",
  'settings.branche.subtitle': "Determina a cor de destaque, o catálogo de cálculo e as opções específicas do tipo.",
  'settings.branche.help': "O estilo (cor de destaque) muda imediatamente para todos os funcionários da oficina após guardar.",

  // Einstellungen: Dein Look (Logo & Akzentfarbe)
  'settings.branding.title': "O seu estilo: logótipo e cor",
  'settings.branding.subtitle': "Logótipo e cor de destaque para as vistas de cliente (acompanhamento da ordem, dossiê de entrega).",
  'settings.branding.logoLabel': "Logótipo",
  'settings.branding.logoPlaceholder': "Sem logótipo",
  'settings.branding.logoChoose': "Selecionar logótipo",
  'settings.branding.logoUploading': "A carregar…",
  'settings.branding.logoRemove': "Remover logótipo",
  'settings.branding.logoHelp': "PNG, JPEG ou WebP, máx. 512 KB. De preferência com fundo transparente.",
  'settings.branding.logoErrorType': "Apenas PNG, JPEG ou WebP são permitidos como logótipo.",
  'settings.branding.logoErrorSize': "O logótipo é demasiado grande (máx. 512 KB).",
  'settings.branding.logoErrorGeneric': "Não foi possível guardar o logótipo.",
  'settings.branding.logoUploaded': "Logótipo atualizado",
  'settings.branding.logoRemoved': "Logótipo removido",
  'settings.branding.logoRemoveConfirmTitle': "Remover o logótipo?",
  'settings.branding.logoRemoveConfirmMsg': "O logótipo será removido de todas as vistas de cliente. Pode carregar um novo a qualquer momento.",
  'settings.branding.accentLabel': "Cor de destaque",
  'settings.branding.accentReset': "Repor valores predefinidos",
  'settings.branding.accentPreviewButton': "Botão de exemplo",
  'settings.branding.accentHelp': "Colore o cabeçalho, os pontos de estado e os botões nas vistas de cliente. Vazio = padrão do setor.",
  'settings.branding.accentInvalid': "Indique uma cor hexadecimal válida (p. ex. #B5722F).",

  // Einstellungen: Betrieb & Anschrift
  'settings.address.title': "Oficina e morada",
  'settings.address.subtitle': "Nome e morada da oficina",
  'settings.address.name': "Nome da oficina",
  'settings.address.email': "E-mail",
  'settings.address.phone': "Telefone",
  'settings.address.street': "Rua e número",
  'settings.address.postalCode': "Código postal",
  'settings.address.city': "Localidade",
  'settings.address.country': "País",
  'settings.address.taxHintPre': "§ 14 UStG: nome, morada e número fiscal ",
  'settings.address.taxHintOr': "ou",
  'settings.address.taxHintPost': " USt-IdNr. são dados obrigatórios para faturas válidas.",

  // Einstellungen: Steuer
  'settings.tax.title': "Impostos (§ 14 UStG)",
  'settings.tax.subtitle': "O número fiscal ou o USt-IdNr. é obrigatório nas faturas.",
  'settings.tax.steuernummer': "Número fiscal",
  'settings.tax.steuernummerPlaceholder': "p. ex. 12/345/67890",
  'settings.tax.ustId': "USt-IdNr.",
  'settings.tax.ustIdPlaceholder': "p. ex. DE123456789",
  // §19 UStG (Kleinunternehmer) + Rechtsform
  'settings.steuer.kleinunternehmer': "Pequeno empresário (§ 19 UStG)",
  'settings.steuer.kleinunternehmerHint': "Não cobrar IVA. Os novos documentos são criados automaticamente com 0 %.",
  'settings.steuer.hinweisLabel': "Texto de aviso nos documentos",
  'settings.steuer.hinweisHelp': "Aparece em faturas/orçamentos. Deixe vazio para o texto padrão.",
  'settings.steuer.standardSatz': "Taxa de IVA padrão para novos documentos",
  'settings.steuer.standardSatzHelp': "Pré-seleção ao criar novos documentos. Continua editável por documento (19 / 7 / 0 %).",
  'settings.steuer.rechtsform': "Forma jurídica",
  'settings.steuer.rechtsform.einzelunternehmen': "Empresário em nome individual",
  'settings.steuer.rechtsform.gbr': "GbR",
  'settings.steuer.rechtsform.ug': "UG (haftungsbeschränkt)",
  'settings.steuer.rechtsform.gmbh': "GmbH",
  'settings.steuer.rechtsform.ohg': "OHG",
  'settings.steuer.rechtsform.kg': "KG",
  'settings.steuer.rechtsform.gmbh_co_kg': "GmbH & Co. KG",
  'settings.steuer.rechtsform.freiberufler': "Profissional liberal",
  'settings.steuer.rechtsform.sonstige': "Outra",
  'settings.steuer.registergericht': "Tribunal de registo",
  'settings.steuer.registergerichtPlaceholder': "p. ex. Amtsgericht Charlottenburg",
  'settings.steuer.registernummer': "Número de registo",
  'settings.steuer.registernummerPlaceholder': "p. ex. HRB 123456",
  'settings.steuer.vertretung': "Representantes legais",
  'settings.steuer.vertretungPlaceholder': "p. ex. Max Mustermann (gerente)",
  'settings.steuer.infoLinkPre': "Não sabe o que se aplica ao seu caso? ",
  'settings.steuer.infoLink': "Informações sobre pequeno empresário e forma jurídica",
  'settings.steuer.infoLinkPost': " (não é aconselhamento fiscal).",

  // ---- Einstellungen: Ziele & Erinnerungen (Tab, nur Inhaber) --------------
  'settings.ziele.intro.title': "Objetivos e lembretes",
  'settings.ziele.intro.subtitle': "Prazos fiscais e avisos — como notificações discretas no sino. Nada é enviado para o exterior.",
  // Auslastungsziel
  'settings.ziele.auslastung.title': "Objetivo de ocupação",
  'settings.ziele.auslastung.subtitle': "Valor-alvo para a ocupação da capacidade da sua oficina.",
  'settings.ziele.auslastung.toggle': "Ativar objetivo de ocupação",
  'settings.ziele.auslastung.toggleHint': "Mostra um aviso no sino quando a sua ocupação semanal está abaixo do objetivo.",
  'settings.ziele.auslastung.prozentLabel': "Ocupação-alvo (%)",
  'settings.ziele.auslastung.prozentHelp': "Entre 50 e 100 %. Padrão: 90 %.",
  // §19-Umsatzgrenzen-Warnung
  'settings.ziele.par19.title': "Aviso de limite de faturação (§ 19 UStG)",
  'settings.ziele.par19.subtitle': "Aviso antecipado antes de atingir o limite de pequeno empresário.",
  'settings.ziele.par19.toggle': "Avisar antes de atingir o limite de faturação",
  'settings.ziele.par19.toggleHint': "Usa o estado §19 existente (100 000 €/ano) — aparece como aviso no sino.",
  'settings.ziele.par19.disabledHint': "Disponível apenas se o regime de pequeno empresário (§ 19 UStG) estiver ativo no separador «Oficina».",
  // Steuer-Termine
  'settings.ziele.termine.title': "Prazos fiscais",
  'settings.ziele.termine.subtitle': "Prazos próprios de que o sino o lembra a tempo (14 dias antes).",
  'settings.ziele.termine.artLabel': "Tipo",
  'settings.ziele.termine.artPlaceholder': "p. ex. declaração periódica de IVA",
  'settings.ziele.termine.datumLabel': "Data",
  'settings.ziele.termine.datumPlaceholderRec': "01-10 (MM-DD)",
  'settings.ziele.termine.datumPlaceholderOnce': "2026-06-30 (AAAA-MM-DD)",
  'settings.ziele.termine.datumHelp': "Recorrente: MM-DD (p. ex. 01-10). Pontual: AAAA-MM-DD.",
  'settings.ziele.termine.wiederkehrend': "Anual",
  'settings.ziele.termine.aktiv': "Ativo",
  'settings.ziele.termine.remove': "Remover",
  'settings.ziele.termine.add': "Adicionar prazo",
  'settings.ziele.termine.empty': "Ainda não há prazos criados.",
  'settings.ziele.termine.max': "No máximo 12 prazos.",
  'settings.ziele.termine.disclaimer': "Lembretes sem compromisso, não é aconselhamento fiscal.",
  'settings.ziele.error.datum': "Indique uma data válida — recorrente MM-DD, pontual AAAA-MM-DD.",

  // Impressum-Generator (§ 5 DDG) – Betrieb-Tab. Pflichtangaben stammen aus den
  // Feldern oben (Adresse/Steuer). Inhalte selbst sind Betriebsdaten (nicht übersetzt).
  'settings.impressum.title': "Aviso legal",
  'settings.impressum.subtitle': "Dados obrigatórios nos termos do § 5 DDG para as suas páginas públicas (reserva, estado, documento).",
  'settings.impressum.disclaimer': "Gerador automático, não é aconselhamento jurídico: o Detailly gera o aviso legal a partir dos seus dados mestre. Enquanto oficina, é responsável pela sua exatidão e integralidade.",
  'settings.impressum.vertretung.inhaber': "Proprietário/a (nome e apelido)",
  'settings.impressum.vertretung.gbr': "Sócios (todos identificados)",
  'settings.impressum.vertretung.vertreter': "Representante(s) legal(is)",
  'settings.impressum.vertretungPlaceholder': "p. ex. Max Mustermann",
  'settings.impressum.vertretungHelp': "Aparece no aviso legal como pessoa responsável. Se houver várias, indique todas.",
  'settings.impressum.complete': "Aviso legal completo — todos os dados obrigatórios estão preenchidos.",
  'settings.impressum.ustWarn': "Recomendação: adicione o USt-IdNr. (§ 27a UStG) assim que o tiver.",
  'settings.impressum.incomplete': "Faltam estes dados para um aviso legal completo:",
  'settings.impressum.incompleteHint': "Um aviso legal incompleto pode ser alvo de notificação judicial. Os campos em falta preenchem-se nas secções acima (morada, impostos/forma jurídica).",
  'settings.impressum.feld.firmenname': "Firma",
  'settings.impressum.feld.strasse': "Rua e número",
  'settings.impressum.feld.plz': "Código postal",
  'settings.impressum.feld.ort': "Localidade",
  'settings.impressum.feld.telefon': "Número de telefone",
  'settings.impressum.feld.email': "Endereço de e-mail",
  'settings.impressum.feld.vertretungsberechtigte': "Pessoa responsável (proprietário/gerente/sócio)",
  'settings.impressum.feld.registergericht': "Tribunal de registo",
  'settings.impressum.feld.registernummer': "Número de registo (HRB)",
  'settings.impressum.previewTitle': "Pré-visualização",
  'settings.impressum.previewHeading': "Dados nos termos do § 5 DDG",
  'settings.impressum.placeholderName': "[Firma em falta]",
  'settings.impressum.previewPhone': "Telefone",
  'settings.impressum.previewEmail': "E-mail",
  'settings.impressum.previewRegister': "Tribunal de registo",
  'settings.impressum.previewUstId': "USt-IdNr.",
  'settings.impressum.viewLive': "Abrir vista pública",
  'settings.impressum.optionalTitle': "Dados adicionais opcionais",
  'settings.impressum.optionalHint': "Necessários apenas para certas oficinas — para detailing/envelopamento/PPF normalmente não são relevantes.",
  'settings.impressum.berufshaftpflicht': "Seguro de responsabilidade civil profissional",
  'settings.impressum.berufshaftpflichtPlaceholder': "p. ex. seguradora, morada, âmbito territorial",
  'settings.impressum.aufsichtsbehoerde': "Autoridade de supervisão",
  'settings.impressum.aufsichtsbehoerdePlaceholder': "apenas para atividades sujeitas a autorização",

  // Einstellungen: Auf detailly.de zeigen (Opt-in Mitgliederliste)
  'settings.mitglied.title': "Mostrar em detailly.de",
  'settings.mitglied.subtitle': "Listar a sua oficina como referência na nossa página inicial — voluntário e revogável a qualquer momento.",
  'settings.mitglied.toggle': "Mostrar na página inicial do Detailly",
  'settings.mitglied.toggleHint': "Apenas com o seu consentimento. São mostrados a firma, o tipo de oficina e, opcionalmente, cidade, breve descrição e site — nunca dados de contacto.",
  'settings.mitglied.stadt': "Cidade (opcional)",
  'settings.mitglied.stadtPlaceholder': "p. ex. Berlim",
  'settings.mitglied.kurzbeschreibung': "Breve descrição (opcional)",
  'settings.mitglied.kurzbeschreibungPlaceholder': "p. ex. Detailing e envelopamento premium desde 2015",
  'settings.mitglied.kurzbeschreibungHelp': "Máx. 160 caracteres.",
  'settings.mitglied.webseite': "Site (opcional)",
  'settings.mitglied.webseitePlaceholder': "https://a-sua-oficina.pt",
  'settings.mitglied.webseiteHelp': "Tem de começar por http:// ou https://.",
  'settings.mitglied.previewLabel': "Pré-visualização",
  'settings.mitglied.consent': "A sua oficina só aparece na nossa página inicial com o seu consentimento; revogável a qualquer momento.",

  // Einstellungen: Bankverbindung
  'settings.bank.title': "Dados bancários",
  'settings.bank.subtitle': "Aparece no rodapé da fatura.",
  'settings.bank.bankname': "Banco",
  'settings.bank.iban': "IBAN",
  'settings.bank.bic': "BIC",

  // Einstellungen: Rechnungsstellung
  'settings.invoice.title': "Faturação",
  'settings.invoice.subtitle': "Valores predefinidos para novas faturas — os documentos existentes permanecem inalterados.",
  'settings.invoice.paymentTerm': "Prazo de pagamento (dias)",
  'settings.invoice.paymentTermHelp': "Deixar vazio = 14 dias.",
  'settings.invoice.paymentLink': "Ligação de pagamento",
  'settings.invoice.paymentLinkPlaceholder': "https://paypal.me/a-sua-oficina",
  'settings.invoice.paymentLinkHelp': "A sua própria ligação de pagamento PayPal.me ou Stripe. Aparece como botão «Pagar online» na página pública do documento — os pagamentos vão diretamente para si, nunca através do Detailly. Tem de começar por https://.",
  'settings.invoice.footer': "Texto de rodapé nos documentos",
  'settings.invoice.footerPlaceholder': "p. ex. Obrigado pela sua encomenda! Aplicam-se as nossas condições gerais.",
  'settings.invoice.footerHelp': "Aparece no rodapé dos PDF de orçamentos e faturas.",

  // Einstellungen: Mahnwesen
  'settings.mahn.title': "Gestão de avisos de pagamento",
  'settings.mahn.subtitle': "Prazos e taxas para lembretes de pagamento e avisos.",
  'settings.mahn.auto': "Avisar automaticamente",
  'settings.mahn.autoHint': "Avisos automáticos — caso contrário, avisa manualmente no cockpit de avisos.",
  'settings.mahn.deadlines': "Prazos (dias após vencimento)",
  'settings.mahn.reminder': "Lembrete",
  'settings.mahn.dunning1': "1.º aviso",
  'settings.mahn.dunning2': "2.º aviso",
  'settings.mahn.deadlinesHelp': "Estritamente crescente: lembrete < 1.º aviso < 2.º aviso (cada um 1–365 dias).",
  'settings.mahn.fees': "Taxas de aviso (€)",
  'settings.mahn.feesHelp': "De 0 a 999 € por nível. Aparece como posição adicional no aviso.",

  // Einstellungen: Kunden-Benachrichtigungen
  'settings.notify.title': "Notificações a clientes",
  'settings.notify.subtitle': "E-mails automáticos a clientes — desativáveis a qualquer momento.",
  'settings.notify.status': "E-mails de estado da ordem",
  'settings.notify.statusHint': "Os clientes com endereço de e-mail recebem automaticamente uma mensagem com ligação ao acompanhamento da ordem nas mudanças de estado importantes.",
  'settings.notify.appointment': "Confirmação de marcação",
  'settings.notify.appointmentHint': "Os clientes recebem um e-mail de confirmação quando o seu pedido de marcação online é aceite.",

  // Einstellungen: Kundenkommunikation (Termin-Erinnerung, Bewertungs-Bitte, Status-Mails)
  'settings.kk.intro.title': "Comunicação com clientes",
  'settings.kk.intro.subtitle': "E-mails automáticos aos seus clientes: lembretes, pedido de avaliação e informações de estado.",
  'settings.kk.reviewNote': "Nada sai sem querer: os e-mails automáticos a clientes só são enviados quando ativa conscientemente o respetivo interruptor. Tudo aqui é desativável a qualquer momento.",
  'settings.kk.reminder.title': "Lembrete de marcação",
  'settings.kk.reminder.subtitle': "Lembra automaticamente a marcação próxima aos clientes com endereço de e-mail.",
  'settings.kk.reminder.toggle': "Enviar lembrete de marcação",
  'settings.kk.reminder.toggleHint': "Os clientes recebem um lembrete amável antes da marcação — cada lembrete é enviado apenas uma vez.",
  'settings.kk.reminder.hoursLabel': "Antecedência (horas antes)",
  'settings.kk.reminder.hoursHelp': "Quantas horas antes do início da marcação o lembrete é enviado (1–168, padrão 24).",
  'settings.kk.review.title': "Pedido de avaliação",
  'settings.kk.review.subtitle': "Anexa uma ligação de avaliação ao e-mail «Veículo pronto a levantar» — apenas se estiver ativo e houver uma ligação definida.",
  'settings.kk.review.toggle': "Pedir uma avaliação",
  'settings.kk.review.toggleHint': "Adiciona ao e-mail de conclusão uma ligação para a sua avaliação Google.",
  'settings.kk.review.urlLabel': "Ligação de avaliação Google",
  'settings.kk.review.urlHelp': "Tem de começar por https://. O mais fácil é através do seu perfil de empresa Google («Escrever avaliação»).",
  'settings.kk.review.urlPlaceholder': "https://g.page/r/...",
  'settings.kk.review.textLabel': "Texto de convite próprio (opcional)",
  'settings.kk.review.textHelp': "Deixe vazio para o texto padrão.",
  'settings.kk.review.textPlaceholder': "Ficou satisfeito? Uma breve avaliação deixar-nos-ia muito contentes:",
  'settings.kk.error.url': "A ligação de avaliação tem de começar por https://.",

  // Einstellungen: Sicherheit (2FA-Pflicht, Owner-Policy)
  'settings.security.title': "Segurança",
  'settings.security.subtitle': "Autenticação de dois fatores para a sua equipa.",
  'settings.security.mfaRequired': "2FA obrigatória para funcionários",
  'settings.security.mfaRequiredHint': "Todas as funções da oficina têm de configurar a autenticação de dois fatores antes de poderem continuar a trabalhar.",

  // Zwei-Faktor-Authentifizierung (Profil-Sektion + Banner)
  'mfa.title': "Autenticação de dois fatores",
  'mfa.subtitle': "Proteção adicional da sua conta com uma aplicação de autenticação.",
  'mfa.idle.desc': "Com a autenticação de dois fatores ativa, ao iniciar sessão necessita ainda de um código único da sua aplicação de autenticação.",
  'mfa.idle.setupCta': "Configurar 2FA",
  'mfa.required.note': "A sua oficina exige a autenticação de dois fatores. Configure-a agora.",
  'mfa.recommended.note': "Para a sua função, a autenticação de dois fatores é fortemente recomendada.",
  'mfa.setup.step1': "Digitalizar com a aplicação de autenticação",
  'mfa.setup.step2': "Não consegue digitalizar? Introduza esta chave manualmente na aplicação.",
  'mfa.setup.secretLabel': "Chave de configuração",
  'mfa.setup.copySecret': "Copiar",
  'mfa.setup.secretCopied': "Copiado",
  'mfa.setup.codeLabel': "Código da aplicação",
  'mfa.setup.codeHint': "Introduza o código de 6 dígitos atualmente apresentado para concluir a configuração.",
  'mfa.setup.activate': "Ativar",
  'mfa.setup.cancel': "Cancelar",
  'mfa.recovery.title': "Códigos de recuperação",
  'mfa.recovery.desc': "Guarde estes códigos num local seguro — cada um funciona apenas uma vez.",
  'mfa.recovery.warn': "Estes códigos só são apresentados agora. Sem a aplicação de autenticação são o seu único acesso — guarde-os ou imprima-os num local seguro.",
  'mfa.recovery.copy': "Copiar todos",
  'mfa.recovery.copied': "Copiado",
  'mfa.recovery.download': "Guardar como ficheiro",
  'mfa.recovery.done': "Já os guardei",
  'mfa.enabled.status': "A autenticação de dois fatores está ativa.",
  'mfa.enabled.deactivate': "Desativar 2FA",
  'mfa.deact.title': "Para desativar, introduza um código atual da aplicação ou a sua palavra-passe.",
  'mfa.deact.codeLabel': "Código da aplicação",
  'mfa.deact.passwordLabel': "Palavra-passe",
  'mfa.deact.usePassword': "Usar a palavra-passe em alternativa",
  'mfa.deact.useCode': "Usar o código da aplicação em alternativa",
  'mfa.deact.confirm': "Desativar",
  'mfa.deact.cancel': "Cancelar",
  'mfa.toast.activated': "Autenticação de dois fatores ativada.",
  'mfa.toast.deactivated': "Autenticação de dois fatores desativada.",
  'mfa.error.generic': "A ação falhou. Tente novamente.",
  'mfa.banner.required': "A sua oficina exige a autenticação de dois fatores. Configure-a agora.",
  'mfa.banner.recommended': "Para a sua função, a autenticação de dois fatores é fortemente recomendada.",
  'mfa.banner.setupCta': "Configurar agora",

  // Einstellungen: Mail-Versand
  'settings.mail.title': "Envio de e-mail (remetente próprio)",
  'settings.mail.subtitle': "Opcional: enviar e-mails a clientes e de documentos através do seu próprio servidor SMTP e remetente.",
  'settings.mail.useOwn': "Usar remetente próprio",
  'settings.mail.useOwnHint': "Sem uma configuração ativa, o Detailly continua a enviar a partir do endereço padrão.",
  'settings.mail.host': "Host SMTP",
  'settings.mail.hostPlaceholder': "p. ex. smtp.o-seu-fornecedor.pt",
  'settings.mail.port': "Porta",
  'settings.mail.encryption': "Encriptação",
  'settings.mail.user': "Utilizador",
  'settings.mail.userPlaceholder': "Nome de acesso ao servidor de e-mail",
  'settings.mail.password': "Palavra-passe",
  'settings.mail.passwordPlaceholder': "Introduza a palavra-passe SMTP",
  'settings.mail.passwordPlaceholderSet': "Definida ({hint}) – para alterar, introduza uma nova palavra-passe",
  'settings.mail.passwordHelp': "Deixar vazio = inalterada. Guardada de forma encriptada e nunca mais apresentada.",
  'settings.mail.fromEmail': "Endereço do remetente (From)",
  'settings.mail.fromEmailPlaceholder': "fatura@a-sua-oficina.pt",
  'settings.mail.fromName': "Nome do remetente",
  'settings.mail.fromNamePlaceholder': "p. ex. o nome da sua oficina",
  'settings.mail.testInfoPre': "O e-mail de teste é enviado para o endereço de remetente definido e verifica a ",
  'settings.mail.testInfoEmph': "última guardada",
  'settings.mail.testInfoPost': " configuração. Guarde primeiro as alterações e depois teste.",
  'settings.mail.testTitleOn': "Envia um e-mail de teste para o endereço do remetente",
  'settings.mail.testTitleOff': "Ative e guarde primeiro «Usar remetente próprio»",
  'settings.mail.sending': "A enviar…",
  'settings.mail.testSend': "Enviar e-mail de teste",
  'settings.mail.confirmMsgPre': "Será enviado um e-mail de teste para o endereço de remetente definido",
  'settings.mail.confirmMsgPost': ". É verificada a última configuração SMTP guardada.",

  // Einstellungen: Eigene Domain & Zustellbarkeit (SPF/DKIM/MX)
  'settings.maildomain.domain': "Domínio próprio",
  'settings.maildomain.domainPlaceholder': "p. ex. a-sua-oficina.pt",
  'settings.maildomain.domainHelp': "O domínio do seu endereço de remetente. Só depois de guardar poderá ver os registos DNS e verificar o domínio.",
  'settings.maildomain.title': "Verificar a entregabilidade",
  'settings.maildomain.badgeVerified': "Domínio verificado",
  'settings.maildomain.badgeUnverified': "Não verificado",
  'settings.maildomain.spamHint': "Sem um domínio verificado (SPF e DKIM), os seus e-mails caem muitas vezes no spam do destinatário. Introduza os registos DNS abaixo no seu fornecedor de domínio e depois verifique.",
  'settings.maildomain.showRecords': "Mostrar registos DNS",
  'settings.maildomain.hideRecords': "Ocultar registos DNS",
  'settings.maildomain.record.spf': "Registo SPF",
  'settings.maildomain.record.dkim': "Registo DKIM",
  'settings.maildomain.recordType': "Tipo",
  'settings.maildomain.recordHost': "Nome / host",
  'settings.maildomain.recordValue': "Valor",
  'settings.maildomain.recordsHint': "No registo SPF, substitua «O-SEU-FORNECEDOR-DE-EMAIL» pelo include SPF do seu fornecedor de e-mail (consulte a respetiva documentação). O valor DKIM deve ser introduzido exatamente assim; alguns fornecedores dividem-no automaticamente.",
  'settings.maildomain.copy': "Copiar",
  'settings.maildomain.copied': "Copiado",
  'settings.maildomain.verify': "Verificar domínio",
  'settings.maildomain.verifying': "A verificar…",
  'settings.maildomain.verifyTitle': "Verifica os registos DNS (SPF, DKIM, MX) em tempo real",
  'settings.maildomain.verifyFailed': "Falha na verificação",
  'settings.maildomain.verifiedToast': "Domínio verificado com sucesso – os e-mails são agora assinados com DKIM.",
  'settings.maildomain.lastChecked': "Última verificação: {date}",
  'settings.maildomain.check.spf': "SPF",
  'settings.maildomain.check.dkim': "DKIM",
  'settings.maildomain.check.mx': "MX",
  'settings.maildomain.setDomainFirst': "Introduza acima um domínio e guarde para ver os registos DNS e verificar a entregabilidade.",

  // Einstellungen: DATEV / Buchhaltung
  'settings.datev.title': "DATEV / contabilidade",
  'settings.datev.subtitle': "Para a exportação do lote de lançamentos DATEV. Número de consultor/cliente do contabilista; contas pré-preenchidas com os valores padrão do SKR03.",
  'settings.datev.beraterNr': "N.º de consultor",
  'settings.datev.beraterNrPlaceholder': "p. ex. 1001",
  'settings.datev.mandantNr': "N.º de cliente",
  'settings.datev.mandantNrPlaceholder': "p. ex. 456",
  'settings.datev.skr': "Plano de contas (SKR)",
  'settings.datev.debitor': "Conta coletiva de clientes",
  'settings.datev.erloes19': "Conta de proveitos 19 %",
  'settings.datev.erloes7': "Conta de proveitos 7 %",
  'settings.datev.erloes0': "Conta de proveitos isenta / §19",
  'settings.datev.help': "Nota: antes da primeira importação DATEV real, confirme com o contabilista ou com o programa gratuito de verificação da DATEV.",

  // Einstellungen: sevDesk-Anbindung
  'settings.sevdesk.title': "Ligação sevDesk",
  'settings.sevdesk.subtitle': "Opcional: transferir automaticamente as faturas emitidas para a sua conta sevDesk.",
  'settings.sevdesk.apiToken': "Token de API",
  'settings.sevdesk.tokenPlaceholder': "Colar o token de API do sevDesk",
  'settings.sevdesk.tokenPlaceholderSet': "Definido ({hint}) – para alterar, introduza um novo token",
  'settings.sevdesk.help': "Encontra-se no sevDesk em Definições → Utilizador → Token de API. Guardado de forma encriptada e nunca mais apresentado.",
  'settings.sevdesk.testTitle': "Testa o token guardado",
  'settings.sevdesk.testing': "A testar…",
  'settings.sevdesk.test': "Testar ligação",
  'settings.sevdesk.remove': "Remover token",

  // Einstellungen: Fehler / Validierung
  'settings.error.saveFailed': "Falha ao guardar",
  'settings.error.loadFailed': "Não foi possível carregar os dados mestre",
  'settings.error.testFailed': "Falha no teste",
  'settings.error.removeFailed': "Falha ao remover",
  'settings.error.mahnDaysRange': "Os prazos de aviso têm de ser números inteiros entre 1 e 365 dias.",
  'settings.error.mahnDaysOrder': "Os prazos de aviso têm de ser crescentes (lembrete < 1.º aviso < 2.º aviso).",
  'settings.error.mailHostRequired': "Para o envio de e-mail próprio é necessário um host SMTP.",
  'settings.error.mailPortRange': "A porta SMTP tem de estar entre 1 e 65535.",
  'settings.error.mailFromInvalid': "Indique um endereço de remetente (From) válido.",
  'settings.error.mailDomainMismatch': "O endereço de remetente tem de pertencer ao domínio registado.",
  'settings.error.mitgliedWebseite': "O site tem de começar por http:// ou https://.",

  // ---- Login ---------------------------------------------------------------
  'login.subtitle': "Detailing Suite — detailing, envelopamento & PPF",
  'login.email': "E-mail",
  'login.password': "Palavra-passe",
  'login.forgot': "Esqueceu-se da palavra-passe?",
  'login.showPassword': "Mostrar palavra-passe",
  'login.hidePassword': "Ocultar palavra-passe",
  'login.submit': "Iniciar sessão",
  'login.submitting': "A iniciar sessão…",
  'login.failed': "Falha ao iniciar sessão",
  'login.noAccount': "Ainda não tem conta?",
  'login.registerCta': "Registar oficina",
  'login.footer': "© {year} Detailly · Software de detailing independente",
  // Login: zweite Stufe (2FA)
  'login.mfaSubtitle': "Confirmação de dois fatores",
  'login.mfaHint': "Introduza o código de 6 dígitos da sua aplicação de autenticação.",
  'login.mfaCode': "Código de confirmação",
  'login.mfaSubmit': "Confirmar e iniciar sessão",
  'login.mfaVerifying': "A verificar…",
  'login.mfaUseRecovery': "Usar código de recuperação",
  'login.mfaUseCode': "Voltar ao código da aplicação",
  'login.mfaRecovery': "Código de recuperação",
  'login.mfaRecoveryHint': "Um dos códigos de uso único que guardou durante a configuração.",
  'login.mfaBack': "Cancelar",
  'login.mfaFailed': "Código inválido ou expirado",

  // ===========================================================================
  // LANDING (Route "/")
  // ===========================================================================

  // ---- Kopfleiste ----------------------------------------------------------
  'landing.nav.branchen': "Setores",
  'landing.nav.ablauf': "Como funciona",
  'landing.nav.funktionen': "Funções",
  'landing.nav.faq': "Perguntas frequentes",
  'landing.nav.login': "Iniciar sessão",
  'landing.nav.trial': "Testar gratuitamente",

  // ---- Hero ----------------------------------------------------------------
  'landing.hero.badge': "O software de oficina para detailing, envelopamento & PPF",
  'landing.hero.eyebrow': "Software de oficina · Detailing / Envelopamento / PPF",
  'landing.hero.headlinePre': "Mais tempo ",
  'landing.hero.headlineEm': "no veículo",
  'landing.hero.headlinePost': ". Menos tempo no escritório.",
  'landing.hero.title1': "O seu ofício é a precisão.",
  'landing.hero.title2': "Agora o seu software também.",
  'landing.hero.sub': "Receção com registo de danos em 3D e assinatura em quatro minutos — ordem de serviço, fatura e aviso seguem automaticamente.",
  'landing.hero.ctaPrimary': "Testar 14 dias grátis",
  'landing.hero.ctaSecondary': "Ver funções",
  'landing.hero.trailer': "Sem cartão de crédito · Pronto em minutos · Cancelável mensalmente",

  // ---- Signature A: µm-Schichtdicken-Readout -------------------------------
  'landing.messwert.label': "Espessura de camada",
  'landing.messwert.unit': "µm",
  'landing.messwert.measuring': "a medir …",
  'landing.messwert.status': "dentro da tolerância",
  'landing.messwert.surface': "Superfície pintada · Capô",
  'landing.messwert.caption': "Na receção conta o valor medido, não a afirmação. É assim que o Detailly trabalha: documentado e comprovável. (A medição da espessura de camada faz parte da ferramenta de receção, não do Detailly.)",
  'landing.messwert.aria': "Medição da espessura de camada: valor dentro do intervalo de tolerância, fixado a verde.",

  // ---- Funktionen als Datenblatt (Label ↔ Fakt) ----------------------------
  'landing.datenblatt.kicker': "Ficha técnica",
  'landing.datenblatt.title': "O que inclui — como factos, não como promessas.",
  'landing.datenblatt.sub': "Cada linha é uma função que hoje está no produto.",
  'landing.datenblatt.footnote': "Além disso: pesquisa global, utilização móvel e vários funcionários por oficina.",
  'landing.datenblatt.kunden.label': "Clientes & veículos",
  'landing.datenblatt.kunden.fact': "Ficha do veículo · histórico completo",
  'landing.datenblatt.auftraege.label': "Ordens & quadro de planeamento",
  'landing.datenblatt.auftraege.fact': "Planeamento semanal · marcações · progresso",
  'landing.datenblatt.schaden.label': "Registo de danos",
  'landing.datenblatt.schaden.fact': "Modelo 3D · foto · assinatura",
  'landing.datenblatt.rechnung.label': "Faturas",
  'landing.datenblatt.rechnung.fact': "GoBD §14 · XRechnung · ZUGFeRD",
  'landing.datenblatt.zahlung.label': "Pagamentos",
  'landing.datenblatt.zahlung.fact': "Vencimentos · avisos",
  'landing.datenblatt.kasse.label': "Livro de caixa",
  'landing.datenblatt.kasse.fact': "Conforme GoBD · ao dia",
  'landing.datenblatt.kalkulation.label': "Cálculo",
  'landing.datenblatt.kalkulation.fact': "por ofício · detailing / envelopamento / PPF",
  'landing.datenblatt.datenschutz.label': "Proteção de dados",
  'landing.datenblatt.datenschutz.fact': "RGPD · encriptado · separado por oficina",
  'landing.datenblatt.sprachen.label': "Idiomas",
  'landing.datenblatt.sprachen.fact': "4 · DE / EN / RU / PL",
  'landing.datenblatt.zugriff.label': "Acesso",
  'landing.datenblatt.zugriff.fact': "Navegador · tablet · smartphone",
  'landing.datenblatt.dellen.label': "Cálculo de amolgadelas",
  'landing.datenblatt.dellen.fact': "Smart Repair / PDR · preço imediato",
  'landing.datenblatt.buchhaltung.label': "Contabilidade",
  'landing.datenblatt.buchhaltung.fact': "DATEV · sevDesk · CSV",
  'landing.datenblatt.shop.label': "Loja e marketplace",
  'landing.datenblatt.shop.fact': "Compra B2B · biblioteca de películas",

  // ---- Vertrauens-Leiste ---------------------------------------------------
  'landing.trust.dsgvo': "Conforme ao RGPD",
  'landing.trust.gobd': "Faturas conformes GoBD",
  'landing.trust.madeInGermany': "Made in Germany",
  'landing.trust.encrypted': "Dados encriptados",
  'landing.trust.noInstall': "Sem instalação",

  // ---- Problem -------------------------------------------------------------
  'landing.problem.kicker': "Conhece isto?",
  'landing.problem.title': "A oficina funciona — a administração trava.",
  'landing.problem.sub': "Enquanto o trabalho no veículo exige precisão, tudo o resto afunda-se na papelada.",
  'landing.problem.p1': "O histórico do veículo está espalhado por pastas, papéis e na cabeça.",
  'landing.problem.p2': "As faturas ficam por emitir — e custam-lhe dinheiro vivo.",
  'landing.problem.p3': "Os danos na receção dificilmente se conseguem comprovar mais tarde.",
  'landing.problem.p4': "Cinco ferramentas diferentes que não falam entre si.",
  'landing.problem.summaryPre': "O Detailly reúne tudo isso num ",
  'landing.problem.summaryEm': "só",
  'landing.problem.summaryPost': " sistema — claro, rápido e em qualquer dispositivo.",

  // ---- Branchen-Switcher ---------------------------------------------------
  'landing.branchen.kicker': "Feito para o seu ofício",
  'landing.branchen.title': "Um software que fala a língua do seu ofício",
  'landing.branchen.sub': "No início escolhe a sua especialidade — o Detailly ajusta o catálogo de serviços, o cálculo e até o aspeto. Experimente: escolha o seu ofício e veja a página mudar de cor.",
  'landing.branchen.selected': "Selecionado",
  'landing.branchen.cta': "Começar como {label}",
  'landing.branchen.complete': "Tudo de um só fornecedor?",
  'landing.branchen.completeCta': "Começar como fornecedor completo",
  'landing.branchen.aufbereitung.l1': "Detailing interior & exterior",
  'landing.branchen.aufbereitung.l2': "Polimento & selante cerâmico",
  'landing.branchen.aufbereitung.l3': "Verificações de devolução de leasing",
  'landing.branchen.folierung.l1': "Envelopamento total & parcial",
  'landing.branchen.folierung.l2': "Mudança de cor & design",
  'landing.branchen.folierung.l3': "Lettering publicitário",
  'landing.branchen.ppf.l1': "Proteção frontal & integral",
  'landing.branchen.ppf.l2': "Pacotes de proteção contra gravilha",
  'landing.branchen.ppf.l3': "Cortes precisos",

  // ---- So funktioniert's ---------------------------------------------------
  'landing.ablauf.kicker': "É assim tão simples",
  'landing.ablauf.title': "Em três passos para um fluxo limpo",
  'landing.ablauf.step1.title': "Rececionar",
  'landing.ablauf.step1.desc': "Cliente, veículo e danos registados em minutos — com marcação 3D, fotos e assinatura digital.",
  'landing.ablauf.step2.title': "Tratar",
  'landing.ablauf.step2.desc': "Calcular serviços, planear marcações no quadro e manter o progresso sempre à vista.",
  'landing.ablauf.step3.title': "Faturar",
  'landing.ablauf.step3.desc': "Da ordem sai com um clique a fatura conforme GoBD em PDF — incluindo vencimentos e avisos.",

  // ---- Funktionen ----------------------------------------------------------
  'landing.funktionen.kicker': "Todas as ferramentas",
  'landing.funktionen.title': "Tudo o que a sua oficina precisa",
  'landing.funktionen.sub': "Um fluxo contínuo — da receção do veículo à fatura paga.",
  'landing.funktionen.kunden.title': "Clientes & veículos",
  'landing.funktionen.kunden.desc': "Dados mestre, ficha do veículo e histórico completo por veículo — encontráveis de imediato.",
  'landing.funktionen.auftraege.title': "Ordens & quadro de planeamento",
  'landing.funktionen.auftraege.desc': "Do orçamento à receção. Planeamento semanal com marcações — tudo à vista.",
  'landing.funktionen.rechnungen.title': "Faturas & documentos",
  'landing.funktionen.rechnungen.desc': "Faturas e orçamentos conformes §14 & GoBD em PDF, incl. vencimentos e avisos.",
  'landing.funktionen.schaden3d.title': "Registo de danos em 3D",
  'landing.funktionen.schaden3d.desc': "Marque os danos diretamente no modelo do veículo, documente-os com fotos e recolha a assinatura digital.",
  'landing.funktionen.kalkulation.title': "Cálculo por ofício",
  'landing.funktionen.kalkulation.desc': "Catálogos de serviços e lógica de preços para detailing, envelopamento e PPF — de acordo com a sua especialidade.",
  'landing.funktionen.dsgvo.title': "RGPD & segurança",
  'landing.funktionen.dsgvo.desc': "Dados sensíveis encriptados, estritamente separados por oficina, com exportação e eliminação de dados num clique.",
  'landing.funktionen.footnotePre': "Além disso: pesquisa global ultrarrápida (",
  'landing.funktionen.footnotePost': "), navegação móvel e vários funcionários por oficina.",
  'landing.funktionen.buchhaltung.title': "Contabilidade e contabilista",
  'landing.funktionen.buchhaltung.desc': "Exporta faturas como lote DATEV (EXTF) ou CSV universal, liga o sevDesk e obtém um resumo de receitas (tipo EÜR) com análises.",
  'landing.funktionen.shop.title': "Loja e marketplace",
  'landing.funktionen.shop.desc': "Marketplace B2B integrado: encomende material e películas diretamente a grossistas. Além disso, gestão de stock e biblioteca de películas na sua loja.",
  'landing.bundesweit.kicker': "Em toda a Alemanha",
  'landing.bundesweit.title': "Para oficinas de toda a Alemanha",
  'landing.bundesweit.sub': "Da costa aos Alpes: o Detailly é feito para oficinas alemãs de detailing, envelopamento e PPF — com GoBD, XRechnung e ZUGFeRD.",
  'landing.bundesweit.caption': "Detailing · envelopamento · PPF — pronto em cada região postal",
  'landing.bundesweit.aria': "Mapa estilizado da Alemanha com pontos regionais distribuídos",
  'landing.finanzShop.kicker': "Mais do que serviços",
  'landing.finanzShop.title': "Contabilidade e material — diretamente integrados",
  'landing.finanzShop.buchhaltung.nutzen': "Os teus números vão direto ao contabilista — sem dupla introdução.",
  'landing.finanzShop.shop.nutzen': "Encomenda material sem sair do software.",
  'landing.dellen.kicker': "Smart Repair / PDR",
  'landing.dellen.title': "Clique na amolgadela e o preço aparece",
  'landing.dellen.desc': "Danos de estacionamento e granizo calculados em segundos: marque a amolgadela no veículo — o Detailly calcula o preço imediato por tamanho, aresta, alumínio e dano de pintura.",
  'landing.dellen.cardHeader': "Cálculo de amolgadelas · PDR",
  'landing.dellen.priceLabel': "Preço imediato",
  'landing.dellen.item': "Amolgadela",
  'landing.dellen.marker1': "Porta",
  'landing.dellen.marker2': "Guarda-lamas",
  'landing.dellen.marker3': "Capô",
  'landing.dellen.note': "Valores de exemplo — define as suas próprias tarifas.",
  'landing.dellen.aria': "Cálculo de amolgadelas ilustrado: três amolgadelas são marcadas e o preço soma-se.",

  // ---- 3D-Schadenserfassung (Showcase) -------------------------------------
  'landing.schaden.kicker': "O destaque",
  'landing.schaden.title': "Registar os danos antes que se tornem litígio",
  'landing.schaden.desc': "Na receção marca riscos, amolgadelas e impactos de pedra diretamente no modelo do veículo — com fotos e assinatura digital do cliente. Se mais tarde surgirem dúvidas, tem as provas. Preto no branco.",
  'landing.schaden.point1': "Colocar os pontos de dano diretamente no modelo 3D",
  'landing.schaden.point2': "Fotos por dano — atribuídas automaticamente",
  'landing.schaden.point3': "Assinatura digital na receção e na entrega",
  'landing.schaden.cardHeader': "Receção do veículo · registo de danos",
  'landing.schaden.cardBadge': "2 danos",
  'landing.schaden.cardPhotos': "4 fotos documentadas",
  'landing.schaden.cardSignature': "Assinatura registada",

  // ---- Landing: 3D-Showcase (LandingCar3D) --------------------------------
  'landing.showcase.aria': "Modelo 3D interativo do veículo com pontos de dano marcados",
  'landing.showcase.pin1': "Impacto de pedra · 2 fotos",
  'landing.showcase.pin2': "Risco · porta esquerda",
  'landing.showcase.pin3': "Amolgadela · documentada",
  'landing.showcase.badgeOne': "{count} dano",
  'landing.showcase.badgeMany': "{count} danos",

  // ---- Wachstum ------------------------------------------------------------
  'landing.wachstum.kicker': "Escalável",
  'landing.wachstum.title': "Crescimento através da visão de conjunto",
  'landing.wachstum.sub': "Quem está organizado e conhece os seus números toma melhores decisões — da oficina individual à cadeia.",
  'landing.wachstum.echtzeit.title': "Visão em tempo real",
  'landing.wachstum.echtzeit.desc': "Faturação, ordens abertas e marcações em direto no painel — vê de imediato onde corre bem e onde emperra.",
  'landing.wachstum.standorte.title': "Várias instalações",
  'landing.wachstum.standorte.desc': "Faça a gestão de filiais sob o mesmo teto — bem separadas e ainda assim centralizadas. Expansível sempre que crescer.",
  'landing.wachstum.team.title': "Equipa, funções & permissões",
  'landing.wachstum.team.desc': "Convide funcionários e atribua funções — cada um vê exatamente o que deve. Supervisionado e documentado de forma limpa.",
  'landing.wachstum.chartVolume': "Volume de ordens",
  'landing.wachstum.chartGrowing': "cresce",
  'landing.wachstum.chartLocations': "Instalações",

  // ---- Zahlen (Count-up) ---------------------------------------------------
  'landing.zahlen.stat1.unit': "Idiomas",
  'landing.zahlen.stat1.label': "em alemão, inglês, russo e polaco",
  'landing.zahlen.stat2.unit': "Dias",
  'landing.zahlen.stat2.label': "de teste grátis — sem cartão de crédito",
  'landing.zahlen.stat3.value': "RGPD + GoBD",
  'landing.zahlen.stat3.label': "armazenado e faturado em conformidade",
  'landing.zahlen.stat4.value': "5 → 1",
  'landing.zahlen.stat4.label': "um sistema em vez de cinco soluções isoladas",

  // ---- Mitglieder (Social Proof, Opt-in) -----------------------------------
  'landing.mitglieder.kicker': "Da prática",
  'landing.mitglieder.title': "Estas oficinas trabalham com o Detailly",
  'landing.mitglieder.sub': "Profissionais de detailing, envelopamento e estúdios de PPF que usam o Detailly diariamente – e que nos permitiram mencioná-los aqui.",

  // ---- Deutschlandkarte (Qualitätssiegel, nur zahlende Opt-in-Betriebe) -----
  'landing.karte.kicker': "Presença em todo o país",
  'landing.karte.title': "Oficinas Detailly em toda a Alemanha",
  'landing.karte.sub': "Oficinas membros verificadas e ativas – no mapa, aproximadamente por região. Toque num ponto para ver as oficinas da região.",
  'landing.karte.pin.aria': "{anzahl} oficinas na região postal {region}",
  'landing.karte.pin.aria.one': "Uma oficina na região postal {region}",
  'landing.karte.pop.aria': "Oficinas na região postal {region}",
  'landing.karte.pop.region': "Região postal {region}",
  'landing.karte.pop.website': "Site",
  'landing.karte.legende': "{betriebe} oficinas ativas em {regionen} regiões",

  // ---- Warum Detailly ------------------------------------------------------
  'landing.warum.kicker': "Porquê o Detailly",
  'landing.warum.title': "Software para a oficina — não para o stand.",
  'landing.warum.body': "Os profissionais de detailing, envelopamento e estúdios de PPF entregam trabalho de precisão e merecem um software que trabalhe com a mesma limpeza. A maioria dos programas de oficina é feita para grandes stands: sobrecarregada, complicada e cara. O Detailly é deliberadamente diferente — leve, à medida dos seus processos e pronto em minutos. Desenvolvido de forma independente, na Alemanha, com proteção de dados de raiz.",

  // ---- News-Teaser ---------------------------------------------------------
  'landing.news.kicker': "Notícias Detailly",
  'landing.news.title': "O que se está a mexer",
  'landing.news.sub': "Atualizações do produto e novidades sobre o Detailly. (Entradas de exemplo — em breve com notícias reais.)",
  'landing.news.all': "Ver todas as notícias",

  // ---- FAQ -----------------------------------------------------------------
  'landing.faq.kicker': "Perguntas frequentes",
  'landing.faq.title': "O que quer saber antes de começar",
  'landing.faq.q1.q': "Preciso de conhecimentos técnicos ou de uma instalação?",
  'landing.faq.q1.a': "Não. Regista a sua oficina e começa logo no navegador — em computador, tablet ou smartphone. Não há nada para instalar nem para configurar.",
  'landing.faq.q2.q': "Faço detailing E envelopamento — o que escolho?",
  'landing.faq.q2.a': "Então é fornecedor completo: no registo, basta escolher «Fornecedor completo» e obtém todos os catálogos de serviços e cálculos em conjunto.",
  'landing.faq.q3.q': "Que segurança têm os dados dos meus clientes?",
  'landing.faq.q3.a': "Os dados sensíveis são guardados de forma encriptada e estão estritamente separados de outras oficinas. Pode exportar ou eliminar os dados de clientes a qualquer momento — totalmente conforme ao RGPD.",
  'landing.faq.q4.q': "O que acontece após os 14 dias?",
  'landing.faq.q4.a': "Testa sem cartão de crédito e sem risco. Após o período de teste, escolhe o plano adequado à sua oficina. Se o período de teste terminar, não tem quaisquer custos.",
  'landing.faq.q5.q': "Também funciona no tablet da oficina?",
  'landing.faq.q5.a': "Sim. O Detailly foi feito para qualquer dispositivo — do PC do escritório ao tablet na receção do veículo. A utilização adapta-se automaticamente.",
  'landing.faq.q6.q': "Posso levar os meus dados comigo?",
  'landing.faq.q6.a': "A qualquer momento. Os seus dados são seus — uma exportação é possível num clique, sem ter de pedir a ninguém.",

  // ---- Abschluss-CTA -------------------------------------------------------
  'landing.cta.title': "Ponha ordem na sua oficina — a partir de hoje.",
  'landing.cta.sub': "Registe a sua oficina em poucos minutos e teste o Detailly 14 dias grátis. Sem cartão de crédito, sem risco.",
  'landing.cta.primary': "Começar grátis agora",
  'landing.cta.secondary': "Já tenho uma conta",

  // ---- Footer --------------------------------------------------------------
  'landing.footer.tagline': "O software de oficina para detailing, envelopamento e PPF. Desenvolvido de forma independente na Alemanha.",
  'landing.footer.discover': "Descobrir",
  'landing.footer.product': "Produto",
  'landing.footer.account': "Conta & aspetos legais",
  'landing.footer.news': "Notícias",
  'landing.footer.changelog': "Novidades",
  'landing.footer.masterclass': "Masterclass",
  'landing.footer.gruendung': "Criação de empresa",
  'landing.footer.grosshaendler': "Para grossistas",
  'landing.footer.features': "Funções",
  'landing.footer.branchen': "Para o seu ofício",
  'landing.footer.faq': "Perguntas frequentes",
  'landing.footer.trial': "Testar gratuitamente",
  'landing.footer.login': "Iniciar sessão",
  'landing.footer.register': "Registar",
  'landing.footer.impressum': "Aviso legal",
  'landing.footer.datenschutz': "Proteção de dados",
  'landing.footer.copyright': "© {year} Detailly · Todos os direitos reservados",

  // ---- Kundenformular ------------------------------------------------------
  'kunden.form.leitwegId.label': "Leitweg-ID",
  'kunden.form.leitwegId.help': "Apenas para faturas a organismos públicos/entidades adjudicantes (controla o encaminhamento B2G).",
  'kunden.form.editTitle': "Editar cliente",
  'kunden.form.saving': "A guardar…",
  'kunden.form.company': "Empresa",
  'kunden.form.firstName': "Nome próprio",
  'kunden.form.lastName': "Apelido",
  'kunden.form.street': "Rua",
  'kunden.form.postalCode': "Código postal",
  'kunden.form.noNameHelp': "Sem nome registado – p. ex. após anonimização RGPD.",
  'kunden.form.gdprSection': "Proteção de dados (RGPD)",
  'kunden.form.exportJson': "Exportar dados (JSON)",
  'kunden.form.anonymizeBtn': "Eliminar / anonimizar dados",
  'kunden.form.gdprNote': "As faturas são conservadas por motivos legais (GoBD), mas sem ligação à pessoa.",
  'kunden.form.anonymize.title': "Eliminar definitivamente os dados do cliente?",
  'kunden.form.anonymize.msgPre': "Os dados pessoais são removidos ou anonimizados. As faturas são conservadas por motivos legais (GoBD, 10 anos), mas sem ligação à pessoa. Esta operação não pode ser ",
  'kunden.form.anonymize.msgEmph': "revertida",
  'kunden.form.anonymize.msgPost': ".",
  'kunden.form.anonymize.confirm': "Eliminar definitivamente",
  'kunden.form.error.save': "Falha ao guardar",
  'kunden.form.error.export': "Falha na exportação",
  'kunden.form.error.anonymize': "Falha na eliminação",
  'kunden.form.gdpr.checking': "A verificar documentos…",
  'kunden.form.gdpr.willAnonymize': "Existem {count} documentos sujeitos a conservação. Por isso, o cliente é anonimizado – os documentos são conservados por motivos legais (GoBD/§147 AO), mas sem ligação à pessoa. Esta operação não pode ser ",
  'kunden.form.gdpr.willDelete': "Não existem documentos sujeitos a conservação. O cliente é totalmente eliminado com todos os veículos, marcações, fotos e rascunhos. Esta operação não pode ser ",
  'kunden.form.gdpr.irreversible': "revertida.",
  'kunden.form.gdpr.confirmDelete': "Eliminar definitivamente",

  // ===========================================================================
  // KUNDEN (Route "/kunden")
  // ===========================================================================
  'kunden.title': "Clientes",
  'kunden.subtitle': "Clientes particulares e empresariais",
  'kunden.csvImport': "Importação CSV",
  'kunden.new': "Novo cliente",
  'kunden.searchPlaceholder': "Pesquisar por nome, e-mail, telefone…",

  // ---- Leerzustand ---------------------------------------------------------
  'kunden.empty.none': "Ainda não há clientes criados.",
  'kunden.empty.filtered': "Nenhum cliente encontrado.",
  'kunden.empty.cta': "Criar o primeiro cliente",

  // ---- Tabellenspalten -----------------------------------------------------
  'kunden.col.name': "Nome",
  'kunden.col.typ': "Tipo",
  'kunden.col.email': "E-mail",
  'kunden.col.telefon': "Telefone",
  'kunden.col.ort': "Localidade",

  // ---- Kundentyp -----------------------------------------------------------
  'kunden.type.business': "Empresa",
  'kunden.type.private': "Particular",

  // ---- Aktionsmenü ---------------------------------------------------------
  'kunden.actionsFor': "Ações para {name}",
  'kunden.action.open': "Abrir",
  'kunden.action.newOrder': "Nova ordem",
  'kunden.action.edit': "Editar",

  // ---- Toast / Fehler / Löschen-Bestätigung --------------------------------
  'kunden.toast.deleted': "{name} eliminado",
  'kunden.error.delete': "Falha ao eliminar",
  'kunden.delete.title': "Eliminar cliente",
  'kunden.delete.msg': "Eliminar mesmo {name}? O cliente é desativado e removido da lista. As ordens e faturas já registadas são conservadas.",

  // ---- Kundenakte (Route "/kunden/detail") ---------------------------------
  'kunden.detail.businessCustomer': "Cliente empresarial",
  'kunden.detail.privateCustomer': "Cliente particular",
  'kunden.detail.addVehicle': "Adicionar veículo",
  'kunden.detail.contact': "Contacto",
  'kunden.detail.address': "Morada",
  'kunden.detail.vatNumber': "USt-IdNr.",
  'kunden.detail.stat.vehicles': "Veículos",
  'kunden.detail.stat.openOrders': "Ordens abertas",
  'kunden.detail.stat.openInvoices': "Faturas abertas",
  'kunden.detail.stat.paidTotal': "Pago no total",
  'kunden.detail.pieces': "{n} unidades",
  'kunden.detail.vehicles': "Veículos",
  'kunden.detail.vehicleCountOne': "{n} veículo",
  'kunden.detail.vehicleCountMany': "{n} veículos",
  'kunden.detail.emptyVehicles': "Nenhum veículo registado.",
  'kunden.detail.openFile': "Ficha",
  'kunden.detail.appointments': "Marcações",
  'kunden.detail.newestFirst': "Mais recentes primeiro",
  'kunden.detail.emptyAppts': "Sem marcações.",
  'kunden.detail.orders': "Ordens",
  'kunden.detail.totalCount': "{n} no total",
  'kunden.detail.emptyOrders': "Ainda não há ordens.",
  'kunden.detail.invoices': "Faturas & orçamentos",
  'kunden.detail.emptyInvoices': "Ainda não há documentos.",
  'kunden.detail.pdf': "PDF",
  'kunden.detail.error.load': "Não foi possível carregar o cliente",
  'kunden.detail.error.pdf': "Não foi possível carregar o PDF",

  // ===========================================================================
  // FAHRZEUGE (Route "/fahrzeuge")
  // ===========================================================================
  'fahrzeuge.title': "Veículos",
  'fahrzeuge.subtitle': "Frota de veículos com ficha do veículo",
  'fahrzeuge.new': "Novo veículo",
  'fahrzeuge.searchPlaceholder': "Pesquisar por matrícula, marca, modelo ou titular…",

  // ---- Leerzustand ---------------------------------------------------------
  'fahrzeuge.empty.none': "Ainda não há veículos criados.",
  'fahrzeuge.empty.filtered': "Nenhum veículo encontrado.",
  'fahrzeuge.empty.cta': "Criar o primeiro veículo",

  // ---- Tabellenspalten -----------------------------------------------------
  'fahrzeuge.col.fahrzeug': "Veículo",
  'fahrzeuge.col.kennzeichen': "Matrícula",
  'fahrzeuge.col.halter': "Titular",
  'fahrzeuge.col.baujahr': "Ano",

  // ---- Aktionsmenü ---------------------------------------------------------
  'fahrzeuge.actionsFor': "Ações para {name}",
  'fahrzeuge.action.open': "Abrir ficha do veículo",
  'fahrzeuge.action.newOrder': "Nova ordem",

  // ---- Formular (Neues Fahrzeug) -------------------------------------------
  'fahrzeuge.form.halter': "Titular",
  'fahrzeuge.form.selectPlaceholder': "– selecionar –",
  'fahrzeuge.form.marke': "Marca",
  'fahrzeuge.form.modell': "Modelo",
  'fahrzeuge.form.variante': "Variante",
  'fahrzeuge.form.baujahr': "Ano",
  'fahrzeuge.form.farbe': "Cor",
  'fahrzeuge.form.kennzeichen': "Matrícula",
  'fahrzeuge.form.kraftstoff': "Combustível",
  'fahrzeuge.form.flaeche': "Área (m²)",

  // ---- Kraftstoffarten -----------------------------------------------------
  'fahrzeuge.fuel.petrol': "Gasolina",
  'fahrzeuge.fuel.diesel': "Gasóleo",
  'fahrzeuge.fuel.electric': "Elétrico",
  'fahrzeuge.fuel.hybrid': "Híbrido",
  'fahrzeuge.saving': "A guardar…",

  // ---- Toast / Fehler / Löschen-Bestätigung --------------------------------
  'fahrzeuge.toast.deleted': "{name} eliminado",
  'fahrzeuge.error.delete': "Falha ao eliminar",
  'fahrzeuge.error.save': "Falha ao guardar",
  'fahrzeuge.delete.title': "Eliminar veículo",
  'fahrzeuge.delete.msg': "Eliminar mesmo {name}? O veículo é removido da lista. As ordens e marcações já registadas são conservadas.",

  // ---- Fahrzeugakte (Route "/fahrzeuge/detail") ----------------------------
  'fahrzeuge.detail.subtitle': "Ficha do veículo",
  'fahrzeuge.detail.masterData': "Dados mestre",
  'fahrzeuge.detail.makeModel': "Marca / modelo",
  'fahrzeuge.detail.area': "Área",
  'fahrzeuge.detail.sqm': "{n} m²",
  'fahrzeuge.detail.toOwner': "Ir para o titular",
  'fahrzeuge.detail.orderHistory': "Histórico de ordens",
  'fahrzeuge.detail.emptyOrders': "Ainda não há ordens para este veículo.",

  // ===========================================================================
  // BELEGE / RECHNUNGEN (Route "/rechnungen")
  // ===========================================================================
  'rechnungen.title': "Documentos",
  'rechnungen.subtitle': "Orçamentos e faturas",
  'rechnungen.searchPlaceholder': "Pesquisar por número ou cliente…",
  'rechnungen.tab.alle': "Todos",

  // ---- Leerzustände --------------------------------------------------------
  'rechnungen.empty.none': "Ainda não há documentos. Os documentos resultam das ordens.",
  'rechnungen.empty.filtered': "Nenhum documento nesta vista.",

  // ---- Tabellenspalten -----------------------------------------------------
  'rechnungen.col.nummer': "Número",
  'rechnungen.col.art': "Tipo",
  'rechnungen.col.kunde': "Cliente",
  'rechnungen.col.datum': "Data",
  'rechnungen.col.status': "Estado",
  'rechnungen.col.brutto': "Bruto",

  // ---- Art / Status --------------------------------------------------------
  'rechnungen.kind.angebot': "Orçamento",
  'rechnungen.kind.rechnung': "Fatura",
  'rechnungen.status.entwurf': "Rascunho",
  'rechnungen.status.offen': "Em aberto",
  'rechnungen.status.bezahlt': "Paga",
  'rechnungen.status.storniert': "Anulada",

  // ---- Fälligkeit / Versand-Badges -----------------------------------------
  'rechnungen.overdue': "Vencida há {tage} dias",
  'rechnungen.dueIn': "vence em {tage} dias",
  'rechnungen.sent': "Enviada",
  'rechnungen.sentOn': "Enviada em {datum}",

  // ---- Mahnstufen ----------------------------------------------------------
  'rechnungen.mahn.stufe1': "Lembrete de pagamento",
  'rechnungen.mahn.stufe2': "1.º aviso",
  'rechnungen.mahn.stufe3': "2.º aviso",
  'rechnungen.mahn.generic': "Nível de aviso {stufe}",

  // ---- Zeilen-Aktionen -----------------------------------------------------
  'rechnungen.action.pdf': "Transferir PDF",
  'rechnungen.action.xrechnung': "XRechnung (XML)",
  'rechnungen.action.send': "Enviar por e-mail",
  'rechnungen.action.resend': "Reenviar por e-mail",
  'rechnungen.action.markPaid': "Marcar como paga",
  'rechnungen.action.copyLink': "Copiar ligação de transferência",
  'rechnungen.action.mahnen': "Avisar",
  'rechnungen.action.storno': "Anular",
  'rechnungen.action.setStatus': "Definir como «{status}»",
  'rechnungen.actionsFor': "Ações para {nummer}",
  'rechnungen.linkPrompt': "Copiar ligação de transferência:",

  // ---- Storno-Bestätigung --------------------------------------------------
  'rechnungen.storno.title': "Anular documento",
  'rechnungen.storno.msg': "Anular mesmo o documento {nummer}? Um documento anulado não pode ser reativado.",
  'rechnungen.storno.msgPaid': "Anular mesmo a fatura paga {nummer}? A anulação não pode ser revertida — uma nota de crédito ou reembolso deve ser tratada em separado, se aplicável.",

  // ---- Toast-Meldungen -----------------------------------------------------
  'rechnungen.toast.statusUpdated': "Estado atualizado",
  'rechnungen.toast.storniert': "Documento anulado",
  'rechnungen.toast.paid': "Marcada como paga",
  'rechnungen.toast.sent': "Documento enviado por e-mail",
  'rechnungen.toast.linkCopied': "Ligação de transferência copiada",
  'rechnungen.toast.mahnSent': "Aviso enviado",

  // ---- Fehlermeldungen -----------------------------------------------------
  'rechnungen.error.statusChange': "Falha na mudança de estado",
  'rechnungen.error.pdf': "Não foi possível carregar o PDF",
  'rechnungen.error.xrechnung': "Não foi possível criar a XRechnung",
  'rechnungen.error.paid': "Não foi possível marcar como paga",
  'rechnungen.error.send': "Falha no envio do e-mail",
  'rechnungen.error.link': "Não foi possível criar a ligação",
  'rechnungen.error.mahn': "Falha no aviso",

  // ===========================================================================
  // AUFTRÄGE (Route "/auftraege")
  // ===========================================================================
  'auftraege.title': "Ordens",

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
