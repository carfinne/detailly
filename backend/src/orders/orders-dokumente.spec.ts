import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

/**
 * Dokumente-Kontext (Auftragskarte + Uebergabeprotokoll): Tenant-Isolation und
 * das Einsammeln der Annahme-Schaeden. Reine Unit-Tests mit gemockten Repos.
 * Kern-Garantie: ein FREMDER/nicht existierender Auftrag fuehrt zu 404 (findOne
 * ist tenant-scoped) – so ist kein Dokument ueber Mandantengrenzen abrufbar.
 */
function makeService(over: {
  order?: any;
  customer?: any;
  vehicle?: any;
  tenant?: any;
  inspections?: any[];
  items?: any[];
} = {}) {
  const repo: any = { findOne: jest.fn().mockResolvedValue(over.order ?? null) };
  const customerRepo: any = { findOne: jest.fn().mockResolvedValue(over.customer ?? null) };
  const vehicleRepo: any = { findOne: jest.fn().mockResolvedValue(over.vehicle ?? null) };
  const tenantRepo: any = { findOne: jest.fn().mockResolvedValue(over.tenant ?? null) };
  const inspectionRepo: any = { find: jest.fn().mockResolvedValue(over.inspections ?? []) };
  const damageItemRepo: any = { find: jest.fn().mockResolvedValue(over.items ?? []) };
  const svc = new OrdersService(
    repo, {} as any, customerRepo, vehicleRepo, {} as any, {} as any, tenantRepo,
    {} as any /* Invoice */, {} as any /* audit */, { send: jest.fn() } as any /* mail */,
    { get: jest.fn() } as any /* config */, {} as any /* subscriptions */,
    inspectionRepo, damageItemRepo,
  );
  return { svc, repo, inspectionRepo, damageItemRepo };
}

const USER_TENANT = 't1';
const order = {
  id: 'o1', tenantId: 't1', auftragsnummer: 'AU-2026-0001',
  customerId: 'c1', vehicleId: 'v1', createdAt: new Date(),
  items: [{ beschreibung: 'Politur', typ: 'leistung' }],
};

describe('OrdersService · getUebergabeContext (Auftragskarte-Basis)', () => {
  it('fremder/nicht existierender Auftrag -> 404 (tenant-scoped findOne)', async () => {
    const { svc, repo } = makeService({ order: null });
    await expect(svc.getUebergabeContext(USER_TENANT, 'fremd')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'fremd', tenantId: 't1' }, relations: ['items'] });
  });

  it('eigener Auftrag -> Kontext (Order/Customer/Vehicle/Tenant) tenant-scoped geladen', async () => {
    const { svc, inspectionRepo } = makeService({
      order,
      customer: { id: 'c1', firstName: 'Max' },
      vehicle: { id: 'v1', make: 'BMW' },
      tenant: { id: 't1', name: 'X' },
    });
    const ctx = await svc.getUebergabeContext(USER_TENANT, 'o1');
    expect(ctx.order.auftragsnummer).toBe('AU-2026-0001');
    expect(ctx.customer).toEqual({ id: 'c1', firstName: 'Max' });
    expect(ctx.tenant).toEqual({ id: 't1', name: 'X' });
    // Auftragskarte braucht keine Schadensdaten -> Inspektions-Repo bleibt unberuehrt.
    expect(inspectionRepo.find).not.toHaveBeenCalled();
  });
});

describe('OrdersService · getUebergabeprotokollContext', () => {
  it('fremder Auftrag -> 404 (kein Schaden-Leak ueber Mandantengrenzen)', async () => {
    const { svc, inspectionRepo } = makeService({ order: null });
    await expect(svc.getUebergabeprotokollContext(USER_TENANT, 'fremd')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(inspectionRepo.find).not.toHaveBeenCalled();
  });

  it('waehlt die Annahme-Inspektion und mappt deren Schaeden (tenant-scoped)', async () => {
    const { svc, inspectionRepo, damageItemRepo } = makeService({
      order,
      customer: { id: 'c1' },
      vehicle: { id: 'v1' },
      tenant: { id: 't1', name: 'X' },
      inspections: [
        { id: 'insp-ausgang', typ: 'ausgang', kmStand: 99999, tankstand: 10 },
        { id: 'insp-annahme', typ: 'annahme', kmStand: 84250, tankstand: 60 },
      ],
      items: [
        { partLabel: 'Tür vorne links', partId: 'tuer_vl', art: 'kratzer', schweregrad: 'mittel', origin: 'vorschaden', ausmass: '20 cm' },
      ],
    });
    const ctx = await svc.getUebergabeprotokollContext(USER_TENANT, 'o1');
    // Annahme-Inspektion bevorzugt (nicht die Ausgangs-Inspektion).
    expect(ctx.annahme?.kmStand).toBe(84250);
    expect(ctx.annahme?.tankstand).toBe(60);
    expect(ctx.annahme?.schaeden).toHaveLength(1);
    expect(ctx.annahme?.schaeden[0]).toMatchObject({ partLabel: 'Tür vorne links', art: 'kratzer' });
    // Beide Queries strikt tenant-scoped (WHERE tenantId).
    expect(inspectionRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', orderId: 'o1' } }),
    );
    expect(damageItemRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', inspectionId: 'insp-annahme' } }),
    );
  });

  it('ohne Inspektion -> annahme = null (PDF zeigt leere Ausfuellzeilen)', async () => {
    const { svc, damageItemRepo } = makeService({
      order,
      customer: { id: 'c1' },
      vehicle: { id: 'v1' },
      tenant: { id: 't1', name: 'X' },
      inspections: [],
    });
    const ctx = await svc.getUebergabeprotokollContext(USER_TENANT, 'o1');
    expect(ctx.annahme).toBeNull();
    expect(damageItemRepo.find).not.toHaveBeenCalled();
  });
});
