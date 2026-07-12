import { BadRequestException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoiceKind } from './entities/invoice.entity';

/**
 * Welle 1 (F1): Angebots-Set aus mehreren Varianten. Unit-Test mit gemockten
 * Repositories; create() wird gespyt, damit nur die Set-Orchestrierung geprueft wird.
 */
function makeService() {
  const repo: any = {
    findOne: jest.fn().mockImplementation((opts: any) =>
      Promise.resolve({ id: opts?.where?.id, tenantId: opts?.where?.tenantId, items: [] }),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const customerRepo: any = { findOne: jest.fn().mockResolvedValue({ id: 'c1', tenantId: 't1' }) };
  const orderRepo: any = { findOne: jest.fn().mockResolvedValue({ id: 'o1', tenantId: 't1' }) };
  const tenantRepo: any = { findOne: jest.fn().mockResolvedValue({ id: 't1', name: 'X' }) };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new InvoicesService(
    repo, {} as any, orderRepo, customerRepo, tenantRepo, audit,
    {} as any, {} as any, {} as any, {} as any,
  );
  return { svc, repo, audit };
}

const USER: any = { id: 'u1', tenantId: 't1' };

describe('InvoicesService · Angebots-Set (F1)', () => {
  it('erzeugt N Angebote mit gemeinsamer varianteGruppeId und je eigenem Label', async () => {
    const { svc, repo } = makeService();
    const created: any[] = [];
    jest.spyOn(svc, 'create').mockImplementation(async (_u: any, dto: any) => {
      const inv = { id: `inv${created.length + 1}`, art: dto.art };
      created.push({ dto });
      return inv as any;
    });

    const res = await svc.createAngebotsSet(USER, {
      customerId: 'c1',
      varianten: [
        { label: 'Vollfolierung 3M', items: [{ beschreibung: 'Voll', menge: 1, einzelpreis: 2000 }] },
        { label: 'Teilfolierung Avery', items: [{ beschreibung: 'Teil', menge: 1, einzelpreis: 1200 }] },
      ],
    } as any);

    // Zwei Angebote, beide als ANGEBOT angelegt.
    expect(created).toHaveLength(2);
    expect(created.every((c) => c.dto.art === InvoiceKind.ANGEBOT)).toBe(true);
    expect(res).toHaveLength(2);

    // Beide bekommen dieselbe Gruppe, aber ihr eigenes Label.
    const updates = repo.update.mock.calls.map((c: any[]) => c[1]);
    const gruppen = new Set(updates.map((u: any) => u.varianteGruppeId));
    expect(gruppen.size).toBe(1);
    expect([...gruppen][0]).toMatch(/[0-9a-f-]{36}/);
    expect(updates.map((u: any) => u.varianteLabel)).toEqual(['Vollfolierung 3M', 'Teilfolierung Avery']);

    // Jede repo.update ist tenant-scoped.
    expect(repo.update.mock.calls.every((c: any[]) => c[0].tenantId === 't1')).toBe(true);
  });

  it('weniger als 2 Varianten -> 400', async () => {
    const { svc } = makeService();
    jest.spyOn(svc, 'create').mockResolvedValue({ id: 'inv1' } as any);
    await expect(
      svc.createAngebotsSet(USER, {
        customerId: 'c1',
        varianten: [{ label: 'nur eine', items: [{ beschreibung: 'x', menge: 1, einzelpreis: 1 }] }],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
