/**
 * InvoicePdfService – rendert eine Beleg-PDF (Angebot/Rechnung) als Buffer.
 *
 * Tenant-Sicherheit: Dieser Service fuehrt KEINE eigenen Repo-Queries ohne
 * Tenant-Scope aus. Der aufrufende Service (InvoicesService.buildPdf) laedt die
 * Invoice tenant-scoped (findOne(tenantId,id)) sowie Customer/Tenant und
 * uebergibt die fertigen Objekte hier hinein. So bleibt die Mandantentrennung
 * vollstaendig in der aufrufenden Schicht.
 *
 * PDF-Tech: gemeinsamer Helfer in ../common/pdf/pdf-printer (pdfmake, pure JS,
 * kein nativer Build, kein headless-Chrome). Printer + Roboto-Fonts (Umlaute/EUR)
 * werden dort zentral aufgesetzt.
 */
import { Injectable } from '@nestjs/common';
import { createRobotoPrinter, renderPdf } from '../common/pdf/pdf-printer';
import {
  buildInvoiceDocDef,
  buildMahnungDocDef,
  MahnungOpts,
  PdfInvoice,
  PdfCustomer,
  PdfTenant,
} from './invoice-pdf';

@Injectable()
export class InvoicePdfService {
  private readonly printer: any = createRobotoPrinter();

  /**
   * Rendert die uebergebenen (bereits tenant-scoped geladenen) Daten zu einem
   * PDF-Buffer. Wirft, falls pdfmake einen Fehler meldet.
   */
  async render(
    invoice: PdfInvoice,
    customer: PdfCustomer | null,
    tenant: PdfTenant | null,
  ): Promise<Buffer> {
    return this.toBuffer(buildInvoiceDocDef(invoice, customer, tenant));
  }

  /** Rendert eine Mahnung/Zahlungserinnerung zu einer Rechnung als PDF-Buffer. */
  async renderMahnung(
    invoice: PdfInvoice,
    customer: PdfCustomer | null,
    tenant: PdfTenant | null,
    opts: MahnungOpts,
  ): Promise<Buffer> {
    return this.toBuffer(buildMahnungDocDef(invoice, customer, tenant, opts));
  }

  private toBuffer(docDef: Record<string, unknown>): Promise<Buffer> {
    return renderPdf(this.printer, docDef);
  }
}
