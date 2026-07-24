// ===========================================================================
// FR – WÖRTERBUCH (Partial<Dict>) · Français
// ---------------------------------------------------------------------------
// MT-gestützte Erstübersetzung — professionelle Prüfung vor breitem Rollout empfohlen.
// Enthält die UI-Keys aus de.ts, nach Français übersetzt. Bleibt technisch
// `Partial<Dict>`: fehlende/neue Keys fallen automatisch auf DE zurück
// (siehe ../provider, t() → de[key]) — nie ein leerer String oder der rohe Key.
// Juristische Volltexte (AGB, AVV, Datenschutz, Widerrufsbelehrung, Impressum)
// liegen NICHT in diesem Wörterbuch, sondern in den jeweiligen Seiten-Komponenten
// und bleiben bewusst auf Deutsch.
//
// Platzhalter wie {name}/{year} bleiben unverändert (werden zur Laufzeit ersetzt).
// ===========================================================================

import type { Dict } from './de';

export const fr: Partial<Dict> = {
  // ---- Gemeinsame UI-Texte -------------------------------------------------
  'common.save': "Enregistrer",
  'common.cancel': "Annuler",
  'common.confirm': "Confirmer",
  'common.delete': "Supprimer",
  'common.close': "Fermer",
  'common.back': "Retour",
  'common.loading': "Chargement",
  'common.loadingEllipsis': "Chargement…",
  'common.loadingBrand': "Chargement de Detailly…",
  'common.error': "Erreur",
  'common.toStart': "Aller à la page d'accueil",
  // ---- Fehler-/Leerzustaende (App-Router error/not-found Boundaries) --------
  'errorBoundary.title': "Une erreur s'est produite",
  'errorBoundary.desc': "Une erreur inattendue s'est produite. Vous pouvez réessayer ou recharger la page.",
  'errorBoundary.retry': "Réessayer",
  'errorBoundary.reload': "Recharger la page",
  'errorBoundary.reference': "Référence",
  'notFound.title': "Page introuvable",
  'notFound.desc': "Cette page n'existe pas ou a été déplacée. Vérifiez l'adresse ou revenez à la page d'accueil.",
  'notFound.dashboard': "Vers le tableau de bord",
  // ---- 2FA-Erzwingung (serverseitige Pflicht) ------------------------------
  'mfa.gate.title': "Authentification à deux facteurs requise",
  'mfa.gate.desc': "L'authentification à deux facteurs est obligatoire pour votre compte. Configurez-la maintenant pour continuer à utiliser Detailly.",
  'mfa.gate.logout': "Se déconnecter",
  'common.toSubscription': "Vers l'abonnement et le forfait",

  // ---- Sprachumschalter ----------------------------------------------------
  'switcher.label': "Choisir la langue",
  'switcher.current': "Langue actuelle",

  // ---- Navigation: Gruppen -------------------------------------------------
  'nav.group.overview': "Aperçu",
  'nav.group.operations': "Exploitation",
  'nav.group.intake': "Réception et calcul",
  'nav.group.masterdata': "Données de base",
  'nav.group.finance': "Finances",
  'nav.group.material': "Matériel",
  'nav.group.organization': "Organisation",
  'nav.group.platform': "Plateforme",

  // ---- Navigation: Einträge ------------------------------------------------
  'nav.item.dashboard': "Tableau de bord",
  'nav.item.achievements': "Réussites",
  'nav.item.orders': "Ordres",
  'nav.item.calculation': "Calcul",
  'nav.item.intakeQuick': "Réception (rapide)",
  'nav.item.intake3d': "Réception et expertise (3D)",
  'nav.item.dellenkalkulation': "Calcul des bosses (PDR)",
  'nav.item.schichtdicke': "Mesurer l'épaisseur de couche",
  'nav.item.planboard': "Planning",
  'nav.item.requests': "Demandes",
  'nav.item.customers': "Clients",
  'nav.item.vehicles': "Véhicules",
  'nav.item.services': "Prestations",
  'nav.item.invoices': "Factures",
  'nav.item.incomingInvoices': "Réception de e-factures",
  'nav.item.cashbook': "Livre de caisse",
  'nav.item.reminders': "Relances",
  'nav.item.reports': "Analyses",
  'nav.item.accounting': "Comptabilité",
  'nav.item.shop': "Matériel et stock",
  'nav.item.marketplace': "Place de marché",
  'nav.item.locations': "Sites",
  'nav.item.staff': "Personnel",
  'nav.item.time': "Suivi du temps",
  'nav.item.showcase': "Vitrine",
  'nav.item.audit': "Journal d'audit",
  'nav.item.settings': "Paramètres",
  'nav.item.help': "Aide et assistance",
  'nav.item.assistant': "Assistant de support",
  'nav.item.subscription': "Abonnement et forfait",
  'nav.item.cockpit': "Cockpit",
  'nav.item.platformAnalytics': "Analyses de la plateforme",
  'nav.item.platformMarketplace': "Gestion de la place de marché",
  'nav.item.platformGeraetemarkt': "Modération du marché d'occasion",
  'nav.item.platformSupport': "Demandes d'assistance",
  'nav.item.platformSecurity': "Sécurité",
  'nav.item.platformNewsletter': "Newsletter",
  'nav.item.subscriptions': "Abonnements",

  // ---- Einstellungen: Kalkulation (€/qm) -----------------------------------
  'settings.kalk.title': "Calcul · €/m²",
  'settings.kalk.subtitle': "Tarifs de base pour le calcul instantané 3D. Dans le calcul, chaque valeur reste modifiable.",
  'settings.kalk.grouplabel': "Prix au mètre carré (HT)",
  'settings.kalk.folierung': "Covering",
  'settings.kalk.ppf': "PPF / protection de peinture",
  'settings.kalk.aufbereitung': "Detailing",
  'settings.kalk.help': "Ces tarifs constituent la valeur par défaut du module 3D (surface × taille du véhicule × €/m²). Vide ou 0 = valeur standard interne.",
  'settings.kalender.umsatzZielTitle': "Objectif de chiffre d'affaires hebdomadaire",
  'settings.kalender.umsatzZielSubtitle': "Valeur cible pour la couche chiffre d'affaires du planning, visible uniquement par les propriétaires et les managers.",
  'settings.kalender.umsatzZielLabel': "Objectif par semaine (€ TTC)",
  'settings.kalender.umsatzZielHelp': "Laisser vide = pas d'objectif. La barre de progression apparaît dans l'en-tête hebdomadaire du planning.",

  // ---- Einstellungen: Kalender & Online-Buchung (Kalender 2.0 W2) ----------
  'settings.kalender.title': "Calendrier et réservation en ligne",
  'settings.kalender.subtitle': "Horaires de travail par jour, grille de créneaux et délai de préavis pour le portail de réservation public.",
  'settings.kalender.von': "de",
  'settings.kalender.bis': "à",
  'settings.kalender.slotDauer': "Durée du créneau (minutes)",
  'settings.kalender.puffer': "Marge entre les rendez-vous (minutes)",
  'settings.kalender.vorlaufMin': "Préavis minimal (heures)",
  'settings.kalender.vorlaufMax': "Préavis maximal (jours)",
  'settings.kalender.hint': "Avec des horaires de travail renseignés, votre portail de réservation affiche les créneaux libres : les clients choisissent parmi les créneaux disponibles au lieu de saisir librement une date souhaitée.",
  'settings.error.kalenderZeiten': "Vérifiez les horaires : « à » doit être postérieur à « de » les jours actifs.",
  'settings.error.kalenderWerte': "Vérifiez les valeurs du calendrier : créneau 5–480 min, marge 0–240 min, préavis 0–720 h ou 1–365 jours.",

  // ---- Buchungsseite: rechtlicher Abschluss-Modus (§312j BGB) ---------------
  'settings.buchung.modusTitle': "Finalisation de la page de réservation",
  'settings.buchung.modusSubtitle': "Détermine si votre page de réservation publique est une demande sans engagement ou une réservation ferme et payante.",
  'settings.buchung.modusLabel': "Mode",
  'settings.buchung.modusAnfrage': "Demande de rendez-vous sans engagement",
  'settings.buchung.modusVerbindlich': "Réservation ferme et payante",
  'settings.buchung.modusHelp': "Demande : les clients envoient une demande sans engagement — aucun contrat n'est encore conclu, vous confirmez le rendez-vous. Ferme : un contrat payant est conclu en ligne (bouton « Réserver avec paiement », droit de rétractation).",
  'settings.buchung.modusVerbindlichHint': "En mode ferme, les clients concluent en ligne avec vous un contrat à distance payant. Vérifiez soigneusement les prix, les mentions légales et l'information sur le droit de rétractation — la responsabilité vous incombe.",
  'settings.buchung.impressumIncomplete': "Page de réservation incomplète : les mentions légales sont manquantes. Les clients ne voient que partiellement le prestataire (partie contractante). Complétez-les dans la section des mentions légales ci-dessous.",

  // ---- Öffentliche Buchungsseite: Verbraucherrecht (UI-Chrome) --------------
  // Die eigentlichen Rechtstexte (Widerrufsbelehrung/-formular) bleiben DEUTSCH
  // und werden NICHT übersetzt – hier nur die Bedien-Elemente.
  'buchen.recht.badge.anfrage': "Demande de rendez-vous en ligne",
  'buchen.recht.badge.verbindlich': "Réservation en ligne",
  'buchen.recht.anbieter.title': "Prestataire",
  'buchen.recht.anbieter.hint': "La partie contractante est l'atelier mentionné ci-dessus, et non Detailly.",
  'buchen.recht.pflichtinfo.title': "Récapitulatif de votre réservation",
  'buchen.recht.pflichtinfo.leistung': "Prestation",
  'buchen.recht.pflichtinfo.keineLeistung': "Aucune prestation sélectionnée",
  'buchen.recht.pflichtinfo.preis': "Prix",
  'buchen.recht.pflichtinfo.termin': "Rendez-vous",
  'buchen.recht.pflichtinfo.keinTermin': "Aucun rendez-vous sélectionné",
  'buchen.recht.pflichtinfo.checkbox': "J'ai lu les informations obligatoires et l'information sur le droit de rétractation.",
  'buchen.recht.pflichtinfo.checkboxError': "Veuillez confirmer les informations obligatoires et l'information sur le droit de rétractation.",
  'buchen.recht.widerruf.title': "Droit de rétractation",
  'buchen.recht.widerruf.deHint': "Le texte juridique officiel n'est disponible qu'en allemand.",
  'buchen.recht.widerruf.belehrungLabel': "Afficher l'information sur le droit de rétractation",
  'buchen.recht.widerruf.formularLabel': "Afficher le modèle de formulaire de rétractation",
  'buchen.recht.vorzeitig.checkbox': "Je demande expressément que l'atelier commence l'exécution avant la fin du délai de rétractation de 14 jours. Je sais qu'avec l'exécution complète du contrat, je perds mon droit de rétractation.",
  'buchen.recht.vorzeitig.error': "Veuillez accepter le début anticipé de la prestation ou choisir un rendez-vous ultérieur.",
  'buchen.recht.datenschutz.hintAnfrage': "L'atelier traite vos données pour gérer votre demande de rendez-vous. Le responsable est le prestataire indiqué ci-dessus.",
  'buchen.recht.datenschutz.hintVerbindlich': "L'atelier traite vos données pour l'exécution du contrat. Le responsable est le prestataire indiqué ci-dessus.",
  'buchen.recht.datenschutz.link': "Informations sur la protection des données",
  'buchen.recht.datenschutz.checkbox': "J'ai pris connaissance des informations sur la protection des données.",
  'buchen.recht.verbindlich.emailRequired': "Pour une réservation ferme et payante, nous avons besoin de votre adresse e-mail — nous y enverrons la confirmation de réservation et l'information sur le droit de rétractation.",
  'buchen.recht.verbindlich.leistungRequired': "Pour une réservation ferme, veuillez sélectionner une prestation.",
  'buchen.recht.anfrage.hinweis': "Aucun contrat n'est encore conclu ; l'atelier confirme votre rendez-vous.",
  'buchen.recht.anfrage.button': "Demander sans engagement",
  'buchen.recht.anfrage.submitting': "Envoi…",
  'buchen.recht.verbindlich.intro': "En cliquant, vous concluez un contrat payant avec l'atelier.",
  'buchen.recht.verbindlich.button': "Réserver avec paiement",
  'buchen.recht.verbindlich.submitting': "Réservation en cours…",
  'buchen.recht.success.anfrage.title': "Demande envoyée",
  'buchen.recht.success.anfrage.text': "Merci ! {betrieb} vous contactera pour confirmer le rendez-vous.",
  'buchen.recht.success.verbindlich.title': "Réservation confirmée",
  'buchen.recht.success.verbindlich.text': "Merci pour votre réservation payante chez {betrieb}. Vous recevrez la confirmation avec l'information sur le droit de rétractation par e-mail.",
  'buchen.recht.success.reference': "Votre référence :",

  // ---- Tarif-Hinweise (Feature-Gating) -------------------------------------
  'settings.sevdesk.upgrade': "Le transfert automatique vers sevDesk est disponible à partir du forfait Basic.",
  'ordertime.upgrade': "Les temps de travail et les coûts de main-d'œuvre sont inclus dans le forfait Pro.",

  // ---- Einstellungen: Seite ------------------------------------------------
  'settings.title': "Paramètres",
  'settings.subtitle': "Apparence, profil et — en tant que propriétaire — les données de l'atelier.",
  'settings.tab.appearance': "Apparence",
  'settings.tab.profile': "Profil",
  'settings.tab.business': "Atelier",
  'settings.tab.customerComm': "Communication client",
  'settings.tab.goals': "Objectifs et rappels",
  'settings.tab.audit': "Journal d'audit",
  'settings.saving': "Enregistrement…",
  'settings.toast.saved': "Enregistré",

  // Einstellungen: Betrieb – Sekundaer-Navigation (Unterbereiche, je eigener Speichern-Button)
  'settings.bereich.navLabel': "Domaines des paramètres de l'atelier",
  'settings.bereich.stammdaten': "Données de base et marque",
  'settings.bereich.steuer': "Fiscalité et mentions légales",
  'settings.bereich.rechnung': "Banque et facturation",
  'settings.bereich.kalender': "Calcul et calendrier",
  'settings.bereich.email': "Envoi d'e-mails",
  'settings.bereich.mahnwesen': "Relances",
  'settings.bereich.buchhaltung': "DATEV et sevDesk",
  'settings.bereich.sicherheit': "Sécurité",

  // Einstellungen: Status-Mail-Vorlagen (editierbar, je Status Betreff + Text)
  'settings.statusmail.title': "Modèles d'e-mails de statut",
  'settings.statusmail.subtitle': "Adaptez l'objet et le texte des e-mails de statut automatiques à vos clients.",
  'settings.statusmail.reviewNote': "Le déclencheur d'envoi reste inchangé : les e-mails de statut ne partent que si l'interrupteur de statut (communication client) est activé. Ici, vous adaptez uniquement le texte.",
  'settings.statusmail.placeholders': "Variables disponibles :",
  'settings.statusmail.status.bestaetigt': "Ordre confirmé",
  'settings.statusmail.status.in_arbeit': "Ordre en cours",
  'settings.statusmail.status.abholbereit': "Véhicule prêt à être récupéré",
  'settings.statusmail.reset': "Réinitialiser aux valeurs par défaut",
  'settings.statusmail.subject': "Objet",
  'settings.statusmail.subjectPlaceholder': "Laisser vide pour l'objet standard",
  'settings.statusmail.body': "Texte",
  'settings.statusmail.bodyPlaceholder': "Laisser vide pour le texte standard",
  'settings.statusmail.defaultHint': "Vide = le texte standard éprouvé est utilisé.",
  'settings.statusmail.footerHint': "La formule d'appel, le lien vers le statut de l'ordre et la formule de politesse sont ajoutés automatiquement — votre texte s'insère entre les deux.",

  // Einstellungen: Benachrichtigungs-Präferenzen je Nutzer (Glocke)
  'settings.benachrichtigungen.title': "Notifications",
  'settings.benachrichtigungen.subtitle': "Quels avis doivent apparaître dans votre cloche.",
  'settings.benachrichtigungen.intro': "Ce réglage ne s'applique qu'à vous. Par défaut, tous les avis sont actifs.",
  'settings.benachrichtigungen.rechnungenFaellig': "Factures échues",
  'settings.benachrichtigungen.rechnungenFaelligHint': "Avis lorsque des factures ont dépassé leur échéance de paiement.",
  'settings.benachrichtigungen.termineHeute': "Rendez-vous du jour",
  'settings.benachrichtigungen.termineHeuteHint': "Avis sur les rendez-vous prévus aujourd'hui.",
  'settings.benachrichtigungen.materialKnapp': "Matériel faible",
  'settings.benachrichtigungen.materialKnappHint': "Avis lorsque des produits passent sous le stock minimal.",
  'settings.benachrichtigungen.steuerTermine': "Échéances fiscales",
  'settings.benachrichtigungen.steuerTermineHint': "Rappel des échéances fiscales à venir que vous gérez vous-même.",
  'settings.benachrichtigungen.auslastung': "Taux d'occupation",
  'settings.benachrichtigungen.auslastungHint': "Avis lorsque le taux d'occupation hebdomadaire est inférieur à votre objectif.",
  'settings.benachrichtigungen.par19': "Seuil de chiffre d'affaires §19",
  'settings.benachrichtigungen.par19Hint': "Avertissement lorsque vous approchez du seuil de chiffre d'affaires du régime de la franchise.",

  // Einstellungen: Darstellung
  'settings.appearance.title': "Apparence",
  'settings.appearance.subtitle': "L'aspect de Detailly pour vous.",
  'settings.appearance.colorScheme': "Thème de couleur",
  'settings.appearance.dark': "Sombre",
  'settings.appearance.light': "Clair",
  'settings.appearance.deviceOnly': "S'applique uniquement à cet appareil et à ce navigateur.",
  'settings.motion.title': "Animations",
  'settings.motion.subtitle': "Réduire les animations : plus calme et plus doux.",
  'settings.motion.reduce': "Réduire les animations",
  'settings.motion.deviceOnly': "Ce réglage ne s'applique qu'à cet appareil et à ce navigateur.",

  // Einstellungen: Profil
  'settings.profile.title': "Mon profil",
  'settings.profile.subtitle': "Vous pouvez gérer vous-même votre nom et votre numéro de téléphone.",
  'settings.profile.firstName': "Prénom",
  'settings.profile.lastName': "Nom",
  'settings.profile.phone': "Téléphone (facultatif)",
  'settings.profile.email': "E-mail",
  'settings.profile.role': "Rôle",
  'settings.profile.emailRoleHint': "L'adresse e-mail et le rôle sont modifiés par la direction de l'atelier via la gestion du personnel.",

  // Einstellungen: Passwort
  'settings.password.title': "Mot de passe",
  'settings.password.subtitle': "Modifiez le mot de passe via un lien sécurisé envoyé par e-mail.",
  'settings.password.sent': "Nous vous avons envoyé un e-mail de réinitialisation.",
  'settings.password.sending': "Envoi…",
  'settings.password.change': "Modifier le mot de passe",

  // Einstellungen: Kalender-Abo
  'settings.calendar.title': "Abonnement au calendrier (Apple / Google)",
  'settings.calendar.subtitle': "Tous les rendez-vous automatiquement dans votre propre calendrier — via un lien d'abonnement secret qui se met à jour tout seul.",
  'settings.calendar.appleLabel': "Calendrier Apple (webcal)",
  'settings.calendar.googleLabel': "Google / autres (https)",
  'settings.calendar.copy': "Copier",
  'settings.calendar.copied': "Copié ✓",
  'settings.calendar.appleName': "Calendrier Apple :",
  'settings.calendar.appleHelp': " Fichier → « Nouvel abonnement au calendrier… » → collez le lien webcal.",
  'settings.calendar.googleName': "Calendrier Google :",
  'settings.calendar.googleHelp': " Autres agendas → « Ajouter à l'aide d'une URL » → collez le lien https.",
  'settings.calendar.secretHint': "Le lien est secret et donne un accès en lecture aux rendez-vous — ne le communiquez qu'à des personnes de confiance.",
  'settings.calendar.regenerating': "Génération…",
  'settings.calendar.regenerate': "Régénérer le lien (invalider l'ancien)",
  'settings.calendar.confirmTitle': "Régénérer le lien du calendrier",
  'settings.calendar.confirmMsg': "Un nouveau lien d'abonnement secret sera généré. L'ancien lien deviendra invalide — les abonnements de calendrier existants devront être reconfigurés avec le nouveau lien.",
  'settings.calendar.confirmLabel': "Régénérer",

  // Einstellungen: Verwaltung (Schnellzugriffe)
  'settings.admin.title': "Administration",
  'settings.admin.subtitle': "Accès direct aux domaines de l'atelier.",
  'settings.admin.staffTitle': "Personnel et rôles",
  'settings.admin.staffText': "Créer l'équipe, gérer les rôles et les accès.",
  'settings.admin.locationsTitle': "Sites",
  'settings.admin.locationsText': "Gérer les succursales et analyser tous sites confondus.",
  'settings.admin.servicesTitle': "Prestations et prix",
  'settings.admin.servicesText': "Gérer votre propre catalogue de prestations et vos prix.",
  'settings.admin.subscriptionTitle': "Abonnement et forfait",
  'settings.admin.subscriptionText': "Consulter et gérer votre forfait Detailly.",

  // Einstellungen: Betriebstyp & Branchen-Look
  'settings.branche.title': "Type d'atelier et style du secteur",
  'settings.branche.subtitle': "Détermine la couleur d'accent, le catalogue de calcul et les options propres au type.",
  'settings.branche.help': "Le style (couleur d'accent) change immédiatement pour tous les employés de l'atelier après l'enregistrement.",

  // Einstellungen: Dein Look (Logo & Akzentfarbe)
  'settings.branding.title': "Votre style : logo et couleur",
  'settings.branding.subtitle': "Logo et couleur d'accent pour les vues client (suivi de l'ordre, dossier de remise).",
  'settings.branding.logoLabel': "Logo",
  'settings.branding.logoPlaceholder': "Aucun logo",
  'settings.branding.logoChoose': "Choisir un logo",
  'settings.branding.logoUploading': "Téléversement…",
  'settings.branding.logoRemove': "Retirer le logo",
  'settings.branding.logoHelp': "PNG, JPEG ou WebP, max. 512 Ko. De préférence avec un fond transparent.",
  'settings.branding.logoErrorType': "Seuls les formats PNG, JPEG ou WebP sont autorisés comme logo.",
  'settings.branding.logoErrorSize': "Le logo est trop volumineux (max. 512 Ko).",
  'settings.branding.logoErrorGeneric': "Le logo n'a pas pu être enregistré.",
  'settings.branding.logoUploaded': "Logo mis à jour",
  'settings.branding.logoRemoved': "Logo retiré",
  'settings.branding.logoRemoveConfirmTitle': "Retirer le logo ?",
  'settings.branding.logoRemoveConfirmMsg': "Le logo sera retiré de toutes les vues client. Vous pouvez en téléverser un nouveau à tout moment.",
  'settings.branding.accentLabel': "Couleur d'accent",
  'settings.branding.accentReset': "Réinitialiser aux valeurs par défaut",
  'settings.branding.accentPreviewButton': "Bouton d'exemple",
  'settings.branding.accentHelp': "Colore l'en-tête, les points de statut et les boutons dans les vues client. Vide = standard du secteur.",
  'settings.branding.accentInvalid': "Veuillez indiquer une couleur hexadécimale valide (p. ex. #B5722F).",

  // Einstellungen: Betrieb & Anschrift
  'settings.address.title': "Atelier et adresse",
  'settings.address.subtitle': "Nom et adresse de l'atelier",
  'settings.address.name': "Nom de l'atelier",
  'settings.address.email': "E-mail",
  'settings.address.phone': "Téléphone",
  'settings.address.street': "Rue et numéro",
  'settings.address.postalCode': "Code postal",
  'settings.address.city': "Ville",
  'settings.address.country': "Pays",
  'settings.address.taxHintPre': "§ 14 UStG : nom, adresse et numéro fiscal ",
  'settings.address.taxHintOr': "ou",
  'settings.address.taxHintPost': " USt-IdNr. sont des mentions obligatoires pour des factures valides.",

  // Einstellungen: Steuer
  'settings.tax.title': "Fiscalité (§ 14 UStG)",
  'settings.tax.subtitle': "Le numéro fiscal ou le USt-IdNr. est obligatoire sur les factures.",
  'settings.tax.steuernummer': "Numéro fiscal",
  'settings.tax.steuernummerPlaceholder': "p. ex. 12/345/67890",
  'settings.tax.ustId': "USt-IdNr.",
  'settings.tax.ustIdPlaceholder': "p. ex. DE123456789",
  // §19 UStG (Kleinunternehmer) + Rechtsform
  'settings.steuer.kleinunternehmer': "Petit entrepreneur (§ 19 UStG)",
  'settings.steuer.kleinunternehmerHint': "Ne pas facturer de TVA. Les nouveaux documents sont créés automatiquement à 0 %.",
  'settings.steuer.hinweisLabel': "Texte d'information sur les documents",
  'settings.steuer.hinweisHelp': "Apparaît sur les factures/devis. Laisser vide pour le texte standard.",
  'settings.steuer.standardSatz': "Taux de TVA standard pour les nouveaux documents",
  'settings.steuer.standardSatzHelp': "Présélection lors de la création de nouveaux documents. Reste modifiable par document (19 / 7 / 0 %).",
  'settings.steuer.rechtsform': "Forme juridique",
  'settings.steuer.rechtsform.einzelunternehmen': "Entreprise individuelle",
  'settings.steuer.rechtsform.gbr': "GbR",
  'settings.steuer.rechtsform.ug': "UG (haftungsbeschränkt)",
  'settings.steuer.rechtsform.gmbh': "GmbH",
  'settings.steuer.rechtsform.ohg': "OHG",
  'settings.steuer.rechtsform.kg': "KG",
  'settings.steuer.rechtsform.gmbh_co_kg': "GmbH & Co. KG",
  'settings.steuer.rechtsform.freiberufler': "Profession libérale",
  'settings.steuer.rechtsform.sonstige': "Autre",
  'settings.steuer.registergericht': "Tribunal du registre",
  'settings.steuer.registergerichtPlaceholder': "p. ex. Amtsgericht Charlottenburg",
  'settings.steuer.registernummer': "Numéro de registre",
  'settings.steuer.registernummerPlaceholder': "p. ex. HRB 123456",
  'settings.steuer.vertretung': "Représentants légaux",
  'settings.steuer.vertretungPlaceholder': "p. ex. Max Mustermann (gérant)",
  'settings.steuer.infoLinkPre': "Vous ne savez pas ce qui s'applique à vous ? ",
  'settings.steuer.infoLink': "Informations sur le régime de franchise et la forme juridique",
  'settings.steuer.infoLinkPost': " (pas de conseil fiscal).",

  // ---- Einstellungen: Ziele & Erinnerungen (Tab, nur Inhaber) --------------
  'settings.ziele.intro.title': "Objectifs et rappels",
  'settings.ziele.intro.subtitle': "Échéances fiscales et avertissements — sous forme d'avis discrets dans la cloche. Rien n'est envoyé à l'extérieur.",
  // Auslastungsziel
  'settings.ziele.auslastung.title': "Objectif d'occupation",
  'settings.ziele.auslastung.subtitle': "Valeur cible pour le taux d'occupation de la capacité de votre atelier.",
  'settings.ziele.auslastung.toggle': "Activer l'objectif d'occupation",
  'settings.ziele.auslastung.toggleHint': "Affiche un avis dans la cloche lorsque votre taux d'occupation hebdomadaire est inférieur à l'objectif.",
  'settings.ziele.auslastung.prozentLabel': "Occupation cible (%)",
  'settings.ziele.auslastung.prozentHelp': "Entre 50 et 100 %. Standard : 90 %.",
  // §19-Umsatzgrenzen-Warnung
  'settings.ziele.par19.title': "Avertissement de seuil de chiffre d'affaires (§ 19 UStG)",
  'settings.ziele.par19.subtitle': "Alerte précoce avant d'atteindre le seuil du régime de franchise.",
  'settings.ziele.par19.toggle': "Avertir avant d'atteindre le seuil de chiffre d'affaires",
  'settings.ziele.par19.toggleHint': "Utilise le statut §19 existant (100 000 €/an) — apparaît comme avis dans la cloche.",
  'settings.ziele.par19.disabledHint': "Disponible uniquement si le régime de franchise (§ 19 UStG) est actif dans l'onglet « Atelier ».",
  // Steuer-Termine
  'settings.ziele.termine.title': "Échéances fiscales",
  'settings.ziele.termine.subtitle': "Vos propres échéances, que la cloche vous rappelle à temps (14 jours avant).",
  'settings.ziele.termine.artLabel': "Type",
  'settings.ziele.termine.artPlaceholder': "p. ex. déclaration de TVA",
  'settings.ziele.termine.datumLabel': "Date",
  'settings.ziele.termine.datumPlaceholderRec': "01-10 (MM-JJ)",
  'settings.ziele.termine.datumPlaceholderOnce': "2026-06-30 (AAAA-MM-JJ)",
  'settings.ziele.termine.datumHelp': "Récurrent : MM-JJ (p. ex. 01-10). Ponctuel : AAAA-MM-JJ.",
  'settings.ziele.termine.wiederkehrend': "Annuel",
  'settings.ziele.termine.aktiv': "Actif",
  'settings.ziele.termine.remove': "Retirer",
  'settings.ziele.termine.add': "Ajouter une échéance",
  'settings.ziele.termine.empty': "Aucune échéance créée pour l'instant.",
  'settings.ziele.termine.max': "12 échéances maximum.",
  'settings.ziele.termine.disclaimer': "Rappels sans engagement, pas de conseil fiscal.",
  'settings.ziele.error.datum': "Veuillez indiquer une date valide — récurrent MM-JJ, ponctuel AAAA-MM-JJ.",

  // Impressum-Generator (§ 5 DDG) – Betrieb-Tab. Pflichtangaben stammen aus den
  // Feldern oben (Adresse/Steuer). Inhalte selbst sind Betriebsdaten (nicht übersetzt).
  'settings.impressum.title': "Mentions légales",
  'settings.impressum.subtitle': "Mentions obligatoires selon § 5 DDG pour vos pages publiques (réservation, statut, document).",
  'settings.impressum.disclaimer': "Générateur automatique, pas de conseil juridique : Detailly génère les mentions légales à partir de vos données de base. En tant qu'atelier, vous êtes responsable de leur exactitude et de leur exhaustivité.",
  'settings.impressum.vertretung.inhaber': "Propriétaire (nom et prénom)",
  'settings.impressum.vertretung.gbr': "Associés (tous nommés)",
  'settings.impressum.vertretung.vertreter': "Représentant(s) légal(aux)",
  'settings.impressum.vertretungPlaceholder': "p. ex. Max Mustermann",
  'settings.impressum.vertretungHelp': "Apparaît dans les mentions légales comme personne responsable. S'il y en a plusieurs, indiquez-les toutes.",
  'settings.impressum.complete': "Mentions légales complètes — toutes les mentions obligatoires sont renseignées.",
  'settings.impressum.ustWarn': "Recommandation : ajoutez le USt-IdNr. (§ 27a UStG) dès que vous en disposez.",
  'settings.impressum.incomplete': "Ces mentions manquent pour des mentions légales complètes :",
  'settings.impressum.incompleteHint': "Des mentions légales incomplètes peuvent faire l'objet d'une mise en demeure. Les champs manquants se renseignent dans les sections ci-dessus (adresse, fiscalité/forme juridique).",
  'settings.impressum.feld.firmenname': "Raison sociale",
  'settings.impressum.feld.strasse': "Rue et numéro",
  'settings.impressum.feld.plz': "Code postal",
  'settings.impressum.feld.ort': "Ville",
  'settings.impressum.feld.telefon': "Numéro de téléphone",
  'settings.impressum.feld.email': "Adresse e-mail",
  'settings.impressum.feld.vertretungsberechtigte': "Personne responsable (propriétaire/gérant/associé)",
  'settings.impressum.feld.registergericht': "Tribunal du registre",
  'settings.impressum.feld.registernummer': "Numéro de registre (HRB)",
  'settings.impressum.previewTitle': "Aperçu",
  'settings.impressum.previewHeading': "Mentions selon § 5 DDG",
  'settings.impressum.placeholderName': "[Raison sociale manquante]",
  'settings.impressum.previewPhone': "Téléphone",
  'settings.impressum.previewEmail': "E-mail",
  'settings.impressum.previewRegister': "Tribunal du registre",
  'settings.impressum.previewUstId': "USt-IdNr.",
  'settings.impressum.viewLive': "Ouvrir la vue publique",
  'settings.impressum.optionalTitle': "Mentions supplémentaires facultatives",
  'settings.impressum.optionalHint': "Nécessaires uniquement pour certains ateliers — généralement non pertinentes pour le detailing/covering/PPF.",
  'settings.impressum.berufshaftpflicht': "Assurance responsabilité civile professionnelle",
  'settings.impressum.berufshaftpflichtPlaceholder': "p. ex. assureur, adresse, champ d'application territorial",
  'settings.impressum.aufsichtsbehoerde': "Autorité de surveillance",
  'settings.impressum.aufsichtsbehoerdePlaceholder': "uniquement pour les activités soumises à autorisation",

  // Einstellungen: Auf detailly.de zeigen (Opt-in Mitgliederliste)
  'settings.mitglied.title': "Afficher sur detailly.de",
  'settings.mitglied.subtitle': "Référencer votre atelier sur notre page d'accueil — facultatif et révocable à tout moment.",
  'settings.mitglied.toggle': "Afficher sur la page d'accueil de Detailly",
  'settings.mitglied.toggleHint': "Uniquement avec votre accord. Sont affichés la raison sociale, le type d'atelier et, en option, la ville, une brève description et le site web — jamais les coordonnées.",
  'settings.mitglied.stadt': "Ville (facultatif)",
  'settings.mitglied.stadtPlaceholder': "p. ex. Berlin",
  'settings.mitglied.kurzbeschreibung': "Brève description (facultatif)",
  'settings.mitglied.kurzbeschreibungPlaceholder': "p. ex. Detailing et covering premium depuis 2015",
  'settings.mitglied.kurzbeschreibungHelp': "Max. 160 caractères.",
  'settings.mitglied.webseite': "Site web (facultatif)",
  'settings.mitglied.webseitePlaceholder': "https://votre-atelier.fr",
  'settings.mitglied.webseiteHelp': "Doit commencer par http:// ou https://.",
  'settings.mitglied.previewLabel': "Aperçu",
  'settings.mitglied.consent': "Votre atelier n'apparaît sur notre page d'accueil qu'avec votre accord ; révocable à tout moment.",

  // Einstellungen: Bankverbindung
  'settings.bank.title': "Coordonnées bancaires",
  'settings.bank.subtitle': "Apparaît au pied de la facture.",
  'settings.bank.bankname': "Banque",
  'settings.bank.iban': "IBAN",
  'settings.bank.bic': "BIC",

  // Einstellungen: Rechnungsstellung
  'settings.invoice.title': "Facturation",
  'settings.invoice.subtitle': "Valeurs par défaut pour les nouvelles factures — les documents existants restent inchangés.",
  'settings.invoice.paymentTerm': "Délai de paiement (jours)",
  'settings.invoice.paymentTermHelp': "Laisser vide = 14 jours.",
  'settings.invoice.paymentLink': "Lien de paiement",
  'settings.invoice.paymentLinkPlaceholder': "https://paypal.me/votre-atelier",
  'settings.invoice.paymentLinkHelp': "Votre propre lien de paiement PayPal.me ou Stripe. Apparaît comme bouton « Payer en ligne » sur la page publique du document — les paiements vous parviennent directement, jamais via Detailly. Doit commencer par https://.",
  'settings.invoice.footer': "Texte de pied de page sur les documents",
  'settings.invoice.footerPlaceholder': "p. ex. Merci pour votre commande ! Nos CGV s'appliquent.",
  'settings.invoice.footerHelp': "Apparaît dans le pied de page des PDF de devis et de factures.",

  // Einstellungen: Mahnwesen
  'settings.mahn.title': "Relances",
  'settings.mahn.subtitle': "Délais et frais pour les rappels de paiement et les relances.",
  'settings.mahn.auto': "Relancer automatiquement",
  'settings.mahn.autoHint': "Relances automatiques — sinon vous relancez manuellement dans le cockpit de relance.",
  'settings.mahn.deadlines': "Délais (jours après échéance)",
  'settings.mahn.reminder': "Rappel",
  'settings.mahn.dunning1': "1re relance",
  'settings.mahn.dunning2': "2e relance",
  'settings.mahn.deadlinesHelp': "Strictement croissant : rappel < 1re relance < 2e relance (chacun 1–365 jours).",
  'settings.mahn.fees': "Frais de relance (€)",
  'settings.mahn.feesHelp': "De 0 à 999 € par niveau. Apparaît comme poste supplémentaire sur la relance.",

  // Einstellungen: Kunden-Benachrichtigungen
  'settings.notify.title': "Notifications client",
  'settings.notify.subtitle': "E-mails automatiques aux clients — désactivables à tout moment.",
  'settings.notify.status': "E-mails de statut de l'ordre",
  'settings.notify.statusHint': "Les clients disposant d'une adresse e-mail reçoivent automatiquement un message avec un lien de suivi de l'ordre lors des changements de statut importants.",
  'settings.notify.appointment': "Confirmation de rendez-vous",
  'settings.notify.appointmentHint': "Les clients reçoivent un e-mail de confirmation lorsque leur demande de rendez-vous en ligne est acceptée.",

  // Einstellungen: Kundenkommunikation (Termin-Erinnerung, Bewertungs-Bitte, Status-Mails)
  'settings.kk.intro.title': "Communication client",
  'settings.kk.intro.subtitle': "E-mails automatiques à vos clients : rappels, demande d'avis et informations de statut.",
  'settings.kk.reviewNote': "Rien ne part par erreur : nous n'envoyons les e-mails automatiques aux clients que si vous activez délibérément l'interrupteur correspondant. Tout ici est désactivable à tout moment.",
  'settings.kk.reminder.title': "Rappel de rendez-vous",
  'settings.kk.reminder.subtitle': "Rappelle automatiquement leur rendez-vous à venir aux clients disposant d'une adresse e-mail.",
  'settings.kk.reminder.toggle': "Envoyer un rappel de rendez-vous",
  'settings.kk.reminder.toggleHint': "Les clients reçoivent un rappel amical avant le rendez-vous — chaque rappel n'est envoyé qu'une seule fois.",
  'settings.kk.reminder.hoursLabel': "Préavis (heures avant)",
  'settings.kk.reminder.hoursHelp': "Combien d'heures avant le début du rendez-vous le rappel est envoyé (1–168, standard 24).",
  'settings.kk.review.title': "Demande d'avis",
  'settings.kk.review.subtitle': "Ajoute un lien d'avis à l'e-mail « Véhicule prêt à être récupéré » — uniquement s'il est activé et qu'un lien est renseigné.",
  'settings.kk.review.toggle': "Demander un avis",
  'settings.kk.review.toggleHint': "Ajoute à l'e-mail de clôture un lien vers votre avis Google.",
  'settings.kk.review.urlLabel': "Lien d'avis Google",
  'settings.kk.review.urlHelp': "Doit commencer par https://. Le plus simple via votre fiche d'établissement Google (« Rédiger un avis »).",
  'settings.kk.review.urlPlaceholder': "https://g.page/r/...",
  'settings.kk.review.textLabel': "Texte d'invitation personnalisé (facultatif)",
  'settings.kk.review.textHelp': "Laisser vide pour le texte standard.",
  'settings.kk.review.textPlaceholder': "Étiez-vous satisfait ? Un court avis nous ferait très plaisir :",
  'settings.kk.error.url': "Le lien d'avis doit commencer par https://.",

  // Einstellungen: Sicherheit (2FA-Pflicht, Owner-Policy)
  'settings.security.title': "Sécurité",
  'settings.security.subtitle': "Authentification à deux facteurs pour votre équipe.",
  'settings.security.mfaRequired': "2FA obligatoire pour les employés",
  'settings.security.mfaRequiredHint': "Tous les rôles de l'atelier doivent configurer l'authentification à deux facteurs avant de pouvoir continuer à travailler.",

  // Zwei-Faktor-Authentifizierung (Profil-Sektion + Banner)
  'mfa.title': "Authentification à deux facteurs",
  'mfa.subtitle': "Protection supplémentaire de votre compte avec une application d'authentification.",
  'mfa.idle.desc': "Lorsque l'authentification à deux facteurs est active, vous avez besoin en plus, à la connexion, d'un code à usage unique de votre application d'authentification.",
  'mfa.idle.setupCta': "Configurer la 2FA",
  'mfa.required.note': "Votre atelier exige l'authentification à deux facteurs. Configurez-la maintenant.",
  'mfa.recommended.note': "Pour votre rôle, l'authentification à deux facteurs est fortement recommandée.",
  'mfa.setup.step1': "Scanner avec l'application d'authentification",
  'mfa.setup.step2': "Impossible de scanner ? Saisissez cette clé manuellement dans l'application.",
  'mfa.setup.secretLabel': "Clé de configuration",
  'mfa.setup.copySecret': "Copier",
  'mfa.setup.secretCopied': "Copié",
  'mfa.setup.codeLabel': "Code de l'application",
  'mfa.setup.codeHint': "Saisissez le code à 6 chiffres actuellement affiché pour terminer la configuration.",
  'mfa.setup.activate': "Activer",
  'mfa.setup.cancel': "Annuler",
  'mfa.recovery.title': "Codes de récupération",
  'mfa.recovery.desc': "Conservez ces codes en lieu sûr — chacun ne fonctionne qu'une seule fois.",
  'mfa.recovery.warn': "Ces codes ne sont affichés que maintenant. Sans application d'authentification, ils sont votre seul accès — enregistrez-les ou imprimez-les en lieu sûr.",
  'mfa.recovery.copy': "Tout copier",
  'mfa.recovery.copied': "Copié",
  'mfa.recovery.download': "Enregistrer dans un fichier",
  'mfa.recovery.done': "Je les ai sauvegardés",
  'mfa.enabled.status': "L'authentification à deux facteurs est active.",
  'mfa.enabled.deactivate': "Désactiver la 2FA",
  'mfa.deact.title': "Pour désactiver, saisissez un code actuel de l'application ou votre mot de passe.",
  'mfa.deact.codeLabel': "Code de l'application",
  'mfa.deact.passwordLabel': "Mot de passe",
  'mfa.deact.usePassword': "Utiliser le mot de passe à la place",
  'mfa.deact.useCode': "Utiliser le code de l'application à la place",
  'mfa.deact.confirm': "Désactiver",
  'mfa.deact.cancel': "Annuler",
  'mfa.toast.activated': "Authentification à deux facteurs activée.",
  'mfa.toast.deactivated': "Authentification à deux facteurs désactivée.",
  'mfa.error.generic': "L'action a échoué. Veuillez réessayer.",
  'mfa.banner.required': "Votre atelier exige l'authentification à deux facteurs. Configurez-la maintenant.",
  'mfa.banner.recommended': "Pour votre rôle, l'authentification à deux facteurs est fortement recommandée.",
  'mfa.banner.setupCta': "Configurer maintenant",

  // Einstellungen: Mail-Versand
  'settings.mail.title': "Envoi d'e-mails (expéditeur personnel)",
  'settings.mail.subtitle': "Facultatif : envoyer les e-mails clients et de documents via votre propre serveur SMTP et votre propre expéditeur.",
  'settings.mail.useOwn': "Utiliser un expéditeur personnel",
  'settings.mail.useOwnHint': "Sans configuration active, Detailly continue d'envoyer depuis l'adresse standard.",
  'settings.mail.host': "Hôte SMTP",
  'settings.mail.hostPlaceholder': "p. ex. smtp.votre-fournisseur.fr",
  'settings.mail.port': "Port",
  'settings.mail.encryption': "Chiffrement",
  'settings.mail.user': "Utilisateur",
  'settings.mail.userPlaceholder': "Nom de connexion au serveur de messagerie",
  'settings.mail.password': "Mot de passe",
  'settings.mail.passwordPlaceholder': "Saisir le mot de passe SMTP",
  'settings.mail.passwordPlaceholderSet': "Enregistré ({hint}) – pour le modifier, saisissez un nouveau mot de passe",
  'settings.mail.passwordHelp': "Laisser vide = inchangé. Enregistré de façon chiffrée et jamais réaffiché.",
  'settings.mail.fromEmail': "Adresse d'expéditeur (From)",
  'settings.mail.fromEmailPlaceholder': "facture@votre-atelier.fr",
  'settings.mail.fromName': "Nom de l'expéditeur",
  'settings.mail.fromNamePlaceholder': "p. ex. le nom de votre atelier",
  'settings.mail.testInfoPre': "L'e-mail de test est envoyé à l'adresse d'expéditeur enregistrée et vérifie la ",
  'settings.mail.testInfoEmph': "dernière enregistrée",
  'settings.mail.testInfoPost': " configuration. Enregistrez donc d'abord les modifications, puis testez.",
  'settings.mail.testTitleOn': "Envoie un e-mail de test à l'adresse d'expéditeur",
  'settings.mail.testTitleOff': "Activez et enregistrez d'abord « Utiliser un expéditeur personnel »",
  'settings.mail.sending': "Envoi…",
  'settings.mail.testSend': "Envoyer un e-mail de test",
  'settings.mail.confirmMsgPre': "Un e-mail de test sera envoyé à l'adresse d'expéditeur enregistrée",
  'settings.mail.confirmMsgPost': ". La dernière configuration SMTP enregistrée est vérifiée.",

  // Einstellungen: Eigene Domain & Zustellbarkeit (SPF/DKIM/MX)
  'settings.maildomain.domain': "Domaine personnel",
  'settings.maildomain.domainPlaceholder': "p. ex. votre-atelier.fr",
  'settings.maildomain.domainHelp': "Le domaine de votre adresse d'expéditeur. Ce n'est qu'après l'enregistrement que vous pourrez afficher les enregistrements DNS et vérifier le domaine.",
  'settings.maildomain.title': "Vérifier la délivrabilité",
  'settings.maildomain.badgeVerified': "Domaine vérifié",
  'settings.maildomain.badgeUnverified': "Non vérifié",
  'settings.maildomain.spamHint': "Sans domaine vérifié (SPF & DKIM), vos e-mails arrivent souvent dans les spams du destinataire. Ajoutez les enregistrements DNS ci-dessous chez votre fournisseur de domaine, puis vérifiez.",
  'settings.maildomain.showRecords': "Afficher les enregistrements DNS",
  'settings.maildomain.hideRecords': "Masquer les enregistrements DNS",
  'settings.maildomain.record.spf': "Enregistrement SPF",
  'settings.maildomain.record.dkim': "Enregistrement DKIM",
  'settings.maildomain.recordType': "Type",
  'settings.maildomain.recordHost': "Nom / hôte",
  'settings.maildomain.recordValue': "Valeur",
  'settings.maildomain.recordsHint': "Dans l'enregistrement SPF, remplacez « VOTRE-FOURNISSEUR-MAIL » par l'include SPF de votre fournisseur de messagerie (voir sa documentation). La valeur DKIM doit être saisie exactement ainsi ; certains fournisseurs la divisent automatiquement.",
  'settings.maildomain.copy': "Copier",
  'settings.maildomain.copied': "Copié",
  'settings.maildomain.verify': "Vérifier le domaine",
  'settings.maildomain.verifying': "Vérification…",
  'settings.maildomain.verifyTitle': "Vérifie les enregistrements DNS (SPF, DKIM, MX) en direct",
  'settings.maildomain.verifyFailed': "Échec de la vérification",
  'settings.maildomain.verifiedToast': "Domaine vérifié avec succès – les e-mails sont désormais signés DKIM.",
  'settings.maildomain.lastChecked': "Dernière vérification : {date}",
  'settings.maildomain.check.spf': "SPF",
  'settings.maildomain.check.dkim': "DKIM",
  'settings.maildomain.check.mx': "MX",
  'settings.maildomain.setDomainFirst': "Saisissez un domaine ci-dessus et enregistrez pour afficher les enregistrements DNS et vérifier la délivrabilité.",

  // Einstellungen: DATEV / Buchhaltung
  'settings.datev.title': "DATEV / comptabilité",
  'settings.datev.subtitle': "Pour l'export du lot d'écritures DATEV. Numéro de conseiller/client fourni par l'expert-comptable ; comptes préremplis avec les valeurs standard SKR03.",
  'settings.datev.beraterNr': "N° de conseiller",
  'settings.datev.beraterNrPlaceholder': "p. ex. 1001",
  'settings.datev.mandantNr': "N° de client",
  'settings.datev.mandantNrPlaceholder': "p. ex. 456",
  'settings.datev.skr': "Plan comptable (SKR)",
  'settings.datev.debitor': "Compte collectif clients",
  'settings.datev.erloes19': "Compte de produits 19 %",
  'settings.datev.erloes7': "Compte de produits 7 %",
  'settings.datev.erloes0': "Compte de produits exonéré / §19",
  'settings.datev.help': "Remarque : avant le premier import DATEV réel, veuillez faire une contre-vérification avec l'expert-comptable ou le programme de contrôle DATEV gratuit.",

  // Einstellungen: sevDesk-Anbindung
  'settings.sevdesk.title': "Connexion sevDesk",
  'settings.sevdesk.subtitle': "Facultatif : transférer automatiquement les factures émises vers votre compte sevDesk.",
  'settings.sevdesk.apiToken': "Jeton d'API",
  'settings.sevdesk.tokenPlaceholder': "Coller le jeton d'API sevDesk",
  'settings.sevdesk.tokenPlaceholderSet': "Enregistré ({hint}) – pour le modifier, saisissez un nouveau jeton",
  'settings.sevdesk.help': "À trouver dans sevDesk sous Paramètres → Utilisateur → Jeton d'API. Enregistré de façon chiffrée et jamais réaffiché.",
  'settings.sevdesk.testTitle': "Teste le jeton enregistré",
  'settings.sevdesk.testing': "Test…",
  'settings.sevdesk.test': "Tester la connexion",
  'settings.sevdesk.remove': "Retirer le jeton",

  // Einstellungen: Fehler / Validierung
  'settings.error.saveFailed': "Échec de l'enregistrement",
  'settings.error.loadFailed': "Impossible de charger les données de base",
  'settings.error.testFailed': "Échec du test",
  'settings.error.removeFailed': "Échec du retrait",
  'settings.error.mahnDaysRange': "Les délais de relance doivent être des nombres entiers entre 1 et 365 jours.",
  'settings.error.mahnDaysOrder': "Les délais de relance doivent être croissants (rappel < 1re relance < 2e relance).",
  'settings.error.mailHostRequired': "Pour l'envoi d'e-mails personnel, un hôte SMTP est requis.",
  'settings.error.mailPortRange': "Le port SMTP doit être compris entre 1 et 65535.",
  'settings.error.mailFromInvalid': "Veuillez indiquer une adresse d'expéditeur (From) valide.",
  'settings.error.mailDomainMismatch': "L'adresse d'expéditeur doit appartenir au domaine enregistré.",
  'settings.error.mitgliedWebseite': "Le site web doit commencer par http:// ou https://.",

  // ---- Login ---------------------------------------------------------------
  'login.subtitle': "Detailing Suite — detailing, covering & PPF",
  'login.email': "E-mail",
  'login.password': "Mot de passe",
  'login.forgot': "Mot de passe oublié ?",
  'login.showPassword': "Afficher le mot de passe",
  'login.hidePassword': "Masquer le mot de passe",
  'login.submit': "Se connecter",
  'login.submitting': "Connexion…",
  'login.failed': "Échec de la connexion",
  'login.noAccount': "Pas encore de compte ?",
  'login.registerCta': "Enregistrer un atelier",
  'login.footer': "© {year} Detailly · Logiciel de detailing indépendant",
  // Login: zweite Stufe (2FA)
  'login.mfaSubtitle': "Confirmation à deux facteurs",
  'login.mfaHint': "Saisissez le code à 6 chiffres de votre application d'authentification.",
  'login.mfaCode': "Code de confirmation",
  'login.mfaSubmit': "Confirmer et se connecter",
  'login.mfaVerifying': "Vérification…",
  'login.mfaUseRecovery': "Utiliser un code de récupération",
  'login.mfaUseCode': "Revenir au code de l'application",
  'login.mfaRecovery': "Code de récupération",
  'login.mfaRecoveryHint': "L'un des codes à usage unique enregistrés lors de la configuration.",
  'login.mfaBack': "Annuler",
  'login.mfaFailed': "Code invalide ou expiré",

  // ===========================================================================
  // LANDING (Route "/")
  // ===========================================================================

  // ---- Kopfleiste ----------------------------------------------------------
  'landing.nav.branchen': "Secteurs",
  'landing.nav.ablauf': "Comment ça marche",
  'landing.nav.funktionen': "Fonctions",
  'landing.nav.faq': "FAQ",
  'landing.nav.login': "Se connecter",
  'landing.nav.trial': "Essai gratuit",

  // ---- Hero ----------------------------------------------------------------
  'landing.hero.badge': "Le logiciel d'atelier pour le detailing, le covering & le PPF",
  'landing.hero.eyebrow': "Logiciel d'atelier · Detailing / Covering / PPF",
  'landing.hero.headlinePre': "Plus de temps ",
  'landing.hero.headlineEm': "sur le véhicule",
  'landing.hero.headlinePost': ". Moins de temps au bureau.",
  'landing.hero.title1': "Votre métier, c'est la précision.",
  'landing.hero.title2': "Votre logiciel aussi, désormais.",
  'landing.hero.sub': "Réception avec relevé des dommages en 3D et signature en quatre minutes — commande, facture et relance suivent automatiquement.",
  'landing.hero.ctaPrimary': "Essayer 14 jours gratuitement",
  'landing.hero.ctaSecondary': "Voir les fonctions",
  'landing.hero.trailer': "Sans carte bancaire · Prêt en quelques minutes · Résiliable chaque mois",

  // ---- Signature A: µm-Schichtdicken-Readout -------------------------------
  'landing.messwert.label': "Épaisseur de couche",
  'landing.messwert.unit': "µm",
  'landing.messwert.measuring': "mesure …",
  'landing.messwert.status': "dans la tolérance",
  'landing.messwert.surface': "Surface peinte · Capot",
  'landing.messwert.caption': "À la réception, c'est la valeur mesurée qui compte, pas l'affirmation. C'est ainsi que travaille Detailly : documenté et prouvable. (La mesure de l'épaisseur de couche fait partie de l'outil de réception, pas de Detailly.)",
  'landing.messwert.aria': "Mesure de l'épaisseur de couche : valeur dans la plage de tolérance, calée en vert.",

  // ---- Funktionen als Datenblatt (Label ↔ Fakt) ----------------------------
  'landing.datenblatt.kicker': "Fiche technique",
  'landing.datenblatt.title': "Ce qu'il contient — en faits, pas en promesses.",
  'landing.datenblatt.sub': "Chaque ligne est une fonction présente aujourd'hui dans le produit.",
  'landing.datenblatt.footnote': "En plus : recherche globale, utilisation mobile et plusieurs employés par atelier.",
  'landing.datenblatt.kunden.label': "Clients & véhicules",
  'landing.datenblatt.kunden.fact': "Dossier véhicule · historique complet",
  'landing.datenblatt.auftraege.label': "Ordres & planning",
  'landing.datenblatt.auftraege.fact': "Planification hebdomadaire · rendez-vous · avancement",
  'landing.datenblatt.schaden.label': "Constat de dommages",
  'landing.datenblatt.schaden.fact': "Modèle 3D · photo · signature",
  'landing.datenblatt.rechnung.label': "Factures",
  'landing.datenblatt.rechnung.fact': "GoBD §14 · XRechnung · ZUGFeRD",
  'landing.datenblatt.zahlung.label': "Paiements",
  'landing.datenblatt.zahlung.fact': "Échéances · relances",
  'landing.datenblatt.kasse.label': "Livre de caisse",
  'landing.datenblatt.kasse.fact': "Conforme GoBD · au jour près",
  'landing.datenblatt.kalkulation.label': "Calcul",
  'landing.datenblatt.kalkulation.fact': "par métier · detailing / covering / PPF",
  'landing.datenblatt.datenschutz.label': "Protection des données",
  'landing.datenblatt.datenschutz.fact': "RGPD · chiffré · séparé par atelier",
  'landing.datenblatt.sprachen.label': "Langues",
  'landing.datenblatt.sprachen.fact': "4 · DE / EN / RU / PL",
  'landing.datenblatt.zugriff.label': "Accès",
  'landing.datenblatt.zugriff.fact': "Navigateur · tablette · smartphone",
  'landing.datenblatt.dellen.label': "Chiffrage des bosses",
  'landing.datenblatt.dellen.fact': "Smart Repair / PDR · prix immédiat",
  'landing.datenblatt.buchhaltung.label': "Comptabilité",
  'landing.datenblatt.buchhaltung.fact': "DATEV · sevDesk · CSV",
  'landing.datenblatt.shop.label': "Boutique et marketplace",
  'landing.datenblatt.shop.fact': "Achat B2B · bibliothèque de films",

  // ---- Vertrauens-Leiste ---------------------------------------------------
  'landing.trust.dsgvo': "Conforme au RGPD",
  'landing.trust.gobd': "Factures conformes GoBD",
  'landing.trust.madeInGermany': "Made in Germany",
  'landing.trust.encrypted': "Données chiffrées",
  'landing.trust.noInstall': "Aucune installation",

  // ---- Problem -------------------------------------------------------------
  'landing.problem.kicker': "Ça vous parle ?",
  'landing.problem.title': "L'atelier tourne — l'administratif freine.",
  'landing.problem.sub': "Alors que le travail sur le véhicule exige de la précision, tout le reste s'enlise dans la paperasse.",
  'landing.problem.p1': "L'historique du véhicule est éparpillé dans des classeurs, des post-it et dans la tête.",
  'landing.problem.p2': "Les factures traînent — et vous coûtent de l'argent bien réel.",
  'landing.problem.p3': "Les dommages à la réception ne peuvent guère être prouvés par la suite.",
  'landing.problem.p4': "Cinq outils différents qui ne se parlent pas.",
  'landing.problem.summaryPre': "Detailly réunit tout cela dans ",
  'landing.problem.summaryEm': "un seul",
  'landing.problem.summaryPost': " système — clair, rapide, sur chaque appareil.",

  // ---- Branchen-Switcher ---------------------------------------------------
  'landing.branchen.kicker': "Conçu pour votre métier",
  'landing.branchen.title': "Un logiciel qui parle le langage de votre métier",
  'landing.branchen.sub': "Au démarrage, vous choisissez votre spécialité — Detailly adapte le catalogue de prestations, le calcul et même l'apparence. Essayez : choisissez votre métier et regardez la page changer de couleur.",
  'landing.branchen.selected': "Sélectionné",
  'landing.branchen.cta': "Démarrer en tant que {label}",
  'landing.branchen.complete': "Tout d'un seul fournisseur ?",
  'landing.branchen.completeCta': "Démarrer en tant que prestataire complet",
  'landing.branchen.aufbereitung.l1': "Rénovation intérieure & extérieure",
  'landing.branchen.aufbereitung.l2': "Polissage & protection céramique",
  'landing.branchen.aufbereitung.l3': "Contrôles de restitution de leasing",
  'landing.branchen.folierung.l1': "Covering total & partiel",
  'landing.branchen.folierung.l2': "Changement de couleur & design",
  'landing.branchen.folierung.l3': "Marquage publicitaire",
  'landing.branchen.ppf.l1': "Protection avant & intégrale",
  'landing.branchen.ppf.l2': "Packs anti-gravillons",
  'landing.branchen.ppf.l3': "Découpes précises",

  // ---- So funktioniert's ---------------------------------------------------
  'landing.ablauf.kicker': "C'est aussi simple que ça",
  'landing.ablauf.title': "En trois étapes vers un flux propre",
  'landing.ablauf.step1.title': "Réceptionner",
  'landing.ablauf.step1.desc': "Client, véhicule et dommages saisis en quelques minutes — avec marquage 3D, photos et signature numérique.",
  'landing.ablauf.step2.title': "Traiter",
  'landing.ablauf.step2.desc': "Calculer les prestations, planifier les rendez-vous sur le planning, garder l'avancement à l'œil à tout moment.",
  'landing.ablauf.step3.title': "Facturer",
  'landing.ablauf.step3.desc': "De l'ordre naît en un clic la facture conforme GoBD au format PDF — échéances et relances incluses.",

  // ---- Funktionen ----------------------------------------------------------
  'landing.funktionen.kicker': "Tous les outils",
  'landing.funktionen.title': "Tout ce dont votre atelier a besoin",
  'landing.funktionen.sub': "Un flux continu — de la réception du véhicule à la facture payée.",
  'landing.funktionen.kunden.title': "Clients & véhicules",
  'landing.funktionen.kunden.desc': "Données de base, dossier véhicule et historique complet par véhicule — retrouvables instantanément.",
  'landing.funktionen.auftraege.title': "Ordres & planning",
  'landing.funktionen.auftraege.desc': "Du devis à la réception. Planification hebdomadaire avec rendez-vous — tout à l'œil.",
  'landing.funktionen.rechnungen.title': "Factures & documents",
  'landing.funktionen.rechnungen.desc': "Factures et devis conformes §14 & GoBD au format PDF, échéances et relances incluses.",
  'landing.funktionen.schaden3d.title': "Constat de dommages en 3D",
  'landing.funktionen.schaden3d.desc': "Marquez les dommages directement sur le modèle du véhicule, documentez-les par des photos et faites-les signer numériquement.",
  'landing.funktionen.kalkulation.title': "Calcul par métier",
  'landing.funktionen.kalkulation.desc': "Catalogues de prestations et logique de prix pour le detailing, le covering et le PPF — adaptés à votre spécialité.",
  'landing.funktionen.dsgvo.title': "RGPD & sécurité",
  'landing.funktionen.dsgvo.desc': "Données sensibles chiffrées, strictement séparées par atelier, avec export et suppression des données en un clic.",
  'landing.funktionen.footnotePre': "En plus : recherche globale ultra-rapide (",
  'landing.funktionen.footnotePost': "), navigation mobile et plusieurs employés par atelier.",
  'landing.funktionen.buchhaltung.title': "Comptabilité et expert-comptable",
  'landing.funktionen.buchhaltung.desc': "Exportez les factures en lot DATEV (EXTF) ou CSV universel, connectez sevDesk et obtenez un aperçu des recettes (type EÜR) avec des analyses.",
  'landing.funktionen.shop.title': "Boutique et marketplace",
  'landing.funktionen.shop.desc': "Marketplace B2B intégrée : commandez matériel et films directement chez les grossistes. Plus la gestion des stocks et une bibliothèque de films dans votre boutique.",
  'landing.bundesweit.kicker': "Partout en Allemagne",
  'landing.bundesweit.title': "Pour les ateliers de toute l'Allemagne",
  'landing.bundesweit.sub': "De la côte aux Alpes : Detailly est conçu pour les ateliers allemands de detailing, covering et PPF — avec GoBD, XRechnung et ZUGFeRD.",
  'landing.bundesweit.caption': "Detailing · covering · PPF — prêt dans chaque région postale",
  'landing.bundesweit.aria': "Carte stylisée de l'Allemagne avec des points régionaux répartis",
  'landing.finanzShop.kicker': "Plus que des commandes",
  'landing.finanzShop.title': "Comptabilité et matériel — directement intégrés",
  'landing.finanzShop.buchhaltung.nutzen': "Vos chiffres vont directement à l'expert-comptable — sans double saisie.",
  'landing.finanzShop.shop.nutzen': "Recommandez du matériel sans quitter le logiciel.",
  'landing.dellen.kicker': "Smart Repair / PDR",
  'landing.dellen.title': "Cliquez sur la bosse, le prix s'affiche",
  'landing.dellen.desc': "Dommages de parking et de grêle chiffrés en quelques secondes : marquez la bosse sur le véhicule — Detailly calcule le prix immédiat selon la taille, le bord, l'aluminium et les dégâts de peinture.",
  'landing.dellen.cardHeader': "Chiffrage des bosses · PDR",
  'landing.dellen.priceLabel': "Prix immédiat",
  'landing.dellen.item': "Bosse",
  'landing.dellen.marker1': "Portière",
  'landing.dellen.marker2': "Aile",
  'landing.dellen.marker3': "Capot",
  'landing.dellen.note': "Valeurs d'exemple — vous définissez vos propres tarifs.",
  'landing.dellen.aria': "Chiffrage des bosses illustré : trois bosses sont marquées et le prix s'additionne.",

  // ---- 3D-Schadenserfassung (Showcase) -------------------------------------
  'landing.schaden.kicker': "Le point fort",
  'landing.schaden.title': "Constater les dommages avant qu'ils ne tournent au litige",
  'landing.schaden.desc': "À la réception, vous marquez rayures, bosses et impacts directement sur le modèle du véhicule — avec photos et signature numérique du client. Si des questions surgissent plus tard, vous avez les preuves. Noir sur blanc.",
  'landing.schaden.point1': "Placer les points de dommage directement sur le modèle 3D",
  'landing.schaden.point2': "Photos par dommage — associées automatiquement",
  'landing.schaden.point3': "Signature numérique à la réception et à la restitution",
  'landing.schaden.cardHeader': "Réception du véhicule · constat de dommages",
  'landing.schaden.cardBadge': "2 dommages",
  'landing.schaden.cardPhotos': "4 photos documentées",
  'landing.schaden.cardSignature': "Signature enregistrée",

  // ---- Landing: 3D-Showcase (LandingCar3D) --------------------------------
  'landing.showcase.aria': "Modèle 3D interactif du véhicule avec points de dommage marqués",
  'landing.showcase.pin1': "Impact · 2 photos",
  'landing.showcase.pin2': "Rayure · portière gauche",
  'landing.showcase.pin3': "Bosse · documentée",
  'landing.showcase.badgeOne': "{count} dommage",
  'landing.showcase.badgeMany': "{count} dommages",

  // ---- Wachstum ------------------------------------------------------------
  'landing.wachstum.kicker': "Évolutif",
  'landing.wachstum.title': "La croissance par la vue d'ensemble",
  'landing.wachstum.sub': "Qui est organisé et connaît ses chiffres prend de meilleures décisions — de l'atelier isolé à la chaîne.",
  'landing.wachstum.echtzeit.title': "Vue en temps réel",
  'landing.wachstum.echtzeit.desc': "Chiffre d'affaires, ordres ouverts et rendez-vous en direct dans le tableau de bord — vous voyez tout de suite ce qui roule et ce qui coince.",
  'landing.wachstum.standorte.title': "Plusieurs sites",
  'landing.wachstum.standorte.desc': "Gérez les succursales sous un même toit — bien séparées et pourtant centralisées. Extensible à mesure que vous grandissez.",
  'landing.wachstum.team.title': "Équipe, rôles & droits",
  'landing.wachstum.team.desc': "Invitez des employés et attribuez des rôles — chacun voit exactement ce qu'il doit voir. Surveillé et documenté proprement.",
  'landing.wachstum.chartVolume': "Volume d'ordres",
  'landing.wachstum.chartGrowing': "croît",
  'landing.wachstum.chartLocations': "Sites",

  // ---- Zahlen (Count-up) ---------------------------------------------------
  'landing.zahlen.stat1.unit': "Langues",
  'landing.zahlen.stat1.label': "en allemand, anglais, russe et polonais",
  'landing.zahlen.stat2.unit': "Jours",
  'landing.zahlen.stat2.label': "d'essai gratuit — sans carte bancaire",
  'landing.zahlen.stat3.value': "RGPD + GoBD",
  'landing.zahlen.stat3.label': "stocké et facturé en conformité",
  'landing.zahlen.stat4.value': "5 → 1",
  'landing.zahlen.stat4.label': "un système au lieu de cinq solutions isolées",

  // ---- Mitglieder (Social Proof, Opt-in) -----------------------------------
  'landing.mitglieder.kicker': "Retours du terrain",
  'landing.mitglieder.title': "Ces ateliers travaillent avec Detailly",
  'landing.mitglieder.sub': "Des spécialistes du detailing, du covering et des studios PPF qui utilisent Detailly au quotidien – et qui nous ont autorisés à les citer ici.",

  // ---- Deutschlandkarte (Qualitätssiegel, nur zahlende Opt-in-Betriebe) -----
  'landing.karte.kicker': "Présent partout",
  'landing.karte.title': "Ateliers Detailly dans toute l'Allemagne",
  'landing.karte.sub': "Ateliers membres vérifiés et actifs – sur la carte, grossièrement par région. Touchez un point pour voir les ateliers de la région.",
  'landing.karte.pin.aria': "{anzahl} ateliers dans la région postale {region}",
  'landing.karte.pin.aria.one': "Un atelier dans la région postale {region}",
  'landing.karte.pop.aria': "Ateliers dans la région postale {region}",
  'landing.karte.pop.region': "Région postale {region}",
  'landing.karte.pop.website': "Site web",
  'landing.karte.legende': "{betriebe} ateliers actifs dans {regionen} régions",

  // ---- Warum Detailly ------------------------------------------------------
  'landing.warum.kicker': "Pourquoi Detailly",
  'landing.warum.title': "Un logiciel pour l'atelier — pas pour le concessionnaire.",
  'landing.warum.body': "Les spécialistes du detailing, du covering et les studios PPF livrent un travail de précision et méritent un logiciel qui travaille tout aussi proprement. La plupart des programmes d'atelier sont conçus pour les grands concessionnaires : surchargés, compliqués et coûteux. Detailly est délibérément différent — léger, taillé pour vos processus et prêt en quelques minutes. Développé de façon indépendante, en Allemagne, avec la protection des données dès la conception.",

  // ---- News-Teaser ---------------------------------------------------------
  'landing.news.kicker': "Actus Detailly",
  'landing.news.title': "Ce qui bouge en ce moment",
  'landing.news.sub': "Mises à jour du produit et actualités autour de Detailly. (Entrées d'exemple — bientôt avec de vraies annonces.)",
  'landing.news.all': "Voir toutes les actus",

  // ---- FAQ -----------------------------------------------------------------
  'landing.faq.kicker': "Questions fréquentes",
  'landing.faq.title': "Ce que vous voulez savoir avant de démarrer",
  'landing.faq.q1.q': "Ai-je besoin de connaissances techniques ou d'une installation ?",
  'landing.faq.q1.a': "Non. Vous enregistrez votre atelier et démarrez directement dans le navigateur — sur ordinateur, tablette ou smartphone. Rien à installer, rien à configurer.",
  'landing.faq.q2.q': "Je fais du detailing ET du covering — que choisir ?",
  'landing.faq.q2.a': "Alors vous êtes prestataire complet : à l'inscription, choisissez simplement « Prestataire complet » et obtenez tous les catalogues de prestations et calculs ensemble.",
  'landing.faq.q3.q': "Quelle est la sécurité de mes données clients ?",
  'landing.faq.q3.a': "Les données sensibles sont stockées de façon chiffrée et strictement séparées des autres ateliers. Vous pouvez exporter ou supprimer les données clients à tout moment — entièrement conforme au RGPD.",
  'landing.faq.q4.q': "Que se passe-t-il après les 14 jours ?",
  'landing.faq.q4.a': "Vous testez sans carte bancaire et sans risque. Après la période d'essai, vous choisissez le forfait adapté à votre atelier. Si la période d'essai se termine, aucun frais ne vous est facturé.",
  'landing.faq.q5.q': "Est-ce que ça fonctionne aussi sur la tablette de l'atelier ?",
  'landing.faq.q5.a': "Oui. Detailly est conçu pour chaque appareil — du PC de bureau à la tablette à la réception du véhicule. L'interface s'adapte automatiquement.",
  'landing.faq.q6.q': "Puis-je récupérer mes données ?",
  'landing.faq.q6.a': "À tout moment. Vos données vous appartiennent — un export est possible en un clic, sans avoir à demander à qui que ce soit.",

  // ---- Abschluss-CTA -------------------------------------------------------
  'landing.cta.title': "Mettez de l'ordre dans votre atelier — dès aujourd'hui.",
  'landing.cta.sub': "Enregistrez votre atelier en quelques minutes et testez Detailly 14 jours gratuitement. Sans carte bancaire, sans risque.",
  'landing.cta.primary': "Commencer gratuitement",
  'landing.cta.secondary': "J'ai déjà un compte",

  // ---- Footer --------------------------------------------------------------
  'landing.footer.tagline': "Le logiciel d'atelier pour le detailing, le covering et le PPF. Développé de façon indépendante en Allemagne.",
  'landing.footer.discover': "Découvrir",
  'landing.footer.product': "Produit",
  'landing.footer.account': "Compte & mentions légales",
  'landing.footer.news': "Actus",
  'landing.footer.changelog': "Nouveautés",
  'landing.footer.masterclass': "Masterclass",
  'landing.footer.gruendung': "Création d'entreprise",
  'landing.footer.grosshaendler': "Pour les grossistes",
  'landing.footer.features': "Fonctions",
  'landing.footer.branchen': "Pour votre métier",
  'landing.footer.faq': "Questions fréquentes",
  'landing.footer.trial': "Essai gratuit",
  'landing.footer.login': "Se connecter",
  'landing.footer.register': "S'inscrire",
  'landing.footer.impressum': "Mentions légales",
  'landing.footer.datenschutz': "Protection des données",
  'landing.footer.copyright': "© {year} Detailly · Tous droits réservés",

  // ---- Kundenformular ------------------------------------------------------
  'kunden.form.leitwegId.label': "Leitweg-ID",
  'kunden.form.leitwegId.help': "Uniquement pour les factures aux administrations/donneurs d'ordre publics (pilote le routage B2G).",
  'kunden.form.editTitle': "Modifier le client",
  'kunden.form.saving': "Enregistrement…",
  'kunden.form.company': "Société",
  'kunden.form.firstName': "Prénom",
  'kunden.form.lastName': "Nom",
  'kunden.form.street': "Rue",
  'kunden.form.postalCode': "Code postal",
  'kunden.form.noNameHelp': "Aucun nom enregistré – p. ex. après anonymisation RGPD.",
  'kunden.form.gdprSection': "Protection des données (RGPD)",
  'kunden.form.exportJson': "Exporter les données (JSON)",
  'kunden.form.anonymizeBtn': "Supprimer / anonymiser les données",
  'kunden.form.gdprNote': "Les factures sont conservées pour des raisons légales (GoBD), mais sans lien avec la personne.",
  'kunden.form.anonymize.title': "Supprimer définitivement les données client ?",
  'kunden.form.anonymize.msgPre': "Les données personnelles sont supprimées ou anonymisées. Les factures sont conservées pour des raisons légales (GoBD, 10 ans), mais sans lien avec la personne. Cette opération ne peut ",
  'kunden.form.anonymize.msgEmph': "pas être annulée",
  'kunden.form.anonymize.msgPost': ".",
  'kunden.form.anonymize.confirm': "Supprimer définitivement",
  'kunden.form.error.save': "Échec de l'enregistrement",
  'kunden.form.error.export': "Échec de l'export",
  'kunden.form.error.anonymize': "Échec de la suppression",
  'kunden.form.gdpr.checking': "Vérification des documents…",
  'kunden.form.gdpr.willAnonymize': "Il existe {count} documents soumis à conservation. Le client est donc anonymisé – les documents sont conservés pour des raisons légales (GoBD/§147 AO), mais sans lien avec la personne. Cette opération ne peut ",
  'kunden.form.gdpr.willDelete': "Il n'existe aucun document soumis à conservation. Le client est entièrement supprimé avec tous ses véhicules, rendez-vous, photos et brouillons. Cette opération ne peut ",
  'kunden.form.gdpr.irreversible': "pas être annulée.",
  'kunden.form.gdpr.confirmDelete': "Supprimer définitivement",

  // ===========================================================================
  // KUNDEN (Route "/kunden")
  // ===========================================================================
  'kunden.title': "Clients",
  'kunden.subtitle': "Particuliers et professionnels",
  'kunden.csvImport': "Import CSV",
  'kunden.new': "Nouveau client",
  'kunden.searchPlaceholder': "Rechercher par nom, e-mail, téléphone…",

  // ---- Leerzustand ---------------------------------------------------------
  'kunden.empty.none': "Aucun client créé pour l'instant.",
  'kunden.empty.filtered': "Aucun client trouvé.",
  'kunden.empty.cta': "Créer le premier client",

  // ---- Tabellenspalten -----------------------------------------------------
  'kunden.col.name': "Nom",
  'kunden.col.typ': "Type",
  'kunden.col.email': "E-mail",
  'kunden.col.telefon': "Téléphone",
  'kunden.col.ort': "Ville",

  // ---- Kundentyp -----------------------------------------------------------
  'kunden.type.business': "Professionnel",
  'kunden.type.private': "Particulier",

  // ---- Aktionsmenü ---------------------------------------------------------
  'kunden.actionsFor': "Actions pour {name}",
  'kunden.action.open': "Ouvrir",
  'kunden.action.newOrder': "Nouvel ordre",
  'kunden.action.edit': "Modifier",

  // ---- Toast / Fehler / Löschen-Bestätigung --------------------------------
  'kunden.toast.deleted': "{name} supprimé",
  'kunden.error.delete': "Échec de la suppression",
  'kunden.delete.title': "Supprimer le client",
  'kunden.delete.msg': "Supprimer vraiment {name} ? Le client est désactivé et retiré de la liste. Les ordres et factures déjà saisis sont conservés.",

  // ---- Kundenakte (Route "/kunden/detail") ---------------------------------
  'kunden.detail.businessCustomer': "Client professionnel",
  'kunden.detail.privateCustomer': "Client particulier",
  'kunden.detail.addVehicle': "Ajouter un véhicule",
  'kunden.detail.contact': "Contact",
  'kunden.detail.address': "Adresse",
  'kunden.detail.vatNumber': "USt-IdNr.",
  'kunden.detail.stat.vehicles': "Véhicules",
  'kunden.detail.stat.openOrders': "Ordres ouverts",
  'kunden.detail.stat.openInvoices': "Factures ouvertes",
  'kunden.detail.stat.paidTotal': "Payé au total",
  'kunden.detail.pieces': "{n} pièces",
  'kunden.detail.vehicles': "Véhicules",
  'kunden.detail.vehicleCountOne': "{n} véhicule",
  'kunden.detail.vehicleCountMany': "{n} véhicules",
  'kunden.detail.emptyVehicles': "Aucun véhicule enregistré.",
  'kunden.detail.openFile': "Dossier",
  'kunden.detail.appointments': "Rendez-vous",
  'kunden.detail.newestFirst': "Les plus récents d'abord",
  'kunden.detail.emptyAppts': "Aucun rendez-vous.",
  'kunden.detail.orders': "Ordres",
  'kunden.detail.totalCount': "{n} au total",
  'kunden.detail.emptyOrders': "Aucun ordre pour l'instant.",
  'kunden.detail.invoices': "Factures & devis",
  'kunden.detail.emptyInvoices': "Aucun document pour l'instant.",
  'kunden.detail.pdf': "PDF",
  'kunden.detail.error.load': "Impossible de charger le client",
  'kunden.detail.error.pdf': "Impossible de charger le PDF",

  // ===========================================================================
  // FAHRZEUGE (Route "/fahrzeuge")
  // ===========================================================================
  'fahrzeuge.title': "Véhicules",
  'fahrzeuge.subtitle': "Parc de véhicules avec dossier véhicule",
  'fahrzeuge.new': "Nouveau véhicule",
  'fahrzeuge.searchPlaceholder': "Rechercher par plaque, marque, modèle ou titulaire…",

  // ---- Leerzustand ---------------------------------------------------------
  'fahrzeuge.empty.none': "Aucun véhicule créé pour l'instant.",
  'fahrzeuge.empty.filtered': "Aucun véhicule trouvé.",
  'fahrzeuge.empty.cta': "Créer le premier véhicule",

  // ---- Tabellenspalten -----------------------------------------------------
  'fahrzeuge.col.fahrzeug': "Véhicule",
  'fahrzeuge.col.kennzeichen': "Plaque",
  'fahrzeuge.col.halter': "Titulaire",
  'fahrzeuge.col.baujahr': "Année",

  // ---- Aktionsmenü ---------------------------------------------------------
  'fahrzeuge.actionsFor': "Actions pour {name}",
  'fahrzeuge.action.open': "Ouvrir le dossier véhicule",
  'fahrzeuge.action.newOrder': "Nouvel ordre",

  // ---- Formular (Neues Fahrzeug) -------------------------------------------
  'fahrzeuge.form.halter': "Titulaire",
  'fahrzeuge.form.selectPlaceholder': "– choisir –",
  'fahrzeuge.form.marke': "Marque",
  'fahrzeuge.form.modell': "Modèle",
  'fahrzeuge.form.variante': "Variante",
  'fahrzeuge.form.baujahr': "Année",
  'fahrzeuge.form.farbe': "Couleur",
  'fahrzeuge.form.kennzeichen': "Plaque",
  'fahrzeuge.form.kraftstoff': "Carburant",
  'fahrzeuge.form.flaeche': "Surface (m²)",

  // ---- Kraftstoffarten -----------------------------------------------------
  'fahrzeuge.fuel.petrol': "Essence",
  'fahrzeuge.fuel.diesel': "Diesel",
  'fahrzeuge.fuel.electric': "Électrique",
  'fahrzeuge.fuel.hybrid': "Hybride",
  'fahrzeuge.saving': "Enregistrement…",

  // ---- Toast / Fehler / Löschen-Bestätigung --------------------------------
  'fahrzeuge.toast.deleted': "{name} supprimé",
  'fahrzeuge.error.delete': "Échec de la suppression",
  'fahrzeuge.error.save': "Échec de l'enregistrement",
  'fahrzeuge.delete.title': "Supprimer le véhicule",
  'fahrzeuge.delete.msg': "Supprimer vraiment {name} ? Le véhicule est retiré de la liste. Les ordres et rendez-vous déjà saisis sont conservés.",

  // ---- Fahrzeugakte (Route "/fahrzeuge/detail") ----------------------------
  'fahrzeuge.detail.subtitle': "Dossier véhicule",
  'fahrzeuge.detail.masterData': "Données de base",
  'fahrzeuge.detail.makeModel': "Marque / modèle",
  'fahrzeuge.detail.area': "Surface",
  'fahrzeuge.detail.sqm': "{n} m²",
  'fahrzeuge.detail.toOwner': "Vers le titulaire",
  'fahrzeuge.detail.orderHistory': "Historique des ordres",
  'fahrzeuge.detail.emptyOrders': "Aucun ordre pour ce véhicule pour l'instant.",

  // ===========================================================================
  // BELEGE / RECHNUNGEN (Route "/rechnungen")
  // ===========================================================================
  'rechnungen.title': "Documents",
  'rechnungen.subtitle': "Devis et factures",
  'rechnungen.searchPlaceholder': "Rechercher par numéro ou client…",
  'rechnungen.tab.alle': "Tous",

  // ---- Leerzustände --------------------------------------------------------
  'rechnungen.empty.none': "Aucun document pour l'instant. Les documents naissent des ordres.",
  'rechnungen.empty.filtered': "Aucun document dans cette vue.",

  // ---- Tabellenspalten -----------------------------------------------------
  'rechnungen.col.nummer': "Numéro",
  'rechnungen.col.art': "Type",
  'rechnungen.col.kunde': "Client",
  'rechnungen.col.datum': "Date",
  'rechnungen.col.status': "Statut",
  'rechnungen.col.brutto': "TTC",

  // ---- Art / Status --------------------------------------------------------
  'rechnungen.kind.angebot': "Devis",
  'rechnungen.kind.rechnung': "Facture",
  'rechnungen.status.entwurf': "Brouillon",
  'rechnungen.status.offen': "Ouverte",
  'rechnungen.status.bezahlt': "Payée",
  'rechnungen.status.storniert': "Annulée",

  // ---- Fälligkeit / Versand-Badges -----------------------------------------
  'rechnungen.overdue': "En retard depuis {tage} jours",
  'rechnungen.dueIn': "échéance dans {tage} jours",
  'rechnungen.sent': "Envoyée",
  'rechnungen.sentOn': "Envoyée le {datum}",

  // ---- Mahnstufen ----------------------------------------------------------
  'rechnungen.mahn.stufe1': "Rappel de paiement",
  'rechnungen.mahn.stufe2': "1re relance",
  'rechnungen.mahn.stufe3': "2e relance",
  'rechnungen.mahn.generic': "Niveau de relance {stufe}",

  // ---- Zeilen-Aktionen -----------------------------------------------------
  'rechnungen.action.pdf': "Télécharger le PDF",
  'rechnungen.action.xrechnung': "XRechnung (XML)",
  'rechnungen.action.send': "Envoyer par e-mail",
  'rechnungen.action.resend': "Renvoyer par e-mail",
  'rechnungen.action.markPaid': "Marquer comme payée",
  'rechnungen.action.copyLink': "Copier le lien de téléchargement",
  'rechnungen.action.mahnen': "Relancer",
  'rechnungen.action.storno': "Annuler",
  'rechnungen.action.setStatus': "Passer à « {status} »",
  'rechnungen.actionsFor': "Actions pour {nummer}",
  'rechnungen.linkPrompt': "Copier le lien de téléchargement :",

  // ---- Storno-Bestätigung --------------------------------------------------
  'rechnungen.storno.title': "Annuler le document",
  'rechnungen.storno.msg': "Annuler vraiment le document {nummer} ? Un document annulé ne peut pas être réactivé.",
  'rechnungen.storno.msgPaid': "Annuler vraiment la facture payée {nummer} ? L'annulation ne peut pas être annulée — un avoir ou remboursement est éventuellement à régler séparément.",

  // ---- Toast-Meldungen -----------------------------------------------------
  'rechnungen.toast.statusUpdated': "Statut mis à jour",
  'rechnungen.toast.storniert': "Document annulé",
  'rechnungen.toast.paid': "Marquée comme payée",
  'rechnungen.toast.sent': "Document envoyé par e-mail",
  'rechnungen.toast.linkCopied': "Lien de téléchargement copié",
  'rechnungen.toast.mahnSent': "Relance envoyée",

  // ---- Fehlermeldungen -----------------------------------------------------
  'rechnungen.error.statusChange': "Échec du changement de statut",
  'rechnungen.error.pdf': "Impossible de charger le PDF",
  'rechnungen.error.xrechnung': "Impossible de créer la XRechnung",
  'rechnungen.error.paid': "Impossible de marquer comme payée",
  'rechnungen.error.send': "Échec de l'envoi de l'e-mail",
  'rechnungen.error.link': "Impossible de créer le lien",
  'rechnungen.error.mahn': "Échec de la relance",

  // ===========================================================================
  // AUFTRÄGE (Route "/auftraege")
  // ===========================================================================
  'auftraege.title': "Ordres",

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
