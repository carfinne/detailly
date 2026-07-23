// Gemeinsame Typdefinitionen passend zu den Backend-Entities.

/** Buchungsart eines Kassenbuch-Eintrags (spiegelt KASSENBUCH_TYPEN). */
export type KassenbuchTyp = 'einnahme' | 'ausgabe';

/** Ein Eintrag im GoBD-Kassenbuch (Barzahlungen). */
export interface KassenbuchEintrag {
  id: string;
  laufendeNummer: number;
  datum: string;
  typ: KassenbuchTyp;
  betrag: number | string;
  mwstSatz: number | string;
  zweck: string;
  belegNummer?: string | null;
  kategorie?: string | null;
  kassenbestandNach: number | string;
  erfasstVonUserId: string;
  festgeschrieben: boolean;
  festgeschriebenAm?: string | null;
  stornoVonId?: string | null;
  createdAt?: string;
}

/** Antwort der Kassenbuch-Liste (paginiert + aktueller Kassenbestand). */
export interface KassenbuchListe {
  data: KassenbuchEintrag[];
  total: number;
  page: number;
  limit: number;
  kassenbestand: number;
}

/** Summen eines Zeitraums (Tag/Monat). */
export interface KassenbuchZeitraumSaldo {
  einnahmen: number;
  ausgaben: number;
  saldo: number;
}

/** Antwort von GET /kassenbuch/saldo. */
export interface KassenbuchSaldo {
  kassenbestand: number;
  tag: KassenbuchZeitraumSaldo;
  monat: KassenbuchZeitraumSaldo;
}

/** Auslese-Status einer empfangenen E-Rechnung (spiegelt IncomingInvoiceStatus). */
export type IncomingInvoiceStatus = 'gelesen' | 'teilweise' | 'nicht_lesbar';
/** Erkanntes Quellformat (spiegelt IncomingInvoiceFormat). */
export type IncomingInvoiceFormat = 'ubl' | 'cii' | 'cii_pdf' | 'unbekannt';

/** Empfangene E-Rechnung (E-Rechnungs-Eingang, §14 UStG). */
export interface IncomingInvoice {
  id: string;
  status: IncomingInvoiceStatus;
  format: IncomingInvoiceFormat;
  mimeType: string;
  dateiGroesse: number;
  originalDateiname?: string | null;
  rechnungsnummer?: string | null;
  rechnungsdatum?: string | null;
  faelligkeitsdatum?: string | null;
  leistungsdatum?: string | null;
  nettoBetrag?: number | string | null;
  mwstBetrag?: number | string | null;
  bruttoBetrag?: number | string | null;
  waehrung?: string;
  leitwegId?: string | null;
  verkaeuferName?: string | null;
  verkaeuferAnschrift?: string | null;
  verkaeuferUstId?: string | null;
  verkaeuferSteuernummer?: string | null;
  iban?: string | null;
  bic?: string | null;
  parseFehler?: string | null;
  createdAt?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  tenantName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  emailVerified?: boolean;
  /** Ist die Zwei-Faktor-Authentifizierung (TOTP) fuer diesen Nutzer aktiv? */
  mfaEnabled?: boolean;
  /** Betriebs-Pflicht: 2FA muss eingerichtet werden (Owner-Policy). Nur aus /auth/me. */
  mfaPflicht?: boolean;
  /** Plattform-Empfehlung: 2FA dringend empfohlen (Banner). Nur aus /auth/me. */
  mfaEmpfohlen?: boolean;
  /**
   * Benachrichtigungs-Praeferenzen je Nutzer (Welle 3-A): welche In-App-Hinweise
   * (Glocke) angezeigt werden. Aus /auth/me; fehlt der Block, gilt jede Kategorie
   * als AN (das Backend liefert ihn immer vollstaendig).
   */
  benachrichtigungen?: BenachrichtigungenPrefs;
}

/** Kategorien der Glocken-Benachrichtigungen (spiegelt backend/common/benachrichtigungen). */
export interface BenachrichtigungenPrefs {
  rechnungenFaellig: boolean;
  termineHeute: boolean;
  materialKnapp: boolean;
  steuerTermine: boolean;
  auslastung: boolean;
  par19: boolean;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Globale Suche (GET /api/v1/search?q=) -> fertige Anzeige-Strings vom Backend.
export interface SearchHit {
  id: string;
  title: string;
  subtitle?: string;
}

export interface GlobalSearchResult {
  query: string;
  customers: SearchHit[];
  vehicles: SearchHit[];
  orders: SearchHit[];
  invoices: SearchHit[];
  appointments: SearchHit[];
  total: number;
}

export type SearchGroupKey = 'customers' | 'vehicles' | 'orders' | 'invoices' | 'appointments';

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
  leitwegId?: string;
  isActive?: boolean;
  anonymisiertAm?: string | null;
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
  aktiv?: boolean;
}

// --- Starter-Katalog (Onboarding: Leistungen je Gewerk uebernehmen) ---------
export type StarterGewerk = 'aufbereitung' | 'folierung' | 'ppf';

export interface StarterLeistung {
  name: string;
  beschreibung: string;
  einheit: string;
  basispreis: number;
}

export interface StarterKatalogGruppe {
  gewerk: StarterGewerk;
  anzahl: number;
  leistungen: StarterLeistung[];
}

export interface StarterKatalog {
  gewerke: StarterKatalogGruppe[];
}

export interface StarterImportResult {
  importiert: number;
  uebersprungen: number;
  items: ServiceItem[];
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
  folierung?: {
    farbe?: string;
    hersteller?: string;
    qm?: number;
    teilfolierung?: boolean;
    garantieJahre?: number;
    pflegehinweis?: string;
  };
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

export interface OrderTime {
  id: string;
  orderId: string;
  userId: string;
  datum: string;
  minuten: number;
  notiz?: string;
  erfasstVon: string;
  mitarbeiterName?: string;
  /** Lohnkosten in € – nur fuer die Leitung gefuellt. */
  kosten?: number;
}

export interface OrderMaterial {
  id: string;
  orderId: string;
  productId: string;
  produktName: string;
  einheit: string;
  menge: number;
  erfasstVon: string;
  createdAt: string;
}

/**
 * Restrolle (Folierer-Welle 2): konkreter Folienrest, bewusst entkoppelt vom
 * groben Produkt-`bestand`. `restLfm` kommt als decimal-String über die API –
 * vor dem Rechnen via toNum() (lib/lfm-rechner) coercen.
 */
export interface FolienRolle {
  id: string;
  productId?: string | null;
  bezeichnung: string;
  charge?: string | null;
  restLfm: number;
  /** verfuegbar | aufgebraucht | entsorgt */
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** Bewerbungs-/Freigabe-Status eines Händlers (Welle 3: Großhändler-Portal). */
export type MarketplaceDealerStatus = 'beantragt' | 'freigegeben' | 'abgelehnt';

/** Ampel der KYB-Vorprüfung (Welle 5). */
export type KybAmpel = 'gruen' | 'gelb' | 'rot';

/** Ergebnis der assistierten Vorprüfung der Gewerbeanmeldung (Welle 5). */
export interface KybErgebnis {
  ampel: KybAmpel;
  felder: {
    firmenname?: string;
    anschrift?: string;
    taetigkeit?: string;
    anmeldedatum?: string;
    behoerde?: string;
  };
  abweichungen: string[];
  geprueftAm: string;
}

export interface MarketplaceDealer {
  id: string;
  name: string;
  beschreibung?: string;
  logoUrl?: string;
  webseite?: string;
  aktiv?: boolean;
  /** Nur in der Plattform-Pflege geliefert (Katalog liefert die Felder nicht). */
  status?: MarketplaceDealerStatus;
  kontaktEmail?: string;
  provisionSatz?: number;
  ansprechpartner?: string;
  telefon?: string;
  adresse?: string;
  ustIdNr?: string;
  /** CSV der Marktplatz-Bereiche, z. B. "folierung,ppf". */
  sortiment?: string;
  nachricht?: string;
  beantragtAm?: string | null;
  createdAt?: string;
  /** KYB (Welle 5): gesetzt, sobald eine Gewerbeanmeldung hochgeladen wurde. */
  gewerbeanmeldungDatei?: string | null;
  /** KYB-Vorprüfung; kann bei ganz frischer Bewerbung noch fehlen (läuft asynchron). */
  kybErgebnis?: KybErgebnis | null;
  /** Betreiber-Admin (PR7): existiert ein Händler-Login-Konto? */
  hatLoginKonto?: boolean;
  /** Betreiber-Admin (PR7): ist mindestens ein Händler-Login aktiv? */
  loginAktiv?: boolean;
}

/** Kategorie-Knoten der Betreiber-Pflege (inkl. inaktiver + `aktiv`). */
export interface MarketplaceCategoryAdminNode {
  id: string;
  slug: string;
  name: string;
  bereich: string;
  parentId: string | null;
  sdbPflicht: boolean;
  sortIndex: number;
  aktiv: boolean;
  unterkategorien?: MarketplaceCategoryAdminNode[];
}

/** Bewertung in der Betreiber-Moderation (auch inaktive; ohne bewertenden Betrieb/Nutzer). */
export interface MarketplaceReviewAdmin {
  id: string;
  productId: string;
  produktName: string;
  haendlerName: string;
  sterne: number;
  text: string | null;
  verifiziert: boolean;
  aktiv: boolean;
  createdAt: string;
}

/** Abgeleiteter Verfügbarkeits-Status (Katalog/Detail); nie der Rohbestand. */
export type MarketplaceBestandStatus = 'verfuegbar' | 'wenig' | 'ausverkauft';

/** Galerie-Bild-Referenz (Stream-Route baut die URL). */
export interface MarketplaceProductImage {
  id: string;
  sortIndex: number;
}

export interface MarketplaceProduct {
  id: string;
  dealerId: string;
  name: string;
  beschreibung?: string;
  /** Haupt-Bereich: folierung | aufbereitung | ppf | sonstiges. */
  bereich?: string;
  /** Marke/Hersteller (Schnellfilter). */
  marke?: string;
  /** Legacy-Kategorie. */
  kategorie?: string;
  preis?: number | null;
  preisHinweis?: string;
  bildUrl?: string;
  affiliateUrl?: string;
  /** Direkt in der App bestellbar (mit festem Preis). */
  bestellbar?: boolean;
  aktiv?: boolean;
  klicks?: number;
  createdAt?: string;
  /** Im Katalog serverseitig angereichert. */
  haendlerName?: string;
  // --- Katalog-Anreicherung (PR4): additiv, im Listen-Katalog gefüllt ---
  /** FK auf die Kategorie-Taxonomie (Unterkategorie-Filter). */
  categoryId?: string | null;
  /** Herkunftsland als ISO-3166-1 alpha-2 (z. B. "DE") – Flaggen-Anzeige. */
  herkunftsland?: string | null;
  /** Gebinde/Inhalt (Freitext, z. B. "1 L", "Rolle 1,52 × 25 m"). */
  inhaltMenge?: string | null;
  versandKosten?: number | string | null;
  versandHinweis?: string | null;
  lieferzeitTage?: number | null;
  /** Abgeleiteter Verfügbarkeits-Status (Rohbestand bleibt serverseitig). */
  bestandStatus?: MarketplaceBestandStatus;
  /** Redaktionelle Hervorhebung (Highlight-Ribbon). */
  istHighlight?: boolean;
  /** Liegt ein Sicherheitsdatenblatt (PDF) vor? */
  hatSdb?: boolean;
  bewertungSchnitt?: number;
  bewertungAnzahl?: number;
  verkaufsAnzahl?: number;
  rankingScore?: number;
  /** Galerie-Bilder (Stream-Route: /marketplace/products/:id/bild/:imageId). */
  bilder?: MarketplaceProductImage[];
}

/** Händler-Kurzprofil, wie es der Katalog/Detail liefert. */
export interface MarketplaceDealerBrief {
  id: string;
  name: string;
  beschreibung?: string;
  logoUrl?: string;
  webseite?: string;
}

/** Kategorie-Knoten der Taxonomie (Haupt- mit Unterkategorien). */
export interface MarketplaceCategoryNode {
  id: string;
  slug: string;
  name: string;
  bereich: string;
  parentId: string | null;
  sdbPflicht: boolean;
  sortIndex: number;
  unterkategorien?: MarketplaceCategoryNode[];
}

/** Gesamter kuratierter Katalog in einem Aufruf (GET /marketplace/catalog). */
export interface MarketplaceCatalog {
  produkte: MarketplaceProduct[];
  haendler: MarketplaceDealerBrief[];
  /** Legacy-Kategorien (Freitext); die Navigation läuft über bereich + categories. */
  kategorien: string[];
  /** Produkt-Ids für die Highlight-/Empfohlen-Sektion. */
  highlights: string[];
}

/** Öffentliche Bewertungs-Vorschau (nur Anzeige; ohne bewertenden Betrieb). */
export interface MarketplaceReviewPreview {
  sterne: number;
  text?: string | null;
  verifiziert: boolean;
  createdAt: string;
}

/** Eigene Bewertung des aufrufenden Betriebs (mit Moderationsstatus). */
export interface MarketplaceOwnReview {
  sterne: number;
  text?: string | null;
  verifiziert: boolean;
  aktiv: boolean;
  createdAt: string;
}

/** Produkt-Detail (volle Felder + Bewertungs-Vorschau). */
export interface MarketplaceProductDetail extends MarketplaceProduct {
  haendler?: MarketplaceDealerBrief | null;
  anwendungshinweise?: string | null;
  /** Flache Merkmal->Wert-Map (simple-json in der Entity); Detailseite rendert sie als Liste. */
  technischeDaten?: Record<string, string | number | boolean> | null;
  bewertungen?: MarketplaceReviewPreview[];
  /** Verifizierter Käufer, der noch nicht bewertet hat -> Formular anzeigen. */
  kannBewerten?: boolean;
  /** Bereits abgegebene eigene Bewertung -> bearbeiten/löschen statt Formular. */
  eigeneBewertung?: MarketplaceOwnReview | null;
}

/** Antwort der Schreib-Endpoints (eigene Bewertung + neu berechnetes Aggregat). */
export interface MarketplaceReviewResult extends MarketplaceOwnReview {
  bewertungSchnitt: number;
  bewertungAnzahl: number;
}

export type MarketplaceOrderStatus = 'eingegangen' | 'bestaetigt' | 'versendet' | 'storniert';

export interface MarketplaceOrderItem {
  id: string;
  orderId: string;
  dealerId: string;
  productId: string;
  produktName: string;
  einzelpreis: number;
  menge: number;
  zeilenSumme: number;
  provisionSatz: number;
  provisionBetrag: number;
}

export interface MarketplaceOrder {
  id: string;
  nummer: string;
  tenantId: string;
  dealerId: string;
  kontaktName: string;
  kontaktEmail: string;
  kontaktTelefon?: string;
  lieferFirma?: string;
  lieferStrasse?: string;
  lieferPlz?: string;
  lieferOrt?: string;
  lieferLand?: string;
  notiz?: string;
  status: MarketplaceOrderStatus;
  summeBrutto: number;
  summeProvision: number;
  createdAt: string;
  /** Serverseitig angereichert. */
  haendlerName?: string;
  positionen?: MarketplaceOrderItem[];
}

export interface SupportMessage {
  id: string;
  autorTyp: 'kunde' | 'detailly';
  autorName: string;
  text: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  betreff: string;
  kategorie: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages?: SupportMessage[];
  /** Nur in der Plattform-Ansicht gefuellt. */
  betriebName?: string;
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
  /** Zugewiesener Mitarbeiter; Entfernen der Zuweisung = explizit `null` senden (nie ''). */
  assignedUserId?: string | null;
  /** Standort des Termins (optional, nur bei Betrieben mit Standorten). */
  locationId?: string | null;
  notiz?: string;
}

/** Eintrag der 409-Konfliktliste des Doppelbuchungs-Schutzes (APPOINTMENT_OVERLAP). */
export interface TerminKonflikt {
  id: string;
  titel: string;
  start: string;
  ende: string;
  assignedUserId: string | null;
}

export interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  isActive?: boolean;
  stundenlohn?: number | null;
  /** Geburtstag als ISO-Datum 'YYYY-MM-DD' (jaehrliche Kalender-Erinnerung). */
  geburtstag?: string | null;
  /** Gewerk-Funktion (aufbereiter | folierer | ppf_spezialist | allrounder | buero). */
  funktion?: string | null;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  kategorie?: string;
  // Folierer-Welle 2: strukturierte Folien-Attribute (additiv/optional; nur bei
  // kategorie==='folie' gesetzt). Hinweis: die numerischen Felder (breiteCm,
  // einkaufspreis, …) kommen als decimal-String ueber die API – vor dem Rechnen
  // immer via toNum() (lib/lfm-rechner) coercen.
  hersteller?: string;
  serie?: string;
  farbcode?: string;
  finish?: string;
  breiteCm?: number;
  einkaufspreis: number;
  verkaufspreis: number;
  bestand: number;
  mindestbestand: number;
  einheit?: string;
  istVermietbar?: boolean;
  mietpreisProTag?: number;
  aktiv?: boolean;
}

// Lagerbewegung (GET /shop/movements). menge kommt als decimal-String -> vor dem
// Rechnen via toNum() coercen. Bei typ 'inventur' ist menge der NEUE Absolutbestand.
export interface StockMovement {
  id: string;
  productId: string;
  typ: 'zugang' | 'abgang' | 'inventur';
  menge: number;
  grund?: string;
  userId?: string;
  createdAt: string;
}

// Vermietung eines vermietbaren Produkts (GET/POST /shop/rentals).
export interface Rental {
  id: string;
  productId: string;
  customerId: string;
  von: string;
  bis: string;
  preis: number;
  status: 'reserviert' | 'aktiv' | 'zurueck';
  createdAt?: string;
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
  mwstSatz?: number;
  datum?: string;
  faelligkeitsdatum?: string;
  zahlungsziel?: number;
  zahldatum?: string;
  mahnstufe?: number;
  versendetAm?: string;
  // Welle 1 (Angebote): Varianten-Set-Bündelung + Angebots-Lebenszyklus.
  // Bei Rechnungen bleiben diese Felder leer/undefined.
  varianteGruppeId?: string | null;
  varianteLabel?: string | null;
  istGewaehlt?: boolean;
  gueltigBis?: string | null;
  angebotStatus?: string | null;
  istAnzahlung?: boolean;
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
  niedrigerBestand?: {
    anzahl: number;
    produkte: { name: string; bestand: number; mindestbestand: number; einheit: string }[];
  };
}

// --- Gamification / Erfolge (Welle 1, betriebsintern) ---
export interface BadgeTrack {
  key: string;
  wert: number;
  /** Index der hoechsten erreichten Stufe (-1 = noch keine). */
  stufeIndex: number;
  stufenAnzahl: number;
  naechsteSchwelle: number | null;
  fortschrittProzent: number;
  erreicht: boolean;
}

export interface AchievementsResponse {
  tracks: BadgeTrack[];
  leistungDesMonats: { name: string; anzahl: number; umsatz: number } | null;
  topKategorieMonat: { kategorie: string; anzahl: number } | null;
  betriebsalterTage: number;
}

export type LeaderboardZeitraum = 'monat' | 'jahr' | 'all';

export interface LeaderboardEntry {
  userId: string;
  name: string;
  aktiv: boolean;
  anzahlAuftraege: number;
  umsatz: number;
  rang: number;
}

export interface LeaderboardResponse {
  zeitraum: LeaderboardZeitraum;
  von: string | null;
  bis: string | null;
  eintraege: LeaderboardEntry[];
  nichtZugeordnet: { anzahlAuftraege: number; umsatz: number };
}

export interface WrappedResponse {
  jahr: number;
  betriebsname: string;
  anzahlAuftraege: number;
  umsatz: number;
  topLeistung: { name: string; anzahl: number } | null;
  topKategorie: string | null;
  /** Monatsindex 1–12; die Anzeige formatiert das Frontend in der aktiven UI-Sprache. */
  staerksterMonat: { monat: number; umsatz: number } | null;
  neueKunden: number;
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
  preisJaehrlich?: number | string | null;
  waehrung: string;
  features?: string[];
  limits?: PlanLimits;
  stripePriceId?: string;
  stripePriceIdYearly?: string;
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
  stripeSubscriptionId?: string;
  /** Nur in der kundensicheren /subscriptions/me-Sicht gesetzt (statt roher Stripe-ID). */
  hatStripeAbo?: boolean;
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
  // Digitale Unterschrift (DSGVO/Haftung). Gesetztes unterschriftPng == gesperrt.
  unterschriftPng?: string | null;
  unterschriebenVonName?: string | null;
  unterschriebenAm?: string | null;
  consentText?: string | null;
  items?: DamageItem[];
  createdAt?: string;
}

// --- Schichtdicken-Messprotokoll (Lackschichtdicke, µm; Pro-Add-on) ---
export type LayerMeasurementAnlass =
  | 'vor_folierung'
  | 'vor_ppf'
  | 'ankauf'
  | 'gutachten'
  | 'sonstiges';
export type LayerMeasurementStatus = 'entwurf' | 'abgeschlossen' | 'freigegeben';
export type LayerPointTyp = 'standard' | 'frei';

/** Eine einzelne µm-Messung an einem Punkt. */
export interface LayerReading {
  wertUm: number;
  erfasstAm?: string;
}

/** Ein Messpunkt an einem Bauteil mit seinen Einzelmessungen. */
export interface LayerMeasurementPoint {
  id: string;
  measurementId?: string;
  partId: string;
  partLabel?: string;
  punktTyp?: LayerPointTyp;
  standardKey?: string;
  label?: string;
  positionMode: '3d' | '2d';
  position3d?: Position3D | null;
  ansicht2d?: string;
  x2d?: number;
  y2d?: number;
  readings?: LayerReading[];
  reihenfolge?: number;
  createdAt?: string;
}

/** Pro-Bauteil aggregierte Auswertung (vom Backend abgeleitet). */
export interface LayerBauteilStatistik {
  count: number;
  punkte: number;
  minUm: number;
  maxUm: number;
  meanUm: number;
  repraesentativUm: number;
}
export interface LayerBauteilAuswertung {
  partId: string;
  partLabel?: string | null;
  statistik: LayerBauteilStatistik | null;
  status:
    | 'unbemessen'
    | 'duenn'
    | 'normal'
    | 'erhoeht'
    | 'verdacht'
    | 'nicht_metall';
  auffaellig: boolean;
}

/** Kopf eines Schichtdicken-Messprotokolls (Liste + Detail). */
export interface LayerMeasurement {
  id: string;
  tenantId?: string;
  customerId?: string;
  vehicleId?: string;
  orderId?: string;
  inspectionId?: string;
  modelKey?: string;
  anlass?: LayerMeasurementAnlass;
  status?: LayerMeasurementStatus;
  normProfileKey?: string;
  messgeraet?: string | null;
  notiz?: string | null;
  unterschriftPng?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // Nur im Detail (GET :id) befuellt:
  points?: LayerMeasurementPoint[];
  auswertung?: LayerBauteilAuswertung[];
  auffaelligeBauteile?: number;
}

// --- Dellenkalkulation (Smart Repair / PDR) ---
export type Groessenklasse = '1euro' | '2euro' | '5euro' | 'golfball' | 'groesser';
export type DellenModus = 'einzel' | 'hagel';
export type DellenStatus = 'entwurf' | 'final';

/** Ein Dellen-Marker (Einzel-Delle ODER Hagel-Panel). einzelpreis serverseitig. */
export interface DellenMarker {
  id: string;
  kalkulationId?: string;
  bauteil: string;
  bauteilLabel?: string | null;
  positionMode: '3d' | '2d';
  position3d?: Position3D | null;
  ansicht2d?: string | null;
  x2d?: number | null;
  y2d?: number | null;
  groessenklasse?: Groessenklasse | null;
  kante?: boolean;
  alu?: boolean;
  lackschaden?: boolean;
  dellenAnzahl?: number | null;
  /** Serverseitig berechnet (decimal-String). */
  einzelpreis?: string;
  reihenfolge?: number | null;
  clientUuid?: string;
}

/** Kopf einer Dellenkalkulation (Liste + Detail). */
export interface DellenKalkulation {
  id: string;
  tenantId?: string;
  customerId?: string | null;
  vehicleId?: string | null;
  modelKey?: string | null;
  modus: DellenModus;
  status: DellenStatus;
  /** Serverseitig berechnet (decimal-String). */
  gesamtpreis?: string;
  notiz?: string | null;
  finalisiertAm?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // Nur im Detail (GET :id) befuellt:
  marker?: DellenMarker[];
}

/** Eine Staffel-Stufe der Hagel-Kalkulation. */
export interface HagelStaffelStufe {
  maxDellen: number | null;
  pauschale: number;
}

/** Effektive Preismatrix (numerisch) inkl. Herkunfts-Flag. */
export interface DellenPreismatrix {
  basispreise: Record<Groessenklasse, number>;
  kantenFaktor: number;
  aluFaktor: number;
  lackschadenAufschlag: number;
  mindestpauschale: number;
  anfahrtspauschale: number;
  hagelStaffel: HagelStaffelStufe[];
  istDefault: boolean;
}

// --- Datenpannen-Register (Art. 33/34 DSGVO) ---
export type IncidentStatus =
  | 'erkannt'
  | 'in_pruefung'
  | 'meldepflichtig'
  | 'gemeldet'
  | 'nicht_meldepflichtig'
  | 'abgeschlossen';
export type IncidentSchweregrad = 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
export type IncidentQuelle = 'auto_signal' | 'manuell' | 'extern_gemeldet' | 'kunde_gemeldet';
export type IncidentSignalTyp = 'export_spike' | 'login_bruteforce' | 'forbidden_spike';

/** Vorfall inkl. serverseitig abgeleiteter 72h-Fristfelder (frist). */
export interface DataIncident {
  id: string;
  tenantId: string | null;
  quelle: IncidentQuelle;
  signalTyp: IncidentSignalTyp | null;
  status: IncidentStatus;
  schweregrad: IncidentSchweregrad;
  kenntnisAm: string;
  betroffeneDatenkategorien: string[] | null;
  betroffenePersonenAnzahl: number | null;
  betroffeneDatensaetzeAnzahl: number | null;
  beschreibung: string | null;
  wahrscheinlicheFolgen: string | null;
  getroffeneMassnahmen: string | null;
  risikoBewertung: string | null;
  meldungEntwurf: string | null;
  verantwortlicherInformiertAm: string | null;
  aufsichtsbehoerdeGemeldetAm: string | null;
  betroffeneInformiertAm: string | null;
  bearbeiterUserId: string | null;
  createdAt: string;
  updatedAt: string;
  frist: { deadline: string; restMs: number; ueberfaellig: boolean };
}
