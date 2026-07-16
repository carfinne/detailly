/**
 * PDF-Dokumentdefinition fuer den Schichtdicken-Messbericht (pdfmake).
 *
 * Reine Build-Funktion (keine Repo-Zugriffe, keine Guards): Der Controller laedt
 * Protokoll/Punkte/Auswertung/Kunde/Fahrzeug/Tenant tenant-scoped und uebergibt
 * die geladenen Objekte. Mandantentrennung bleibt in der Service-/Controller-
 * Schicht.
 *
 * Die Heatmap wird als 2D-Schema mit pdfmake-VEKTOR (farbige Zonen-Rechtecke +
 * Legende) gezeichnet – deterministisch serverseitig, KEIN WebGL, kein neues
 * npm-Paket. Ein Client-3D-Snapshot ins PDF ist eine Welle-2-Option.
 *
 * WICHTIG (Haftung): Der Bericht traegt einen prominenten Haftungshinweis. Die
 * µm-Bewertung ist ein herstellerabhaengiger RICHTWERT-Hinweis, kein Gutachten.
 */
import { datum, kundenName } from '../common/util/format';
import type { AmpelStatus, BauteilStatistik } from './layer-norm-profiles';

const INK = '#1A1A1A';
const MUTED = '#6B6B6B';
const AKZENT = '#B06A3B';

/** Fuellfarben je Ampel-Status (druck-robust, in Graustufen unterscheidbar). */
const STATUS_COLOR: Record<AmpelStatus, string> = {
  unbemessen: '#CBD0D8',
  duenn: '#5B8DEF',
  normal: '#3FA66A',
  erhoeht: '#D9A521',
  verdacht: '#D65745',
  nicht_metall: '#9AA1AC',
};

const STATUS_LABEL: Record<AmpelStatus, string> = {
  unbemessen: 'Nicht gemessen',
  duenn: 'Dünn (< Serie)',
  normal: 'Normal (Serie)',
  erhoeht: 'Erhöht',
  verdacht: 'Verdacht (Nachlack/Spachtel)',
  nicht_metall: 'Kunststoff (nicht bewertbar)',
};

const ANLASS_LABEL: Record<string, string> = {
  vor_folierung: 'Vor Folierung',
  vor_ppf: 'Vor Lackschutzfolie (PPF)',
  ankauf: 'Ankauf / Gebrauchtwagen',
  gutachten: 'Begutachtung',
  sonstiges: 'Sonstiges',
};

// --- Minimal-Struktur-Typen (kein hartes Koppeln an die Entities) ---
export interface PdfMeasurement {
  anlass?: string;
  messgeraet?: string | null;
  normProfileKey?: string;
  notiz?: string | null;
  createdAt?: Date | string | null;
}
export interface PdfAuswertung {
  partId: string;
  partLabel?: string | null;
  statistik: BauteilStatistik | null;
  status: AmpelStatus;
  auffaellig: boolean;
}
export interface PdfPersonAdresse {
  type?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}
export interface PdfVehicle {
  make?: string;
  model?: string;
  variant?: string;
  color?: string;
  licensePlate?: string;
  vin?: string;
}
export interface PdfTenant {
  name?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
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

const round = (n: number): number => Math.round(n);

/**
 * Top-View-Schema: normalisierte Rechtecke je Bauteil (kanonische partId).
 * Fahrzeug zeigt nach oben (Front oben). Koordinaten in PDF-Punkten relativ zum
 * Canvas-Ursprung; Gesamtbreite 170, Hoehe 320.
 */
const SCHEMA_RECTS: Array<{ partId: string; x: number; y: number; w: number; h: number }> = [
  { partId: 'stossfaenger_vorne', x: 35, y: 0, w: 100, h: 18 },
  { partId: 'motorhaube', x: 45, y: 20, w: 80, h: 52 },
  { partId: 'kotfluegel_vl', x: 20, y: 20, w: 22, h: 66 },
  { partId: 'kotfluegel_vr', x: 128, y: 20, w: 22, h: 66 },
  { partId: 'dach', x: 48, y: 92, w: 74, h: 108 },
  { partId: 'tuer_vl', x: 20, y: 92, w: 25, h: 52 },
  { partId: 'tuer_hl', x: 20, y: 148, w: 25, h: 52 },
  { partId: 'tuer_vr', x: 125, y: 92, w: 25, h: 52 },
  { partId: 'tuer_hr', x: 125, y: 148, w: 25, h: 52 },
  { partId: 'seitenwand_hl', x: 20, y: 204, w: 25, h: 48 },
  { partId: 'seitenwand_hr', x: 125, y: 204, w: 25, h: 48 },
  { partId: 'heckklappe', x: 45, y: 204, w: 80, h: 48 },
  { partId: 'stossfaenger_hinten', x: 35, y: 256, w: 100, h: 18 },
];

/** Zeichnet das Karosserie-Schema als pdfmake-Canvas (farbige Rechtecke). */
function heatmapCanvas(statusByPart: Map<string, AmpelStatus>): Record<string, unknown> {
  const rects = SCHEMA_RECTS.map((r) => ({
    type: 'rect',
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    r: 2,
    color: STATUS_COLOR[statusByPart.get(r.partId) ?? 'unbemessen'],
    lineColor: '#FFFFFF',
    lineWidth: 1.2,
  }));
  return { canvas: rects };
}

/** Legende: farbige Quadrate + Status-Text (nur tatsaechlich relevante Stufen). */
function legende(): Record<string, unknown> {
  const stufen: AmpelStatus[] = ['normal', 'duenn', 'erhoeht', 'verdacht', 'nicht_metall', 'unbemessen'];
  return {
    stack: stufen.map((s) => ({
      columns: [
        {
          width: 12,
          canvas: [{ type: 'rect', x: 0, y: 1, w: 9, h: 9, r: 1.5, color: STATUS_COLOR[s] }],
        },
        { width: '*', text: STATUS_LABEL[s], style: 'legende' },
      ],
      columnGap: 4,
      margin: [0, 0, 0, 2],
    })),
  };
}

/**
 * Baut die pdfmake-Dokumentdefinition fuer den Schichtdicken-Messbericht.
 */
export function buildLayerMeasurementDocDef(
  measurement: PdfMeasurement,
  _points: unknown[],
  auswertung: PdfAuswertung[],
  customer: PdfPersonAdresse | null,
  vehicle: PdfVehicle | null,
  tenant: PdfTenant | null,
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

  const statusByPart = new Map<string, AmpelStatus>();
  for (const a of auswertung) statusByPart.set(a.partId, a.status);
  const auffaellige = auswertung.filter((a) => a.auffaellig);

  // --- Fahrzeug-Tabelle ---
  const fahrzeugBody: Array<Array<Record<string, unknown>>> = [
    [
      { text: 'Fahrzeug', style: 'metaLabel' },
      { text: fahrzeugName, style: 'metaValue' },
    ],
  ];
  if (vehicle?.licensePlate)
    fahrzeugBody.push([
      { text: 'Kennzeichen', style: 'metaLabel' },
      { text: vehicle.licensePlate, style: 'metaValue' },
    ]);
  if (vehicle?.vin)
    fahrzeugBody.push([
      { text: 'FIN', style: 'metaLabel' },
      { text: vehicle.vin, style: 'metaValue' },
    ]);
  if (vehicle?.color)
    fahrzeugBody.push([
      { text: 'Farbe', style: 'metaLabel' },
      { text: vehicle.color, style: 'metaValue' },
    ]);

  // --- Bauteil-Tabelle (nur gemessene Bauteile) ---
  const gemessen = auswertung.filter((a) => a.statistik && a.statistik.count > 0);
  const tabHeader = [
    { text: 'Bauteil', style: 'thead' },
    { text: 'Messungen', style: 'thead', alignment: 'right' },
    { text: 'Min µm', style: 'thead', alignment: 'right' },
    { text: 'Ø µm', style: 'thead', alignment: 'right' },
    { text: 'Max µm', style: 'thead', alignment: 'right' },
    { text: 'Bewertung', style: 'thead' },
  ];
  const tabBody: Array<Array<Record<string, unknown>>> = [tabHeader];
  for (const a of gemessen) {
    const s = a.statistik as BauteilStatistik;
    tabBody.push([
      { text: a.partLabel ?? a.partId, style: 'tcell' },
      { text: String(s.count), style: 'tcell', alignment: 'right' },
      { text: String(round(s.minUm)), style: 'tcell', alignment: 'right' },
      { text: String(round(s.meanUm)), style: 'tcell', alignment: 'right' },
      { text: String(round(s.maxUm)), style: 'tcell', alignment: 'right' },
      {
        columns: [
          {
            width: 10,
            canvas: [{ type: 'rect', x: 0, y: 1, w: 8, h: 8, r: 1.5, color: STATUS_COLOR[a.status] }],
          },
          { width: '*', text: STATUS_LABEL[a.status], style: 'tcell' },
        ],
        columnGap: 3,
      },
    ]);
  }

  const content: Array<Record<string, unknown>> = [
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
                { text: 'Datum', style: 'metaLabel' },
                { text: datum(measurement.createdAt), style: 'metaValue' },
              ],
              [
                { text: 'Anlass', style: 'metaLabel' },
                { text: ANLASS_LABEL[measurement.anlass ?? ''] ?? '–', style: 'metaValue' },
              ],
            ],
          },
          layout: 'noBorders',
        },
      ],
      columnGap: 20,
    },
    { text: '\n' },
    { text: 'Schichtdicken-Messprotokoll', style: 'titel' },
    { text: 'Lackschichtdicke (µm) je Fahrzeugbereich', style: 'untertitel' },
    { text: '\n' },
    { stack: [{ text: empfName, style: 'empfName' }, ...empfAdresse.map((z) => ({ text: z, style: 'empf' }))] },
    { text: '\n' },
    { text: 'Fahrzeug', style: 'section' },
    { table: { widths: ['auto', '*'], body: fahrzeugBody }, layout: 'noBorders' },
    { text: '\n' },
    // Schema + Legende nebeneinander
    { text: 'Schichtdicke-Übersicht (Draufsicht)', style: 'section' },
    {
      columns: [
        { width: 175, ...heatmapCanvas(statusByPart) },
        { width: '*', stack: [{ text: 'Legende', style: 'legendeTitel' }, legende()] },
      ],
      columnGap: 16,
    },
    { text: '\n' },
    { text: 'Messwerte je Bauteil', style: 'section' },
  ];

  if (gemessen.length) {
    content.push({
      table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'], body: tabBody },
      layout: {
        hLineWidth: (i: number) => (i === 1 ? 0.7 : 0.3),
        vLineWidth: () => 0,
        hLineColor: () => '#DDDDDD',
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
    });
  } else {
    content.push({ text: 'Es wurden noch keine Messwerte erfasst.', style: 'fliess' });
  }

  // Auffaelligkeiten
  content.push({ text: '\n' });
  content.push({ text: 'Auffälligkeiten', style: 'section' });
  if (auffaellige.length) {
    content.push({
      ul: auffaellige.map((a) => ({
        text: `${a.partLabel ?? a.partId}: bis ${round((a.statistik as BauteilStatistik).maxUm)} µm – Verdacht auf Nachlackierung/Spachtel (prüfen)`,
        style: 'fliess',
      })),
      margin: [0, 2, 0, 4],
    });
  } else {
    content.push({
      text: 'Keine Bauteile außerhalb des Richtwert-Bereichs erkannt.',
      style: 'fliess',
    });
  }

  if (measurement.notiz && measurement.notiz.trim()) {
    content.push({ text: '\n' });
    content.push({ text: 'Notiz', style: 'section' });
    content.push({ text: measurement.notiz.trim(), style: 'fliess' });
  }

  // Haftungshinweis (prominent, gerahmt)
  content.push({ text: '\n' });
  content.push({
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              { text: 'Wichtiger Hinweis', style: 'hinweisTitel' },
              {
                text:
                  'Die angegebenen µm-Bereiche sind herstellerabhängige Richtwerte und dienen nur als Hinweis auf mögliche Vorlackierungen oder Spachtelstellen. Dieses Protokoll ist KEIN Sachverständigen-Gutachten. Serienlackdicken variieren je nach Hersteller, Bauteil und Fertigung. Messgerät' +
                  (measurement.messgeraet ? `: ${measurement.messgeraet}. ` : ' nicht angegeben. ') +
                  `Angewandtes Normprofil: ${measurement.normProfileKey ?? 'serienlack_stahl'}.`,
                style: 'hinweisText',
              },
            ],
            margin: [8, 6, 8, 6],
            fillColor: '#FBF3EC',
          },
        ],
      ],
    },
    layout: 'noBorders',
  });

  return {
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 60],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: INK },
    info: { title: 'Schichtdicken-Messprotokoll', author: absenderName },
    content,
    styles: {
      absenderName: { fontSize: 12, bold: true, color: AKZENT },
      absender: { fontSize: 8, color: MUTED },
      empfName: { fontSize: 11, bold: true },
      empf: { fontSize: 10 },
      titel: { fontSize: 16, bold: true, color: INK },
      untertitel: { fontSize: 10, color: MUTED },
      section: { fontSize: 11, bold: true, color: AKZENT, margin: [0, 2, 0, 4] },
      metaLabel: { fontSize: 8, color: MUTED, margin: [0, 0, 12, 2] },
      metaValue: { fontSize: 9, bold: true, margin: [0, 0, 0, 2] },
      thead: { fontSize: 8, bold: true, color: MUTED },
      tcell: { fontSize: 9 },
      fliess: { fontSize: 10, margin: [0, 1, 0, 1] },
      legende: { fontSize: 8, margin: [0, 0, 0, 0] },
      legendeTitel: { fontSize: 8, bold: true, color: MUTED, margin: [0, 0, 0, 3] },
      hinweisTitel: { fontSize: 9, bold: true, color: AKZENT, margin: [0, 0, 0, 2] },
      hinweisText: { fontSize: 8, color: INK, lineHeight: 1.15 },
    },
  };
}
