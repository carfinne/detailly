import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceKind } from '../invoices/entities/invoice.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { buildXRechnungXml } from './xrechnung.builder';

/**
 * EInvoiceService – laedt eine Rechnung MANDANTENSICHER und erzeugt daraus ein
 * XRechnung-3.0-XML (Download, KEIN Auto-Versand).
 *
 * Mandantentrennung: Alle drei Quellen (Invoice/Customer/Tenant) werden strikt
 * tenant-scoped geladen (Vorbild InvoicesService.loadContext). Eine fremde
 * Rechnung liefert 404 (kein Cross-Tenant-Leak). Der eigentliche XML-Bau ist
 * eine reine Funktion (xrechnung.builder) ohne DB-Zugriff.
 */
@Injectable()
export class EInvoiceService {
  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
  ) {}

  /**
   * Baut das XRechnung-XML fuer eine Rechnung des eigenen Betriebs.
   * - 404, wenn die Rechnung nicht zum Tenant gehoert / nicht existiert.
   * - 400, wenn es ein Angebot ist (XRechnung gilt nur fuer Rechnungen).
   * - 422 (im Builder), wenn §14-/Kaeufer-Pflichtfelder fehlen.
   */
  async buildXRechnung(tenantId: string, id: string): Promise<{ xml: string; nummer: string }> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id, tenantId },
      relations: ['items'],
    });
    if (!invoice) throw new NotFoundException('Beleg nicht gefunden');
    if (invoice.art !== InvoiceKind.RECHNUNG) {
      throw new BadRequestException(
        'E-Rechnung (XRechnung) ist nur für Rechnungen verfügbar, nicht für Angebote.',
      );
    }
    // Rechnungskorrektur: Ein Storno-Beleg braucht in der XRechnung einen eigenen
    // Dokumententyp (UNCL1001 384/381) + BillingReference auf das Original. Das
    // folgt in einem eigenen Paket; bis dahin KEINE irrefuehrende Typ-380-E-Rechnung
    // fuer Stornos ausliefern (das PDF steht weiter zur Verfuegung).
    if (invoice.stornoVonInvoiceId) {
      throw new BadRequestException(
        'Für Stornorechnungen ist die E-Rechnung (XRechnung) noch nicht verfügbar – bitte vorerst das PDF verwenden.',
      );
    }

    const customer = await this.customerRepo.findOne({
      where: { id: invoice.customerId, tenantId },
    });
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });

    const xml = buildXRechnungXml(
      invoice,
      tenant ? { ...tenant, settings: (tenant.settings ?? {}) as Record<string, unknown> } : null,
      customer,
    );
    return { xml, nummer: invoice.nummer ?? 'Entwurf' };
  }
}
