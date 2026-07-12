import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FolienRollenService } from './folien-rollen.service';
import { FolienRolleStatus } from './entities/folien-rolle.entity';

function makeService(over: { found?: any; product?: any } = {}) {
  const repo: any = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue('found' in over ? over.found : { id: 'r1', tenantId: 't1' }),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: 'r1', ...x })),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const productRepo: any = {
    findOne: jest.fn().mockResolvedValue('product' in over ? over.product : { id: 'p1', tenantId: 't1' }),
  };
  const audit: any = { log: jest.fn() };
  const svc = new FolienRollenService(repo, productRepo, audit);
  return { svc, repo, productRepo };
}

const USER: any = { id: 'u1', tenantId: 't1', role: 'technician' };
const MGR: any = { id: 'm1', tenantId: 't1', role: 'manager' };

describe('FolienRollenService · findAll', () => {
  it('filtert immer auf tenantId, optional auf Produkt/Status (Mandantentrennung)', async () => {
    const { svc, repo } = makeService();
    await svc.findAll('t1', { productId: 'p1', status: FolienRolleStatus.VERFUEGBAR });
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't1', productId: 'p1', status: FolienRolleStatus.VERFUEGBAR },
      }),
    );
  });
});

describe('FolienRollenService · create', () => {
  it('setzt tenantId aus dem Nutzer und legt die Rolle an', async () => {
    const { svc, repo } = makeService();
    await svc.create(USER, { bezeichnung: '3M 2080 - 2,8 m Rest', restLfm: 2.8 });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', bezeichnung: '3M 2080 - 2,8 m Rest', restLfm: 2.8 }),
    );
    expect(repo.save).toHaveBeenCalled();
  });

  it('fremder/unbekannter Produktbezug -> BadRequest (Cross-Tenant-Schutz)', async () => {
    const { svc } = makeService({ product: null });
    await expect(
      svc.create(USER, { bezeichnung: 'x', productId: 'fremd', restLfm: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('FolienRollenService · update/remove (Tenant-Isolation)', () => {
  it('update auf fremde/unbekannte Rolle -> 404', async () => {
    const { svc } = makeService({ found: null });
    await expect(svc.update(USER, 'fremd', { restLfm: 1 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update setzt die Felder (z. B. Abschreiben via ENTSORGT)', async () => {
    const { svc, repo } = makeService({
      found: { id: 'r1', tenantId: 't1', status: FolienRolleStatus.VERFUEGBAR, restLfm: '5' },
    });
    await svc.update(USER, 'r1', { status: FolienRolleStatus.ENTSORGT });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: FolienRolleStatus.ENTSORGT }),
    );
  });

  it('remove auf fremde/unbekannte Rolle -> 404', async () => {
    const { svc } = makeService({ found: null });
    await expect(svc.remove(MGR, 'fremd')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove loescht die eigene Rolle', async () => {
    const { svc, repo } = makeService({ found: { id: 'r1', tenantId: 't1' } });
    const res = await svc.remove(MGR, 'r1');
    expect(repo.remove).toHaveBeenCalled();
    expect(res).toEqual({ success: true });
  });
});
