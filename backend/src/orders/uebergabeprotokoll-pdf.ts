/**
 * PDF-Dokumentdefinition fuer das ANNAHME-/UEBERGABEPROTOKOLL eines Auftrags
 * mit pdfmake.
 *
 * Reine Build-Funktion (keine Repo-Zugriffe, keine Guards): Der aufrufende
 * Service laedt Auftrag/Kunde/Fahrzeug/Tenant + vorhandene Annahme-Schaeden
 * tenant-scoped und uebergibt die bereits geladenen Objekte. Mandantentrennung
 * bleibt in der Service-Schicht.
 *
 * Zweck: Zustandsprotokoll fuer die Fahrzeugannahme/-uebergabe – vorhandene
 * Schadensdaten (falls eine Annahme-Inspektion existiert) als Liste, Zeilen fuer
 * Kilometerstand/Tankfuellung zum Ausfuellen, ein neutraler Haftungs-Standardtext
 * (KEINE Rechtsberatung) und zwei Unterschriftslinien (Kunde/Betrieb) mit
 * Ort/Datum. Bewusst s/w-tauglich (druckerfreundlich). Download only.
 */
import { datum, kundenName } from '../common/util/format';
import {
  PdfUebergabeCustomer,
  PdfUebergabeVehicle,
  PdfUebergabeTenant,
} from './uebergabe-pdf';

const INK = '#1A1A1A';
const MUTED = '#6B6B6B';
const LINE = '#B8B8B8';
const CONTENT_WIDTH = 515; // A4 (595pt) minus 2×40 Seitenrand.

/** Deutsche Labels fuer die Schadensart (Spiegel der DamageArt-Enums). */
const ART_LABEL: Record<string, string> = {
  kratzer: 'Kratzer',
  delle: 'Delle',
  steinschlag: 'Steinschlag',
  lackschaden: 'Lackschaden',
  rost: 'Rost',
  riss: 'Riss',
  bruch: 'Bruch',
  verzogen: 'Verzogen',
  fehlteil: 'Fehlteil',
  sonstiges: 'Sonstiges',
};

const ORIGIN_LABEL: Record<string, string> = {
  vorschaden: 'Vorschaden',
  neu: 'Neu',
};

/** Ein dokumentierter Schaden aus der Annahme-Inspektion (kein Entity-Koppeln). */
export interface PdfProtokollSchaden {
  partLabel?: string | null;
  partId?: string | null;
  art?: string | null;
  schweregrad?: string | null;
  ausmass?: string | null;
  origin?: string | null;
}

/** Annahme-Kontext: erfasste Schaeden + optionale Km-/Tankwerte bei Annahme. */
export interface PdfAnnahmeKontext {
  kmStand?: number | null;
  tankstand?: number | null;
  schaeden: PdfProtokollSchaden[];
}

/** Minimale Struktur des Auftrags fuer das Protokoll. */
export interface PdfProtokollOrder {
  auftragsnummer: string;
  geplanterStart?: Date | string | null;
  createdAt?: Date | string | null;
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

/** Eine leere Ausfuellzeile (duenne Linie ueber die volle Breite). */
function leerzeile(topMargin = 16): Record<string, unknown> {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.5, lineColor: LINE }],
    margin: [0, topMargin, 0, 0],
  };
}

/**
 * Verdichtet einen Schaden zu einer lesbaren Zeile, z. B.
 * "Tür vorne links – Kratzer (mittel, Vorschaden), Streifer 20 cm".
 */
export function schadenZeile(s: PdfProtokollSchaden): string {
  const ort = s.partLabel || s.partId || 'Fahrzeug';
  const art = ART_LABEL[s.art ?? ''] ?? (s.art ? String(s.art) : 'Schaden');
  const zusatz: string[] = [];
  if (s.schweregrad) zusatz.push(String(s.schweregrad));
  if (s.origin && ORIGIN_LABEL[s.origin]) zusatz.push(ORIGIN_LABEL[s.origin]);
  const kopf = zusatz.length ? `${art} (${zusatz.join(', ')})` : art;
  return s.ausmass ? `${ort} – ${kopf}, ${s.ausmass}` : `${ort} – ${kopf}`;
}

/** Neutraler Haftungs-/Hinweistext (KEINE Rechtsberatung). */
const HAFTUNGSTEXT =
  'Der Kunde bestätigt die Richtigkeit der oben erfassten Fahrzeugdaten und des ' +
  'dokumentierten Zustands bei Annahme. Nicht ausdrücklich vermerkte Schäden gelten ' +
  'als bei Annahme nicht festgestellt. Für das Fahrzeug und darin befindliche ' +
  'Gegenstände wird nur im Rahmen der gesetzlichen Bestimmungen gehaftet. Wertsachen ' +
  'sind vor der Übergabe zu entnehmen. Für bereits vorhandene (Vor-)Schäden wird ' +
  'keine Haftung übernommen.';

/** Baut die pdfmake-Dokumentdefinition fuer das Annahme-/Uebergabeprotokoll. */
export function buildUebergabeprotokollDocDef(
  order: PdfProtokollOrder,
  customer: PdfUebergabeCustomer | null,
  vehicle: PdfUebergabeVehicle | null,
  tenant: PdfUebergabeTenant | null,
  annahme: PdfAnnahmeKontext | null = null,
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

  const schaeden = annahme?.schaeden ?? [];

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
    // Kopf: Absender links, Auftrag/Datum rechts.
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
                { text: datum(order.geplanterStart ?? order.createdAt), style: 'metaValue' },
              ],
            ],
          },
          layout: 'noBorders',
        },
      ],
      columnGap: 20,
    },
    { text: 'Annahme- / Übergabeprotokoll', style: 'titel', margin: [0, 12, 0, 2] },
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 1, lineColor: INK }],
      margin: [0, 2, 0, 10],
    },
    // Kunde
    {
      stack: [{ text: empfName, style: 'empfName' }, ...empfAdresse.map((z) => ({ text: z, style: 'empf' }))],
    },
    // Fahrzeug
    { text: 'Fahrzeug', style: 'section', margin: [0, 12, 0, 4] },
    { table: { widths: ['auto', '*'], body: fahrzeugBody }, layout: 'noBorders' },
    // Kilometerstand / Tankfuellung zum Ausfuellen (bei Annahme ggf. vorbelegt als Hinweis).
    {
      table: {
        widths: ['auto', '*', 'auto', '*'],
        body: [
          [
            { text: 'Kilometerstand', style: 'metaLabel' },
            {
              text:
                annahme?.kmStand != null ? `${annahme.kmStand} km` : '_______________',
              style: 'fillValue',
            },
            { text: 'Tankfüllung', style: 'metaLabel' },
            {
              text:
                annahme?.tankstand != null ? `${annahme.tankstand} %` : '_______________',
              style: 'fillValue',
            },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 10, 0, 0],
    },
    // Fahrzeugzustand bei Annahme.
    { text: 'Fahrzeugzustand bei Annahme', style: 'section', margin: [0, 14, 0, 4] },
  ];

  if (schaeden.length) {
    content.push({
      ul: schaeden.map((s) => ({ text: schadenZeile(s), style: 'fliess' })),
      margin: [0, 2, 0, 4],
    });
  } else {
    content.push({
      text: 'Keine Schäden aus einer Annahme-Inspektion hinterlegt. Bitte Zustand hier vermerken:',
      style: 'hint',
    });
    for (let i = 0; i < 4; i++) content.push(leerzeile(i === 0 ? 14 : 16));
  }

  // Haftungs-/Hinweistext (neutral).
  content.push({ text: 'Hinweise', style: 'section', margin: [0, 16, 0, 4] });
  content.push({ text: HAFTUNGSTEXT, style: 'legal' });

  // Zwei Unterschriftslinien (Kunde / Betrieb) mit Ort/Datum.
  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.7, lineColor: MUTED }] },
          { text: 'Ort, Datum · Unterschrift Kunde', style: 'sigLabel' },
        ],
      },
      { width: 24, text: '' },
      {
        width: '*',
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.7, lineColor: MUTED }] },
          { text: 'Ort, Datum · Unterschrift Betrieb', style: 'sigLabel' },
        ],
      },
    ],
    margin: [0, 34, 0, 0],
  });

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 48],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: INK },
    info: { title: `Übergabeprotokoll ${order.auftragsnummer}`, author: absenderName },
    content,
    styles: {
      absenderName: { fontSize: 12, bold: true, color: INK },
      absender: { fontSize: 8, color: MUTED },
      empfName: { fontSize: 11, bold: true },
      empf: { fontSize: 10 },
      titel: { fontSize: 18, bold: true, color: INK },
      section: { fontSize: 12, bold: true, color: INK },
      metaLabel: { fontSize: 8, color: MUTED, margin: [0, 0, 12, 2] },
      metaValue: { fontSize: 9, bold: true, margin: [0, 0, 0, 2] },
      fillValue: { fontSize: 10, margin: [0, 0, 0, 2] },
      fliess: { fontSize: 10, margin: [0, 1, 0, 1] },
      hint: { fontSize: 9, italics: true, color: MUTED },
      legal: { fontSize: 8, color: MUTED, lineHeight: 1.2 },
      sigLabel: { fontSize: 8, color: MUTED, margin: [0, 3, 0, 0] },
    },
  };
}
