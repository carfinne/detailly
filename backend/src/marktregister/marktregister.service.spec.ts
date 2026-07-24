import { NotFoundException } from '@nestjs/common';
import { MarktregisterService } from './marktregister.service';

/** Repo-Stub – nur die vom Service genutzten Methoden. */
function repoStub(over: any = {}) {
  return {
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: x.id ?? 'neu-id', ...x })),
    remove: jest.fn().mockResolvedValue(undefined),
    ...over,
  };
}

function makeService(over: any = {}) {
  const audit = over.audit ?? { log: jest.fn().mockResolvedValue(undefined) };
  const repo = repoStub(over.repo);
  const svc = new MarktregisterService(repo as any, audit as any);
  return { svc, repo, audit };
}

const ADMIN: any = { id: 'admin1', email: 'a@detailly.de', role: 'platform_admin', tenantId: 'plat' };

const VALID_CREATE = {
  wettbewerber: 'Mitbewerber GmbH',
  kategorie: 'feature' as const,
  beobachtung: 'Bietet einen 3D-Konfigurator auf der Startseite.',
  quelleUrl: 'https://example.com/produkt',
  beobachtetAm: '2026-07-20',
  abgeleiteteIdee: 'Eigenen Konfigurator prominenter platzieren.',
};

describe('MarktregisterService · list (paginiert, plattformweit, gefiltert)', () => {
  it('deckelt limit hart (max 100), offset nie negativ', async () => {
    const repo = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
    const { svc } = makeService({ repo });
    const r = await svc.list({ limit: '9999', offset: '-10' });
    expect(r.limit).toBe(100);
    expect(r.offset).toBe(0);
    expect(r.total).toBe(0);
  });

  it('default-Limit 25, wenn kein limit uebergeben', async () => {
    const repo = { findAndCount: jest.fn().mockResolvedValue([[{ id: 'x' }], 1]) };
    const { svc } = makeService({ repo });
    const r = await svc.list({});
    expect(r.limit).toBe(25);
    expect(r.data).toHaveLength(1);
  });

  it('ist NICHT tenant-scoped: das WHERE traegt keinerlei tenantId', async () => {
    const findAndCount = jest.fn().mockResolvedValue([[], 0]);
    const { svc } = makeService({ repo: { findAndCount } });
    await svc.list({});
    const arg = findAndCount.mock.calls[0][0];
    expect(arg.where).toEqual({});
    expect('tenantId' in arg.where).toBe(false);
  });

  it('gueltige Filter (status/kategorie/prioritaet) landen im WHERE', async () => {
    const findAndCount = jest.fn().mockResolvedValue([[], 0]);
    const { svc } = makeService({ repo: { findAndCount } });
    await svc.list({ status: 'eingeplant', kategorie: 'preis', prioritaet: 'hoch' });
    expect(findAndCount.mock.calls[0][0].where).toEqual({
      status: 'eingeplant',
      kategorie: 'preis',
      prioritaet: 'hoch',
    });
  });

  it('ungueltige Filterwerte werden ignoriert (kein Fehler, kein WHERE-Eintrag)', async () => {
    const findAndCount = jest.fn().mockResolvedValue([[], 0]);
    const { svc } = makeService({ repo: { findAndCount } });
    await svc.list({ status: 'boese', kategorie: 'xxx', prioritaet: '9' });
    expect(findAndCount.mock.calls[0][0].where).toEqual({});
  });

  it('sortiert neueste zuerst (createdAt DESC)', async () => {
    const findAndCount = jest.fn().mockResolvedValue([[], 0]);
    const { svc } = makeService({ repo: { findAndCount } });
    await svc.list({});
    expect(findAndCount.mock.calls[0][0].order).toEqual({ createdAt: 'DESC' });
  });
});

describe('MarktregisterService · Mutationen (jeweils Audit-Log)', () => {
  it('create: setzt erstelltVonUserId aus dem Nutzer + Defaults + auditiert', async () => {
    const { svc, repo, audit } = makeService();
    const saved = await svc.create(ADMIN, { ...VALID_CREATE });
    expect(repo.save).toHaveBeenCalledTimes(1);
    const persisted = repo.create.mock.calls[0][0];
    expect(persisted.erstelltVonUserId).toBe('admin1');
    expect(persisted.status).toBe('neu');
    expect(persisted.prioritaet).toBe('mittel');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'marktregister.create',
        entityType: 'MarktBeobachtung',
        tenantId: 'plat',
        userId: 'admin1',
      }),
    );
    expect(saved.id).toBeDefined();
  });

  it('create ohne Akteur-Tenant bucht Audit auf "platform" (null-sicher)', async () => {
    const { svc, audit } = makeService();
    await svc.create({ id: 'p1', role: 'platform_admin' } as any, { ...VALID_CREATE });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'platform', userId: 'p1' }),
    );
  });

  it('update: laedt vorhandenen Eintrag, wendet nur gesetzte Felder an + auditiert', async () => {
    const bestand = { id: 'm1', wettbewerber: 'Alt', status: 'neu', prioritaet: 'mittel', quelleUrl: 'https://a.de' };
    const repo = repoStub({ findOne: jest.fn().mockResolvedValue({ ...bestand }) });
    const { svc, audit } = makeService({ repo });
    await svc.update(ADMIN, 'm1', { wettbewerber: 'Neu' });
    const saved = repo.save.mock.calls[0][0];
    expect(saved.wettbewerber).toBe('Neu');
    expect(saved.status).toBe('neu'); // unveraendert
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'marktregister.update', entityId: 'm1' }),
    );
  });

  it('update: leere quelleUrl wird zu null normalisiert', async () => {
    const repo = repoStub({ findOne: jest.fn().mockResolvedValue({ id: 'm1', quelleUrl: 'https://a.de' }) });
    const { svc } = makeService({ repo });
    await svc.update(ADMIN, 'm1', { quelleUrl: '' });
    expect(repo.save.mock.calls[0][0].quelleUrl).toBeNull();
  });

  it('update auf unbekannte id -> NotFound', async () => {
    const repo = repoStub({ findOne: jest.fn().mockResolvedValue(null) });
    const { svc } = makeService({ repo });
    await expect(svc.update(ADMIN, 'weg', { wettbewerber: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('setStatus: aendert nur den Status + auditiert mit Payload', async () => {
    const repo = repoStub({ findOne: jest.fn().mockResolvedValue({ id: 'm1', status: 'neu' }) });
    const { svc, audit } = makeService({ repo });
    await svc.setStatus(ADMIN, 'm1', 'umgesetzt');
    expect(repo.save.mock.calls[0][0].status).toBe('umgesetzt');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'marktregister.update.status', payload: { status: 'umgesetzt' } }),
    );
  });

  it('setPrioritaet: aendert nur die Prioritaet + auditiert mit Payload', async () => {
    const repo = repoStub({ findOne: jest.fn().mockResolvedValue({ id: 'm1', prioritaet: 'mittel' }) });
    const { svc, audit } = makeService({ repo });
    await svc.setPrioritaet(ADMIN, 'm1', 'hoch');
    expect(repo.save.mock.calls[0][0].prioritaet).toBe('hoch');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'marktregister.update.prioritaet', payload: { prioritaet: 'hoch' } }),
    );
  });

  it('remove: echtes Delete + auditiert', async () => {
    const bestand = { id: 'm1' };
    const repo = repoStub({ findOne: jest.fn().mockResolvedValue(bestand) });
    const { svc, audit } = makeService({ repo });
    const r = await svc.remove(ADMIN, 'm1');
    expect(repo.remove).toHaveBeenCalledWith(bestand);
    expect(r).toEqual({ success: true });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'marktregister.delete', entityId: 'm1' }),
    );
  });

  it('remove auf unbekannte id -> NotFound (kein Delete, kein Audit)', async () => {
    const repo = repoStub({ findOne: jest.fn().mockResolvedValue(null) });
    const { svc, audit } = makeService({ repo });
    await expect(svc.remove(ADMIN, 'weg')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.remove).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
