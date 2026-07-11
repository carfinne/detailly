// ===========================================================================
// EN – VOLLSTÄNDIGES WÖRTERBUCH
// ---------------------------------------------------------------------------
// `en: Dict` – der Typ erzwingt, dass ALLE Keys aus de.ts vorhanden sind
// (fehlt einer, schlägt der Build fehl). Die Reihenfolge folgt de.ts.
// ===========================================================================

import type { Dict } from './de';

export const en: Dict = {
  // ---- Common UI -----------------------------------------------------------
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.delete': 'Delete',
  'common.close': 'Close',
  'common.back': 'Back',
  'common.loading': 'Loading',
  'common.loadingEllipsis': 'Loading…',
  'common.error': 'Error',
  'common.toStart': 'To home page',
  'common.toSubscription': 'Go to subscription',

  // ---- Language switcher ---------------------------------------------------
  'switcher.label': 'Choose language',
  'switcher.current': 'Current language',

  // ---- Navigation: groups --------------------------------------------------
  'nav.group.overview': 'Overview',
  'nav.group.operations': 'Operations',
  'nav.group.masterdata': 'Master data',
  'nav.group.finance': 'Finance',
  'nav.group.organization': 'Organization',
  'nav.group.platform': 'Platform',

  // ---- Navigation: items ---------------------------------------------------
  'nav.item.dashboard': 'Dashboard',
  'nav.item.orders': 'Orders',
  'nav.item.calculation': 'Quoting',
  'nav.item.intakeQuick': 'Intake (quick)',
  'nav.item.intake3d': 'Intake & report (3D)',
  'nav.item.planboard': 'Planning board',
  'nav.item.requests': 'Requests',
  'nav.item.customers': 'Customers',
  'nav.item.vehicles': 'Vehicles',
  'nav.item.services': 'Services',
  'nav.item.invoices': 'Invoices',
  'nav.item.reminders': 'Reminders',
  'nav.item.reports': 'Reports',
  'nav.item.accounting': 'Accounting',
  'nav.item.shop': 'Shop & stock',
  'nav.item.marketplace': 'Marketplace',
  'nav.item.locations': 'Locations',
  'nav.item.staff': 'Staff',
  'nav.item.time': 'Time tracking',
  'nav.item.audit': 'Audit log',
  'nav.item.settings': 'Settings',
  'nav.item.help': 'Help & support',
  'nav.item.assistant': 'Support assistant',
  'nav.item.subscription': 'Subscription & plan',
  'nav.item.platformAnalytics': 'Platform analytics',
  'nav.item.platformMarketplace': 'Marketplace admin',
  'nav.item.platformSupport': 'Support requests',
  'nav.item.subscriptions': 'Subscriptions',

  // ---- Settings: calculation (€/sqm) ---------------------------------------
  'settings.kalk.title': 'Calculation · €/sqm',
  'settings.kalk.subtitle': 'Base rates for the 3D instant calculation. Every value stays editable in the calculator.',
  'settings.kalk.grouplabel': 'Price per square metre (net)',
  'settings.kalk.folierung': 'Vehicle wrapping',
  'settings.kalk.ppf': 'PPF / paint protection',
  'settings.kalk.aufbereitung': 'Detailing',
  'settings.kalk.help': 'These rates are the default in the 3D module (area × vehicle size × €/sqm). Empty or 0 = built-in default.',

  // ---- Plan hints (feature gating) -----------------------------------------
  'settings.sevdesk.upgrade': 'Automatic sevDesk hand-off is available from the Basic plan.',
  'ordertime.upgrade': 'Job times & labour costs are included in the Pro plan.',

  // ---- Login ---------------------------------------------------------------
  'login.subtitle': 'Detailing Suite — Detailing, Wrapping & PPF',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.forgot': 'Forgot password?',
  'login.showPassword': 'Show password',
  'login.hidePassword': 'Hide password',
  'login.submit': 'Sign in',
  'login.submitting': 'Signing in…',
  'login.failed': 'Sign-in failed',
  'login.noAccount': 'No account yet?',
  'login.registerCta': 'Register your business',
  'login.footer': '© {year} Detailly · Independent detailing software',

  // ===========================================================================
  // LANDING
  // ===========================================================================

  // ---- Header --------------------------------------------------------------
  'landing.nav.branchen': 'Trades',
  'landing.nav.ablauf': 'How it works',
  'landing.nav.funktionen': 'Features',
  'landing.nav.faq': 'FAQ',
  'landing.nav.login': 'Sign in',
  'landing.nav.trial': 'Try for free',

  // ---- Hero ----------------------------------------------------------------
  'landing.hero.badge': 'The workshop software for detailing, wrapping & PPF',
  'landing.hero.title1': 'Your craft is precision.',
  'landing.hero.title2': 'Now your software is too.',
  'landing.hero.sub':
    'Detailly brings customers, vehicles, orders, planning board, 3D damage capture and legally compliant invoices together in one piece of software — GDPR-compliant, on any device. No more paper chaos.',
  'landing.hero.ctaPrimary': 'Try free for 14 days',
  'landing.hero.ctaSecondary': 'See the features',
  'landing.hero.trailer': 'No credit card required · Ready in minutes · Cancel monthly',

  // ---- Trust bar -----------------------------------------------------------
  'landing.trust.dsgvo': 'GDPR-compliant',
  'landing.trust.gobd': 'Compliant invoices',
  'landing.trust.madeInGermany': 'Made in Germany',
  'landing.trust.encrypted': 'Data encrypted',
  'landing.trust.noInstall': 'No installation',

  // ---- Problem -------------------------------------------------------------
  'landing.problem.kicker': 'Sound familiar?',
  'landing.problem.title': 'The shop runs — the admin slows it down.',
  'landing.problem.sub':
    'While the work on the vehicle demands precision, everything around it drowns in paperwork.',
  'landing.problem.p1': 'The vehicle history is scattered across folders, sticky notes and memory.',
  'landing.problem.p2': 'Invoices pile up — and cost you real money.',
  'landing.problem.p3': 'Damage noted at intake is hard to prove later on.',
  'landing.problem.p4': 'Five different tools that don’t talk to each other.',
  'landing.problem.summaryPre': 'Detailly brings it all into ',
  'landing.problem.summaryEm': 'one',
  'landing.problem.summaryPost': ' system — clear, fast, on every device.',

  // ---- Trade switcher ------------------------------------------------------
  'landing.branchen.kicker': 'Built for your trade',
  'landing.branchen.title': 'Software that speaks your trade',
  'landing.branchen.sub':
    'When you start, you pick your focus — Detailly tailors the service catalog, quoting and even the look to match. Try it: choose your trade and watch the page recolor.',
  'landing.branchen.selected': 'Selected',
  'landing.branchen.cta': 'Start as {label}',
  'landing.branchen.complete': 'Everything from one hand?',
  'landing.branchen.completeCta': 'Start as full-service provider',
  'landing.branchen.aufbereitung.l1': 'Interior & exterior detailing',
  'landing.branchen.aufbereitung.l2': 'Polishing & ceramic coating',
  'landing.branchen.aufbereitung.l3': 'Lease return checks',
  'landing.branchen.folierung.l1': 'Full & partial wraps',
  'landing.branchen.folierung.l2': 'Color change & design',
  'landing.branchen.folierung.l3': 'Advertising lettering',
  'landing.branchen.ppf.l1': 'Front & full protection',
  'landing.branchen.ppf.l2': 'Stone-chip protection kits',
  'landing.branchen.ppf.l3': 'Precise cuts',

  // ---- How it works --------------------------------------------------------
  'landing.ablauf.kicker': 'It’s this simple',
  'landing.ablauf.title': 'A clean workflow in three steps',
  'landing.ablauf.step1.title': 'Intake',
  'landing.ablauf.step1.desc':
    'Capture customer, vehicle and damage in minutes — with 3D marking, photos and a digital signature.',
  'landing.ablauf.step2.title': 'Handle',
  'landing.ablauf.step2.desc':
    'Quote services, schedule appointments on the planning board and keep an eye on progress at all times.',
  'landing.ablauf.step3.title': 'Invoice',
  'landing.ablauf.step3.desc':
    'The order becomes a compliant PDF invoice in one click — including due dates and dunning.',

  // ---- Features ------------------------------------------------------------
  'landing.funktionen.kicker': 'Every tool',
  'landing.funktionen.title': 'Everything your business needs',
  'landing.funktionen.sub':
    'One seamless workflow — from vehicle intake to the paid invoice.',
  'landing.funktionen.kunden.title': 'Customers & vehicles',
  'landing.funktionen.kunden.desc':
    'Master data, vehicle file and full history per vehicle — instantly findable.',
  'landing.funktionen.auftraege.title': 'Orders & planning board',
  'landing.funktionen.auftraege.desc':
    'From quote to handover. Weekly planning with appointments — all in view.',
  'landing.funktionen.rechnungen.title': 'Invoices & receipts',
  'landing.funktionen.rechnungen.desc':
    'Legally compliant invoices and quotes as PDF, incl. due dates and dunning.',
  'landing.funktionen.schaden3d.title': '3D damage capture',
  'landing.funktionen.schaden3d.desc':
    'Mark damage right on the vehicle model, document it with photos and collect a digital signature.',
  'landing.funktionen.kalkulation.title': 'Quoting per trade',
  'landing.funktionen.kalkulation.desc':
    'Service catalogs and pricing logic for detailing, wrapping and PPF — matched to your focus.',
  'landing.funktionen.dsgvo.title': 'GDPR & security',
  'landing.funktionen.dsgvo.desc':
    'Sensitive data encrypted, strictly separated per business, with data export and deletion at the push of a button.',
  'landing.funktionen.footnotePre': 'Plus: lightning-fast global search (',
  'landing.funktionen.footnotePost': '), mobile navigation and multiple staff members per business.',

  // ---- 3D damage capture (showcase) ----------------------------------------
  'landing.schaden.kicker': 'The highlight',
  'landing.schaden.title': 'Record damage before it becomes a dispute',
  'landing.schaden.desc':
    'At intake you mark scratches, dents and stone chips right on the vehicle model — with photos and the customer’s digital signature. If questions come up later, you have the proof. In black and white.',
  'landing.schaden.point1': 'Place damage points directly on the 3D model',
  'landing.schaden.point2': 'Photos per damage — automatically assigned',
  'landing.schaden.point3': 'Digital signature at intake and handover',
  'landing.schaden.cardHeader': 'Vehicle intake · Damage capture',
  'landing.schaden.cardBadge': '2 damages',
  'landing.schaden.cardPhotos': '4 photos documented',
  'landing.schaden.cardSignature': 'Signature captured',

  // ---- Growth --------------------------------------------------------------
  'landing.wachstum.kicker': 'Scalable',
  'landing.wachstum.title': 'Growth through overview',
  'landing.wachstum.sub':
    'Those who are organized and know their numbers make better decisions — from single shop to chain.',
  'landing.wachstum.echtzeit.title': 'Real-time overview',
  'landing.wachstum.echtzeit.desc':
    'Revenue, open orders and appointments live in the dashboard — you see instantly what’s working and what’s stuck.',
  'landing.wachstum.standorte.title': 'Multiple locations',
  'landing.wachstum.standorte.desc':
    'Manage branches under one roof — cleanly separated yet centrally in view. Scales whenever you grow.',
  'landing.wachstum.team.title': 'Team, roles & permissions',
  'landing.wachstum.team.desc':
    'Invite staff and assign roles — everyone sees exactly what they should. Cleanly monitored and documented.',
  'landing.wachstum.chartVolume': 'Order volume',
  'landing.wachstum.chartGrowing': 'growing',
  'landing.wachstum.chartLocations': 'Locations',

  // ---- Numbers (count-up) --------------------------------------------------
  'landing.zahlen.stat1.unit': 'min.',
  'landing.zahlen.stat1.label': 'from intake to finished order',
  'landing.zahlen.stat2.unit': 'days',
  'landing.zahlen.stat2.label': 'free trial — no credit card',
  'landing.zahlen.stat3.unit': '%',
  'landing.zahlen.stat3.label': 'GDPR- and audit-compliant',
  'landing.zahlen.stat4.value': '5 → 1',
  'landing.zahlen.stat4.label': 'one system instead of five silos',

  // ---- Voices --------------------------------------------------------------
  'landing.stimmen.kicker': 'From the field',
  'landing.stimmen.title': 'What pilot businesses say',
  'landing.stimmen.q1.text':
    'I finally see at a glance every morning what’s happening in the shop today. The paper chaos is gone.',
  'landing.stimmen.q1.who': 'Owner · Detailing studio',
  'landing.stimmen.q2.text':
    'The 3D damage capture at intake has already saved us from expensive arguments twice.',
  'landing.stimmen.q2.who': 'Managing director · Wrapping shop',
  'landing.stimmen.q3.text':
    'The finished order becomes an invoice in seconds. That used to cost me my evenings.',
  'landing.stimmen.q3.who': 'Shop lead · PPF studio',

  // ---- Why Detailly --------------------------------------------------------
  'landing.warum.kicker': 'Why Detailly',
  'landing.warum.title': 'Software for the workshop — not for the dealership.',
  'landing.warum.body':
    'Detailers, wrappers and PPF studios deliver precision work and deserve software that works just as cleanly. Most workshop programs are built for large dealerships: bloated, complicated and expensive. Detailly is deliberately different — lean, tailored to your workflows and ready in minutes. Independently developed, in Germany, with privacy built in from the ground up.',

  // ---- News teaser ---------------------------------------------------------
  'landing.news.kicker': 'Detailly News',
  'landing.news.title': 'What’s happening right now',
  'landing.news.sub':
    'Product updates and news around Detailly. (Sample entries — real announcements coming soon.)',
  'landing.news.all': 'See all news',

  // ---- FAQ -----------------------------------------------------------------
  'landing.faq.kicker': 'Frequent questions',
  'landing.faq.title': 'What you want to know before you start',
  'landing.faq.q1.q': 'Do I need technical knowledge or an installation?',
  'landing.faq.q1.a':
    'No. You register your business and get going right in the browser — on computer, tablet or smartphone. There is nothing to install and nothing to set up.',
  'landing.faq.q2.q': 'I do detailing AND wrapping — which do I choose?',
  'landing.faq.q2.a':
    'Then you’re a full-service provider: at registration you simply pick “full-service provider” and get all service catalogs and quoting together.',
  'landing.faq.q3.q': 'How secure is my customer data?',
  'landing.faq.q3.a':
    'Sensitive data is stored encrypted and strictly separated from other businesses. You can export or delete customer data at any time — fully GDPR-compliant.',
  'landing.faq.q4.q': 'What happens after the 14 days?',
  'landing.faq.q4.a':
    'You test without a credit card and without risk. After the trial you choose the plan that fits your business. If the trial ends, you incur no costs.',
  'landing.faq.q5.q': 'Does it also run on the tablet in the workshop?',
  'landing.faq.q5.a':
    'Yes. Detailly is built for every device — from the office PC to the tablet at vehicle intake. The interface adapts automatically.',
  'landing.faq.q6.q': 'Can I take my data with me again?',
  'landing.faq.q6.a':
    'Any time. Your data belongs to you — an export is possible at the push of a button, without having to ask anyone.',

  // ---- Closing CTA ---------------------------------------------------------
  'landing.cta.band': 'Full speed ahead',
  'landing.cta.title': 'Bring order to your business — starting today.',
  'landing.cta.sub':
    'Register your business in a few minutes and try Detailly free for 14 days. No credit card, no risk.',
  'landing.cta.primary': 'Start for free now',
  'landing.cta.secondary': 'I already have an account',

  // ---- Footer --------------------------------------------------------------
  'landing.footer.tagline':
    'The workshop software for detailing, wrapping and PPF. Independently developed in Germany.',
  'landing.footer.discover': 'Discover',
  'landing.footer.product': 'Product',
  'landing.footer.account': 'Account & legal',
  'landing.footer.news': 'News',
  'landing.footer.masterclass': 'Masterclass',
  'landing.footer.gruendung': 'Founding',
  'landing.footer.features': 'Features',
  'landing.footer.branchen': 'For your trade',
  'landing.footer.faq': 'Frequent questions',
  'landing.footer.trial': 'Try for free',
  'landing.footer.login': 'Sign in',
  'landing.footer.register': 'Register',
  'landing.footer.impressum': 'Imprint',
  'landing.footer.datenschutz': 'Privacy',
  'landing.footer.copyright': '© {year} Detailly · All rights reserved',

  // ---- Customer form -------------------------------------------------------
  'kunden.form.leitwegId.label': 'Routing ID (Leitweg-ID)',
  'kunden.form.leitwegId.help':
    'Only for invoices to public authorities/government clients (controls B2G routing).',

  // ===========================================================================
  // CUSTOMERS (route "/kunden")
  // ===========================================================================
  'kunden.title': 'Customers',
  'kunden.subtitle': 'Private and business customers',
  'kunden.csvImport': 'CSV import',
  'kunden.new': 'New customer',
  'kunden.searchPlaceholder': 'Search by name, email, phone…',

  // ---- Empty state ---------------------------------------------------------
  'kunden.empty.none': 'No customers yet.',
  'kunden.empty.filtered': 'No customers found.',
  'kunden.empty.cta': 'Add first customer',

  // ---- Table columns -------------------------------------------------------
  'kunden.col.name': 'Name',
  'kunden.col.typ': 'Type',
  'kunden.col.email': 'Email',
  'kunden.col.telefon': 'Phone',
  'kunden.col.ort': 'City',

  // ---- Customer type -------------------------------------------------------
  'kunden.type.business': 'Business',
  'kunden.type.private': 'Private',

  // ---- Action menu ---------------------------------------------------------
  'kunden.actionsFor': 'Actions for {name}',
  'kunden.action.open': 'Open',
  'kunden.action.newOrder': 'New order',
  'kunden.action.edit': 'Edit',

  // ---- Toast / error / delete confirmation ---------------------------------
  'kunden.toast.deleted': '{name} deleted',
  'kunden.error.delete': 'Deletion failed',
  'kunden.delete.title': 'Delete customer',
  'kunden.delete.msg':
    'Really delete {name}? The customer will be deactivated and removed from the list. Existing orders and invoices are retained.',

  // ===========================================================================
  // FAHRZEUGE (route "/fahrzeuge")
  // ===========================================================================
  'fahrzeuge.title': 'Vehicles',
  'fahrzeuge.subtitle': 'Vehicle inventory with vehicle records',
  'fahrzeuge.new': 'New vehicle',
  'fahrzeuge.searchPlaceholder': 'Search by licence plate, make, model or owner…',

  // ---- Empty state ---------------------------------------------------------
  'fahrzeuge.empty.none': 'No vehicles yet.',
  'fahrzeuge.empty.filtered': 'No vehicles found.',
  'fahrzeuge.empty.cta': 'Add first vehicle',

  // ---- Table columns -------------------------------------------------------
  'fahrzeuge.col.fahrzeug': 'Vehicle',
  'fahrzeuge.col.kennzeichen': 'Licence plate',
  'fahrzeuge.col.halter': 'Owner',
  'fahrzeuge.col.baujahr': 'Year',

  // ---- Action menu ---------------------------------------------------------
  'fahrzeuge.actionsFor': 'Actions for {name}',
  'fahrzeuge.action.open': 'Open vehicle record',
  'fahrzeuge.action.newOrder': 'New order',

  // ---- Form (new vehicle) --------------------------------------------------
  'fahrzeuge.form.halter': 'Owner',
  'fahrzeuge.form.selectPlaceholder': '– select –',
  'fahrzeuge.form.marke': 'Make',
  'fahrzeuge.form.modell': 'Model',
  'fahrzeuge.form.variante': 'Variant',
  'fahrzeuge.form.baujahr': 'Year',
  'fahrzeuge.form.farbe': 'Colour',
  'fahrzeuge.form.kennzeichen': 'Licence plate',
  'fahrzeuge.form.kraftstoff': 'Fuel',
  'fahrzeuge.form.flaeche': 'Area (sqm)',

  // ---- Fuel types ----------------------------------------------------------
  'fahrzeuge.fuel.petrol': 'Petrol',
  'fahrzeuge.fuel.diesel': 'Diesel',
  'fahrzeuge.fuel.electric': 'Electric',
  'fahrzeuge.fuel.hybrid': 'Hybrid',
  'fahrzeuge.saving': 'Saving…',

  // ---- Toast / error / delete confirmation ---------------------------------
  'fahrzeuge.toast.deleted': '{name} deleted',
  'fahrzeuge.error.delete': 'Deletion failed',
  'fahrzeuge.error.save': 'Saving failed',
  'fahrzeuge.delete.title': 'Delete vehicle',
  'fahrzeuge.delete.msg':
    'Really delete {name}? The vehicle will be removed from the list. Existing orders and appointments are retained.',

  // ===========================================================================
  // DOCUMENTS / INVOICES (route "/rechnungen")
  // ===========================================================================
  'rechnungen.title': 'Documents',
  'rechnungen.subtitle': 'Quotes and invoices',
  'rechnungen.searchPlaceholder': 'Search by number or customer…',
  'rechnungen.tab.alle': 'All',

  // ---- Empty states --------------------------------------------------------
  'rechnungen.empty.none': 'No documents yet. Documents are created from orders.',
  'rechnungen.empty.filtered': 'No documents in this view.',

  // ---- Table columns -------------------------------------------------------
  'rechnungen.col.nummer': 'Number',
  'rechnungen.col.art': 'Type',
  'rechnungen.col.kunde': 'Customer',
  'rechnungen.col.datum': 'Date',
  'rechnungen.col.status': 'Status',
  'rechnungen.col.brutto': 'Gross',

  // ---- Type / status -------------------------------------------------------
  'rechnungen.kind.angebot': 'Quote',
  'rechnungen.kind.rechnung': 'Invoice',
  'rechnungen.status.entwurf': 'Draft',
  'rechnungen.status.offen': 'Open',
  'rechnungen.status.bezahlt': 'Paid',
  'rechnungen.status.storniert': 'Voided',

  // ---- Due-date / send badges ----------------------------------------------
  'rechnungen.overdue': 'Overdue by {tage} days',
  'rechnungen.dueIn': 'due in {tage} days',
  'rechnungen.sent': 'Sent',
  'rechnungen.sentOn': 'Sent on {datum}',

  // ---- Reminder levels -----------------------------------------------------
  'rechnungen.mahn.stufe1': 'Payment reminder',
  'rechnungen.mahn.stufe2': '1st reminder',
  'rechnungen.mahn.stufe3': '2nd reminder',
  'rechnungen.mahn.generic': 'Reminder level {stufe}',

  // ---- Row actions ---------------------------------------------------------
  'rechnungen.action.pdf': 'Download PDF',
  'rechnungen.action.xrechnung': 'XRechnung (XML)',
  'rechnungen.action.send': 'Send by email',
  'rechnungen.action.resend': 'Resend by email',
  'rechnungen.action.markPaid': 'Mark as paid',
  'rechnungen.action.copyLink': 'Copy download link',
  'rechnungen.action.mahnen': 'Send reminder',
  'rechnungen.action.storno': 'Void',
  'rechnungen.action.setStatus': 'Set to “{status}”',
  'rechnungen.actionsFor': 'Actions for {nummer}',
  'rechnungen.linkPrompt': 'Copy download link:',

  // ---- Void confirmation ---------------------------------------------------
  'rechnungen.storno.title': 'Void document',
  'rechnungen.storno.msg':
    'Really void document {nummer}? A voided document cannot be reactivated.',
  'rechnungen.storno.msgPaid':
    'Really void the paid invoice {nummer}? The void cannot be undone – a credit note or refund may need to be handled separately.',

  // ---- Toast messages ------------------------------------------------------
  'rechnungen.toast.statusUpdated': 'Status updated',
  'rechnungen.toast.storniert': 'Document voided',
  'rechnungen.toast.paid': 'Marked as paid',
  'rechnungen.toast.sent': 'Document sent by email',
  'rechnungen.toast.linkCopied': 'Download link copied',
  'rechnungen.toast.mahnSent': 'Reminder sent',

  // ---- Error messages ------------------------------------------------------
  'rechnungen.error.statusChange': 'Status change failed',
  'rechnungen.error.pdf': 'PDF could not be loaded',
  'rechnungen.error.xrechnung': 'XRechnung could not be created',
  'rechnungen.error.paid': 'Could not mark as paid',
  'rechnungen.error.send': 'Email delivery failed',
  'rechnungen.error.link': 'Link could not be created',
  'rechnungen.error.mahn': 'Reminder failed',

  // ===========================================================================
  // ORDERS (route "/auftraege")
  // ===========================================================================
  'auftraege.title': 'Orders',
  'auftraege.subtitle': 'The central unit with status workflow and costing',
  'auftraege.new': 'New order',
  'auftraege.searchPlaceholder': 'Search by number or customer…',
  'auftraege.tab.alle': 'All',

  // ---- Empty states --------------------------------------------------------
  'auftraege.empty.none': 'No orders yet.',
  'auftraege.empty.filtered': 'No orders in this view.',
  'auftraege.empty.cta': 'Create first order',

  // ---- Table columns -------------------------------------------------------
  'auftraege.col.nummer': 'Number',
  'auftraege.col.kunde': 'Customer',
  'auftraege.col.leistung': 'Service',
  'auftraege.col.status': 'Status',
  'auftraege.col.gesamt': 'Total',

  // ---- Row actions ---------------------------------------------------------
  'auftraege.actionsFor': 'Actions for order {nummer}',
  'auftraege.action.open': 'Open',

  // ---- Status --------------------------------------------------------------
  'auftraege.status.angefragt': 'Requested',
  'auftraege.status.kalkuliert': 'Quoted',
  'auftraege.status.bestaetigt': 'Confirmed',
  'auftraege.status.in_arbeit': 'In progress',
  'auftraege.status.qualitaetskontrolle': 'Quality check',
  'auftraege.status.fertig': 'Done',
  'auftraege.status.abgerechnet': 'Invoiced',
  'auftraege.status.storniert': 'Cancelled',

  // ---- Service type --------------------------------------------------------
  'auftraege.service.aufbereitung': 'Detailing',
  'auftraege.service.folierung': 'Wrapping',
  'auftraege.service.ppf': 'PPF',
  'auftraege.service.sonstiges': 'Other',

  // ---- Form (new order) ----------------------------------------------------
  'auftraege.form.kunde': 'Customer',
  'auftraege.form.selectPlaceholder': '– select –',
  'auftraege.form.fahrzeug': 'Vehicle',
  'auftraege.form.optionalPlaceholder': '– optional –',
  'auftraege.form.leistungsart': 'Service type',
  'auftraege.form.materialkosten': 'Material cost (net)',
  'auftraege.form.positionen': 'Line items',
  'auftraege.form.addPosition': '+ Line item',
  'auftraege.form.beschreibung': 'Description',
  'auftraege.form.fromService': 'take from service…',
  'auftraege.form.menge': 'Quantity',
  'auftraege.form.einzelpreis': 'Unit price',
  'auftraege.form.netto': 'Net',
  'auftraege.form.mwst': 'VAT (19%)',
  'auftraege.saving': 'Saving…',
  'auftraege.submit': 'Create order',

  // ---- Toast / errors ------------------------------------------------------
  'auftraege.toast.deleted': 'Order {nummer} deleted',
  'auftraege.error.delete': 'Deletion failed',
  'auftraege.error.save': 'Saving failed',

  // ---- Delete confirmation -------------------------------------------------
  'auftraege.delete.title': 'Delete order',
  'auftraege.delete.msg':
    'Really delete order {nummer}? This action cannot be undone.',

  // ===========================================================================
  // CALCULATION (Route "/kalkulation")
  // ===========================================================================
  'kalkulation.title': 'Calculation',
  'kalkulation.subtitle':
    'Click components or services – the price is calculated live. Every line item stays adjustable.',
  'kalkulation.diagram.aria': 'Vehicle top view: click components',

  // ---- Catalog hint (fixed business type) ----------------------------------
  'kalkulation.katalog.prefix': 'Catalog:',
  'kalkulation.katalog.suffix':
    '– more catalogs via Settings → business type “Full-service provider”.',

  // ---- Parameters ----------------------------------------------------------
  'kalkulation.section.fahrzeugMaterial': 'Vehicle & material',
  'kalkulation.field.groesse': 'Vehicle size',
  'kalkulation.field.schnellauswahl': 'Quick select',
  'kalkulation.clearSelection': 'Clear selection',
  'kalkulation.section.auswahlSubtitle': 'Click to add – in the diagram or the list.',

  // ---- Ceramic option ------------------------------------------------------
  'kalkulation.keramik.add': 'Add ceramic coating',
  'kalkulation.keramik.basis': 'Base price (incl. 1 layer)',
  'kalkulation.keramik.weitereSchichten': 'Additional layers',
  'kalkulation.keramik.none': 'none',
  'kalkulation.keramik.proSchicht': 'Price per additional layer',
  'kalkulation.keramik.layerSingular': 'layer',
  'kalkulation.keramik.layerPlural': 'layers',

  // ---- Live total ----------------------------------------------------------
  'kalkulation.positionCount': '{count} line item(s)',
  'kalkulation.empty': 'Nothing selected yet – click components in the diagram or the list.',
  'kalkulation.priceAria': 'Price for {label}',
  'kalkulation.netto': 'Net',
  'kalkulation.mwst': 'VAT (19%)',
  'kalkulation.gesamt': 'Total',
  'kalkulation.copyButton': 'Copy summary',
  'kalkulation.hint.base':
    'Guide prices based on vehicle size{material} – every line item can be overridden directly.',
  'kalkulation.hint.materialSuffix': ' and material grade',
  'kalkulation.toast.copied': 'Summary copied',
  'kalkulation.summaryHeadline': 'Calculation {titel} – {rahmen}',

  // ===========================================================================
  // ACCOUNTING (Route "/buchhaltung")
  // ===========================================================================
  'buchhaltung.title': 'Accounting',
  'buchhaltung.subtitle':
    'Export data for your tax advisor – invoices (CSV/DATEV) and working times for payroll.',

  // ---- Period --------------------------------------------------------------
  'buchhaltung.zeitraum.title': 'Period',
  'buchhaltung.zeitraum.subtitle': 'Applies to both exports (invoices and working times).',
  'buchhaltung.von': 'From',
  'buchhaltung.bis': 'To',
  'buchhaltung.zeitraum.help':
    'Invoices: issued (open & paid) within the period · Working times: all entries within the period.',

  // ---- Format --------------------------------------------------------------
  'buchhaltung.format.title': 'Format',
  'buchhaltung.format.subtitle': 'Universal CSV or DATEV posting batch.',
  'buchhaltung.format.csv.title': 'CSV (universal)',
  'buchhaltung.format.csv.desc':
    'Semicolon-separated, for any tax advisor – even without DATEV. Document number, date, amounts, VAT, status.',
  'buchhaltung.format.datev.title': 'DATEV posting batch',
  'buchhaltung.format.datev.desc':
    'EXTF format for direct import into DATEV. Requires advisor/client number (Settings).',

  // ---- Export --------------------------------------------------------------
  'buchhaltung.export': 'Export',
  'buchhaltung.exporting': 'Exporting…',
  'buchhaltung.datevStammdaten': 'Manage DATEV master data →',
  'buchhaltung.datevHinweis':
    'Note: The DATEV export follows the common EXTF specification. Before your first real import, please verify once with your tax advisor or the free DATEV validation tool.',

  // ---- Working times -------------------------------------------------------
  'buchhaltung.zeiten.title': 'Working times for payroll',
  'buchhaltung.zeiten.subtitle':
    'Recorded order times per employee within the period (incl. labor costs) as CSV – for payroll.',
  'buchhaltung.zeiten.export': 'Export working times',
  'buchhaltung.zeiten.help':
    'Detail rows per entry + total per employee. Labor costs are based on the currently stored hourly wage. Contains salary data – for management only.',

  // ---- Toast / Error -------------------------------------------------------
  'buchhaltung.toast.exportStarted': 'Export started',
  'buchhaltung.error.export': 'Export failed',
};
