// Deutsche Anzeige-Labels und Badge-Farben fuer Enum-Werte.

export const ORDER_STATUS_LABEL: Record<string, string> = {
  angefragt: 'Angefragt',
  kalkuliert: 'Kalkuliert',
  bestaetigt: 'Bestaetigt',
  in_arbeit: 'In Arbeit',
  qualitaetskontrolle: 'Qualitaetskontrolle',
  fertig: 'Fertig',
  abgerechnet: 'Abgerechnet',
  storniert: 'Storniert',
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

export const SERVICE_TYPE_LABEL: Record<string, string> = {
  aufbereitung: 'Aufbereitung',
  folierung: 'Folierung',
  ppf: 'PPF',
  sonstiges: 'Sonstiges',
};

export const ROLE_LABEL: Record<string, string> = {
  // Plattform (Detailly)
  platform_admin: 'Platform-Admin',
  platform_analyst: 'Platform-Analyst',
  platform_support: 'Platform-Support',
  // Betrieb (Kunde)
  owner: 'Inhaber (Admin)',
  manager: 'Manager',
  technician: 'Techniker',
  receptionist: 'Rezeption',
};

export const TICKET_STATUS_LABEL: Record<string, string> = {
  offen: 'Offen',
  beantwortet: 'Beantwortet',
  geschlossen: 'Geschlossen',
};

export const TICKET_STATUS_COLOR: Record<string, string> = {
  offen: 'badge-caution',
  beantwortet: 'badge-positive',
  geschlossen: 'badge-neutral',
};

export const TICKET_KATEGORIE_LABEL: Record<string, string> = {
  frage: 'Frage',
  problem: 'Problem',
  idee: 'Idee / Wunsch',
  abrechnung: 'Abrechnung',
};

export const APPT_STATUS_LABEL: Record<string, string> = {
  geplant: 'Geplant',
  bestaetigt: 'Bestaetigt',
  laeuft: 'Laeuft',
  abgeschlossen: 'Abgeschlossen',
  abgesagt: 'Abgesagt',
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  entwurf: 'Entwurf',
  offen: 'Offen',
  bezahlt: 'Bezahlt',
  storniert: 'Storniert',
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

export const INVOICE_KIND_LABEL: Record<string, string> = {
  angebot: 'Angebot',
  rechnung: 'Rechnung',
};

// --- Fahrzeugannahme / Schadensprotokoll ---
export const SCHADEN_ART_LABEL: Record<string, string> = {
  kratzer: 'Kratzer',
  delle: 'Delle',
  steinschlag: 'Steinschlag',
  lackschaden: 'Lackschaden',
  rost: 'Rost',
  sonstiges: 'Sonstiges',
};

export const SCHWEREGRAD_LABEL: Record<string, string> = {
  leicht: 'Leicht',
  mittel: 'Mittel',
  schwer: 'Schwer',
};

// Marker-Farbe je Schweregrad (Hex-Werte der Design-System-Tokens positive/caution/danger).
export const SCHWEREGRAD_COLOR: Record<string, string> = {
  leicht: '#4FB477',
  mittel: '#E0A93B',
  schwer: '#E06A6A',
};

export const SCHWEREGRAD_BADGE: Record<string, string> = {
  leicht: 'badge-positive',
  mittel: 'badge-caution',
  schwer: 'badge-danger',
};

// --- Abo / Subscription ---
export const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  trial: 'Testphase',
  active: 'Aktiv',
  past_due: 'Zahlung offen',
  canceled: 'Gekuendigt',
  suspended: 'Gesperrt',
};

export const SUBSCRIPTION_STATUS_COLOR: Record<string, string> = {
  trial: 'badge-info',
  active: 'badge-positive',
  past_due: 'badge-caution',
  canceled: 'badge-neutral',
  suspended: 'badge-danger',
};

// Zugriffsstufe (aus dem Abo abgeleitet).
export const ACCESS_LABEL: Record<string, string> = {
  full: 'Voller Zugriff',
  warn: 'Zugriff mit Hinweis',
  blocked: 'Gesperrt',
};

export const ACCESS_COLOR: Record<string, string> = {
  full: 'badge-positive',
  warn: 'badge-caution',
  blocked: 'badge-danger',
};

// --- Zeiterfassung ---
export const TIME_ENTRY_TYPE_LABEL: Record<string, string> = {
  kommen: 'Kommen',
  gehen: 'Gehen',
};

export const TIME_ENTRY_TYPE_COLOR: Record<string, string> = {
  kommen: 'badge-positive',
  gehen: 'badge-neutral',
};

// --- 3D-Schadenserfassung ---
export const DAMAGE_ART_LABEL: Record<string, string> = {
  kratzer: 'Kratzer',
  delle: 'Delle',
  steinschlag: 'Steinschlag',
  lackschaden: 'Lackschaden',
  rost: 'Rost',
  riss: 'Riss',
  bruch: 'Bruch',
  verzogen: 'Verzogen',
  fehlteil: 'Fehlteil',
  sonstiges: 'Sonstiges',
};

export const DAMAGE_ORIGIN_LABEL: Record<string, string> = {
  vorschaden: 'Vorschaden',
  neu: 'Neuschaden',
};

export const DAMAGE_ORIGIN_BADGE: Record<string, string> = {
  vorschaden: 'badge-neutral',
  neu: 'badge-copper',
};

export const INSPECTION_TYP_LABEL: Record<string, string> = {
  annahme: 'Annahme',
  gutachten: 'Gutachten',
  ausgang: 'Ausgang',
};

export const INSPECTION_TYP_COLOR: Record<string, string> = {
  annahme: 'badge-info',
  gutachten: 'badge-neutral',
  ausgang: 'badge-copper',
};

export const INSPECTION_STATUS_LABEL: Record<string, string> = {
  entwurf: 'Entwurf',
  abgeschlossen: 'Abgeschlossen',
  freigegeben: 'Freigegeben',
};

export const INSPECTION_STATUS_COLOR: Record<string, string> = {
  entwurf: 'badge-neutral',
  abgeschlossen: 'badge-info',
  freigegeben: 'badge-positive',
};
