/**
 * PDF-Dokumentdefinition fuer das Uebergabe-/Garantiedokument eines Auftrags
 * (Welle 1, F4) mit pdfmake.
 *
 * Reine Build-Funktion (keine Repo-Zugriffe, keine Guards): Der aufrufende
 * Service laedt Auftrag/Kunde/Fahrzeug/Tenant tenant-scoped und uebergibt die
 * bereits geladenen Objekte. Mandantentrennung bleibt in der Service-Schicht.
 *
 * Inhalt: Fahrzeug, erbrachte Leistung(en) mit Details, Garantiejahre,
 * Pflegehinweise, Verweis auf die Nachher-Fotos, Unterschriftszeile.
 * Download only – kein Auto-Versand.
 */
import { datum, kundenName } from '../common/util/format';
import {
  buildKopf,
  metaTabelle,
  titelBlock,
  buildFuss,
  sammlePflichtLines,
  signaturZeile,
  themeStyles,
  defaultStyle,
  adresszeilen,
  PAGE_MARGINS,
} from '../common/pdf/pdf-theme';

// Minimale Struktur-Typen (kein hartes Koppeln an die Entities).
export interface PdfUebergabeOrder {
  auftragsnummer: string;
  serviceType?: string;
  status?: string;
  geplantesEnde?: Date | string | null;
  createdAt?: Date | string | null;
  bilderVorher?: string[] | null;
  bilderNachher?: string[] | null;
  /** Vorher-Fotos in der oeffentlichen Kundenmappe freigegeben? (Default false.) */
  mappeVorherFotosZeigen?: boolean | null;
  leistungDetails?: {
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
  } | null;
  items?: Array<{ beschreibung: string; typ?: string }>;
}

export interface PdfUebergabeCustomer {
  type?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

export interface PdfUebergabeVehicle {
  make?: string;
  model?: string;
  variant?: string;
  year?: number;
  color?: string;
  licensePlate?: string;
  vin?: string;
}

export interface PdfUebergabeTenant {
  name?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  /** Verschluesseltes settings-JSON (Steuer-/Firmierungs-/Fusstext-Keys). */
  settings?: Record<string, unknown> | null;
  /** Betriebs-Logo als data:image-URL (PNG/JPEG) fuer den Kopf; sonst Firmenname. */
  logoUrl?: string | null;
}

// Kupfer bleibt NUR fuer safeAkzent (Web-Kundenmappe, mappe-view). Das PDF selbst
// ist schwarz-weiss (Theme) und nutzt die Akzentfarbe bewusst NICHT.
const COPPER = '#B06A3B';

export const SERVICE_LABEL: Record<string, string> = {
  aufbereitung: 'Fahrzeugaufbereitung',
  folierung: 'Folierung',
  ppf: 'Lackschutzfolie (PPF)',
  sonstiges: 'Leistung',
};

/**
 * Validierte Akzentfarbe fuer die Betriebs-Marke. Akzeptiert NUR ein 3-/6-
 * stelliges Hex (kein beliebiger Freitext -> pdfmake/Style-Injection-sicher).
 * Ungueltig/leer -> Kupfer-Default (Detailly-Stammfarbe). Dieselbe Regel nutzt
 * die oeffentliche Web-Ansicht (mappe-view), damit PDF und Web identisch faerben.
 */
export function safeAkzent(farbe?: string | null): string {
  const s = (farbe ?? '').trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : COPPER;
}

/** Detailzeilen (Label/Wert) je nach erbrachter Leistung. */
export function leistungDetailZeilen(order: PdfUebergabeOrder): Array<[string, string]> {
  const d = order.leistungDetails ?? {};
  const zeilen: Array<[string, string]> = [];
  const push = (label: string, wert: unknown) => {
    if (wert !== undefined && wert !== null && String(wert).trim() !== '') {
      zeilen.push([label, String(wert)]);
    }
  };
  if (d.folierung) {
    const f = d.folierung;
    push('Farbe / Folie', f.farbe);
    push('Hersteller', f.hersteller);
    if (f.qm != null) push('Fläche', `${f.qm} m²`);
    if (f.teilfolierung != null) push('Umfang', f.teilfolierung ? 'Teilfolierung' : 'Vollfolierung');
    if (f.garantieJahre != null) push('Garantie', `${f.garantieJahre} Jahre`);
  }
  if (d.ppf) {
    const p = d.ppf;
    push('Folie', p.folie);
    push('Hersteller', p.hersteller);
    if (p.qm != null) push('Fläche', `${p.qm} m²`);
    if (p.garantieJahre != null) push('Garantie', `${p.garantieJahre} Jahre`);
  }
  if (d.keramik) {
    const k = d.keramik;
    push('Produkt', k.produkt);
    if (k.schichten != null) push('Schichten', String(k.schichten));
    if (k.garantieJahre != null) push('Garantie', `${k.garantieJahre} Jahre`);
  }
  return zeilen;
}

/** Sammelt Pflegehinweise (aktuell aus der Folierung) als Fliesstext. */
export function pflegehinweise(order: PdfUebergabeOrder): string | null {
  const hinweis = order.leistungDetails?.folierung?.pflegehinweis;
  return hinweis && hinweis.trim() ? hinweis.trim() : null;
}

/**
 * Baut die pdfmake-Dokumentdefinition fuer das Uebergabe-/Garantiedokument.
 * Schwarz-weiss, ueber den gemeinsamen Theme-Baustein (Kopf/Titel/Fuss). Ein
 * hinterlegtes Betriebs-Logo (tenant.logoUrl, data:image PNG/JPEG) erscheint im
 * Kopf, sonst der Firmenname. Die Betriebs-Akzentfarbe wird bewusst NICHT genutzt.
 */
export function buildUebergabeDocDef(
  order: PdfUebergabeOrder,
  customer: PdfUebergabeCustomer | null,
  vehicle: PdfUebergabeVehicle | null,
  tenant: PdfUebergabeTenant | null,
): Record<string, unknown> {
  const absenderName = tenant?.name ?? 'Detailly';

  const empfName = kundenName(customer ?? undefined);
  const empfAdresse = customer ? adresszeilen(customer) : [];

  const fahrzeugName = vehicle
    ? [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(' ') || '–'
    : '–';

  const serviceLabel = SERVICE_LABEL[order.serviceType ?? ''] ?? 'Leistung';
  const detailZeilen = leistungDetailZeilen(order);
  const pflege = pflegehinweise(order);
  const leistungen = (order.items ?? [])
    .filter((i) => (i.typ ?? 'leistung') === 'leistung' && i.beschreibung)
    .map((i) => i.beschreibung);
  const anzahlNachher = order.bilderNachher?.length ?? 0;

  // --- Fahrzeug-Tabelle ---
  const fahrzeugBody: Array<Array<Record<string, unknown>>> = [
    [
      { text: 'Fahrzeug', style: 'metaLabel' },
      { text: fahrzeugName, style: 'metaValue' },
    ],
  ];
  if (vehicle?.licensePlate) {
    fahrzeugBody.push([
      { text: 'Kennzeichen', style: 'metaLabel' },
      { text: vehicle.licensePlate, style: 'metaValue' },
    ]);
  }
  if (vehicle?.vin) {
    fahrzeugBody.push([
      { text: 'FIN', style: 'metaLabel' },
      { text: vehicle.vin, style: 'metaValue' },
    ]);
  }
  if (vehicle?.color) {
    fahrzeugBody.push([
      { text: 'Farbe', style: 'metaLabel' },
      { text: vehicle.color, style: 'metaValue' },
    ]);
  }

  const content: Array<Record<string, unknown>> = [
    // Kopf: Absender (Logo/Firmenname) links, Auftrag/Datum rechts.
    buildKopf(
      tenant,
      metaTabelle([
        ['Auftrag', order.auftragsnummer],
        ['Datum', datum(order.geplantesEnde ?? order.createdAt)],
      ]),
    ),
    // Titel (+ feine Trennlinie).
    ...titelBlock('Übergabe- & Garantiedokument'),
    // Empfaenger
    {
      stack: [{ text: empfName, style: 'empfName' }, ...empfAdresse.map((z) => ({ text: z, style: 'empf' }))],
    },
    // Fahrzeug
    { text: 'Fahrzeug', style: 'section' },
    { table: { widths: ['auto', '*'], body: fahrzeugBody }, layout: 'noBorders' },
    // Leistung
    { text: `Erbrachte Leistung: ${serviceLabel}`, style: 'section' },
  ];

  if (leistungen.length) {
    content.push({
      ul: leistungen.map((z) => ({ text: z, style: 'fliess' })),
      margin: [0, 2, 0, 4],
    });
  }
  if (detailZeilen.length) {
    content.push({
      table: {
        widths: ['auto', '*'],
        body: detailZeilen.map(([label, wert]) => [
          { text: label, style: 'metaLabel' },
          { text: wert, style: 'metaValue' },
        ]),
      },
      layout: 'noBorders',
    });
  }
  if (!leistungen.length && !detailZeilen.length) {
    content.push({ text: serviceLabel, style: 'fliess' });
  }

  // Pflegehinweise
  if (pflege) {
    content.push({ text: 'Pflegehinweise', style: 'section' });
    content.push({ text: pflege, style: 'fliess' });
  }

  // Nachher-Fotos-Verweis (die Bilder selbst liegen guard-geschuetzt in der App).
  content.push({ text: 'Dokumentation', style: 'section' });
  content.push({
    text:
      anzahlNachher > 0
        ? `Zu diesem Auftrag sind ${anzahlNachher} Nachher-Foto(s) hinterlegt und in Ihrem Kundenbereich einsehbar.`
        : 'Zu diesem Auftrag sind derzeit keine Nachher-Fotos hinterlegt.',
    style: 'fliess',
  });

  // Unterschriftszeile (Ort/Datum · Unterschrift Kunde).
  content.push(signaturZeile('Ort, Datum', 'Unterschrift Kunde', { breite: 180, gap: 20, margin: [0, 40, 0, 0] }));

  // Fuss-Angaben (Geschaeftsbrief-Firmierung + freier Betriebs-Fusstext), s/w.
  const pflichtLines = sammlePflichtLines(tenant, { firmierung: true, fusstext: true });

  return {
    pageSize: 'A4',
    pageMargins: PAGE_MARGINS,
    defaultStyle: defaultStyle(9),
    info: { title: `Übergabe ${order.auftragsnummer}`, author: absenderName },
    content,
    footer: buildFuss(pflichtLines),
    styles: themeStyles(),
  };
}
