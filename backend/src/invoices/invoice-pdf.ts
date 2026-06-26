/**
 * PDF-Dokumentdefinition fuer Belege (Angebot + Rechnung) mit pdfmake.
 *
 * Bewusst nur eine reine Build-Funktion (keine Repo-Zugriffe, keine Guards):
 * Der aufrufende Service laedt die Daten tenant-scoped und uebergibt die bereits
 * geladene Invoice samt Customer/Tenant. So bleibt die Mandantentrennung im
 * Controller/Service, dieses Modul ist eine reine Rendering-Schicht.
 *
 * Wichtige Garantien:
 * - KEINE Neuberechnung von Summen. netto/mwst/brutto kommen 1:1 aus der DB
 *   (Decimal -> als String, daher Number()-Cast vor eur()). Damit kann das PDF
 *   nie von DB/Frontend abweichen.
 * - art steuert nur Titel + ob Faelligkeit gedruckt wird (Faelligkeit ist ein
 *   reines Rechnungs-Konzept, beim Angebot weggelassen).
 * - Umlaute/Euro funktionieren out-of-the-box ueber die mitgelieferten
 *   Roboto-Fonts (pdfmake VFS) – kein manuelles Font-Embedding noetig.
 */
import { eur, datum, kundenName } from '../common/util/format';

const MWST_PROZENT = 19; // entspricht MWST_SATZ=0.19 im invoices.service.ts

// Minimale Struktur-Typen, damit dieses Modul nicht hart an die Entities koppelt
// (verhindert Import-Zyklen / erleichtert Tests).
export interface PdfInvoiceItem {
  beschreibung: string;
  menge: number | string;
  einzelpreis: number | string;
  gesamtpreis: number | string;
}

export interface PdfInvoice {
  nummer: string;
  art: string; // 'angebot' | 'rechnung'
  status?: string;
  datum?: Date | string | null;
  leistungsdatum?: Date | string | null;
  faelligkeitsdatum?: Date | string | null;
  netto: number | string;
  mwst: number | string;
  brutto: number | string;
  /** Angewandter MwSt-Satz in Prozent (bevorzugt vor der Ableitung aus netto/mwst). */
  mwstSatz?: number | string | null;
  hinweis?: string | null;
  items?: PdfInvoiceItem[];
  // DSGVO/GoBD-Snapshot: bevorzugt vor dem Live-Customer verwendet (Anonymisierung).
  empfaengerName?: string | null;
  empfaengerAnschrift?: string | null;
  empfaengerVatNumber?: string | null;
}

export interface PdfCustomer {
  type?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  vatNumber?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

export interface PdfTenant {
  name: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  /** Generisches settings-Objekt; optionaler Steuer-/Bank-Block (falls gepflegt). */
  settings?: Record<string, unknown> | null;
}

const COPPER = '#B06A3B';
const INK = '#1A1A1A';
const MUTED = '#6B6B6B';

/** Liest einen optionalen settings-String defensiv (settings ist untypisiert). */
function setting(tenant: PdfTenant, key: string): string | undefined {
  const v = tenant.settings?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
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

/**
 * Baut die pdfmake-Dokumentdefinition fuer einen Beleg.
 * Rueckgabe ist ein einfaches Objekt (TDocumentDefinitions kompatibel), das der
 * Service an printer.createPdfKitDocument(...) uebergibt.
 */
export function buildInvoiceDocDef(
  invoice: PdfInvoice,
  customer: PdfCustomer | null,
  tenant: PdfTenant | null,
): Record<string, unknown> {
  const istRechnung = (invoice.art ?? 'rechnung') === 'rechnung';
  const titel = istRechnung ? 'Rechnung' : 'Angebot';

  // --- Absender (Tenant) ---
  const absenderName = tenant?.name ?? 'Detailly';
  const absenderAdresse = tenant ? adresszeilen(tenant) : [];
  const absenderKontakt: string[] = [];
  if (tenant?.phone) absenderKontakt.push(`Tel. ${tenant.phone}`);
  if (tenant?.email) absenderKontakt.push(tenant.email);

  // Einzeiler fuer das Kuvertfenster oberhalb der Empfaengeranschrift.
  const absenderEinzeiler = [
    absenderName,
    ...adresszeilen(tenant ?? {}),
  ]
    .filter(Boolean)
    .join(' · ');

  // --- Empfaenger (Customer ODER eingefrorener DSGVO-Snapshot) ---
  // Nach Art.17-Anonymisierung ist der Live-Customer entpersonalisiert; der
  // Snapshot auf der Invoice haelt den korrekten Rechnungsadressaten fest und
  // hat daher Vorrang. Fallback: Live-Customer (Normalfall vor Anonymisierung).
  const empfName = invoice.empfaengerName?.trim()
    ? invoice.empfaengerName.trim()
    : kundenName(customer ?? undefined);
  const empfAdresse = invoice.empfaengerAnschrift?.trim()
    ? invoice.empfaengerAnschrift.split('\n').map((z) => z.trim()).filter(Boolean)
    : customer
      ? adresszeilen(customer)
      : [];

  // --- Positionen ---
  const positionsHeader = [
    { text: 'Beschreibung', style: 'thead' },
    { text: 'Menge', style: 'theadRight' },
    { text: 'Einzelpreis', style: 'theadRight' },
    { text: 'Gesamt', style: 'theadRight' },
  ];
  const positionsZeilen = (invoice.items ?? []).map((i) => [
    { text: i.beschreibung ?? '', style: 'tcell' },
    { text: String(Number(i.menge)), style: 'tcellRight' },
    { text: eur(i.einzelpreis), style: 'tcellRight' },
    { text: eur(i.gesamtpreis), style: 'tcellRight' },
  ]);
  if (positionsZeilen.length === 0) {
    positionsZeilen.push([
      { text: 'Keine Positionen', style: 'tcell' },
      { text: '', style: 'tcellRight' },
      { text: '', style: 'tcellRight' },
      { text: '', style: 'tcellRight' },
    ]);
  }

  // --- Summenblock (ALLE Werte aus der DB, keine Neuberechnung) ---
  // Steuersatz aus den persistierten Werten ableiten (statt loser Konstante), damit
  // der ausgewiesene Prozentsatz immer zum tatsaechlichen MwSt-Betrag passt.
  const nettoNum = Number(invoice.netto);
  // Bevorzugt den gespeicherten Satz (korrekt auch bei netto=0); Fallback:
  // aus netto/mwst ableiten (Altbestand ohne mwstSatz).
  const satzProzent =
    invoice.mwstSatz !== undefined && invoice.mwstSatz !== null && invoice.mwstSatz !== ''
      ? Math.round(Number(invoice.mwstSatz))
      : nettoNum > 0
        ? Math.round((Number(invoice.mwst) / nettoNum) * 100)
        : MWST_PROZENT;
  const summen = {
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          { text: 'Zwischensumme netto', style: 'sumLabel' },
          { text: eur(invoice.netto), style: 'sumValue' },
        ],
        [
          { text: `zzgl. ${satzProzent}% MwSt`, style: 'sumLabel' },
          { text: eur(invoice.mwst), style: 'sumValue' },
        ],
        [
          { text: 'Gesamtbetrag brutto', style: 'sumTotalLabel' },
          { text: eur(invoice.brutto), style: 'sumTotalValue' },
        ],
      ],
    },
    layout: 'noBorders',
  };

  // --- Meta-Block (rechts oben) ---
  const metaBody: Array<Array<Record<string, unknown>>> = [
    [
      { text: 'Belegnummer', style: 'metaLabel' },
      { text: invoice.nummer, style: 'metaValue' },
    ],
    [
      { text: 'Datum', style: 'metaLabel' },
      { text: datum(invoice.datum), style: 'metaValue' },
    ],
    [
      { text: 'Leistungsdatum', style: 'metaLabel' },
      { text: datum(invoice.leistungsdatum), style: 'metaValue' },
    ],
  ];
  if (istRechnung && invoice.faelligkeitsdatum) {
    metaBody.push([
      { text: 'Fällig bis', style: 'metaLabel' },
      { text: datum(invoice.faelligkeitsdatum), style: 'metaValue' },
    ]);
  }

  // --- Optionaler Steuer-/Bank-Fussblock (nur wenn in settings gepflegt) ---
  const steuernummer = setting(tenant ?? ({} as PdfTenant), 'steuernummer');
  const ustId = setting(tenant ?? ({} as PdfTenant), 'ustId');
  const iban = setting(tenant ?? ({} as PdfTenant), 'iban');
  const bic = setting(tenant ?? ({} as PdfTenant), 'bic');
  const bankname = setting(tenant ?? ({} as PdfTenant), 'bankname');

  const fusszeilen: string[] = [];
  if (steuernummer) fusszeilen.push(`Steuernummer: ${steuernummer}`);
  if (ustId) fusszeilen.push(`USt-IdNr.: ${ustId}`);
  if (istRechnung && (iban || bankname)) {
    const bankZeile = [bankname, iban && `IBAN ${iban}`, bic && `BIC ${bic}`]
      .filter(Boolean)
      .join(' · ');
    if (bankZeile) fusszeilen.push(`Bankverbindung: ${bankZeile}`);
  }

  const content: Array<Record<string, unknown>> = [
    // Kopf: Absender links, Meta-Tabelle rechts
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
          table: { body: metaBody },
          layout: 'noBorders',
        },
      ],
      columnGap: 20,
    },
    { text: '\n' },
    // Absender-Einzeiler + Empfaengeranschrift
    { text: absenderEinzeiler, style: 'absenderEinzeiler' },
    {
      stack: [
        { text: empfName, style: 'empfName' },
        ...empfAdresse.map((z) => ({ text: z, style: 'empf' })),
      ],
      margin: [0, 4, 0, 0],
    },
    { text: '\n' },
    // Titel
    { text: `${titel} ${invoice.nummer}`, style: 'titel' },
    { text: '\n' },
    // Positionstabelle
    {
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto', 'auto'],
        body: [positionsHeader, ...positionsZeilen],
      },
      layout: {
        hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
          i === 0 || i === 1 || i === node.table.body.length ? 0.7 : 0.3,
        vLineWidth: () => 0,
        hLineColor: () => '#DDDDDD',
        paddingTop: () => 5,
        paddingBottom: () => 5,
      },
    },
    { text: '\n' },
    // Summenblock rechtsbuendig
    {
      columns: [{ width: '*', text: '' }, { width: 'auto', ...summen }],
    },
  ];

  if (invoice.hinweis) {
    content.push({ text: '\n' });
    content.push({ text: invoice.hinweis, style: 'hinweis' });
  }

  return {
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 60],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: INK },
    info: { title: `${titel} ${invoice.nummer}`, author: absenderName },
    content,
    footer: () =>
      fusszeilen.length
        ? {
            text: fusszeilen.join('   ·   '),
            style: 'fuss',
            margin: [40, 0, 40, 0],
          }
        : undefined,
    styles: {
      absenderName: { fontSize: 12, bold: true, color: COPPER },
      absender: { fontSize: 8, color: MUTED },
      absenderEinzeiler: { fontSize: 7, color: MUTED, decoration: 'underline' },
      empfName: { fontSize: 11, bold: true },
      empf: { fontSize: 10 },
      titel: { fontSize: 16, bold: true, color: INK },
      metaLabel: { fontSize: 8, color: MUTED, margin: [0, 0, 12, 2] },
      metaValue: { fontSize: 8, bold: true, margin: [0, 0, 0, 2] },
      thead: { bold: true, fontSize: 9, color: INK },
      theadRight: { bold: true, fontSize: 9, color: INK, alignment: 'right' },
      tcell: { fontSize: 9 },
      tcellRight: { fontSize: 9, alignment: 'right' },
      sumLabel: { fontSize: 9, color: MUTED, alignment: 'right', margin: [0, 0, 16, 2] },
      sumValue: { fontSize: 9, alignment: 'right', margin: [0, 0, 0, 2] },
      sumTotalLabel: {
        fontSize: 11,
        bold: true,
        alignment: 'right',
        margin: [0, 4, 16, 0],
      },
      sumTotalValue: { fontSize: 11, bold: true, color: COPPER, alignment: 'right', margin: [0, 4, 0, 0] },
      hinweis: { fontSize: 8, color: MUTED, italics: true },
      fuss: { fontSize: 7, color: MUTED, alignment: 'center' },
    },
  };
}
