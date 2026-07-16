/**
 * Lese-Extraktor fuer eingehende E-Rechnungen (EN 16931) – reine Funktionen,
 * KEINE DB, KEINE Guards (Vorbild: xrechnung.builder.ts).
 *
 * Zweck: Aus einem strukturierten Rechnungs-XML die ~15 EN-16931-Kopf-/Summen-
 * Felder auslesen. BEWUSST OHNE npm-Paket und OHNE DOM-Parser: ein kleiner,
 * zeichenweiser Tokenizer baut einen leichten Element-Baum (local-name-basiert,
 * Namespace-Praefixe wie `rsm:`/`ram:`/`cbc:`/`cac:` werden abgeschnitten). Damit
 * lesen UBL (Wurzel `Invoice`) UND CII (Wurzel `CrossIndustryInvoice`) mit
 * derselben Engine – nur die Feld-Pfade unterscheiden sich.
 *
 * SICHERHEIT: Der Reader loest WEDER `<!DOCTYPE>` NOCH `<!ENTITY>` auf (beide
 * werden uebersprungen) -> kein XXE, kein Billion-Laughs, kein SSRF. Nur die 5
 * vordefinierten XML-Entities + numerische Zeichen-Referenzen werden dekodiert.
 * Zusaetzlich Knoten-Obergrenze gegen pathologisch tiefe/breite Eingaben.
 *
 * FEHLERTOLERANZ: Nie werfen. Fehlt ein Feld -> undefined. Ist das XML kaputt
 * oder das Format unbekannt -> `syntax: 'unbekannt'` und leere Felder. Der
 * Aufrufer archiviert das Original IMMER (GoBD) und leitet den Status ab.
 */

/** Erkannte EN-16931-Syntax anhand des Wurzel-Localnames. */
export type EInvoiceSyntax = 'ubl' | 'cii' | 'unbekannt';

/** Ausgelesene Kopf-/Summen-Felder (alle optional – best effort). */
export interface EInvoiceFields {
  syntax: EInvoiceSyntax;
  rechnungsnummer?: string;
  /** ISO YYYY-MM-DD. */
  rechnungsdatum?: string;
  faelligkeitsdatum?: string;
  leistungsdatum?: string;
  rechnungstyp?: string;
  waehrung?: string;
  leitwegId?: string;
  verkaeuferName?: string;
  verkaeuferAnschrift?: string;
  verkaeuferUstId?: string;
  verkaeuferSteuernummer?: string;
  nettoBetrag?: number;
  mwstBetrag?: number;
  bruttoBetrag?: number;
  zahlbetrag?: number;
  iban?: string;
  bic?: string;
}

// --- Leichter XML-Baum ------------------------------------------------------

interface XmlNode {
  name: string; // local-name (Praefix abgeschnitten)
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string; // direkte Textknoten, konkateniert + getrimmt beim Lesen
}

/** Obergrenze gegen pathologische Eingaben (Invoices sind real < ~5k Knoten). */
const MAX_NODES = 200_000;

/**
 * Obergrenze fuer den Attribut-String EINES Start-Tags. Ueberlange Attribut-
 * Bloecke (DoS-Vektor) werden gar nicht erst geparst – echte Rechnungen haben
 * winzige Attribute (`schemeID`/`currencyID`, < ~100 Zeichen). Verhindert, dass
 * ein einzelnes Riesen-Tag CPU frisst.
 */
const MAX_ATTR_BYTES = 8192;

class NodeLimitError extends Error {}

/** Schneidet den Namespace-Praefix ab: `ram:ID` -> `ID`. */
function localName(raw: string): string {
  const i = raw.indexOf(':');
  return i >= 0 ? raw.slice(i + 1) : raw;
}

/** Dekodiert die 5 vordefinierten Entities + numerische Zeichen-Referenzen. */
function decodeEntities(s: string): string {
  if (s.indexOf('&') === -1) return s;
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : m;
    }
    switch (body) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default:
        return m; // unbekannte/benannte Entity NICHT aufloesen (XXE-sicher)
    }
  });
}

/** True fuer XML-Whitespace (Space/Tab/CR/LF). */
function isWs(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/**
 * Liest die Attribute aus dem Inneren eines Start-Tags – STRIKT LINEAR (jeder
 * Zeichenindex wird hoechstens einmal besucht), KEINE Backtracking-Regex.
 *
 * Sicherheit: Die frueher genutzte greedy-Alternation-Regex lief O(L²) bei einem
 * langen Lauf ohne `=` (ein einziges Riesen-Tag = 1 Node -> MAX_NODES griff
 * nicht) und fror den Event-Loop ein. Dieser Scanner ist O(L). Zusaetzlich wird
 * `parseAttrs` am Aufrufort erst gar nicht fuer ueberlange Attribut-Strings
 * aufgerufen (siehe MAX_ATTR_BYTES) – fuer die Feldextraktion wird ohnehin nur
 * `schemeID` gebraucht, das in echten Rechnungen winzig ist.
 */
function parseAttrs(inner: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const n = inner.length;
  let i = 0;
  while (i < n) {
    while (i < n && isWs(inner[i])) i++;
    // Attributname bis '=', Whitespace, '/' oder Ende.
    const nameStart = i;
    while (i < n && inner[i] !== '=' && inner[i] !== '/' && !isWs(inner[i])) i++;
    const name = inner.slice(nameStart, i);
    while (i < n && isWs(inner[i])) i++;
    if (inner[i] !== '=') {
      // Name ohne Wert (z. B. der lange '='-freie Lauf) – nicht endlos drehen.
      if (i < n && (inner[i] === '/' || !name)) i++;
      continue;
    }
    i++; // '='
    while (i < n && isWs(inner[i])) i++;
    const quote = inner[i];
    let value = '';
    if (quote === '"' || quote === "'") {
      i++;
      const valStart = i;
      while (i < n && inner[i] !== quote) i++;
      value = inner.slice(valStart, i);
      if (i < n) i++; // schliessendes Quote
    } else {
      // unquotierter Wert (selten) – bis Whitespace.
      const valStart = i;
      while (i < n && !isWs(inner[i])) i++;
      value = inner.slice(valStart, i);
    }
    if (name) attrs[localName(name)] = decodeEntities(value);
  }
  return attrs;
}

/**
 * Parst das XML in einen leichten Baum. Wirft NodeLimitError bei Ueberschreitung
 * der Knotengrenze; jeder andere Fehler wird vom Aufrufer als "unbekannt"
 * behandelt. `<!DOCTYPE>`/`<!ENTITY>`/Kommentare/Processing-Instructions werden
 * uebersprungen (nicht aufgeloest).
 */
function parseXml(xml: string): XmlNode | null {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  let nodes = 0;
  let i = 0;
  const n = xml.length;

  while (i < n) {
    const lt = xml.indexOf('<', i);
    if (lt === -1) break;

    // Text vor dem naechsten Tag dem aktuellen Element zuschlagen.
    if (lt > i) {
      const txt = decodeEntities(xml.slice(i, lt));
      if (txt.trim()) stack[stack.length - 1].text += txt;
    }

    // Sonder-Konstrukte: Kommentar / CDATA / DOCTYPE / PI.
    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt + 9);
      const data = xml.slice(lt + 9, end === -1 ? n : end);
      stack[stack.length - 1].text += data;
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (xml.startsWith('<!', lt)) {
      // DOCTYPE/ENTITY etc. – NICHT aufloesen (XXE-sicher). Grenze VORWAERTS
      // finden; die '['-Suche wird auf den Token (lt..gt) BEGRENZT – sonst
      // scannte indexOf('[') bei fehlendem '[' bis EOF und ergab bei vielen
      // winzigen `<!>`-Tokens O(n²). Zusaetzlich gegen MAX_NODES zaehlen.
      if (++nodes > MAX_NODES) throw new NodeLimitError();
      const gt = xml.indexOf('>', lt);
      if (gt === -1) {
        i = n;
        continue;
      }
      // Internen Subset `[ ... ]` nur beachten, wenn ein '[' VOR diesem '>' steht
      // (token-lokale Suche, kein Scan bis EOF).
      let bracket = -1;
      for (let k = lt + 2; k < gt; k++) {
        if (xml.charCodeAt(k) === 0x5b /* [ */) {
          bracket = k;
          break;
        }
      }
      if (bracket !== -1) {
        // Ende des Subsets: erstes '>' NACH dem schliessenden ']'. Fehlt eines,
        // konsumieren wir bis EOF (Schleife endet) – kein O(n²).
        const closeSubset = xml.indexOf(']', bracket);
        const afterSubset = closeSubset === -1 ? -1 : xml.indexOf('>', closeSubset);
        i = afterSubset === -1 ? n : afterSubset + 1;
      } else {
        i = gt + 1;
      }
      continue;
    }
    if (xml.startsWith('<?', lt)) {
      const end = xml.indexOf('?>', lt + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }

    const gt = xml.indexOf('>', lt);
    if (gt === -1) break; // kaputtes Tag -> abbrechen, was da ist bleibt

    // End-Tag `</name>`.
    if (xml[lt + 1] === '/') {
      if (stack.length > 1) stack.pop();
      i = gt + 1;
      continue;
    }

    // Start-Tag (evtl. selbstschliessend).
    const selfClosing = xml[gt - 1] === '/';
    const raw = xml.slice(lt + 1, selfClosing ? gt - 1 : gt).trim();
    const wsp = raw.search(/[\s]/);
    const tagName = localName(wsp === -1 ? raw : raw.slice(0, wsp));
    const attrStr = wsp === -1 ? '' : raw.slice(wsp + 1);

    if (++nodes > MAX_NODES) throw new NodeLimitError();

    const node: XmlNode = {
      name: tagName,
      // Ueberlange Attribut-Bloecke (DoS) gar nicht erst parsen – nur `schemeID`
      // wird gebraucht und ist in echten Rechnungen winzig.
      attrs: attrStr && attrStr.length <= MAX_ATTR_BYTES ? parseAttrs(attrStr) : {},
      children: [],
      text: '',
    };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
    i = gt + 1;
  }

  return root.children[0] ?? null;
}

// --- Baum-Abfragen (pre-order, local-name) ----------------------------------

/** Erstes Nachfahren-Element mit `name` (pre-order/Dokumentreihenfolge). */
function firstDesc(root: XmlNode, name: string): XmlNode | undefined {
  for (const c of root.children) {
    if (c.name === name) return c;
    const found = firstDesc(c, name);
    if (found) return found;
  }
  return undefined;
}

/** Alle Nachfahren-Elemente mit `name` (pre-order). */
function allDesc(root: XmlNode, name: string): XmlNode[] {
  const out: XmlNode[] = [];
  const walk = (el: XmlNode) => {
    for (const c of el.children) {
      if (c.name === name) out.push(c);
      walk(c);
    }
  };
  walk(root);
  return out;
}

/** Folgt einem Pfad ueber "erstes Nachfahren-Element" je Segment. */
function descend(root: XmlNode | undefined, path: string[]): XmlNode | undefined {
  let cur: XmlNode | undefined = root;
  for (const seg of path) {
    if (!cur) return undefined;
    cur = firstDesc(cur, seg);
  }
  return cur;
}

/** Getrimmter Text eines per Pfad gefundenen Elements. */
function textAt(root: XmlNode | undefined, path: string[]): string | undefined {
  const el = descend(root, path);
  const t = el?.text.trim();
  return t ? t : undefined;
}

// --- Normalisierer ----------------------------------------------------------

/** Datum -> ISO YYYY-MM-DD. Unterstuetzt `YYYY-MM-DD` (UBL) und `YYYYMMDD` (CII 102). */
function normDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return undefined;
}

/** Betrag -> Zahl mit 2 Nachkommastellen (Punkt-Dezimal, EN-16931-konform). */
function normAmount(raw?: string): number | undefined {
  if (raw == null || raw.trim() === '') return undefined;
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n * 100) / 100;
}

// --- Feld-Extraktion je Syntax ----------------------------------------------

function readUbl(root: XmlNode): EInvoiceFields {
  const seller = descend(root, ['AccountingSupplierParty', 'Party']);
  const ustId = taxIdUbl(seller, 'VAT');
  const steuernummer = taxIdUbl(seller, 'FC');

  const addrEl = descend(seller, ['PostalAddress']);
  const paymentAccount = descend(root, ['PaymentMeans', 'PayeeFinancialAccount']);

  return {
    syntax: 'ubl',
    rechnungsnummer: textAt(root, ['ID']),
    rechnungsdatum: normDate(textAt(root, ['IssueDate'])),
    faelligkeitsdatum: normDate(textAt(root, ['DueDate'])),
    leistungsdatum: normDate(textAt(root, ['Delivery', 'ActualDeliveryDate'])),
    rechnungstyp: textAt(root, ['InvoiceTypeCode']),
    waehrung: textAt(root, ['DocumentCurrencyCode']),
    leitwegId: textAt(root, ['BuyerReference']),
    verkaeuferName:
      textAt(seller, ['PartyLegalEntity', 'RegistrationName']) ??
      textAt(seller, ['PartyName', 'Name']),
    verkaeuferAnschrift: formatAddress(
      textAt(addrEl, ['StreetName']),
      textAt(addrEl, ['PostalZone']),
      textAt(addrEl, ['CityName']),
      textAt(addrEl, ['Country', 'IdentificationCode']),
    ),
    verkaeuferUstId: ustId,
    verkaeuferSteuernummer: steuernummer,
    nettoBetrag: normAmount(textAt(root, ['LegalMonetaryTotal', 'TaxExclusiveAmount'])),
    mwstBetrag: normAmount(textAt(root, ['TaxTotal', 'TaxAmount'])),
    bruttoBetrag: normAmount(textAt(root, ['LegalMonetaryTotal', 'TaxInclusiveAmount'])),
    zahlbetrag: normAmount(textAt(root, ['LegalMonetaryTotal', 'PayableAmount'])),
    iban: textAt(paymentAccount, ['ID']),
    bic: textAt(paymentAccount, ['FinancialInstitutionBranch', 'ID']),
  };
}

/** UBL: CompanyID aus dem PartyTaxScheme mit passendem TaxScheme/ID (VAT|FC). */
function taxIdUbl(seller: XmlNode | undefined, scheme: 'VAT' | 'FC'): string | undefined {
  if (!seller) return undefined;
  for (const pts of allDesc(seller, 'PartyTaxScheme')) {
    const schemeId = textAt(pts, ['TaxScheme', 'ID']);
    if (schemeId && schemeId.toUpperCase() === scheme) {
      const id = textAt(pts, ['CompanyID']);
      if (id) return id;
    }
  }
  return undefined;
}

function readCii(root: XmlNode): EInvoiceFields {
  const doc = descend(root, ['ExchangedDocument']);
  const agreement = descend(root, ['ApplicableHeaderTradeAgreement']);
  const seller = descend(agreement, ['SellerTradeParty']);
  const delivery = descend(root, ['ApplicableHeaderTradeDelivery']);
  const settlement = descend(root, ['ApplicableHeaderTradeSettlement']);
  const summation = descend(settlement, ['SpecifiedTradeSettlementHeaderMonetarySummation']);
  const paymentMeans = descend(settlement, ['SpecifiedTradeSettlementPaymentMeans']);
  const creditorAcct = descend(paymentMeans, ['PayeePartyCreditorFinancialAccount']);
  const creditorInst = descend(paymentMeans, ['PayeeSpecifiedCreditorFinancialInstitution']);
  const addrEl = descend(seller, ['PostalTradeAddress']);

  return {
    syntax: 'cii',
    rechnungsnummer: textAt(doc, ['ID']),
    rechnungsdatum: normDate(textAt(doc, ['IssueDateTime', 'DateTimeString'])),
    faelligkeitsdatum: normDate(
      textAt(settlement, ['SpecifiedTradePaymentTerms', 'DueDateDateTime', 'DateTimeString']),
    ),
    leistungsdatum: normDate(
      textAt(delivery, ['ActualDeliverySupplyChainEvent', 'OccurrenceDateTime', 'DateTimeString']),
    ),
    rechnungstyp: textAt(doc, ['TypeCode']),
    waehrung: textAt(settlement, ['InvoiceCurrencyCode']) ?? textAt(root, ['InvoiceCurrencyCode']),
    leitwegId: textAt(agreement, ['BuyerReference']),
    verkaeuferName: textAt(seller, ['Name']),
    verkaeuferAnschrift: formatAddress(
      textAt(addrEl, ['LineOne']),
      textAt(addrEl, ['PostcodeCode']),
      textAt(addrEl, ['CityName']),
      textAt(addrEl, ['CountryID']),
    ),
    verkaeuferUstId: taxIdCii(seller, 'VA'),
    verkaeuferSteuernummer: taxIdCii(seller, 'FC'),
    nettoBetrag: normAmount(textAt(summation, ['TaxBasisTotalAmount'])),
    mwstBetrag: normAmount(textAt(summation, ['TaxTotalAmount'])),
    bruttoBetrag: normAmount(textAt(summation, ['GrandTotalAmount'])),
    zahlbetrag: normAmount(textAt(summation, ['DuePayableAmount'])),
    iban: textAt(creditorAcct, ['IBANID']) ?? textAt(creditorAcct, ['ProprietaryID']),
    bic: textAt(creditorInst, ['BICID']),
  };
}

/** CII: ID aus SpecifiedTaxRegistration mit passendem schemeID-Attribut (VA|FC). */
function taxIdCii(seller: XmlNode | undefined, scheme: 'VA' | 'FC'): string | undefined {
  if (!seller) return undefined;
  for (const reg of allDesc(seller, 'SpecifiedTaxRegistration')) {
    const idEl = firstDesc(reg, 'ID');
    if (idEl && (idEl.attrs.schemeID ?? '').toUpperCase() === scheme) {
      const v = idEl.text.trim();
      if (v) return v;
    }
  }
  return undefined;
}

/** Baut eine einzeilige Anschrift aus den Teilen (leere Teile entfallen). */
function formatAddress(
  street?: string,
  zip?: string,
  city?: string,
  country?: string,
): string | undefined {
  const zeile2 = [zip, city].filter((p) => p && p.trim()).join(' ');
  const teile = [street, zeile2, country].filter((p) => p && p.trim());
  return teile.length ? teile.join(', ') : undefined;
}

/**
 * Erkennt die Syntax und liest die Kopf-/Summen-Felder aus. Nie werfend: bei
 * kaputtem XML / unbekanntem Format -> `{ syntax: 'unbekannt' }`.
 */
export function readEInvoiceXml(xml: string): EInvoiceFields {
  if (!xml || typeof xml !== 'string') return { syntax: 'unbekannt' };
  let root: XmlNode | null;
  try {
    root = parseXml(xml);
  } catch {
    return { syntax: 'unbekannt' };
  }
  if (!root) return { syntax: 'unbekannt' };

  // Wurzel-Localname entscheidet die Syntax (Fallback: Namespace-Substring).
  if (root.name === 'Invoice' || /:Invoice-2/.test(xml.slice(0, 2000))) {
    // CreditNote (UBL) truegt hier – wir behandeln nur Invoice-Wurzel als UBL.
    if (root.name === 'Invoice') return safeRead(() => readUbl(root as XmlNode));
  }
  if (root.name === 'CrossIndustryInvoice' || /CrossIndustryInvoice/.test(xml.slice(0, 2000))) {
    return safeRead(() => readCii(root as XmlNode));
  }
  // Zweiter Versuch rein ueber die Wurzel, falls der Namespace-Heuristik-Slice
  // (erste 2k Zeichen) das Format verfehlt hat.
  if (root.name === 'Invoice') return safeRead(() => readUbl(root as XmlNode));
  if (root.name === 'CrossIndustryInvoice') return safeRead(() => readCii(root as XmlNode));
  return { syntax: 'unbekannt' };
}

/** Kapselt die Feld-Extraktion: jeder Fehler -> "unbekannt" (nie werfen). */
function safeRead(fn: () => EInvoiceFields): EInvoiceFields {
  try {
    return fn();
  } catch {
    return { syntax: 'unbekannt' };
  }
}
