import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EInvoiceService } from './e-invoice.service';
import { InvoiceKind } from '../invoices/entities/invoice.entity';

/**
 * Tenant-Scope-Tests fuer EInvoiceService mit gemockten Repos. Fokus:
 * Mandantentrennung (jede Query traegt tenantId), 404 bei Fremdrechnung,
 * 400 bei Angebot.
 */
describe('EInvoiceService', () => {
  const TENANT = 'tenant-1';

  const makeInvoice = () => ({
    id: 'inv-1',
    tenantId: TENANT,
    customerId: 'cust-1',
    nummer: 'RE-2026-0001',
    art: InvoiceKind.RECHNUNG,
    datum: new Date(2026, 0, 15),
    faelligkeitsdatum: new Date(2026, 0, 29),
    netto: 100,
    mwst: 19,
    brutto: 119,
    mwstSatz: 19,
    items: [{ beschreibung: 'Politur', menge: 1, einzelpreis: 100, gesamtpreis: 100 }],
  });

  const makeTenant = () => ({
    id: TENANT,
    name: 'Glanz GmbH',
    street: 'Hauptstr. 1',
    city: 'Berlin',
    postalCode: '10115',
    country: 'DE',
    phone: '030 1234567',
    email: 'info@glanz.de',
    settings: {
      steuernummer: '12/345/67890',
      ustId: 'DE123456789',
      iban: 'DE02120300000000202051',
      bic: 'BYLADEM1001',
      bankname: 'Test Bank',
    },
  });

  const makeCustomer = () => ({
    id: 'cust-1',
    tenantId: TENANT,
    type: 'business',
    companyName: 'Fuhrpark AG',
    vatNumber: 'DE987654321',
    city: 'Hamburg',
    postalCode: '20095',
    country: 'DE',
  });

  function build(overrides: {
    invoice?: unknown;
    customer?: unknown;
    tenant?: unknown;
  }) {
    const invoiceRepo = { findOne: jest.fn().mockResolvedValue(overrides.invoice ?? null) };
    const customerRepo = { findOne: jest.fn().mockResolvedValue(overrides.customer ?? null) };
    const tenantRepo = { findOne: jest.fn().mockResolvedValue(overrides.tenant ?? null) };
    const service = new EInvoiceService(
      invoiceRepo as never,
      customerRepo as never,
      tenantRepo as never,
    );
    return { service, invoiceRepo, customerRepo, tenantRepo };
  }

  it('laedt die Rechnung tenant-scoped und liefert XML + Nummer', async () => {
    const { service, invoiceRepo, customerRepo, tenantRepo } = build({
      invoice: makeInvoice(),
      customer: makeCustomer(),
      tenant: makeTenant(),
    });

    const { xml, nummer } = await service.buildXRechnung(TENANT, 'inv-1');

    expect(nummer).toBe('RE-2026-0001');
    expect(xml).toContain('<cbc:ID>RE-2026-0001</cbc:ID>');
    // Mandantentrennung: alle drei Queries tragen tenantId.
    expect(invoiceRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'inv-1', tenantId: TENANT },
      relations: ['items'],
    });
    expect(customerRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'cust-1', tenantId: TENANT },
    });
    expect(tenantRepo.findOne).toHaveBeenCalledWith({ where: { id: TENANT } });
  });

  it('404, wenn die Rechnung nicht zum Tenant gehoert', async () => {
    const { service, customerRepo } = build({ invoice: null });
    await expect(service.buildXRechnung(TENANT, 'fremd')).rejects.toBeInstanceOf(NotFoundException);
    // Ohne Treffer wird nichts Weiteres geladen (kein Cross-Tenant-Leak).
    expect(customerRepo.findOne).not.toHaveBeenCalled();
  });

  it('400 bei einem Angebot (XRechnung nur fuer Rechnungen)', async () => {
    const angebot = { ...makeInvoice(), art: InvoiceKind.ANGEBOT };
    const { service } = build({ invoice: angebot, customer: makeCustomer(), tenant: makeTenant() });
    await expect(service.buildXRechnung(TENANT, 'inv-1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
