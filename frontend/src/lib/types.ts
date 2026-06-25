// Gemeinsame Typdefinitionen passend zu den Backend-Entities.

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  tenantName?: string;
  firstName?: string;
  lastName?: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Customer {
  id: string;
  type: 'private' | 'business';
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  vatNumber?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface Vehicle {
  id: string;
  customerId: string;
  make: string;
  model: string;
  variant?: string;
  year?: number;
  color?: string;
  licensePlate?: string;
  fuelType?: string;
  estimatedSqm?: number;
}

export interface ServiceItem {
  id: string;
  name: string;
  beschreibung?: string;
  kategorie: string;
  basispreis: number;
  einheit: string;
}

export interface OrderItem {
  id?: string;
  beschreibung: string;
  menge: number;
  einzelpreis: number;
  gesamtpreis?: number;
  typ?: string;
}

export interface LeistungDetails {
  ppf?: { folie?: string; hersteller?: string; qm?: number; garantieJahre?: number };
  keramik?: { produkt?: string; schichten?: number; garantieJahre?: number };
  folierung?: { farbe?: string; hersteller?: string; qm?: number; teilfolierung?: boolean };
}

export interface Order {
  id: string;
  auftragsnummer: string;
  customerId: string;
  vehicleId?: string;
  assignedUserId?: string;
  serviceType: string;
  status: string;
  nettoSumme: number;
  mwstBetrag: number;
  gesamtpreis: number;
  materialkosten?: number;
  geplanterStart?: string;
  geplantesEnde?: string;
  items?: OrderItem[];
  bilderVorher?: string[];
  bilderNachher?: string[];
  leistungDetails?: LeistungDetails;
  createdAt?: string;
}

export interface Appointment {
  id: string;
  titel: string;
  start: string;
  ende: string;
  status: string;
  customerId?: string;
  vehicleId?: string;
  orderId?: string;
  assignedUserId?: string;
}

export interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  isActive?: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  kategorie?: string;
  einkaufspreis: number;
  verkaufspreis: number;
  bestand: number;
  mindestbestand: number;
  einheit?: string;
  istVermietbar?: boolean;
  mietpreisProTag?: number;
}

export interface Invoice {
  id: string;
  nummer: string;
  art: string;
  status: string;
  customerId: string;
  orderId?: string;
  netto: number;
  mwst: number;
  brutto: number;
  datum?: string;
  faelligkeitsdatum?: string;
  zahlungsziel?: number;
  zahldatum?: string;
  mahnstufe?: number;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  createdAt: string;
}

// Dekorierter offener Auftrag fuer das Dashboard (Namen bereits aufgeloest).
export interface DashboardOrder {
  id: string;
  auftragsnummer: string;
  status: string;
  art: string; // = serviceType
  gesamtpreis: number;
  kunde: string;
  fahrzeug: string;
  geplanterStart?: string;
}

// Dekorierter Termin fuer das Dashboard (Kunde/Fahrzeug aufgeloest).
export interface DashboardAppointment {
  id: string;
  titel: string;
  start: string;
  kunde: string;
  fahrzeug: string;
}

export interface UmsatzTrendPunkt {
  label: string;
  umsatz: number;
}

export interface TopLeistung {
  name: string;
  umsatz: number;
  anzahl: number;
}

export interface Location {
  id: string;
  name: string;
  street?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface StandortAuswertung {
  locationId: string | null;
  name: string;
  umsatz: number;
  offeneAuftraege: number;
  termine: number;
}

export interface SchadensMarker {
  id: string;
  ansicht: string;
  x: number;
  y: number;
  zone?: string;
  art: string;
  schweregrad: string;
  notiz?: string;
}

export interface VehicleIntake {
  id: string;
  customerId: string;
  vehicleId?: string;
  orderId?: string;
  kmStand?: number;
  tankstand?: number;
  marker?: SchadensMarker[];
  notiz?: string;
  createdAt?: string;
}

export interface DashboardStats {
  offeneAuftraege: number;
  termineHeute: number;
  kundenGesamt: number;
  umsatzBezahlt: number;
  umsatzMonat: number;
  umsatzVormonat: number;
  umsatzDeltaProzent: number | null;
  offeneRechnungenSumme: number;
  offeneRechnungenAnzahl: number;
  offeneAuftragsListe: DashboardOrder[];
  kommendeTermine: DashboardAppointment[];
  termineHeuteListe: DashboardAppointment[];
  umsatzTrend: UmsatzTrendPunkt[];
  topLeistungen: TopLeistung[];
}

// --- Abo / Subscription (SaaS) ---
export interface PlanLimits {
  maxUsers?: number | null;
  maxLocations?: number | null;
  maxCustomers?: number | null;
}

export interface Plan {
  id: string;
  slug: string;
  name: string;
  beschreibung?: string;
  // Decimal kommt als String aus der DB – Anzeige via eur() toleriert beides.
  preisMonatlich: number | string;
  waehrung: string;
  features?: string[];
  limits?: PlanLimits;
  istAktiv: boolean;
}

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'suspended';

export interface AccessResult {
  access: 'full' | 'warn' | 'blocked';
  status: SubscriptionStatus | 'none';
  reason: string;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId?: string;
  status: SubscriptionStatus;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  canceledAt?: string;
  cancelAtPeriodEnd?: boolean;
  notiz?: string;
  plan?: Plan | null;
  access?: AccessResult;
}

export interface TenantSubscriptionOverview {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  subscription: (Subscription & { plan: Plan | null; access: AccessResult }) | null;
}

// --- Zeiterfassung (Stempeluhr) ---
export type TimeEntryType = 'kommen' | 'gehen';

export interface TimeEntry {
  id: string;
  tenantId: string;
  userId: string;
  locationId?: string | null;
  art: TimeEntryType;
  zeitpunkt: string;
  korrigiert: boolean;
  notiz?: string;
  mitarbeiterName?: string; // angereichert (View)
  standortName?: string | null; // angereichert (View)
  createdAt?: string;
}

export interface TimeClockStatus {
  eingestempelt: boolean;
  seit: string | null;
  letzter: TimeEntry | null;
}

// --- 3D-Schadenserfassung (Inspection) ---
export interface Position3D {
  x: number;
  y: number;
  z: number; // Weltpunkt am Bauteil
  nx: number;
  ny: number;
  nz: number; // Weltnormale der getroffenen Flaeche
}

export type DamageOrigin = 'vorschaden' | 'neu';
export type DamageArt =
  | 'kratzer'
  | 'delle'
  | 'steinschlag'
  | 'lackschaden'
  | 'rost'
  | 'riss'
  | 'bruch'
  | 'verzogen'
  | 'fehlteil'
  | 'sonstiges';
export type DamageSchweregrad = 'leicht' | 'mittel' | 'schwer';
export type DamageReparaturart =
  | 'polieren'
  | 'smart_repair'
  | 'lackieren'
  | 'instandsetzen'
  | 'austausch'
  | 'keine';
export type DamageItemStatus = 'offen' | 'in_arbeit' | 'erledigt' | 'abgelehnt' | 'uebernommen';

export type DamagePhotoKategorie = 'detail' | 'uebersicht' | 'vin' | 'tacho' | 'kennzeichen';

export interface DamagePhoto {
  id: string;
  inspectionId: string;
  pfad: string;
  thumbnailPfad?: string;
  partId?: string;
  kategorie?: DamagePhotoKategorie;
  reihenfolge?: number;
  createdAt?: string;
}

export interface DamageItem {
  id: string;
  partId: string;
  partLabel?: string;
  positionMode: '3d' | '2d';
  position3d?: Position3D | null;
  ansicht2d?: string;
  x2d?: number;
  y2d?: number;
  origin: DamageOrigin;
  art: DamageArt;
  schweregrad: DamageSchweregrad;
  reparaturart?: DamageReparaturart;
  status?: DamageItemStatus;
  notiz?: string;
  istUebernommen?: boolean;
  photos?: DamagePhoto[];
}

export type InspectionTyp = 'annahme' | 'gutachten' | 'ausgang';
export type InspectionStatus = 'entwurf' | 'abgeschlossen' | 'freigegeben';

export interface DamageInspection {
  id: string;
  tenantId?: string;
  customerId?: string;
  vehicleId?: string;
  orderId?: string;
  typ?: InspectionTyp;
  status?: InspectionStatus;
  modelKey?: string;
  kmStand?: number;
  tankstand?: number;
  previousInspectionId?: string;
  notiz?: string;
  items?: DamageItem[];
  createdAt?: string;
}
