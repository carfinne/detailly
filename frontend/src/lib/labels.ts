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
  super_admin: 'Super-Admin',
  franchise_owner: 'Franchise-Inhaber',
  manager: 'Manager',
  technician: 'Techniker',
  receptionist: 'Rezeption',
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
