/**
 * SchichtdickePdfService – rendert den Schichtdicken-Messbericht als PDF-Buffer.
 *
 * Tenant-Sicherheit: KEINE eigenen Repo-Queries. Der Controller laedt Protokoll/
 * Punkte/Auswertung/Kunde/Fahrzeug/Tenant tenant-scoped (ueber den Service) und
 * uebergibt die fertige Dokumentdefinition hier hinein.
 *
 * PDF-Tech: gemeinsamer Helfer in ../common/pdf/pdf-printer (pdfmake, pure JS,
 * kein nativer Build, kein neues npm-Paket). Printer + Fonts zentral aufgesetzt.
 */
import { Injectable } from '@nestjs/common';
import { createRobotoPrinter, renderPdf } from '../common/pdf/pdf-printer';

@Injectable()
export class SchichtdickePdfService {
  private readonly printer: any = createRobotoPrinter();

  /** Rendert eine bereits gebaute pdfmake-Dokumentdefinition zu einem PDF-Buffer. */
  render(docDef: Record<string, unknown>): Promise<Buffer> {
    return renderPdf(this.printer, docDef);
  }
}
