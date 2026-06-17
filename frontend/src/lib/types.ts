// Gemeinsame Typdefinitionen passend zu den Backend-Entities.

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
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
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  createdAt: string;
}

export interface DashboardStats {
  offeneAuftraege: number;
  termineHeute: number;
  kundenGesamt: number;
  umsatzBezahlt: number;
  offeneAuftragsListe: Order[];
}
