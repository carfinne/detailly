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

// Minimale Struktur-Typen (kein hartes Koppeln an die Entities).
export interface PdfUebergabeOrder {
  auftragsnummer: string;
  serviceType?: string;
  status?: string;
  geplantesEnde?: Date | string | null;
  createdAt?: Date | string | null;
  bilderNachher?: string[] | null;
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
}

const COPPER = '#B06A3B';
const INK = '#1A1A1A';
const MUTED = '#6B6B6B';

const SERVICE_LABEL: Record<string, string> = {
  aufbereitung: 'Fahrzeugaufbereitung',
  folierung: 'Folierung',
  ppf: 'Lackschutzfolie (PPF)',
  sonstiges: 'Leistung',
};

function adresszeilen(o: {
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}): string[] {
  const zeilen: string[] = [];
  if (o.street) zeilen.push(o.street);
  const ort = [o.postalCode, o.city].filter(Boolean).join(' ').trim();
  if (ort) zeilen.push(ort);
  if (o.country && o.country !== 'DE') zeilen.push(o.country);
  return zeilen;
}

/** Detailzeilen (Label/Wert) je nach erbrachter Leistung. */
function leistungDetailZeilen(order: PdfUebergabeOrder): Array<[string, string]> {
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
function pflegehinweise(order: PdfUebergabeOrder): string | null {
  const hinweis = order.leistungDetails?.folierung?.pflegehinweis;
  return hinweis && hinweis.trim() ? hinweis.trim() : null;
}

/**
 * Baut die pdfmake-Dokumentdefinition fuer das Uebergabe-/Garantiedokument.
 */
export function buildUebergabeDocDef(
  order: PdfUebergabeOrder,
  customer: PdfUebergabeCustomer | null,
  vehicle: PdfUebergabeVehicle | null,
  tenant: PdfUebergabeTenant | null,
): Record<string, unknown> {
  const absenderName = tenant?.name ?? 'Detailly';
  const absenderAdresse = tenant ? adresszeilen(tenant) : [];
  const absenderKontakt: string[] = [];
  if (tenant?.phone) absenderKontakt.push(`Tel. ${tenant.phone}`);
  if (tenant?.email) absenderKontakt.push(tenant.email);

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
    // Kopf: Absender links, Belegdaten rechts
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: absenderName, style: 'absenderName' },
            ...absenderAdresse.map((z) => ({ text: z, style: 'absender' })),
            ...absenderKontakt.map((z) => ({ text: z, style: 'absender' })),
          ],
        },
        {
          width: 'auto',
          table: {
            body: [
              [
                { text: 'Auftrag', style: 'metaLabel' },
                { text: order.auftragsnummer, style: 'metaValue' },
              ],
              [
                { text: 'Datum', style: 'metaLabel' },
                { text: datum(order.geplantesEnde ?? order.createdAt), style: 'metaValue' },
              ],
            ],
          },
          layout: 'noBorders',
        },
      ],
      columnGap: 20,
    },
    { text: '\n' },
    { text: 'Übergabe- & Garantiedokument', style: 'titel' },
    { text: '\n' },
    // Empfaenger
    {
      stack: [{ text: empfName, style: 'empfName' }, ...empfAdresse.map((z) => ({ text: z, style: 'empf' }))],
    },
    { text: '\n' },
    // Fahrzeug
    { text: 'Fahrzeug', style: 'section' },
    { table: { widths: ['auto', '*'], body: fahrzeugBody }, layout: 'noBorders' },
    { text: '\n' },
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
    content.push({ text: '\n' });
    content.push({ text: 'Pflegehinweise', style: 'section' });
    content.push({ text: pflege, style: 'fliess' });
  }

  // Nachher-Fotos-Verweis (die Bilder selbst liegen guard-geschuetzt in der App).
  content.push({ text: '\n' });
  content.push({ text: 'Dokumentation', style: 'section' });
  content.push({
    text:
      anzahlNachher > 0
        ? `Zu diesem Auftrag sind ${anzahlNachher} Nachher-Foto(s) hinterlegt und in Ihrem Kundenbereich einsehbar.`
        : 'Zu diesem Auftrag sind derzeit keine Nachher-Fotos hinterlegt.',
    style: 'fliess',
  });

  // Unterschriftszeile
  content.push({ text: '\n\n' });
  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.7, lineColor: MUTED }] },
          { text: 'Ort, Datum', style: 'sigLabel' },
        ],
      },
      { width: 20, text: '' },
      {
        width: '*',
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.7, lineColor: MUTED }] },
          { text: 'Unterschrift Kunde', style: 'sigLabel' },
        ],
      },
    ],
  });

  return {
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 60],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: INK },
    info: { title: `Übergabe ${order.auftragsnummer}`, author: absenderName },
    content,
    styles: {
      absenderName: { fontSize: 12, bold: true, color: COPPER },
      absender: { fontSize: 8, color: MUTED },
      empfName: { fontSize: 11, bold: true },
      empf: { fontSize: 10 },
      titel: { fontSize: 16, bold: true, color: INK },
      section: { fontSize: 11, bold: true, color: COPPER, margin: [0, 2, 0, 4] },
      metaLabel: { fontSize: 8, color: MUTED, margin: [0, 0, 12, 2] },
      metaValue: { fontSize: 9, bold: true, margin: [0, 0, 0, 2] },
      fliess: { fontSize: 10, margin: [0, 1, 0, 1] },
      sigLabel: { fontSize: 8, color: MUTED, margin: [0, 3, 0, 0] },
    },
  };
}
