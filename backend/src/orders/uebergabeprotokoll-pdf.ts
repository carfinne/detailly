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
import { buildQrCanvas } from '../common/pdf/qr-canvas';
import {
  PdfUebergabeCustomer,
  PdfUebergabeVehicle,
  PdfUebergabeTenant,
} from './uebergabe-pdf';
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
  CONTENT_WIDTH,
  HAIRLINE,
} from '../common/pdf/pdf-theme';

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

/** Eine leere Ausfuellzeile (duenne Linie ueber die volle Breite). */
function leerzeile(topMargin = 16): Record<string, unknown> {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.5, lineColor: HAIRLINE }],
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
  trackUrl?: string | null,
): Record<string, unknown> {
  const absenderName = tenant?.name ?? 'Detailly';

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
    // Kopf: Absender (Logo/Firmenname) links, Auftrag/Datum rechts.
    buildKopf(
      tenant,
      metaTabelle([
        ['Auftrag', order.auftragsnummer],
        ['Datum', datum(order.geplanterStart ?? order.createdAt)],
      ]),
    ),
    // Titel (+ feine Trennlinie).
    ...titelBlock('Annahme- / Übergabeprotokoll'),
    // Kunde
    {
      stack: [{ text: empfName, style: 'empfName' }, ...empfAdresse.map((z) => ({ text: z, style: 'empf' }))],
    },
    // Fahrzeug-Mappe: Track-Link als QR-Code fuer den Endkunden. Nur wenn ein
    // Link uebergeben wurde (der Service stellt das Token VOR dem Rendern sicher).
    // Kodiert wird der VERFOLGUNGS-Link (/track/?t=...), nicht die Mappe direkt –
    // er funktioniert auch vor Fertigstellung und blendet die Mappe automatisch ein.
    ...(trackUrl
      ? [
          {
            columns: [
              {
                width: '*',
                stack: [
                  { text: 'Fahrzeug-Mappe', style: 'section', margin: [0, 0, 0, 2] },
                  {
                    text:
                      'Fotos, Leistungen und Pflegehinweise zu Ihrem Fahrzeug jederzeit ' +
                      'ansehen – einfach den Code mit der Handykamera scannen.',
                    style: 'fliess',
                  },
                ],
              },
              {
                width: 'auto',
                stack: [{ canvas: buildQrCanvas(trackUrl).canvas }],
              },
            ],
            columnGap: 16,
            margin: [0, 14, 0, 0],
          },
        ]
      : []),
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
  content.push(
    signaturZeile('Ort, Datum · Unterschrift Kunde', 'Ort, Datum · Unterschrift Betrieb', {
      breite: 200,
      gap: 24,
      margin: [0, 34, 0, 0],
    }),
  );

  // Fuss: Firmierung/Geschaeftsbrief-Angaben + freier Betriebs-Fusstext, s/w.
  const pflichtLines = sammlePflichtLines(tenant, { firmierung: true, fusstext: true });

  return {
    pageSize: 'A4',
    pageMargins: PAGE_MARGINS,
    defaultStyle: defaultStyle(9),
    info: { title: `Übergabeprotokoll ${order.auftragsnummer}`, author: absenderName },
    content,
    footer: buildFuss(pflichtLines),
    styles: themeStyles(),
  };
}
