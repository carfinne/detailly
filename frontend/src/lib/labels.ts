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

export const ORDER_STATUS_COLOR: Record<string, string> = {
  angefragt: 'bg-slate-500/20 text-slate-300',
  kalkuliert: 'bg-blue-500/20 text-blue-300',
  bestaetigt: 'bg-indigo-500/20 text-indigo-300',
  in_arbeit: 'bg-amber-500/20 text-amber-300',
  qualitaetskontrolle: 'bg-purple-500/20 text-purple-300',
  fertig: 'bg-emerald-500/20 text-emerald-300',
  abgerechnet: 'bg-teal-500/20 text-teal-300',
  storniert: 'bg-red-500/20 text-red-300',
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

export const INVOICE_KIND_LABEL: Record<string, string> = {
  angebot: 'Angebot',
  rechnung: 'Rechnung',
};
