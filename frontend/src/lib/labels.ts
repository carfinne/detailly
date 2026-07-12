// Zentrale Enum-Maps für Anzeige-Labels und Badge-Farben.
//
// Anzeige-Labels sind i18n-KEYS (kein deutscher Text mehr): die *_KEY-Maps
// verweisen auf den `labels.*`-Namespace der Wörterbücher. Aufrufer rendern per
//   t(X_KEY[wert] ?? wert)
// Der `?? wert`-Fallback garantiert: unbekannter Enum-Wert crasht nie, sondern
// zeigt den Rohwert. Diese Datei bleibt bewusst React-frei (reine Daten).
//
// Farb-/Badge-Maps (*_COLOR, *_BADGE) und die Übergangs-Map ORDER_STATUS_NEXT
// sind sprachneutral und bleiben unverändert.

export const ORDER_STATUS_KEY: Record<string, string> = {
  angefragt: 'labels.orderStatus.angefragt',
  kalkuliert: 'labels.orderStatus.kalkuliert',
  bestaetigt: 'labels.orderStatus.bestaetigt',
  in_arbeit: 'labels.orderStatus.in_arbeit',
  qualitaetskontrolle: 'labels.orderStatus.qualitaetskontrolle',
  fertig: 'labels.orderStatus.fertig',
  abgerechnet: 'labels.orderStatus.abgerechnet',
  storniert: 'labels.orderStatus.storniert',
};

// Badge-Klassen aus dem Design-System (globals.css) – keine generischen Tailwind-Farben.
export const ORDER_STATUS_COLOR: Record<string, string> = {
  angefragt: 'badge-neutral',
  kalkuliert: 'badge-info',
  bestaetigt: 'badge-info',
  in_arbeit: 'badge-copper',
  qualitaetskontrolle: 'badge-caution',
  fertig: 'badge-positive',
  abgerechnet: 'badge-positive',
  storniert: 'badge-danger',
};

export const ORDER_STATUS_NEXT: Record<string, string[]> = {
  angefragt: ['kalkuliert', 'storniert'],
  kalkuliert: ['bestaetigt', 'storniert'],
  bestaetigt: ['in_arbeit', 'storniert'],
  in_arbeit: ['qualitaetskontrolle', 'storniert'],
  qualitaetskontrolle: ['fertig', 'in_arbeit'],
  fertig: ['abgerechnet'],
  abgerechnet: [],
  storniert: [],
};

export const SERVICE_TYPE_KEY: Record<string, string> = {
  aufbereitung: 'labels.serviceType.aufbereitung',
  folierung: 'labels.serviceType.folierung',
  ppf: 'labels.serviceType.ppf',
  sonstiges: 'labels.serviceType.sonstiges',
};

export const ROLE_KEY: Record<string, string> = {
  // Plattform (Detailly)
  platform_admin: 'labels.role.platform_admin',
  platform_analyst: 'labels.role.platform_analyst',
  platform_support: 'labels.role.platform_support',
  // Betrieb (Kunde)
  owner: 'labels.role.owner',
  manager: 'labels.role.manager',
  technician: 'labels.role.technician',
  receptionist: 'labels.role.receptionist',
};

export const TICKET_STATUS_KEY: Record<string, string> = {
  offen: 'labels.ticketStatus.offen',
  beantwortet: 'labels.ticketStatus.beantwortet',
  geschlossen: 'labels.ticketStatus.geschlossen',
};

export const TICKET_STATUS_COLOR: Record<string, string> = {
  offen: 'badge-caution',
  beantwortet: 'badge-positive',
  geschlossen: 'badge-neutral',
};

export const TICKET_KATEGORIE_KEY: Record<string, string> = {
  frage: 'labels.ticketKategorie.frage',
  problem: 'labels.ticketKategorie.problem',
  idee: 'labels.ticketKategorie.idee',
  abrechnung: 'labels.ticketKategorie.abrechnung',
};

export const APPT_STATUS_KEY: Record<string, string> = {
  geplant: 'labels.apptStatus.geplant',
  bestaetigt: 'labels.apptStatus.bestaetigt',
  laeuft: 'labels.apptStatus.laeuft',
  abgeschlossen: 'labels.apptStatus.abgeschlossen',
  abgesagt: 'labels.apptStatus.abgesagt',
};

export const INVOICE_STATUS_KEY: Record<string, string> = {
  entwurf: 'labels.invoiceStatus.entwurf',
  offen: 'labels.invoiceStatus.offen',
  bezahlt: 'labels.invoiceStatus.bezahlt',
  storniert: 'labels.invoiceStatus.storniert',
};

export const APPT_STATUS_COLOR: Record<string, string> = {
  geplant: 'badge-info',
  bestaetigt: 'badge-copper',
  laeuft: 'badge-caution',
  abgeschlossen: 'badge-positive',
  abgesagt: 'badge-danger',
};

export const INVOICE_STATUS_COLOR: Record<string, string> = {
  entwurf: 'badge-neutral',
  offen: 'badge-caution',
  bezahlt: 'badge-positive',
  storniert: 'badge-danger',
};

// --- Fahrzeugannahme / Schadensprotokoll ---
export const SCHWEREGRAD_KEY: Record<string, string> = {
  leicht: 'labels.schweregrad.leicht',
  mittel: 'labels.schweregrad.mittel',
  schwer: 'labels.schweregrad.schwer',
};

// Marker-Farbe je Schweregrad (Design-System-Tokens positive/caution/danger).
// Als CSS-var-Ausdruecke: in style={{...}} verwenden, NICHT in SVG-Praesentations-
// attributen (fill=/stroke=) – dort funktionieren CSS-Variablen nicht.
export const SCHWEREGRAD_COLOR: Record<string, string> = {
  leicht: 'rgb(var(--positive))',
  mittel: 'rgb(var(--caution))',
  schwer: 'rgb(var(--danger))',
};

export const SCHWEREGRAD_BADGE: Record<string, string> = {
  leicht: 'badge-positive',
  mittel: 'badge-caution',
  schwer: 'badge-danger',
};

// --- Abo / Subscription ---
export const SUBSCRIPTION_STATUS_KEY: Record<string, string> = {
  trial: 'labels.subscriptionStatus.trial',
  active: 'labels.subscriptionStatus.active',
  past_due: 'labels.subscriptionStatus.past_due',
  canceled: 'labels.subscriptionStatus.canceled',
  suspended: 'labels.subscriptionStatus.suspended',
};

export const SUBSCRIPTION_STATUS_COLOR: Record<string, string> = {
  trial: 'badge-info',
  active: 'badge-positive',
  past_due: 'badge-caution',
  canceled: 'badge-neutral',
  suspended: 'badge-danger',
};

// Zugriffsstufe (aus dem Abo abgeleitet).
export const ACCESS_KEY: Record<string, string> = {
  full: 'labels.access.full',
  warn: 'labels.access.warn',
  blocked: 'labels.access.blocked',
};

export const ACCESS_COLOR: Record<string, string> = {
  full: 'badge-positive',
  warn: 'badge-caution',
  blocked: 'badge-danger',
};

// --- Zeiterfassung ---
export const TIME_ENTRY_TYPE_COLOR: Record<string, string> = {
  kommen: 'badge-positive',
  gehen: 'badge-neutral',
};

// --- 3D-Schadenserfassung ---
export const DAMAGE_ART_KEY: Record<string, string> = {
  kratzer: 'labels.damageArt.kratzer',
  delle: 'labels.damageArt.delle',
  steinschlag: 'labels.damageArt.steinschlag',
  lackschaden: 'labels.damageArt.lackschaden',
  rost: 'labels.damageArt.rost',
  riss: 'labels.damageArt.riss',
  bruch: 'labels.damageArt.bruch',
  verzogen: 'labels.damageArt.verzogen',
  fehlteil: 'labels.damageArt.fehlteil',
  sonstiges: 'labels.damageArt.sonstiges',
};

export const DAMAGE_ORIGIN_KEY: Record<string, string> = {
  vorschaden: 'labels.damageOrigin.vorschaden',
  neu: 'labels.damageOrigin.neu',
};

export const DAMAGE_ORIGIN_BADGE: Record<string, string> = {
  vorschaden: 'badge-neutral',
  neu: 'badge-copper',
};

export const INSPECTION_TYP_KEY: Record<string, string> = {
  annahme: 'labels.inspectionTyp.annahme',
  gutachten: 'labels.inspectionTyp.gutachten',
  ausgang: 'labels.inspectionTyp.ausgang',
};

export const INSPECTION_TYP_COLOR: Record<string, string> = {
  annahme: 'badge-info',
  gutachten: 'badge-neutral',
  ausgang: 'badge-copper',
};

export const INSPECTION_STATUS_KEY: Record<string, string> = {
  entwurf: 'labels.inspectionStatus.entwurf',
  abgeschlossen: 'labels.inspectionStatus.abgeschlossen',
  freigegeben: 'labels.inspectionStatus.freigegeben',
};

export const INSPECTION_STATUS_COLOR: Record<string, string> = {
  entwurf: 'badge-neutral',
  abgeschlossen: 'badge-info',
  freigegeben: 'badge-positive',
};

// --- Marktplatz-Bereiche (Shop, Händler-Portal, Plattform-Pflege) ---
/** Feste Bereiche; Reihenfolge = Anzeige in Navigation und Filtern. labelKey = i18n-Key. */
export const BEREICHE: { key: string; labelKey: string }[] = [
  { key: 'folierung', labelKey: 'labels.bereich.folierung' },
  { key: 'aufbereitung', labelKey: 'labels.bereich.aufbereitung' },
  { key: 'ppf', labelKey: 'labels.bereich.ppf' },
  { key: 'sonstiges', labelKey: 'labels.bereich.sonstiges' },
];

export const BEREICH_KEY: Record<string, string> = Object.fromEntries(
  BEREICHE.map((b) => [b.key, b.labelKey]),
);
