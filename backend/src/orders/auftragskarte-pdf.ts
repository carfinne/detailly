/**
 * PDF-Dokumentdefinition fuer die AUFTRAGSKARTE (Werkstatt-Laufzettel) eines
 * Auftrags mit pdfmake.
 *
 * Reine Build-Funktion (keine Repo-Zugriffe, keine Guards): Der aufrufende
 * Service laedt Auftrag/Kunde/Fahrzeug/Tenant tenant-scoped und uebergibt die
 * bereits geladenen Objekte. Mandantentrennung bleibt in der Service-Schicht.
 *
 * Zweck: kompakter Laufzettel (1 Seite) fuer die Werkstatt – Auftragsnummer,
 * Kunde (Name/Telefon), Fahrzeug (Kennzeichen/Marke/Modell), Termin, gebuchte
 * Leistungen als Checkliste mit Ankreuz-Kaestchen, Notizzeilen und Platz fuer
 * das Mitarbeiter-Kuerzel. Bewusst s/w-tauglich (druckerfreundlich, keine
 * Farbakzente). Download only – kein Auto-Versand.
 */
import { datum, kundenName } from '../common/util/format';
import { PdfUebergabeVehicle, PdfUebergabeTenant, SERVICE_LABEL } from './uebergabe-pdf';

const INK = '#1A1A1A';
const MUTED = '#6B6B6B';
const LINE = '#B8B8B8';
const CONTENT_WIDTH = 515; // A4 (595pt) minus 2×40 Seitenrand.

/** Minimale Struktur des Auftrags fuer die Auftragskarte (kein Entity-Koppeln). */
export interface PdfAuftragskarteOrder {
  auftragsnummer: string;
  serviceType?: string;
  geplanterStart?: Date | string | null;
  geplantesEnde?: Date | string | null;
  createdAt?: Date | string | null;
  items?: Array<{ beschreibung: string; typ?: string }>;
}

/** Kundendaten fuer die Auftragskarte inkl. Telefon (fuer den Werkstatt-Kontakt). */
export interface PdfKarteCustomer {
  type?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone?: string;
  mobile?: string;
}

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

/** Ankreuz-Kaestchen (leeres Quadrat) als pdfmake-canvas-Node. */
function checkbox(): Record<string, unknown> {
  return {
    canvas: [{ type: 'rect', x: 0, y: 1, w: 11, h: 11, lineWidth: 0.9, lineColor: '#444' }],
    width: 18,
  };
}

/** Eine leere Ausfuellzeile (duenne Linie ueber die volle Breite). */
function leerzeile(topMargin = 16): Record<string, unknown> {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.5, lineColor: LINE }],
    margin: [0, topMargin, 0, 0],
  };
}

/** Buchbare Leistungspositionen (typ='leistung') als Checklisten-Texte. */
export function leistungsCheckliste(order: PdfAuftragskarteOrder): string[] {
  return (order.items ?? [])
    .filter((i) => (i.typ ?? 'leistung') === 'leistung' && i.beschreibung)
    .map((i) => i.beschreibung);
}

/** Termin-Zeile: Start (– Ende) oder „–", wenn nichts geplant ist. */
export function terminText(order: PdfAuftragskarteOrder): string {
  const start = order.geplanterStart ? datum(order.geplanterStart) : null;
  const ende = order.geplantesEnde ? datum(order.geplantesEnde) : null;
  if (start && ende && start !== ende) return `${start} – ${ende}`;
  return start ?? ende ?? '–';
}

/** Baut die pdfmake-Dokumentdefinition fuer die Auftragskarte. */
export function buildAuftragskarteDocDef(
  order: PdfAuftragskarteOrder,
  customer: PdfKarteCustomer | null,
  vehicle: PdfUebergabeVehicle | null,
  tenant: PdfUebergabeTenant | null,
): Record<string, unknown> {
  const absenderName = tenant?.name ?? 'Detailly';
  const absenderAdresse = tenant ? adresszeilen(tenant) : [];
  const absenderKontakt: string[] = [];
  if (tenant?.phone) absenderKontakt.push(`Tel. ${tenant.phone}`);
  if (tenant?.email) absenderKontakt.push(tenant.email);

  const kunde = kundenName(customer ?? undefined);
  const telefon = customer?.phone || customer?.mobile || '–';

  const fahrzeugName = vehicle
    ? [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(' ') || '–'
    : '–';
  const kennzeichen = vehicle?.licensePlate || '–';

  const serviceLabel = SERVICE_LABEL[order.serviceType ?? ''] ?? 'Leistung';
  const leistungen = leistungsCheckliste(order);

  // Zwei-Spalten-Datenblock (Kunde | Fahrzeug) als randlose Meta-Tabellen.
  const kundeTabelle = {
    table: {
      widths: ['auto', '*'],
      body: [
        [
          { text: 'Kunde', style: 'metaLabel' },
          { text: kunde, style: 'metaValue' },
        ],
        [
          { text: 'Telefon', style: 'metaLabel' },
          { text: telefon, style: 'metaValue' },
        ],
      ],
    },
    layout: 'noBorders',
  };
  const fahrzeugTabelle = {
    table: {
      widths: ['auto', '*'],
      body: [
        [
          { text: 'Kennzeichen', style: 'metaLabel' },
          { text: kennzeichen, style: 'metaValueStrong' },
        ],
        [
          { text: 'Fahrzeug', style: 'metaLabel' },
          { text: fahrzeugName, style: 'metaValue' },
        ],
      ],
    },
    layout: 'noBorders',
  };

  const content: Array<Record<string, unknown>> = [
    // Kopf: Absender links, Auftragsnummer rechts.
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
              [{ text: 'Auftrag', style: 'metaLabel' }],
              [{ text: order.auftragsnummer, style: 'auftragsnr' }],
            ],
          },
          layout: 'noBorders',
          alignment: 'right',
        },
      ],
      columnGap: 20,
    },
    { text: 'Auftragskarte', style: 'titel', margin: [0, 12, 0, 2] },
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 1, lineColor: INK }],
      margin: [0, 2, 0, 10],
    },
    // Kunde | Fahrzeug nebeneinander.
    {
      columns: [
        { width: '*', stack: [kundeTabelle] },
        { width: '*', stack: [fahrzeugTabelle] },
      ],
      columnGap: 20,
    },
    // Service + Termin.
    {
      table: {
        widths: ['auto', '*', 'auto', '*'],
        body: [
          [
            { text: 'Leistungsart', style: 'metaLabel' },
            { text: serviceLabel, style: 'metaValue' },
            { text: 'Termin', style: 'metaLabel' },
            { text: terminText(order), style: 'metaValue' },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 8, 0, 0],
    },
    { text: 'Leistungen', style: 'section', margin: [0, 14, 0, 6] },
  ];

  // Checkliste der gebuchten Leistungen (Ankreuz-Kaestchen + Text).
  if (leistungen.length) {
    for (const leistung of leistungen) {
      content.push({
        columns: [checkbox(), { width: '*', text: leistung, style: 'check' }],
        margin: [0, 3, 0, 3],
      });
    }
  } else {
    // Keine gebuchten Positionen -> leere Ankreuz-Zeilen zum handschriftlichen Ausfuellen.
    for (let i = 0; i < 4; i++) {
      content.push({
        columns: [
          checkbox(),
          {
            width: '*',
            canvas: [{ type: 'line', x1: 0, y1: 8, x2: CONTENT_WIDTH - 18, y2: 8, lineWidth: 0.5, lineColor: LINE }],
          },
        ],
        margin: [0, 4, 0, 4],
      });
    }
  }

  // Notizfeld mit mehreren Ausfuellzeilen.
  content.push({ text: 'Notizen', style: 'section', margin: [0, 16, 0, 0] });
  for (let i = 0; i < 5; i++) content.push(leerzeile(i === 0 ? 14 : 16));

  // Fuss: Platz fuer das Mitarbeiter-Kuerzel + Datum.
  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.7, lineColor: MUTED }] },
          { text: 'Bearbeiter / Kürzel', style: 'sigLabel' },
        ],
      },
      { width: 24, text: '' },
      {
        width: '*',
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.7, lineColor: MUTED }] },
          { text: 'Datum', style: 'sigLabel' },
        ],
      },
    ],
    margin: [0, 28, 0, 0],
  });

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 48],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: INK },
    info: { title: `Auftragskarte ${order.auftragsnummer}`, author: absenderName },
    content,
    styles: {
      absenderName: { fontSize: 12, bold: true, color: INK },
      absender: { fontSize: 8, color: MUTED },
      auftragsnr: { fontSize: 15, bold: true, color: INK, alignment: 'right' },
      titel: { fontSize: 18, bold: true, color: INK },
      section: { fontSize: 12, bold: true, color: INK },
      metaLabel: { fontSize: 8, color: MUTED, margin: [0, 0, 12, 2] },
      metaValue: { fontSize: 10, bold: true, margin: [0, 0, 0, 2] },
      metaValueStrong: { fontSize: 12, bold: true, margin: [0, 0, 0, 2] },
      check: { fontSize: 11, margin: [0, 0, 0, 0] },
      sigLabel: { fontSize: 8, color: MUTED, margin: [0, 3, 0, 0] },
    },
  };
}
