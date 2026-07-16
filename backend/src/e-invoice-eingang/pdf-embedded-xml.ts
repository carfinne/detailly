/**
 * Extraktion des eingebetteten Rechnungs-XML aus einem hybriden PDF/A-3
 * (PDF mit EN-16931-XML als Anhang). Reine Funktion, KEINE DB.
 *
 * BEWUSST OHNE npm-Paket / ohne PDF-Objektgraph-Parser: Node-Bordmittel `zlib`
 * genuegt. Ansatz (tolerant, inhaltsbasiert statt dateinamensbasiert):
 *   1. `%PDF`-Signatur pruefen; verschluesselte PDFs (`/Encrypt` im Trailer)
 *      -> null (Aufrufer archiviert + zeigt das PDF, Status "nicht ausgelesen").
 *   2. Bis zu MAX_PDF_STREAMS `stream … endstream`-Bloecke per Byte-Scan finden.
 *   3. Je Block: erst ROH pruefen (unkomprimierte Anhaenge), dann EINMAL inflaten
 *      (Filter per zlib-Header gewaehlt) – Fallbacks (andere Funktion / EOL-
 *      getrimmt) NUR bei echtem Inflate-Fehler, nicht routinemaessig.
 *   4. Erster dekodierter Block mit EN-16931-Signatur (`CrossIndustryInvoice`
 *      ODER UBL-`Invoice` + Namespace) ist das Rechnungs-XML.
 *
 * DoS-HAERTUNG (synchroner Event-Loop-Freeze trifft ALLE Mandanten):
 *   - MAX_PDF_STREAMS begrenzt die Anzahl untersuchter Bloecke.
 *   - MAX_STREAM_INFLATE_BYTES kappt EINEN Inflate-Aufruf (Zip-Bomb je Stream).
 *   - MAX_TOTAL_INFLATE_BYTES ist ein AGGREGIERTES Budget ueber die ganze Datei
 *     (Summe aller Inflate-Ausgaben) – schuetzt vor "viele hochkomprimierte
 *     Streams" aus EINEM Upload.
 *   - Pro Rohblock wird nur EINMAL erfolgreich dekomprimiert; ein dekomprimierter
 *     Nicht-Rechnungs-Block wird sofort verworfen (keine weiteren Versuche).
 *
 * Ein False-Positive braeuchte einen ANDEREN Flate-Stream, der zufaellig ein
 * vollstaendiges Invoice-Wurzelelement + EN-16931-Namespace enthaelt – praktisch
 * ausgeschlossen. Worst Case ist immer nur "PDF archiviert, nicht strukturiert
 * ausgelesen" – nie Crash, nie Datenverlust.
 *
 * Restrisiko (bewusst Welle 2): exotische Filter (LZW/ASCII85 statt Flate) und
 * XML in Objekt-Streams werden nicht erfasst -> landen im Fallback.
 */
import * as zlib from 'zlib';

/** Max. dekomprimierte Groesse EINES Streams (ein Rechnungs-XML ist klein). */
export const MAX_STREAM_INFLATE_BYTES = 4 * 1024 * 1024;
/** Aggregiertes Dekomprimier-Budget ueber die GANZE Datei (DoS-Deckel). */
export const MAX_TOTAL_INFLATE_BYTES = 24 * 1024 * 1024;
/** Max. Anzahl untersuchter `stream`-Bloecke je PDF. */
export const MAX_PDF_STREAMS = 256;

const STREAM_KW = Buffer.from('stream');
const ENDSTREAM_KW = Buffer.from('endstream');

/** Traegt der Puffer die EN-16931-Wurzel eines Rechnungs-XML? */
function looksLikeEInvoiceXml(text: string): boolean {
  // Nur die ersten ~4k Zeichen betrachten (Wurzelelement steht am Anfang).
  const head = text.slice(0, 4096);
  if (/CrossIndustryInvoice/.test(head)) return true;
  // UBL: Wurzel `Invoice` (oder `ubl:Invoice`) UND UBL-Invoice-Namespace.
  if (/<([A-Za-z0-9]+:)?Invoice[\s>]/.test(head) && /:Invoice-2/.test(head)) return true;
  return false;
}

/** Ist der Buffer ein PDF (fuehrendes `%PDF`, evtl. nach BOM/Whitespace)? */
export function isPdf(buf: Buffer): boolean {
  const start = buf.subarray(0, 1024).toString('latin1');
  return start.includes('%PDF-');
}

/** Grobe Heuristik: verschluesseltes PDF (Trailer enthaelt `/Encrypt`). */
function isEncryptedPdf(buf: Buffer): boolean {
  // Im letzten Teil nach dem Trailer-Dictionary suchen (dort steht /Encrypt).
  const tail = buf.subarray(Math.max(0, buf.length - 4096)).toString('latin1');
  return /\/Encrypt\b/.test(tail) || /\/Encrypt\b/.test(buf.subarray(0, 4096).toString('latin1'));
}

/** Laufendes Dekomprimier-Budget ueber die ganze Datei. */
interface Budget {
  used: number;
}

/** Sentinel: das aggregierte Budget ist erschoepft -> Extraktion abbrechen. */
const EXHAUSTED = Symbol('inflate-budget-exhausted');

/**
 * Ein Inflate-Versuch mit Budget. Liefert den dekomprimierten Text bei Erfolg,
 * `null` bei Inflate-Fehler (falscher Filter / EOL / Kappung) oder EXHAUSTED,
 * wenn das aggregierte Budget aufgebraucht ist.
 */
function tryInflate(
  fn: (b: Buffer, o: zlib.ZlibOptions) => Buffer,
  buf: Buffer,
  budget: Budget,
): string | null | typeof EXHAUSTED {
  const remaining = MAX_TOTAL_INFLATE_BYTES - budget.used;
  if (remaining <= 0) return EXHAUSTED;
  const cap = Math.min(MAX_STREAM_INFLATE_BYTES, remaining);
  try {
    const out = fn(buf, { maxOutputLength: cap });
    budget.used += out.length; // erfolgreiche Ausgabe zaehlt gegen das Budget
    return out.toString('utf8');
  } catch {
    return null;
  }
}

/** Rohblock ohne EIN abschliessendes EOL (\r\n / \n / \r) – fuer den Fallback. */
function stripTrailingEol(raw: Buffer): Buffer {
  const n = raw.length;
  if (n >= 2 && raw[n - 2] === 0x0d && raw[n - 1] === 0x0a) return raw.subarray(0, n - 2);
  if (n >= 1 && (raw[n - 1] === 0x0a || raw[n - 1] === 0x0d)) return raw.subarray(0, n - 1);
  return raw;
}

/**
 * Versucht, einen Stream-Rohblock zu Rechnungs-XML zu machen.
 *
 * Reihenfolge (kostenbewusst): (1) unkomprimiertes Klartext-XML (kein Inflate);
 * (2) EINMAL inflaten mit der per zlib-Header gewaehlten Funktion. Erst wenn
 * dieser Versuch WIRFT, wird der EOL-getrimmte Rohblock und danach die andere
 * Inflate-Funktion probiert. Ein erfolgreich dekomprimierter Nicht-Rechnungs-
 * Block wird SOFORT verworfen (kein weiterer Versuch, kein Budget-Mehrverbrauch).
 *
 * Liefert Text, `null` (kein XML) oder EXHAUSTED (Budget verbraucht -> Abbruch).
 */
function decodeStream(raw: Buffer, budget: Budget): string | null | typeof EXHAUSTED {
  // 1) Unkomprimierter Anhang – nur den Kopf (max. 8 KB) betrachten.
  const headText = raw.subarray(0, 8192).toString('utf8');
  if (looksLikeEInvoiceXml(headText)) return raw.toString('utf8');

  // 2) Inflate: Filter per zlib-Header (0x78) waehlen, sonst RawFlate zuerst.
  const zlibFirst = raw.length > 1 && raw[0] === 0x78;
  const fns = zlibFirst
    ? ([zlib.inflateSync, zlib.inflateRawSync] as const)
    : ([zlib.inflateRawSync, zlib.inflateSync] as const);

  for (const fn of fns) {
    for (const candidate of candidates(raw)) {
      const res = tryInflate(fn, candidate, budget);
      if (res === EXHAUSTED) return EXHAUSTED;
      if (res === null) continue; // Inflate warf -> naechste Variante/Funktion
      // Erfolgreich dekomprimiert: entweder Rechnung -> zurueck, oder verwerfen.
      return looksLikeEInvoiceXml(res) ? res : null;
    }
  }
  return null;
}

/** Rohblock + (nur falls abweichend) EOL-getrimmte Variante. */
function candidates(raw: Buffer): Buffer[] {
  const trimmed = stripTrailingEol(raw);
  return trimmed === raw ? [raw] : [raw, trimmed];
}

/**
 * Extrahiert das eingebettete EN-16931-XML aus einem hybriden PDF. Liefert den
 * XML-String oder null (kein Anhang gefunden / verschluesselt / kein PDF /
 * DoS-Budget erschoepft). Wirft NIE.
 */
export function extractEmbeddedInvoiceXml(pdf: Buffer): string | null {
  try {
    if (!pdf || pdf.length === 0 || !isPdf(pdf)) return null;
    if (isEncryptedPdf(pdf)) return null;

    const budget: Budget = { used: 0 };
    let from = 0;
    let streams = 0;
    while (from < pdf.length && streams < MAX_PDF_STREAMS) {
      const sIdx = pdf.indexOf(STREAM_KW, from);
      if (sIdx === -1) break;
      // Datenbeginn: direkt nach `stream` folgt CRLF oder LF (PDF-Spec).
      let dataStart = sIdx + STREAM_KW.length;
      if (pdf[dataStart] === 0x0d) dataStart++; // CR
      if (pdf[dataStart] === 0x0a) dataStart++; // LF
      const eIdx = pdf.indexOf(ENDSTREAM_KW, dataStart);
      if (eIdx === -1) break;
      if (eIdx > dataStart) {
        streams++;
        // KEIN inhaltsbasiertes EOL-Trimmen hier (binaere Daten) – decodeStream
        // probiert die EOL-Variante selbst (nur bei Inflate-Fehler).
        const res = decodeStream(pdf.subarray(dataStart, eIdx), budget);
        if (res === EXHAUSTED) return null; // Budget aufgebraucht -> Fallback
        if (res) return res;
      }
      from = eIdx + ENDSTREAM_KW.length;
    }
    return null;
  } catch {
    return null;
  }
}
