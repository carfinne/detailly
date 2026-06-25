/**
 * InvoicePdfService – rendert eine Beleg-PDF (Angebot/Rechnung) als Buffer.
 *
 * Tenant-Sicherheit: Dieser Service fuehrt KEINE eigenen Repo-Queries ohne
 * Tenant-Scope aus. Der aufrufende Service (InvoicesService.buildPdf) laedt die
 * Invoice tenant-scoped (findOne(tenantId,id)) sowie Customer/Tenant und
 * uebergibt die fertigen Objekte hier hinein. So bleibt die Mandantentrennung
 * vollstaendig in der aufrufenden Schicht.
 *
 * PDF-Tech: pdfmake (pure JS, kein nativer Build, kein headless-Chrome). Die
 * Roboto-Fonts (Umlaute + Euro) kommen als base64-VFS mit der Lib. WICHTIG:
 * Der SERVER-Printer (pdfkit) liest Fonts vom DATEISYSTEM, nicht aus dem VFS
 * (das ist ein reines Browser-Konzept). Daher materialisieren wir die
 * mitgelieferten Fonts einmalig in ein Temp-Verzeichnis und referenzieren echte
 * Datei-Pfade – so brauchen wir keine eigenen TTFs und behalten Umlaute/EUR.
 */
import { Injectable } from '@nestjs/common';
import * as os from 'os';
import * as fs from 'fs';
import { join } from 'path';
import {
  buildInvoiceDocDef,
  PdfInvoice,
  PdfCustomer,
  PdfTenant,
} from './invoice-pdf';

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

@Injectable()
export class InvoicePdfService {
  private readonly printer: any;

  constructor() {
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

    this.printer = new PdfPrinter({
      Roboto: {
        normal: join(fontDir, 'Roboto-Regular.ttf'),
        bold: join(fontDir, 'Roboto-Medium.ttf'),
        italics: join(fontDir, 'Roboto-Italic.ttf'),
        bolditalics: join(fontDir, 'Roboto-MediumItalic.ttf'),
      },
    });
  }

  /**
   * Rendert die uebergebenen (bereits tenant-scoped geladenen) Daten zu einem
   * PDF-Buffer. Wirft, falls pdfmake einen Fehler meldet.
   */
  async render(
    invoice: PdfInvoice,
    customer: PdfCustomer | null,
    tenant: PdfTenant | null,
  ): Promise<Buffer> {
    const docDef = buildInvoiceDocDef(invoice, customer, tenant);
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
