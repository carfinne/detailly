/**
 * Zentraler pdfmake-Printer + Buffer-Renderer fuer ALLE Server-PDFs.
 *
 * Vorher war dieses Setup byte-identisch in drei Services dupliziert
 * (InvoicePdfService, OrdersPdfService, SchichtdickePdfService). Diese Helfer
 * vereinen es an EINER Stelle – das Verhalten bleibt unveraendert.
 *
 * PDF-Tech: pdfmake (pure JS, kein nativer Build, kein headless-Chrome). Die
 * mitgelieferten Roboto-Fonts (Umlaute + Euro) kommen als base64-VFS mit der Lib.
 * WICHTIG: Der SERVER-Printer (pdfkit) liest Fonts vom DATEISYSTEM, nicht aus dem
 * VFS (das ist ein reines Browser-Konzept). Daher materialisieren wir die Fonts
 * einmalig in ein Temp-Verzeichnis und referenzieren echte Datei-Pfade – so
 * brauchen wir keine eigenen TTFs und behalten Umlaute/EUR. Kein neues npm-Paket.
 */
import * as os from 'os';
import * as fs from 'fs';
import { join } from 'path';

// pdfmake liefert keine sauberen ESM-Typen fuer den Server-Pfad; CommonJS-Require
// ist der dokumentierte Weg fuer den Printer + das mitgelieferte Font-VFS.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfFonts = require('pdfmake/build/vfs_fonts');

const FONT_DATEIEN = [
  'Roboto-Regular.ttf',
  'Roboto-Medium.ttf',
  'Roboto-Italic.ttf',
  'Roboto-MediumItalic.ttf',
];

/**
 * Baut einen pdfmake-Printer mit registrierten Roboto-Fonts. Die Fonts werden
 * idempotent aus dem gebuendelten VFS nach <tmp>/detailly-pdf-fonts/ geschrieben.
 * Wirft, falls das VFS oder eine Font-Datei fehlt (fail-closed statt kaputtem PDF).
 */
export function createRobotoPrinter(): any {
  // VFS-Objekt (Dateiname -> base64) robust aufloesen: aeltere pdfmake-Builds
  // legen es unter .pdfMake.vfs / .vfs ab, 0.2.x exportiert es DIREKT als Modul.
  const vfs: Record<string, string> =
    (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).vfs ?? (pdfFonts as any);
  if (!vfs || typeof vfs !== 'object' || Object.keys(vfs).length === 0) {
    throw new Error('pdfmake VFS (Fonts) nicht gefunden');
  }

  // Fonts einmalig nach <tmp>/detailly-pdf-fonts/ schreiben (idempotent).
  const fontDir = join(os.tmpdir(), 'detailly-pdf-fonts');
  fs.mkdirSync(fontDir, { recursive: true });
  for (const name of FONT_DATEIEN) {
    const b64 = vfs[name];
    if (!b64) throw new Error(`pdfmake-Font fehlt im VFS: ${name}`);
    const ziel = join(fontDir, name);
    if (!fs.existsSync(ziel)) fs.writeFileSync(ziel, Buffer.from(b64, 'base64'));
  }

  return new PdfPrinter({
    Roboto: {
      normal: join(fontDir, 'Roboto-Regular.ttf'),
      bold: join(fontDir, 'Roboto-Medium.ttf'),
      italics: join(fontDir, 'Roboto-Italic.ttf'),
      bolditalics: join(fontDir, 'Roboto-MediumItalic.ttf'),
    },
  });
}

/** Rendert eine bereits gebaute pdfmake-Dokumentdefinition zu einem PDF-Buffer. */
export function renderPdf(printer: any, docDef: Record<string, unknown>): Promise<Buffer> {
  const pdfDoc = printer.createPdfKitDocument(docDef as any);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', (err: Error) => reject(err));
    pdfDoc.end();
  });
}
