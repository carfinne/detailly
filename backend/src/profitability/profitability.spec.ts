import { NotFoundException } from '@nestjs/common';
import { ProfitabilityService } from './profitability.service';

function makeService(over: any = {}) {
  const orderRepo: any = {
    findOne: jest.fn().mockResolvedValue(
      'order' in over ? over.order : { id: 'o1', tenantId: 't1', nettoSumme: '1600' },
    ),
  };
  const timeRepo: any = { find: jest.fn().mockResolvedValue(over.zeiten ?? []) };
  const materialRepo: any = { find: jest.fn().mockResolvedValue(over.material ?? []) };
  const userRepo: any = { find: jest.fn().mockResolvedValue(over.users ?? []) };
  const productRepo: any = { find: jest.fn().mockResolvedValue(over.products ?? []) };
  const svc = new ProfitabilityService(orderRepo, timeRepo, materialRepo, userRepo, productRepo);
  return { svc, userRepo, productRepo };
}

describe('ProfitabilityService · forOrder', () => {
  it('Marge = Netto - Lohn - Material (+ Prozent)', async () => {
    const { svc } = makeService({
      zeiten: [{ userId: 'u1', minuten: 480 }], // 8 h
      material: [{ productId: 'p1', menge: '2' }],
      users: [{ id: 'u1', stundenlohn: 20 }], // 8 * 20 = 160
      products: [{ id: 'p1', einkaufspreis: 100 }], // 2 * 100 = 200
    });
    const r = await svc.forOrder('t1', 'o1');
    expect(r).toEqual({
      netto: 1600,
      lohnkosten: 160,
      materialkosten: 200,
      marge: 1240, // 1600 - 160 - 200
      margeProzent: 77.5, // 1240 / 1600
    });
  });

  it('ohne Kosten: Marge = Netto, keine User-/Produkt-Abfrage', async () => {
    const { svc, userRepo, productRepo } = makeService();
    const r = await svc.forOrder('t1', 'o1');
    expect(r.lohnkosten).toBe(0);
    expect(r.materialkosten).toBe(0);
    expect(r.marge).toBe(1600);
    expect(userRepo.find).not.toHaveBeenCalled();
    expect(productRepo.find).not.toHaveBeenCalled();
  });

  it('Netto 0 -> margeProzent null (keine Division durch Null)', async () => {
    const { svc } = makeService({ order: { id: 'o1', tenantId: 't1', nettoSumme: '0' } });
    const r = await svc.forOrder('t1', 'o1');
    expect(r.margeProzent).toBeNull();
    expect(r.marge).toBe(0);
  });

  it('unbekannter Auftrag -> 404', async () => {
    const { svc } = makeService({ order: null });
    await expect(svc.forOrder('t1', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
