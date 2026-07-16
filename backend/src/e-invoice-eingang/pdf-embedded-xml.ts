/**
 * Extraktion des eingebetteten Rechnungs-XML aus einem hybriden PDF/A-3
 * (PDF mit EN-16931-XML als Anhang). Reine Funktion, KEINE DB.
 *
 * BEWUSST OHNE npm-Paket / ohne PDF-Objektgraph-Parser: Node-Bordmittel `zlib`
 * genuegt. Ansatz (tolerant, inhaltsbasiert statt dateinamensbasiert):
 *   1. `%PDF`-Signatur pruefen; verschluesselte PDFs (`/Encrypt` im Trailer)
 *      -> null (Aufrufer archiviert + zeigt das PDF, Status "nicht ausgelesen").
 *   2. Alle `stream … endstream`-Bloecke per Byte-Scan finden.
 *   3. Je Block: erst ROH pruefen (unkomprimierte Anhaenge), dann `inflateSync`
 *      und als Fallback `inflateRawSync` – mit `maxOutputLength` als
 *      Zip-Bomb-Schutz. Inflate-Fehler -> Block ueberspringen.
 *   4. Erster dekodierter Block mit EN-16931-Signatur (`CrossIndustryInvoice`
 *      ODER UBL-`Invoice` + Namespace) ist das Rechnungs-XML.
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

/** Obergrenze fuer dekomprimierte Stream-Groesse (Zip-Bomb-Schutz). */
export const MAX_INFLATE_BYTES = 8 * 1024 * 1024;

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

/**
 * Versucht, einen Stream-Rohblock zu XML-Text zu machen (roh/Flate/RawFlate).
 *
 * WICHTIG: Der Rohblock kann noch das vom PDF-Erzeuger eingefuegte EOL vor
 * `endstream` tragen – aber Stream-DATEN sind binaer und duerfen NICHT anhand
 * ihres Inhalts EOL-getrimmt werden (sonst zerstoert man ein echtes 0x0A/0x0D
 * am Datenende). Ohne /Length-Parsing loesen wir das robust, indem wir mehrere
 * End-Varianten (as-is / minus \n / minus \r\n / minus \r) durchprobieren.
 */
function decodeStream(raw: Buffer): string | null {
  for (const buf of endVarianten(raw)) {
    // 1) Bereits Klartext-XML (unkomprimierter Anhang)?
    const rawHead = buf.subarray(0, 64).toString('latin1');
    if (rawHead.includes('<?xml') || rawHead.includes('<')) {
      const text = buf.toString('utf8');
      if (looksLikeEInvoiceXml(text)) return text;
    }
    // 2) Flate (zlib) bzw. RawFlate.
    for (const inflate of [zlib.inflateSync, zlib.inflateRawSync] as const) {
      try {
        const out = inflate(buf, { maxOutputLength: MAX_INFLATE_BYTES });
        const text = out.toString('utf8');
        if (looksLikeEInvoiceXml(text)) return text;
      } catch {
        /* falscher Filter / kein Flate / Zip-Bomb-Kappung -> naechster Versuch */
      }
    }
  }
  return null;
}

/** End-Varianten eines Rohblocks (unveraendert + moegliche EOL-Abschnitte). */
function endVarianten(raw: Buffer): Buffer[] {
  const out = [raw];
  const n = raw.length;
  if (n >= 2 && raw[n - 2] === 0x0d && raw[n - 1] === 0x0a) out.push(raw.subarray(0, n - 2));
  if (n >= 1 && raw[n - 1] === 0x0a) out.push(raw.subarray(0, n - 1));
  if (n >= 1 && raw[n - 1] === 0x0d) out.push(raw.subarray(0, n - 1));
  return out;
}

/**
 * Extrahiert das eingebettete EN-16931-XML aus einem hybriden PDF. Liefert den
 * XML-String oder null (kein Anhang gefunden / verschluesselt / kein PDF).
 * Wirft NIE.
 */
export function extractEmbeddedInvoiceXml(pdf: Buffer): string | null {
  try {
    if (!pdf || pdf.length === 0 || !isPdf(pdf)) return null;
    if (isEncryptedPdf(pdf)) return null;

    let from = 0;
    while (from < pdf.length) {
      const sIdx = pdf.indexOf(STREAM_KW, from);
      if (sIdx === -1) break;
      // Datenbeginn: direkt nach `stream` folgt CRLF oder LF (PDF-Spec).
      let dataStart = sIdx + STREAM_KW.length;
      if (pdf[dataStart] === 0x0d) dataStart++; // CR
      if (pdf[dataStart] === 0x0a) dataStart++; // LF
      const eIdx = pdf.indexOf(ENDSTREAM_KW, dataStart);
      if (eIdx === -1) break;
      // KEIN inhaltsbasiertes EOL-Trimmen hier (binaere Daten) – decodeStream
      // probiert die End-Varianten selbst durch.
      if (eIdx > dataStart) {
        const xml = decodeStream(pdf.subarray(dataStart, eIdx));
        if (xml) return xml;
      }
      from = eIdx + ENDSTREAM_KW.length;
    }
    return null;
  } catch {
    return null;
  }
}
