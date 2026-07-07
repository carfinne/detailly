/**
 * Kleiner, dependency-freier CSV-Parser fuer den Bestandsdaten-Import (T-007).
 *
 * Warum selbst gebaut: Excel/DE exportiert typischerweise Semikolon + Windows-1252,
 * andere Tools Komma + UTF-8. Der Parser ist dafuer tolerant:
 *  - Trennzeichen-Autoerkennung (";" vs ",") anhand der Kopfzeile,
 *  - Encoding-Erkennung: erst UTF-8 (strikt), sonst Windows-1252-Fallback,
 *  - RFC-4180-Quotes ("Wert; mit Trenner", doppelte "" als Escape, auch
 *    Zeilenumbrueche INNERHALB eines Feldes),
 *  - BOM-Strip, CRLF/LF/CR, komplett leere Zeilen werden uebersprungen.
 *
 * Bewusst REIN (kein Nest, keine DB): wirft bei unbrauchbarer Eingabe ein
 * gewoehnliches Error – die Import-Services uebersetzen das in eine 400.
 */

/**
 * Minimaler Typ der von multer (memoryStorage) gelieferten Datei. Bewusst als
 * eigenes Interface statt @types/multer: das Backend kommt ohne neue
 * (Dev-)Dependencies aus (lokales npm install ist wegen better-sqlite3/Node 24
 * nicht moeglich, siehe Run-Umgebungs-Notizen).
 */
export interface HochgeladeneDatei {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}

export interface CsvDaten {
  /** Normalisierte Kopfzeile (lowercase, getrimmt) – fuer das Spalten-Mapping. */
  header: string[];
  /** Original-Kopfzeile (fuer Meldungen wie "ignorierte Spalten"). */
  headerOriginal: string[];
  /** Datenzeilen mit ihrer Zeilennummer in der Datei (Kopfzeile = Zeile 1). */
  zeilen: { nr: number; felder: string[] }[];
  trennzeichen: ';' | ',';
  encoding: 'utf-8' | 'windows-1252';
}

// Windows-1252 unterscheidet sich von Latin-1 nur im Block 0x80-0x9F
// (Euro, typografische Anfuehrungszeichen, Gedankenstriche ...).
const CP1252_SONDER: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…',
  0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š',
  0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’',
  0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ',
  0x9e: 'ž', 0x9f: 'Ÿ',
};

function dekodiereWindows1252(buf: Buffer): string {
  let out = '';
  for (const b of buf) out += CP1252_SONDER[b] ?? String.fromCharCode(b);
  return out;
}

/** Dekodiert einen Datei-Buffer: UTF-8 wenn strikt gueltig, sonst Windows-1252. */
export function dekodiereTextBuffer(buf: Buffer): { text: string; encoding: 'utf-8' | 'windows-1252' } {
  let text: string;
  let encoding: 'utf-8' | 'windows-1252';
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    encoding = 'utf-8';
  } catch {
    text = dekodiereWindows1252(buf);
    encoding = 'windows-1252';
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  return { text, encoding };
}

/** Erkennt das Trennzeichen anhand der Kopfzeile (Excel/DE nutzt ";"). */
export function erkenneTrennzeichen(text: string): ';' | ',' {
  const ende = text.search(/[\r\n]/);
  const kopf = ende === -1 ? text : text.slice(0, ende);
  const semikolons = (kopf.match(/;/g) || []).length;
  const kommas = (kopf.match(/,/g) || []).length;
  return semikolons >= kommas ? ';' : ',';
}

/**
 * Zerlegt CSV-Text in Datensaetze (Zustandsautomat, RFC-4180-Quotes).
 * `nr` ist die Dateizeile, in der der Datensatz BEGINNT (1-basiert) – bei
 * Zeilenumbruechen innerhalb eines Feldes bleibt die Zuordnung so stabil.
 */
export function parseCsvText(text: string, trennzeichen: string): { nr: number; felder: string[] }[] {
  const saetze: { nr: number; felder: string[] }[] = [];
  let felder: string[] = [];
  let feld = '';
  let inQuotes = false;
  let zeileNr = 1;
  let startNr = 1;

  const feldAbschliessen = () => {
    felder.push(feld);
    feld = '';
  };
  const satzAbschliessen = () => {
    feldAbschliessen();
    const leer = felder.length === 1 && felder[0].trim() === '';
    if (!leer) saetze.push({ nr: startNr, felder });
    felder = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          feld += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (c === '\r') {
          // CRLF im Feld auf \n normalisieren
          if (text[i + 1] === '\n') i++;
          feld += '\n';
          zeileNr++;
        } else {
          feld += c;
          if (c === '\n') zeileNr++;
        }
      }
    } else if (c === '"' && feld === '') {
      inQuotes = true;
    } else if (c === trennzeichen) {
      feldAbschliessen();
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      zeileNr++;
      satzAbschliessen();
      startNr = zeileNr;
    } else {
      feld += c;
    }
  }
  if (feld !== '' || felder.length > 0) satzAbschliessen();
  return saetze;
}

/** Komplett-Parser: Buffer -> Kopfzeile + Datenzeilen. Wirft Error bei leerer Datei. */
export function parseCsv(datei: HochgeladeneDatei): CsvDaten {
  if (!datei?.buffer || datei.buffer.length === 0) {
    throw new Error('Die Datei ist leer. Bitte eine CSV-Datei mit Kopfzeile hochladen.');
  }
  const { text, encoding } = dekodiereTextBuffer(datei.buffer);
  const trennzeichen = erkenneTrennzeichen(text);
  const saetze = parseCsvText(text, trennzeichen);
  if (saetze.length === 0) {
    throw new Error('Die Datei enthaelt keine Kopfzeile.');
  }
  const kopf = saetze[0];
  return {
    header: kopf.felder.map((h) => h.trim().toLowerCase()),
    headerOriginal: kopf.felder.map((h) => h.trim()),
    zeilen: saetze.slice(1),
    trennzeichen,
    encoding,
  };
}
