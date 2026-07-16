/**
 * SchichtdickePdfService – rendert den Schichtdicken-Messbericht als PDF-Buffer.
 *
 * Tenant-Sicherheit: KEINE eigenen Repo-Queries. Der Controller laedt Protokoll/
 * Punkte/Auswertung/Kunde/Fahrzeug/Tenant tenant-scoped (ueber den Service) und
 * uebergibt die fertige Dokumentdefinition hier hinein.
 *
 * PDF-Tech: identisch zu OrdersPdfService/InvoicePdfService (pdfmake, pure JS,
 * kein nativer Build, kein neues npm-Paket). Fonts einmalig in ein Temp-
 * Verzeichnis materialisiert (der Server-Printer liest Fonts vom Dateisystem).
 */
import { Injectable } from '@nestjs/common';
import * as os from 'os';
import * as fs from 'fs';
import { join } from 'path';

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

@Injectable()
export class SchichtdickePdfService {
  private readonly printer: any;

  constructor() {
    const vfs: Record<string, string> =
      (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).vfs ?? (pdfFonts as any);
    if (!vfs || typeof vfs !== 'object' || Object.keys(vfs).length === 0) {
      throw new Error('pdfmake VFS (Fonts) nicht gefunden');
    }

    const fontDir = join(os.tmpdir(), 'detailly-pdf-fonts');
    fs.mkdirSync(fontDir, { recursive: true });
    for (const name of FONT_DATEIEN) {
      const b64 = vfs[name];
      if (!b64) throw new Error(`pdfmake-Font fehlt im VFS: ${name}`);
      const ziel = join(fontDir, name);
      if (!fs.existsSync(ziel)) fs.writeFileSync(ziel, Buffer.from(b64, 'base64'));
    }

    this.printer = new PdfPrinter({
      Roboto: {
        normal: join(fontDir, 'Roboto-Regular.ttf'),
        bold: join(fontDir, 'Roboto-Medium.ttf'),
        italics: join(fontDir, 'Roboto-Italic.ttf'),
        bolditalics: join(fontDir, 'Roboto-MediumItalic.ttf'),
      },
    });
  }

  /** Rendert eine bereits gebaute pdfmake-Dokumentdefinition zu einem PDF-Buffer. */
  render(docDef: Record<string, unknown>): Promise<Buffer> {
    const pdfDoc = this.printer.createPdfKitDocument(docDef as any);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', (err: Error) => reject(err));
      pdfDoc.end();
    });
  }
}
