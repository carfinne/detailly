/**
 * OrdersPdfService – rendert Auftrags-Dokumente (Uebergabe-/Garantiedokument,
 * Auftragskarte, Uebergabeprotokoll) als PDF-Buffer.
 *
 * Tenant-Sicherheit: Dieser Service fuehrt KEINE eigenen Repo-Queries aus. Der
 * aufrufende Controller laedt Auftrag/Kunde/Fahrzeug/Tenant tenant-scoped (ueber
 * OrdersService) und uebergibt die fertige Dokumentdefinition hier hinein.
 *
 * PDF-Tech: gemeinsamer Helfer in ../common/pdf/pdf-printer (pdfmake, pure JS,
 * kein nativer Build). Printer + Fonts werden dort zentral aufgesetzt.
 */
import { Injectable } from '@nestjs/common';
import { createRobotoPrinter, renderPdf } from '../common/pdf/pdf-printer';

@Injectable()
export class OrdersPdfService {
  private readonly printer: any = createRobotoPrinter();

  /** Rendert eine bereits gebaute pdfmake-Dokumentdefinition zu einem PDF-Buffer. */
  render(docDef: Record<string, unknown>): Promise<Buffer> {
    return renderPdf(this.printer, docDef);
  }
}
