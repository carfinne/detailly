// Antwort-Formen des Betreiber-Cockpit-Backends (Teil 1, /platform/*). Bewusst
// als schlanke, read-only Sichten getippt – exakt gespiegelt zu den WHITELIST-
// Interfaces in backend/src/platform-cockpit/platform-cockpit.service.ts. Datums-
// felder kommen als ISO-Strings ueber die JSON-Grenze (nicht als Date).

export type Betriebstyp = 'aufbereitung' | 'folierung' | 'ppf' | 'komplett';
export type TenantStatusWert = 'active' | 'inactive' | 'trial';
export type AboStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'suspended' | 'pilot';

export interface LiveKpi {
  testphasenEndenIn7Tagen: number;
  aktiveNutzer24h: number;
  offeneSupportTickets: number;
  offeneKybBewerbungen: number;
}

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  ort: string | null;
  betriebstyp: Betriebstyp;
  status: TenantStatusWert;
  createdAt: string;
  nutzerAnzahl: number;
  abo: { status: AboStatus; tarif: string | null; tarifSlug: string | null } | null;
}

export interface TenantListResult {
  data: TenantListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface TenantDetail {
  profil: {
    id: string;
    name: string;
    slug: string;
    street: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
    betriebstyp: Betriebstyp;
    status: TenantStatusWert;
    createdAt: string;
  };
  nutzer: {
    id: string;
    name: string;
    email: string;
    rolle: string;
    aktiv: boolean;
    letzterLogin: string | null;
  }[];
  nutzung: { auftraege: number; belege: number };
  abo: {
    status: AboStatus;
    tarif: string | null;
    tarifSlug: string | null;
    preisMonatlich: number | null;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
    notiz: string | null;
  } | null;
}

export interface UserLookupItem {
  id: string;
  email: string;
  name: string;
  rolle: string;
  aktiv: boolean;
  betrieb: { id: string; name: string; slug: string } | null;
}

export interface RegionAggregat {
  region: string;
  anzahl: number;
  typen: Record<Betriebstyp, number>;
}

export interface AuditLogItem {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditReadResult {
  data: AuditLogItem[];
  total: number;
  limit: number;
  offset: number;
}

// Empfehlungsprogramm (Betreiber-Sicht, /platform/referrals) – gespiegelt zu
// PlatformReferralItem/PlatformReferralResult im AffiliateService (read-only).
export interface PlatformReferralItem {
  id: string;
  werber: string;
  werberTenantId: string;
  geworben: string;
  geworbenTenantId: string;
  code: string;
  status: string;
  belohnungAnwartschaft: boolean;
  belohnungTyp: string | null;
  geworbenAm: string;
  zahlendSeit: string | null;
}

export interface PlatformReferralResult {
  data: PlatformReferralItem[];
  total: number;
  limit: number;
  offset: number;
}

// Betriebstyp -> i18n-Key (Anzeige-Label). Nutzt die bestehenden Branchen-Labels
// aus dictionaries/de.ts (Quelle der Wahrheit), damit die Bezeichnungen ueberall
// konsistent bleiben. Aufruf crash-sicher: t(BETRIEBSTYP_KEY[v] ?? v).
export const BETRIEBSTYP_KEY: Record<string, string> = {
  aufbereitung: 'labels.betriebstyp.aufbereitung.label',
  folierung: 'labels.betriebstyp.folierung.label',
  ppf: 'labels.betriebstyp.ppf.label',
  komplett: 'labels.betriebstyp.komplett.label',
};

export const BETRIEBSTYP_LISTE: Betriebstyp[] = ['aufbereitung', 'folierung', 'ppf', 'komplett'];

// Fuellfarben je Betriebstyp (Design-System-Tokens als CSS-var-Ausdruecke, wie
// SCHWEREGRAD_COLOR in lib/labels.ts). In style={{...}} verwenden.
export const BETRIEBSTYP_COLOR: Record<Betriebstyp, string> = {
  aufbereitung: 'rgb(var(--info))',
  folierung: 'rgb(var(--copper))',
  ppf: 'rgb(var(--positive))',
  komplett: 'rgb(var(--caution))',
};

// Betriebs-Status (Tenant.status) -> Badge-Klasse.
export const TENANT_STATUS_COLOR: Record<string, string> = {
  active: 'badge-positive',
  trial: 'badge-info',
  inactive: 'badge-neutral',
};

// Betriebs-Status -> i18n-Key.
export const TENANT_STATUS_KEY: Record<string, string> = {
  active: 'cockpit.tenantStatus.active',
  trial: 'cockpit.tenantStatus.trial',
  inactive: 'cockpit.tenantStatus.inactive',
};

// ---------------------------------------------------------------------------
// Marktrecherche-Register (Betreiber-intern, /platform/marktregister). Gespiegelt
// zur MarktBeobachtung-Entity im Backend: nur sachliche, oeffentlich beobachtbare
// Fakten + die daraus abgeleitete EIGENE Idee. Kein Bewertungs-/Herabsetzungsfeld.
// Wertespalten sind Freitext-Whitelists (varchar + @IsIn) – hier als String-Unions
// gespiegelt. Datumsfelder kommen als ISO-Strings ueber die JSON-Grenze.
// ---------------------------------------------------------------------------
export type MarktKategorie = 'preis' | 'feature' | 'ux' | 'marketing' | 'sonstiges';
export type MarktStatus = 'neu' | 'geprueft' | 'eingeplant' | 'umgesetzt' | 'verworfen';
export type MarktPrioritaet = 'hoch' | 'mittel' | 'niedrig';

export const MARKT_KATEGORIEN: MarktKategorie[] = ['preis', 'feature', 'ux', 'marketing', 'sonstiges'];
export const MARKT_STATUS: MarktStatus[] = ['neu', 'geprueft', 'eingeplant', 'umgesetzt', 'verworfen'];
export const MARKT_PRIORITAETEN: MarktPrioritaet[] = ['hoch', 'mittel', 'niedrig'];

export interface MarktBeobachtung {
  id: string;
  wettbewerber: string;
  kategorie: MarktKategorie;
  beobachtung: string;
  quelleUrl: string | null;
  beobachtetAm: string;
  abgeleiteteIdee: string;
  status: MarktStatus;
  prioritaet: MarktPrioritaet;
  erstelltVonUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarktListResult {
  data: MarktBeobachtung[];
  total: number;
  limit: number;
  offset: number;
}

// Wert -> i18n-Key (crash-sicher via `t(MAP[v] ?? v)`).
export const MARKT_KATEGORIE_KEY: Record<string, string> = {
  preis: 'marktregister.kategorie.preis',
  feature: 'marktregister.kategorie.feature',
  ux: 'marktregister.kategorie.ux',
  marketing: 'marktregister.kategorie.marketing',
  sonstiges: 'marktregister.kategorie.sonstiges',
};

export const MARKT_STATUS_KEY: Record<string, string> = {
  neu: 'marktregister.status.neu',
  geprueft: 'marktregister.status.geprueft',
  eingeplant: 'marktregister.status.eingeplant',
  umgesetzt: 'marktregister.status.umgesetzt',
  verworfen: 'marktregister.status.verworfen',
};

export const MARKT_PRIORITAET_KEY: Record<string, string> = {
  hoch: 'marktregister.prioritaet.hoch',
  mittel: 'marktregister.prioritaet.mittel',
  niedrig: 'marktregister.prioritaet.niedrig',
};

// Wert -> Badge-Klasse (Design-System). Status ist ein Arbeitsstatus der EIGENEN
// Idee – nicht eine Bewertung des Wettbewerbers.
export const MARKT_STATUS_COLOR: Record<string, string> = {
  neu: 'badge-neutral',
  geprueft: 'badge-info',
  eingeplant: 'badge-copper',
  umgesetzt: 'badge-positive',
  verworfen: 'badge-neutral',
};

export const MARKT_PRIORITAET_COLOR: Record<string, string> = {
  hoch: 'badge-danger',
  mittel: 'badge-caution',
  niedrig: 'badge-neutral',
};
