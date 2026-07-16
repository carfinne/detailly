/**
 * Reine Build-Funktion fuer die OEFFENTLICHE Web-Ansicht der Uebergabe-Mappe
 * (Pro-Feature `kundenerlebnis`, Welle 1). Kein Repo-Zugriff, keine Guards: der
 * aufrufende Service laedt Auftrag/Kunde/Fahrzeug/Tenant tenant-scoped und gatet
 * (Feature + Status) VOR dem Aufruf.
 *
 * BEWUSST PII-ARM (der Link ist zwar geheim/an den Kunden adressiert, wird aber
 * ohne Login geoeffnet): KEIN Kundenname, KEINE Kundenadresse, KEIN Preis, KEINE
 * internen Notizen, KEINE Fotos (Fotos = Welle 2 mit Kennzeichen-/Consent-Konzept).
 * Gezeigt wird nur, was der Kunde ohnehin kennt: sein Fahrzeug, die erbrachte
 * Leistung, Pflege/Garantie – plus die (oeffentlichen) Kontaktdaten des Betriebs.
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

export interface MappeView {
  betrieb: {
    name: string;
    /** Nur http(s)-URL (sonst null) – wird im Browser als <img> geladen. */
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
  /** Anzahl hinterlegter Nachher-Fotos (nur Zahl, keine Bilder in Welle 1). */
  nachherAnzahl: number;
}

/** Nur echte http(s)-URLs zulassen (kein javascript:/data: im <img src>). */
function safeLogo(url?: string | null): string | null {
  const s = (url ?? '').trim();
  return /^https?:\/\/\S+$/i.test(s) ? s : null;
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
): MappeView {
  const fahrzeug = vehicle
    ? [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(' ') || null
    : null;
  const ort = tenant
    ? [tenant.postalCode, tenant.city].filter(Boolean).join(' ').trim() || null
    : null;

  return {
    betrieb: {
      name: tenant?.name ?? 'Detailly',
      logo: safeLogo(tenant?.logoUrl),
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
    nachherAnzahl: order.bilderNachher?.length ?? 0,
  };
}
