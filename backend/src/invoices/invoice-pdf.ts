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
import { resolveSteuer } from '../common/steuer';
import {
  buildKopf,
  metaTabelle,
  titelBlock,
  buildFuss,
  sammlePflichtLines,
  tabellenLayout,
  themeStyles,
  defaultStyle,
  adresszeilen,
  setting,
  PAGE_MARGINS,
  INK,
} from '../common/pdf/pdf-theme';

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
  /** Rechnungskorrektur: gesetzt, wenn dieser Beleg eine Stornorechnung ist. */
  stornoVonInvoiceId?: string | null;
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
  /** Betriebs-Logo als data:image-URL (PNG/JPEG) fuer den Kopf; sonst Firmenname. */
  logoUrl?: string | null;
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
  // Rechnungskorrektur: ein Storno-Beleg traegt den Titel "Stornorechnung".
  const istStorno = !!invoice.stornoVonInvoiceId;
  const titel = istStorno ? 'Stornorechnung' : istRechnung ? 'Rechnung' : 'Angebot';
  // Rechnungs-Entwuerfe haben noch keine Nummer (wird erst bei Festsetzung vergeben).
  const nummerText = invoice.nummer || 'Entwurf';

  // --- Absender (Tenant) --- (Kopf-Layout uebernimmt das Theme via buildKopf)
  const absenderName = tenant?.name ?? 'Detailly';

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

  // §19 UStG (Kleinunternehmer): Steuer-Konfiguration des Betriebs defensiv
  // aufloesen. Ein §19-Beleg wird NUR dann als steuerbefreit behandelt, wenn der
  // Betrieb aktuell Kleinunternehmer ist UND der Beleg 0 % traegt – so bleiben
  // Alt-Belege mit 19 % (aus der Zeit vor der Umstellung) korrekt und ein
  // regulaerer 0 %-Beleg (z. B. innergem. Lieferung) unberuehrt.
  const steuer = resolveSteuer((tenant?.settings ?? {})['steuer']);
  const istBefreiung = steuer.kleinunternehmer && satzProzent === 0;

  const summenBody: Array<Array<Record<string, unknown>>> = [
    [
      { text: 'Zwischensumme netto', style: 'sumLabel' },
      { text: eur(invoice.netto), style: 'sumValue' },
    ],
  ];
  // Bei §19 die MwSt-Zeile WEGLASSEN (nicht "zzgl. 0 %"); sonst ausweisen.
  if (!istBefreiung) {
    summenBody.push([
      { text: `zzgl. ${satzProzent}% MwSt`, style: 'sumLabel' },
      { text: eur(invoice.mwst), style: 'sumValue' },
    ]);
  }
  summenBody.push([
    { text: istBefreiung ? 'Gesamtbetrag' : 'Gesamtbetrag brutto', style: 'sumTotalLabel' },
    { text: eur(invoice.brutto), style: 'sumTotalValue' },
  ]);
  const summen = {
    table: { widths: ['*', 'auto'], body: summenBody },
    layout: 'noBorders',
  };

  // --- Meta-Block (rechts oben) ---
  const metaRows: Array<[string, string]> = [
    ['Belegnummer', nummerText],
    ['Datum', datum(invoice.datum)],
    ['Leistungsdatum', datum(invoice.leistungsdatum)],
  ];
  if (istRechnung && invoice.faelligkeitsdatum) {
    metaRows.push(['Fällig bis', datum(invoice.faelligkeitsdatum)]);
  }

  // --- Fuss-Pflichtangaben (§14 UStG + Geschaeftsbrief) aus den Stammdaten ---
  // Firmierung/Rechtsform, Steuernummer/USt-IdNr., Bankverbindung (nur Rechnung)
  // und freier Betriebs-Fusstext. Fehlende Angaben fallen ersatzlos weg – keine
  // leere Zeile, kein "undefined". Zentral im Theme (identisch fuer alle Belege).
  const pflichtLines = sammlePflichtLines(tenant, {
    steuer: true,
    bank: istRechnung,
    firmierung: true,
    fusstext: true,
  });

  const content: Array<Record<string, unknown>> = [
    // Kopf: Absender (Logo/Firmenname + Anschrift) links, Beleg-Meta rechts.
    buildKopf(tenant, metaTabelle(metaRows)),
    // Kuvertfenster-Absenderzeile + Empfaengeranschrift.
    { text: absenderEinzeiler, style: 'absenderEinzeiler', margin: [0, 22, 0, 0] },
    {
      stack: [
        { text: empfName, style: 'empfName' },
        ...empfAdresse.map((z) => ({ text: z, style: 'empf' })),
      ],
      margin: [0, 4, 0, 0],
    },
    // Titel (+ feine Trennlinie).
    ...titelBlock(`${titel} ${nummerText}`),
    // Rechnungskorrektur: eindeutiger Bezug auf die Ursprungsrechnung (§14 UStG)
    // direkt unter dem Titel (statt nur als kleiner Fuss-Hinweis).
    ...(istStorno && invoice.hinweis
      ? [{ text: invoice.hinweis, style: 'stornoRef', margin: [0, 0, 0, 8] }]
      : []),
    // Positionstabelle (feine Trennlinien statt Vollgitter).
    {
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto', 'auto'],
        body: [positionsHeader, ...positionsZeilen],
      },
      layout: tabellenLayout(),
    },
    // Summenblock rechtsbuendig.
    { columns: [{ width: '*', text: '' }, { width: 'auto', ...summen }], margin: [0, 12, 0, 0] },
  ];

  // §19 UStG (Kleinunternehmer): bei einem steuerbefreiten Beleg ist der Hinweis
  // gesetzlich erforderlich, dass keine Umsatzsteuer ausgewiesen wird. Der Text
  // kommt aus den Einstellungen (steuer.kleinunternehmerHinweis, Default-Text
  // wird von resolveSteuer garantiert) – nicht mehr hart codiert.
  if (istBefreiung) {
    content.push({ text: steuer.kleinunternehmerHinweis, style: 'hinweis', margin: [0, 14, 0, 0] });
  }

  // Bei Stornorechnungen steht der Hinweis bereits als Bezug unter dem Titel –
  // hier nicht erneut ausgeben.
  if (invoice.hinweis && !istStorno) {
    content.push({ text: invoice.hinweis, style: 'hinweis', margin: [0, 14, 0, 0] });
  }

  return {
    pageSize: 'A4',
    pageMargins: PAGE_MARGINS,
    defaultStyle: defaultStyle(9),
    info: { title: `${titel} ${nummerText}`, author: absenderName },
    content,
    footer: buildFuss(pflichtLines),
    styles: themeStyles({ stornoRef: { fontSize: 10, color: INK } }),
  };
}

export interface MahnungOpts {
  mahnstufe: number; // 1..3
  mahndatum: Date | string;
  zahlbarBis: Date | string;
  tageUeberfaellig: number;
  /** Konfigurierte Mahngebuehr der Stufe (EUR, Cent-normalisiert). 0/undefined = keine. */
  gebuehr?: number;
  /** Zu zahlender Gesamtbetrag = brutto + gebuehr. Nur relevant/ausgewiesen bei gebuehr > 0. */
  gesamtbetrag?: number;
}

/** Titel je Mahnstufe (1=Erinnerung, 2=1. Mahnung, 3=2. Mahnung). */
export const MAHN_TITEL: Record<number, string> = {
  1: 'Zahlungserinnerung',
  2: '1. Mahnung',
  3: '2. Mahnung',
};

const MAHN_KOERPER: Record<number, string[]> = {
  1: [
    'vermutlich ist es Ihrer Aufmerksamkeit entgangen – die unten genannte Rechnung ist bei uns noch offen.',
    'Sollten Sie den Betrag bereits überwiesen haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.',
  ],
  2: [
    'trotz unserer Erinnerung ist die unten genannte Rechnung weiterhin offen.',
    'Wir bitten Sie, den offenen Betrag nun zeitnah auszugleichen.',
  ],
  3: [
    'leider konnten wir bis heute keinen Zahlungseingang feststellen.',
    'Wir fordern Sie letztmalig auf, den offenen Betrag fristgerecht zu begleichen. Andernfalls behalten wir uns weitere Schritte vor.',
  ],
};

/**
 * Baut die pdfmake-Dokumentdefinition fuer eine Mahnung/Zahlungserinnerung zu
 * einer Rechnung. Reine Render-Funktion (Daten kommen tenant-scoped geladen aus
 * dem Service). Optik identisch zum Beleg-PDF.
 */
export function buildMahnungDocDef(
  invoice: PdfInvoice,
  customer: PdfCustomer | null,
  tenant: PdfTenant | null,
  opts: MahnungOpts,
): Record<string, unknown> {
  const titel = MAHN_TITEL[opts.mahnstufe] ?? 'Zahlungserinnerung';
  const absenderName = tenant?.name ?? 'Detailly';
  const absenderEinzeiler = [absenderName, ...adresszeilen(tenant ?? {})].filter(Boolean).join(' · ');

  const empfName = invoice.empfaengerName?.trim()
    ? invoice.empfaengerName.trim()
    : kundenName(customer ?? undefined);
  const empfAdresse = invoice.empfaengerAnschrift?.trim()
    ? invoice.empfaengerAnschrift.split('\n').map((z) => z.trim()).filter(Boolean)
    : customer
      ? adresszeilen(customer)
      : [];

  const anrede = 'Sehr geehrte Damen und Herren,';
  const koerper = MAHN_KOERPER[opts.mahnstufe] ?? MAHN_KOERPER[1];

  // Mahngebuehr (B6): nur ausweisen, wenn eine Gebuehr konfiguriert ist. Der
  // Zahlbetrag ist dann brutto + Gebuehr; ohne Gebuehr bleibt es unveraendert der
  // offene Rechnungsbetrag (brutto).
  const gebuehr = opts.gebuehr ?? 0;
  const hatGebuehr = gebuehr > 0;
  const zahlbetrag = hatGebuehr
    ? (opts.gesamtbetrag ?? Math.round((Number(invoice.brutto) + gebuehr) * 100) / 100)
    : invoice.brutto;

  // Offene-Posten-Tabelle.
  const postenHeader = [
    { text: 'Rechnung', style: 'thead' },
    { text: 'Rechnungsdatum', style: 'thead' },
    { text: 'Fällig war', style: 'thead' },
    { text: 'Tage überfällig', style: 'theadRight' },
    { text: 'Offener Betrag', style: 'theadRight' },
  ];
  const postenZeile = [
    { text: invoice.nummer || '–', style: 'tcell' },
    { text: datum(invoice.datum), style: 'tcell' },
    { text: datum(invoice.faelligkeitsdatum), style: 'tcell' },
    { text: String(Math.max(0, opts.tageUeberfaellig)), style: 'tcellRight' },
    { text: eur(invoice.brutto), style: 'tcellRight' },
  ];

  // Bankverbindung fuer den Zahl-Hinweis im Textkoerper (der Kunde soll wissen,
  // wohin er ueberweisen kann) – aus den Stammdaten, sonst weggelassen.
  const iban = setting(tenant, 'iban');
  const bic = setting(tenant, 'bic');
  const bankname = setting(tenant, 'bankname');

  // Fuss-Pflichtangaben (§14/Geschaeftsbrief): Firmierung, Steuernummer/USt-IdNr.
  // und Bankverbindung. Freier Fusstext bleibt beim Mahnschreiben bewusst aussen vor.
  const pflichtLines = sammlePflichtLines(tenant, {
    steuer: true,
    bank: true,
    firmierung: true,
    fusstext: false,
  });

  const content: Array<Record<string, unknown>> = [
    // Kopf: Absender links, Datum/Rechnung rechts.
    buildKopf(
      tenant,
      metaTabelle([
        ['Datum', datum(opts.mahndatum)],
        ['Rechnung', invoice.nummer || '–'],
      ]),
    ),
    { text: absenderEinzeiler, style: 'absenderEinzeiler', margin: [0, 22, 0, 0] },
    {
      stack: [{ text: empfName, style: 'empfName' }, ...empfAdresse.map((z) => ({ text: z, style: 'empf' }))],
      margin: [0, 4, 0, 0],
    },
    ...titelBlock(`${titel} zu Rechnung ${invoice.nummer || ''}`.trim()),
    { text: anrede, style: 'fliess' },
    ...koerper.map((z) => ({ text: z, style: 'fliess' })),
    {
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto', 'auto', 'auto'],
        body: [postenHeader, postenZeile],
      },
      layout: tabellenLayout(),
      margin: [0, 10, 0, 0],
    },
    // Gebuehren-Block (nur bei konfigurierter Mahngebuehr): weist die Gebuehr als
    // separaten Posten aus und nennt den neuen Zahlbetrag (brutto + Gebuehr).
    // Rechtsbuendig, gleiche Optik wie der Beleg-Summenblock.
    ...(hatGebuehr
      ? [
          {
            columns: [
              { width: '*', text: '' },
              {
                width: 'auto',
                table: {
                  widths: ['*', 'auto'],
                  body: [
                    [
                      { text: 'Offener Rechnungsbetrag', style: 'sumLabel' },
                      { text: eur(invoice.brutto), style: 'sumValue' },
                    ],
                    [
                      { text: 'Mahngebühr', style: 'sumLabel' },
                      { text: eur(gebuehr), style: 'sumValue' },
                    ],
                    [
                      { text: 'Zu zahlen', style: 'sumTotalLabel' },
                      { text: eur(zahlbetrag), style: 'sumTotalValue' },
                    ],
                  ],
                },
                layout: 'noBorders',
              },
            ],
            margin: [0, 10, 0, 0],
          },
        ]
      : []),
    {
      text: `Bitte überweisen Sie den offenen Betrag von ${eur(zahlbetrag)} bis zum ${datum(
        opts.zahlbarBis,
      )}.`,
      style: 'fliess',
      bold: true,
      margin: [0, 12, 0, 0],
    },
  ];

  if (iban || bankname) {
    const bankZeile = [bankname, iban && `IBAN: ${iban}`, bic && `BIC: ${bic}`].filter(Boolean).join('   ·   ');
    content.push({ text: bankZeile, style: 'hinweis', margin: [0, 4, 0, 0] });
  }

  content.push({ text: 'Mit freundlichen Grüßen', style: 'fliess', margin: [0, 14, 0, 0] });
  content.push({ text: absenderName, style: 'fliess' });

  return {
    pageSize: 'A4',
    pageMargins: PAGE_MARGINS,
    defaultStyle: defaultStyle(9),
    info: { title: `${titel} ${invoice.nummer ?? ''}`.trim(), author: absenderName },
    content,
    footer: buildFuss(pflichtLines),
    styles: themeStyles(),
  };
}
