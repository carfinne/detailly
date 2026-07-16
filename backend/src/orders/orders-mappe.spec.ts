import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { buildMappeView } from './mappe-view';

/**
 * Tests fuer die OEFFENTLICHE Uebergabe-Mappe (Pro-Feature `kundenerlebnis`).
 * Reine Unit-Tests mit gemockten Repositories. Schwerpunkt: das serverseitige
 * Tenant-Gate (Feature ∧ Status) und die Datensparsamkeit der Ausgabe.
 */
const VALID_TOKEN = 'b'.repeat(48);

function makeService(over: {
  order?: any;
  customer?: any;
  vehicle?: any;
  tenant?: any;
  feature?: boolean;
} = {}) {
  const repo: any = { findOne: jest.fn().mockResolvedValue(over.order ?? null) };
  const customerRepo: any = { findOne: jest.fn().mockResolvedValue(over.customer ?? null) };
  const vehicleRepo: any = { findOne: jest.fn().mockResolvedValue(over.vehicle ?? null) };
  const tenantRepo: any = { findOne: jest.fn().mockResolvedValue(over.tenant ?? null) };
  const subscriptions: any = {
    hasFeatureForTenant: jest.fn().mockResolvedValue(over.feature ?? false),
  };
  const svc = new OrdersService(
    repo, {} as any, customerRepo, vehicleRepo, {} as any, {} as any, tenantRepo,
    {} as any /* Invoice */, {} as any /* audit */, { send: jest.fn() } as any /* mail */,
    { get: jest.fn() } as any /* config */, subscriptions,
  );
  return { svc, repo, customerRepo, vehicleRepo, tenantRepo, subscriptions };
}

const fertigOrder = {
  id: 'o1', tenantId: 't1', auftragsnummer: 'AU-2026-0007', serviceType: 'folierung',
  status: 'fertig', customerId: 'c1', vehicleId: 'v1', createdAt: new Date(),
  geplantesEnde: new Date(Date.UTC(2026, 6, 1, 12, 0, 0)),
  bilderNachher: ['a.jpg', 'b.jpg'],
  leistungDetails: { folierung: { farbe: 'Nardograu', garantieJahre: 5, pflegehinweis: '48h nicht waschen.' } },
  items: [{ beschreibung: 'Vollfolierung', typ: 'leistung' }],
};

describe('OrdersService · mappeWebByToken (Gate)', () => {
  it.each(['', 'xyz', '../etc', 'g'.repeat(48)])('unplausibles Token "%s" -> 404', async (bad) => {
    const { svc, repo } = makeService();
    await expect(svc.mappeWebByToken(bad)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('kein Auftrag -> 404', async () => {
    const { svc } = makeService({ order: null });
    await expect(svc.mappeWebByToken(VALID_TOKEN)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('OHNE Feature (trotz Status fertig) -> 404 (kein Orakel)', async () => {
    const { svc } = makeService({ order: fertigOrder, feature: false, tenant: { id: 't1', name: 'X' } });
    await expect(svc.mappeWebByToken(VALID_TOKEN)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('MIT Feature aber Status in_arbeit -> 404 (Review-before-send)', async () => {
    const { svc } = makeService({
      order: { ...fertigOrder, status: 'in_arbeit' }, feature: true, tenant: { id: 't1', name: 'X' },
    });
    await expect(svc.mappeWebByToken(VALID_TOKEN)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('MIT Feature + Status fertig -> PII-arme Mappe (kein Kundenname/Preis)', async () => {
    const { svc } = makeService({
      order: fertigOrder,
      feature: true,
      customer: { firstName: 'Max', lastName: 'Muster', street: 'Weg 1', city: 'Berlin' },
      vehicle: { make: 'VW', model: 'Golf', licensePlate: 'B-XY 1' },
      tenant: { id: 't1', name: 'Folienprofi', betriebstyp: 'folierung', logoUrl: 'https://x/l.png', phone: '030' },
    });
    const view = await svc.mappeWebByToken(VALID_TOKEN);

    expect(view.betrieb.name).toBe('Folienprofi');
    expect(view.betrieb.akzent).toBe('#9B76FC');
    expect(view.betrieb.logo).toBe('https://x/l.png');
    expect(view.fahrzeug).toBe('VW Golf');
    expect(view.kennzeichen).toBe('B-XY 1');
    expect(view.serviceLabel).toBe('Folierung');
    expect(view.leistungen).toEqual(['Vollfolierung']);
    expect(view.pflege).toBe('48h nicht waschen.');
    expect(view.nachherAnzahl).toBe(2);
    expect(view.details).toEqual(
      expect.arrayContaining([{ label: 'Garantie', wert: '5 Jahre' }]),
    );
    // Datensparsamkeit: KEIN Kundenname/Adresse/Preis im Web-DTO.
    const flat = JSON.stringify(view);
    expect(flat).not.toContain('Max');
    expect(flat).not.toContain('Muster');
    expect(flat).not.toContain('Berlin');
  });
});

describe('OrdersService · mappePdfContextByToken', () => {
  it('reicht den Kunden NAMENS-only durch (keine Adresse ins token-oeffentliche PDF)', async () => {
    const { svc } = makeService({
      order: fertigOrder,
      feature: true,
      customer: { type: 'private', firstName: 'Max', lastName: 'Muster', street: 'Weg 1', city: 'Berlin' },
      tenant: { id: 't1', name: 'X', betriebstyp: 'ppf', logoUrl: 'https://x/l.png' },
    });
    const ctx = await svc.mappePdfContextByToken(VALID_TOKEN);
    expect(ctx.customer).toEqual({ type: 'private', firstName: 'Max', lastName: 'Muster', companyName: undefined });
    expect(ctx.akzent).toBe('#3EBFB9');
    // https-Logo wird NICHT als data-URL eingebettet (kein Server-Fetch).
    expect(ctx.logoDataUrl).toBeNull();
  });

  it('data:-Logo wird als logoDataUrl durchgereicht', async () => {
    const { svc } = makeService({
      order: fertigOrder,
      feature: true,
      customer: null,
      tenant: { id: 't1', name: 'X', logoUrl: 'data:image/png;base64,AAAA' },
    });
    const ctx = await svc.mappePdfContextByToken(VALID_TOKEN);
    expect(ctx.logoDataUrl).toBe('data:image/png;base64,AAAA');
  });
});

describe('buildMappeView (pure)', () => {
  it('unsauberes Logo -> null, Kennzeichen/Details korrekt', () => {
    const view = buildMappeView(
      fertigOrder as any,
      { make: 'BMW', model: 'M3', licensePlate: 'M-AB 9' } as any,
      { name: 'Y', logoUrl: 'javascript:1', akzent: '#abc' } as any,
    );
    expect(view.betrieb.logo).toBeNull();
    expect(view.betrieb.akzent).toBe('#abc');
    expect(view.kennzeichen).toBe('M-AB 9');
    expect(view.pflege).toBe('48h nicht waschen.');
  });
});
