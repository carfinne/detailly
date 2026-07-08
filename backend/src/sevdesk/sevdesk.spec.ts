import { SevdeskService } from './sevdesk.service';
import { CustomerType } from '../customers/entities/customer.entity';

/**
 * Tests fuer die reinen sevDesk-Payload-Builder + Token-Maskierung. Die echten
 * HTTP-Calls (gegated) werden hier nicht getestet (brauchen einen echten Token).
 */
describe('SevdeskService (Payload-Builder)', () => {
  const svc = new SevdeskService({} as any, {} as any);

  describe('buildContactBody', () => {
    it('Geschaeftskunde -> name + Kategorie 3', () => {
      const b: any = svc.buildContactBody({ type: CustomerType.BUSINESS, companyName: 'Auto Meier GmbH' } as any);
      expect(b.name).toBe('Auto Meier GmbH');
      expect(b.surname).toBeUndefined();
      expect(b.category).toEqual({ id: 3, objectName: 'Category' });
    });

    it('Privatkunde -> surname (Vorname) + familyname (Nachname), kein name', () => {
      const b: any = svc.buildContactBody({ type: CustomerType.PRIVATE, firstName: 'Max', lastName: 'Mustermann' } as any);
      expect(b.name).toBeUndefined();
      expect(b.surname).toBe('Max');
      expect(b.familyname).toBe('Mustermann');
      expect(b.category).toEqual({ id: 3, objectName: 'Category' });
    });
  });

  describe('buildInvoiceBody', () => {
    const invoice: any = {
      nummer: 'RE-2026-0001',
      datum: new Date(2026, 0, 15),
      mwstSatz: 19,
      items: [
        { beschreibung: 'Aufbereitung', menge: 1, einzelpreis: 100 },
        { beschreibung: 'Material', menge: 2, einzelpreis: 12.5 },
      ],
    };

    it('Rechnungskopf korrekt (19%)', () => {
      const body: any = svc.buildInvoiceBody(invoice, 'C123', 'U7');
      const inv = body.invoice;
      expect(inv.objectName).toBe('Invoice');
      expect(inv.mapAll).toBe(true);
      expect(inv.contact).toEqual({ id: 'C123', objectName: 'Contact' });
      expect(inv.contactPerson).toEqual({ id: 'U7', objectName: 'SevUser' });
      expect(inv.invoiceDate).toBe('15.01.2026');
      expect(inv.invoiceType).toBe('RE');
      expect(inv.status).toBe(200);
      expect(inv.taxType).toBe('default');
      expect(inv.taxRate).toBe(19);
      expect(inv.header).toBe('Rechnung RE-2026-0001');
    });

    it('Positionen aus items (Netto-Einzelpreis, Stueck-Einheit)', () => {
      const body: any = svc.buildInvoiceBody(invoice, 'C123', 'U7');
      expect(body.invoicePosSave).toHaveLength(2);
      expect(body.invoicePosSave[0]).toEqual({
        objectName: 'InvoicePos',
        mapAll: true,
        name: 'Aufbereitung',
        quantity: 1,
        price: 100,
        taxRate: 19,
        unity: { id: 1, objectName: 'Unity' },
      });
      expect(body.invoicePosSave[1].price).toBe(12.5);
      expect(body.invoicePosDelete).toBeNull();
      expect(body.discountSave).toBeNull();
    });

    it('Kleinunternehmer (0%) -> taxType ss', () => {
      const body: any = svc.buildInvoiceBody({ ...invoice, mwstSatz: 0 }, 'C1', 'U1');
      expect(body.invoice.taxType).toBe('ss');
      expect(body.invoice.taxRate).toBe(0);
    });
  });

  describe('maskToken', () => {
    it('zeigt nur die letzten 4 Zeichen', () => {
      const masked = SevdeskService.maskToken('abcd1234efgh');
      expect(masked.endsWith('efgh')).toBe(true);
      expect(masked).not.toContain('abcd1234');
      expect(/^•+efgh$/.test(masked)).toBe(true);
    });
    it('leerer Token -> leerer String', () => {
      expect(SevdeskService.maskToken('')).toBe('');
    });
  });
});

/**
 * Feature-Gate von loadToken (Umsatzsicherung): Die sevDesk-Anbindung laeuft nur
 * mit dem Tarif-Feature `export` (Basic+/Pro). Ohne das Feature -> stiller No-op
 * (`null`), KEIN Throw (loadToken liegt in Kern-Create-Pfaden). Backward-compat:
 * kein Tarif (`null`) -> Vollzugriff. Repo + SubscriptionsService sind gemockt.
 */
describe('SevdeskService.loadToken (Feature-Gate export)', () => {
  const TOKEN = 'SEV-SECRET-TOKEN';

  function makeService(opts: { plan?: any; planThrows?: boolean; token?: string | null }) {
    const qb: any = {
      addSelect: () => qb,
      where: () => qb,
      getOne: async () => ({ sevdeskApiToken: opts.token === undefined ? TOKEN : opts.token }),
    };
    const tenantRepo: any = { createQueryBuilder: () => qb };
    const getTenantPlan = opts.planThrows
      ? jest.fn().mockRejectedValue(new Error('db down'))
      : jest.fn().mockResolvedValue(opts.plan ?? null);
    const subscriptions: any = { getTenantPlan };
    return { svc: new SevdeskService(tenantRepo, subscriptions), getTenantPlan };
  }

  it('Tarif OHNE export -> null (stiller No-op, auch mit hinterlegtem Token)', async () => {
    const { svc } = makeService({ plan: { features: ['kunden', 'rechnungen'] } });
    await expect(svc.loadToken('t1')).resolves.toBeNull();
  });

  it('leere features ([]) -> null (KEIN Modul erlaubt)', async () => {
    const { svc } = makeService({ plan: { features: [] } });
    await expect(svc.loadToken('t1')).resolves.toBeNull();
  });

  it('Tarif MIT export -> laedt den Token', async () => {
    const { svc } = makeService({ plan: { features: ['rechnungen', 'export'] } });
    await expect(svc.loadToken('t1')).resolves.toBe(TOKEN);
  });

  it('kein Tarif (null) -> laedt den Token (backward-compat)', async () => {
    const { svc } = makeService({ plan: null });
    await expect(svc.loadToken('t1')).resolves.toBe(TOKEN);
  });

  it('features == null (ungepflegt) -> laedt den Token (backward-compat)', async () => {
    const { svc } = makeService({ plan: { features: null } });
    await expect(svc.loadToken('t1')).resolves.toBe(TOKEN);
  });

  it('Tarif-Lookup wirft -> null (fail-safe, nicht ungegatet syncen)', async () => {
    const { svc } = makeService({ planThrows: true });
    await expect(svc.loadToken('t1')).resolves.toBeNull();
  });

  it('export vorhanden, aber kein Token hinterlegt -> null', async () => {
    const { svc } = makeService({ plan: { features: ['export'] }, token: null });
    await expect(svc.loadToken('t1')).resolves.toBeNull();
  });
});
