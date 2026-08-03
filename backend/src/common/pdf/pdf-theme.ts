/**
 * Gemeinsamer Gestaltungs-Baustein fuer ALLE Server-PDFs (Beleg, Mahnung,
 * Auftragskarte, Uebergabe-/Garantiedokument, Annahmeprotokoll, Schichtdicken-
 * Bericht). EINE Quelle fuer Seitenraender, Schriftgroessen, Abstaende, Tabellen-
 * Layouts, Trennlinien, Kopf (Betriebsdaten) und Fuss (Pflichtangaben + dezenter
 * Detailly-Hinweis).
 *
 * Bewusst SCHWARZ-WEISS / graustufig: keine Farbflaechen, kein dunkles Thema –
 * ein moderner, typografisch gesetzter Geschaeftsbrief (grosszuegiger Weissraum,
 * klare Groessenabstufung statt Rahmen/Fettdruck ueberall, feine Trennlinien
 * statt Vollgitter). Die Betriebs-`akzentfarbe` wird hier BEWUSST NICHT genutzt
 * (die faerbt nur die Web-Kundenmappe).
 *
 * Reine Bau-Helfer ohne Repo-/Guard-Zugriffe: der aufrufende Service laedt die
 * Daten tenant-scoped und uebergibt fertige Objekte. Mandantentrennung bleibt in
 * der Service-Schicht.
 */
import { resolveSteuer, RECHTSFORM_LABEL, REGISTER_RECHTSFORMEN } from '../steuer';

// --- Farbwelt (nur Graustufen) -------------------------------------------------
/** Fliesstext/Ueberschriften (fast schwarz, angenehmer als reines #000). */
export const INK = '#1A1A1A';
/** Sekundaertext (Adresse, Labels, Hinweise). */
export const MUTED = '#6B6B6B';
/** Feine Trennlinien/Tabellenlinien. */
export const HAIRLINE = '#DCDCDC';
/** Sehr dezente Linie (Titel-Unterstrich). */
export const RULE = '#111111';
/** Extra zurueckhaltend – nur der Detailly-Fusshinweis. */
export const FAINT = '#9A9A9A';

// --- Seitengeometrie (grosszuegige Raender) -----------------------------------
/** Seitlicher Rand in pt (grosszuegiger als das alte 40er-Mass). */
export const PAGE_MARGIN_X = 50;
/** Oberer Rand in pt. */
export const PAGE_MARGIN_TOP = 54;
/** Unterer Rand in pt (Platz fuer den zweizeiligen Fuss). */
export const PAGE_MARGIN_BOTTOM = 72;
/** A4-Breite (595,28 pt) minus 2× seitlicher Rand -> nutzbare Inhaltsbreite. */
export const CONTENT_WIDTH = 495;
/** pdfmake-pageMargins-Tupel [links, oben, rechts, unten]. */
export const PAGE_MARGINS: [number, number, number, number] = [
  PAGE_MARGIN_X,
  PAGE_MARGIN_TOP,
  PAGE_MARGIN_X,
  PAGE_MARGIN_BOTTOM,
];

/** Gemeinsamer defaultStyle-Block (Roboto, Graustufen). fontSize je Dok waehlbar. */
export function defaultStyle(fontSize = 9): Record<string, unknown> {
  return { font: 'Roboto', fontSize, color: INK };
}

/** Strukturelle Tenant-Sicht fuer Kopf/Fuss (alle Felder optional, robust). */
export interface PdfKopfTenant {
  name?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  /** Verschluesseltes settings-JSON (Steuer-/Bank-/Fusstext-Keys). */
  settings?: Record<string, unknown> | null;
  /** Betriebs-Logo als data:image-URL (PNG/JPEG). Andere Typen -> Firmenname. */
  logoUrl?: string | null;
}

/** Liest einen optionalen settings-String defensiv (settings ist untypisiert). */
export function setting(tenant: PdfKopfTenant | null | undefined, key: string): string | undefined {
  const v = tenant?.settings?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Baut die Adresszeilen (Strasse / PLZ Ort / Land≠DE). Leere Felder fallen weg. */
export function adresszeilen(o: {
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
 * Nur ein einbettbares Raster-Logo (PNG/JPEG) als data:-URL wird zurueckgegeben –
 * pdfmake/pdfkit kann WebP/SVG nicht rendern, deshalb faellt der Kopf dann auf
 * den Firmennamen zurueck (sauberes Dokument statt kaputtem Bild/Loch).
 */
export function logoDataUrl(url?: string | null): string | null {
  return typeof url === 'string' && /^data:image\/(png|jpe?g);base64,/.test(url) ? url : null;
}

/**
 * Linke Kopfspalte (Absender): Logo ODER Firmenname, darunter Anschrift + Kontakt
 * in kleiner, grauer Schrift. Fehlt der Name, greift ein neutraler Fallback –
 * nie "undefined". Fehlende Adress-/Kontaktfelder erzeugen keine leeren Zeilen.
 */
export function absenderStack(tenant: PdfKopfTenant | null): Array<Record<string, unknown>> {
  const name = tenant?.name?.trim() || 'Detailly';
  const logo = logoDataUrl(tenant?.logoUrl);
  const stack: Array<Record<string, unknown>> = [];
  if (logo) stack.push({ image: logo, fit: [175, 52], margin: [0, 0, 0, 6] });
  else stack.push({ text: name, style: 'firmenname' });
  for (const z of adresszeilen(tenant ?? {})) stack.push({ text: z, style: 'kopfZeile' });
  const kontakt: string[] = [];
  if (tenant?.phone) kontakt.push(`Tel. ${tenant.phone}`);
  if (tenant?.email) kontakt.push(tenant.email);
  for (const z of kontakt) stack.push({ text: z, style: 'kopfZeile' });
  return stack;
}

/**
 * Kompletter Kopf: Absender links (Logo/Firmenname + Anschrift/Kontakt), rechts
 * ein frei uebergebener Meta-Block (z. B. Belegnummer/Datum oder die grosse
 * Auftragsnummer). Einheitlich fuer alle Dokumente.
 */
export function buildKopf(
  tenant: PdfKopfTenant | null,
  rechts: Record<string, unknown>,
): Record<string, unknown> {
  return {
    columns: [
      { width: '*', stack: absenderStack(tenant) },
      { width: 'auto', stack: [rechts] },
    ],
    columnGap: 24,
  };
}

/** Rechter Kopf-Meta-Block als randlose Label/Wert-Tabelle. */
export function metaTabelle(rows: Array<[string, string]>): Record<string, unknown> {
  return {
    table: {
      body: rows.map(([label, wert]) => [
        { text: label, style: 'metaLabel' },
        { text: wert, style: 'metaValue' },
      ]),
    },
    layout: 'noBorders',
  };
}

/** Feine, volle Trennlinie (Titel-Unterstrich / Sektionstrenner). */
export function trennlinie(
  lineWidth = 0.8,
  lineColor: string = RULE,
  margin: [number, number, number, number] = [0, 0, 0, 12],
): Record<string, unknown> {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth, lineColor }],
    margin,
  };
}

/**
 * Titelblock: Dokumenttitel (gross), optionaler Untertitel, darunter eine feine
 * Trennlinie. Sorgt fuer die einheitliche Hierarchie ueber alle Dokumente.
 */
export function titelBlock(titel: string, untertitel?: string | null): Array<Record<string, unknown>> {
  const block: Array<Record<string, unknown>> = [
    { text: titel, style: 'titel', margin: [0, 14, 0, untertitel ? 1 : 6] },
  ];
  if (untertitel) block.push({ text: untertitel, style: 'untertitel', margin: [0, 0, 0, 6] });
  block.push(trennlinie());
  return block;
}

/**
 * Firmierungs-/Rechtsform-Zeile (Pflichtangaben auf Geschaeftsbriefen,
 * § 37a HGB / § 35a GewO). Kapitalgesellschaften (UG/GmbH/GmbH & Co. KG):
 * Rechtsform, Sitz, Registergericht + -nummer, Vertretungsberechtigte – gedruckt
 * wird, was gepflegt ist (keine Blockade bei Luecken). Uebrige Rechtsformen:
 * der Inhaber, falls hinterlegt. Fehlt alles, `undefined` (keine leere Zeile).
 */
export function firmierungsZeile(
  tenant: PdfKopfTenant | null,
  steuer: ReturnType<typeof resolveSteuer>,
): string | undefined {
  const label = RECHTSFORM_LABEL[steuer.rechtsform] ?? '';
  const sitz = (tenant?.city ?? '').trim();
  if (REGISTER_RECHTSFORMEN.includes(steuer.rechtsform)) {
    const teile: string[] = [];
    if (label) teile.push(label);
    if (sitz) teile.push(`Sitz: ${sitz}`);
    const register = [steuer.registergericht, steuer.registernummer].filter(Boolean).join(' ');
    if (register) teile.push(register);
    if (steuer.vertretungsberechtigte) {
      teile.push(`Vertretungsberechtigt: ${steuer.vertretungsberechtigte}`);
    }
    return teile.length ? teile.join(' · ') : undefined;
  }
  if (steuer.vertretungsberechtigte) return `Inhaber: ${steuer.vertretungsberechtigte}`;
  return undefined;
}

/** Welche Pflicht-/Angabenzeilen der Fuss tragen soll (dokumentabhaengig). */
export interface FussOptions {
  /** Steuernummer + USt-IdNr. (§ 14 UStG) drucken – nur auf Belegen/Mahnungen. */
  steuer?: boolean;
  /** Bankverbindung drucken – fachlich nur auf der Rechnung/Mahnung sinnvoll. */
  bank?: boolean;
  /** Firmierung/Rechtsform drucken (Default true; Geschaeftsbrief-Pflicht). */
  firmierung?: boolean;
  /** Freien Betriebs-Fusstext (settings.rechnungFusstext) drucken (Default true). */
  fusstext?: boolean;
}

/**
 * Stellt die Angaben-Zeilen fuer den Fuss zusammen (Reihenfolge stabil:
 * Firmierung · Steuernummer · USt-IdNr. · Bankverbindung · Fusstext). Jede fehlende
 * Angabe faellt ersatzlos weg – nie eine leere Zeile oder ein "undefined".
 */
export function sammlePflichtLines(tenant: PdfKopfTenant | null, opts: FussOptions): string[] {
  const lines: string[] = [];
  const steuerCfg = resolveSteuer(((tenant?.settings ?? {}) as Record<string, unknown>).steuer);
  if (opts.firmierung !== false) {
    const f = firmierungsZeile(tenant, steuerCfg);
    if (f) lines.push(f);
  }
  if (opts.steuer) {
    const steuernummer = setting(tenant, 'steuernummer');
    const ustId = setting(tenant, 'ustId');
    if (steuernummer) lines.push(`Steuernummer: ${steuernummer}`);
    if (ustId) lines.push(`USt-IdNr.: ${ustId}`);
  }
  if (opts.bank) {
    const iban = setting(tenant, 'iban');
    const bic = setting(tenant, 'bic');
    const bankname = setting(tenant, 'bankname');
    if (iban || bankname) {
      const bankZeile = [bankname, iban && `IBAN ${iban}`, bic && `BIC ${bic}`]
        .filter(Boolean)
        .join(' · ');
      if (bankZeile) lines.push(`Bankverbindung: ${bankZeile}`);
    }
  }
  if (opts.fusstext !== false) {
    const fusstext = setting(tenant, 'rechnungFusstext');
    if (fusstext) lines.push(fusstext);
  }
  return lines;
}

/** Dezente, NICHT werbliche Absender-Signatur im Fuss. Der Betrieb ist Absender. */
export const DETAILLY_HINWEIS = 'Erstellt mit Detailly';

/**
 * Baut die pdfmake-`footer`-Funktion: oben (falls vorhanden) eine feine Linie +
 * die zentrierten Pflicht-/Angabenzeilen, darunter IMMER der dezente
 * Detailly-Hinweis (klein, grau). Gibt eine Funktion zurueck (pdfmake ruft sie je
 * Seite auf) – so steht der Fuss auf jeder Seite.
 */
export function buildFuss(pflichtLines: string[]): () => Record<string, unknown> {
  const lines = pflichtLines.filter((l) => !!l && l.trim() !== '');
  return () => ({
    margin: [PAGE_MARGIN_X, 6, PAGE_MARGIN_X, 0],
    stack: [
      ...(lines.length
        ? [
            {
              canvas: [
                { type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.5, lineColor: HAIRLINE },
              ],
              margin: [0, 0, 0, 5],
            },
            { text: lines.join('   ·   '), style: 'fussPflicht' },
          ]
        : []),
      { text: DETAILLY_HINWEIS, style: 'fussHinweis', margin: [0, lines.length ? 4 : 0, 0, 0] },
    ],
  });
}

/** Ein Unterschrifts-/Ausfuellfeld: feine Linie mit Beschriftung darunter. */
export function signaturFeld(label: string, breite = 200): Record<string, unknown> {
  return {
    width: '*',
    stack: [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: breite, y2: 0, lineWidth: 0.7, lineColor: MUTED }] },
      { text: label, style: 'sigLabel' },
    ],
  };
}

/** Zwei Unterschrifts-/Ausfuellfelder nebeneinander (z. B. Kunde / Betrieb). */
export function signaturZeile(
  links: string,
  rechts: string,
  opts: { breite?: number; gap?: number; margin?: [number, number, number, number] } = {},
): Record<string, unknown> {
  const breite = opts.breite ?? 200;
  return {
    columns: [signaturFeld(links, breite), { width: opts.gap ?? 24, text: '' }, signaturFeld(rechts, breite)],
    margin: opts.margin ?? [0, 30, 0, 0],
  };
}

/**
 * Feines, RANDLINIEN-basiertes Positions-/Datentabellen-Layout (kein Vollgitter):
 * duenne horizontale Linien, keine vertikalen; grosszuegige Zeilenpolsterung.
 * `kopf` markiert die staerkere Linie unter der Kopfzeile.
 */
export function tabellenLayout(): Record<string, unknown> {
  return {
    hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
      i === 0 || i === 1 || i === node.table.body.length ? 0.7 : 0.3,
    vLineWidth: () => 0,
    hLineColor: () => HAIRLINE,
    paddingTop: () => 5,
    paddingBottom: () => 5,
    paddingLeft: () => 0,
    paddingRight: (i: number, node: { table: { widths: unknown[] } }) =>
      i === node.table.widths.length - 1 ? 0 : 8,
  };
}

/**
 * Gemeinsamer Style-Katalog (Graustufen, moderne Hierarchie). Doc-spezifische
 * Ergaenzungen koennen via `extra` zugemischt werden (z. B. Legenden im
 * Schichtdicken-Bericht). EINE Quelle fuer Groessen/Abstaende/Farben.
 */
export function themeStyles(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    // Kopf
    firmenname: { fontSize: 15, bold: true, color: INK, characterSpacing: 0.2 },
    kopfZeile: { fontSize: 8, color: MUTED, lineHeight: 1.35 },
    absenderEinzeiler: { fontSize: 7, color: MUTED },
    // Empfaenger
    empfName: { fontSize: 11, bold: true, color: INK },
    empf: { fontSize: 10, color: INK, lineHeight: 1.3 },
    // Titel/Sektionen
    titel: { fontSize: 18, bold: true, color: INK, characterSpacing: 0.2 },
    untertitel: { fontSize: 10, color: MUTED },
    section: { fontSize: 11, bold: true, color: INK, characterSpacing: 0.3, margin: [0, 14, 0, 5] },
    // Meta/Labels
    metaLabel: { fontSize: 8, color: MUTED, characterSpacing: 0.2, margin: [0, 0, 12, 2] },
    metaValue: { fontSize: 9, bold: true, color: INK, margin: [0, 0, 0, 2] },
    metaValueStrong: { fontSize: 12, bold: true, color: INK, margin: [0, 0, 0, 2] },
    fillValue: { fontSize: 10, color: INK, margin: [0, 0, 0, 2] },
    // Fliesstext/Hinweise
    fliess: { fontSize: 10, color: INK, margin: [0, 1.5, 0, 1.5], lineHeight: 1.25 },
    hint: { fontSize: 9, italics: true, color: MUTED },
    hinweis: { fontSize: 8, italics: true, color: MUTED, lineHeight: 1.2 },
    legal: { fontSize: 8, color: MUTED, lineHeight: 1.3 },
    sigLabel: { fontSize: 8, color: MUTED, margin: [0, 3, 0, 0] },
    // Tabellen
    thead: { fontSize: 9, bold: true, color: INK, characterSpacing: 0.2 },
    theadRight: { fontSize: 9, bold: true, color: INK, alignment: 'right', characterSpacing: 0.2 },
    tcell: { fontSize: 9, color: INK },
    tcellRight: { fontSize: 9, color: INK, alignment: 'right' },
    // Summenblock
    sumLabel: { fontSize: 9, color: MUTED, alignment: 'right', margin: [0, 0, 16, 2] },
    sumValue: { fontSize: 9, color: INK, alignment: 'right', margin: [0, 0, 0, 2] },
    sumTotalLabel: { fontSize: 11, bold: true, color: INK, alignment: 'right', margin: [0, 4, 16, 0] },
    sumTotalValue: { fontSize: 11, bold: true, color: INK, alignment: 'right', margin: [0, 4, 0, 0] },
    // Fuss
    fussPflicht: { fontSize: 7, color: MUTED, alignment: 'center', characterSpacing: 0.2, lineHeight: 1.3 },
    fussHinweis: { fontSize: 6.5, color: FAINT, alignment: 'center', characterSpacing: 0.3 },
    ...extra,
  };
}
