/**
 * Reine Build-Funktion fuer die OEFFENTLICHE Web-Ansicht der Uebergabe-Mappe
 * (Pro-Feature `kundenerlebnis`, Welle 1). Kein Repo-Zugriff, keine Guards: der
 * aufrufende Service laedt Auftrag/Kunde/Fahrzeug/Tenant tenant-scoped und gatet
 * (Feature + Status) VOR dem Aufruf.
 *
 * BEWUSST PII-ARM (der Link ist zwar geheim/an den Kunden adressiert, wird aber
 * ohne Login geoeffnet): KEIN Kundenname, KEINE Kundenadresse, KEIN Preis, KEINE
 * internen Notizen. Gezeigt wird nur, was der Kunde ohnehin kennt: sein Fahrzeug,
 * die erbrachte Leistung, Pflege/Garantie – plus die (oeffentlichen) Kontaktdaten
 * des Betriebs.
 *
 * Welle 2-C: Die Nachher-/Vorher-Fotos werden NICHT eingebettet, sondern als
 * token-scoped INDEX-URLs (`/public/orders/<token>/foto/<phase>/<i>`) geliefert.
 * Bewusst per Index statt Dateiname -> es leckt KEINE interne Order-ID/kein Pfad
 * in die oeffentliche Nutzlast; der Bild-Endpunkt loest den Dateinamen server-
 * seitig aus dem Token auf (siehe orders.service.mappeFotoContextByToken).
 *
 * Faerbung (akzent) und Detail-/Pflege-Ableitung teilen sich EINE Quelle mit dem
 * PDF (`uebergabe-pdf`), damit Web und PDF identisch aussehen.
 */
import {
  PdfUebergabeOrder,
  PdfUebergabeVehicle,
  PdfUebergabeTenant,
  SERVICE_LABEL,
  leistungDetailZeilen,
  pflegehinweise,
  safeAkzent,
} from './uebergabe-pdf';
import { sanitizeLogoUrl } from '../common/logo-url';

export interface MappeView {
  betrieb: {
    name: string;
    /**
     * Sicheres Logo (http(s)-URL ODER validiertes data:image-Raster; kein SVG) –
     * wird im Browser als <img src> geladen. Gemeinsame Whitelist sanitizeLogoUrl.
     */
    logo: string | null;
    /** Validiertes Hex (Betriebsfarbe); Fallback Kupfer. */
    akzent: string;
    telefon: string | null;
    email: string | null;
    ort: string | null;
  };
  auftragsnummer: string;
  /** ISO-Datum (geplantesEnde ?? createdAt) oder null. */
  datum: string | null;
  fahrzeug: string | null;
  kennzeichen: string | null;
  serviceLabel: string;
  leistungen: string[];
  details: Array<{ label: string; wert: string }>;
  pflege: string | null;
  /** Anzahl hinterlegter Nachher-Fotos (Zahl bleibt fuer Abwaertskompatibilitaet). */
  nachherAnzahl: number;
  /**
   * Token-scoped Nachher-Bild-URLs (Index-basiert, KEINE internen IDs/Pfade).
   * Leer, wenn kein Token/keine Bilder – der "so sieht mein Auto jetzt aus"-Moment.
   */
  fotosNachher: string[];
  /** Token-scoped Vorher-Bild-URLs (fuer den optionalen Vorher/Nachher-Vergleich). */
  fotosVorher: string[];
  /**
   * Oeffentlicher Bewertungs-Link des Betriebs (settings.bewertung.googleUrl) oder
   * null. WICHTIG: bleibt fuer JEDE Feedback-Stimmung erreichbar (kein Review-
   * Gating) – die Betonung im UI unterscheidet sich, der Link selbst nie.
   */
  bewertungslink: string | null;
}

/** Zusatzquellen, die NICHT aus order/vehicle/tenant ableitbar sind. */
export interface MappeViewOptions {
  /** Bereits geprueftes Mappe-Token (Hex) fuer die Bild-URLs; null = keine Bild-URLs. */
  token?: string | null;
  /** Oeffentlicher Bewertungs-Link (bereits auf sicheres https normalisiert) oder null. */
  bewertungslink?: string | null;
}

function isoDatum(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function buildMappeView(
  order: PdfUebergabeOrder,
  vehicle: PdfUebergabeVehicle | null,
  tenant: (PdfUebergabeTenant & { logoUrl?: string | null; akzent?: string | null }) | null,
  opts: MappeViewOptions = {},
): MappeView {
  const fahrzeug = vehicle
    ? [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(' ') || null
    : null;
  const ort = tenant
    ? [tenant.postalCode, tenant.city].filter(Boolean).join(' ').trim() || null
    : null;

  // Index-basierte, token-scoped Bild-URLs (kein Dateiname/keine Order-ID in der
  // Nutzlast). Ohne Token bleibt die Liste leer (Bilder brauchen den Endpunkt).
  const token = (opts.token ?? '').trim();
  const fotoUrl = (phase: 'vorher' | 'nachher', i: number): string =>
    `/public/orders/${encodeURIComponent(token)}/foto/${phase}/${i}`;
  const nachherCount = order.bilderNachher?.length ?? 0;
  const vorherCount = order.bilderVorher?.length ?? 0;
  const fotosNachher = token
    ? Array.from({ length: nachherCount }, (_, i) => fotoUrl('nachher', i))
    : [];
  // Vorher-Fotos sind interne Schadensdoku und werden NUR ausgeliefert, wenn der
  // Betrieb sie fuer diesen Auftrag bewusst freigegeben hat (Default false). Der
  // Bild-Endpunkt gatet zusaetzlich (mappeFotoContextByToken) – hier bleibt die
  // Liste ansonsten leer, damit der Vorher/Nachher-Vergleich sauber weglaeuft.
  const fotosVorher =
    token && order.mappeVorherFotosZeigen
      ? Array.from({ length: vorherCount }, (_, i) => fotoUrl('vorher', i))
      : [];

  return {
    betrieb: {
      name: tenant?.name ?? 'Detailly',
      logo: sanitizeLogoUrl(tenant?.logoUrl),
      akzent: safeAkzent(tenant?.akzent),
      telefon: tenant?.phone ?? null,
      email: tenant?.email ?? null,
      ort,
    },
    auftragsnummer: order.auftragsnummer,
    datum: isoDatum(order.geplantesEnde ?? order.createdAt),
    fahrzeug,
    kennzeichen: vehicle?.licensePlate ?? null,
    serviceLabel: SERVICE_LABEL[order.serviceType ?? ''] ?? 'Leistung',
    leistungen: (order.items ?? [])
      .filter((i) => (i.typ ?? 'leistung') === 'leistung' && i.beschreibung)
      .map((i) => i.beschreibung),
    details: leistungDetailZeilen(order).map(([label, wert]) => ({ label, wert })),
    pflege: pflegehinweise(order),
    nachherAnzahl: nachherCount,
    fotosNachher,
    fotosVorher,
    bewertungslink: opts.bewertungslink ?? null,
  };
}
