import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GeraetemarktService } from './geraetemarkt.service';

/** Chainable QueryBuilder-Mock, der die WHERE-/Sort-Aufrufe protokolliert. */
function makeQb(rows: any[], total: number) {
  const calls: any = { select: null, where: [], andWhere: [], orderBy: [], skip: null, take: null };
  const qb: any = {};
  qb.select = jest.fn((s: any) => ((calls.select = s), qb));
  qb.where = jest.fn((c: any, p: any) => (calls.where.push([c, p]), qb));
  qb.andWhere = jest.fn((c: any, p: any) => (calls.andWhere.push([c, p]), qb));
  qb.orderBy = jest.fn((c: any, d: any) => (calls.orderBy.push([c, d]), qb));
  qb.skip = jest.fn((n: any) => ((calls.skip = n), qb));
  qb.take = jest.fn((n: any) => ((calls.take = n), qb));
  qb.getManyAndCount = jest.fn(async () => [rows, total]);
  return { qb, calls };
}

function makeService(over: { found?: any; qb?: any; findOne?: any } = {}) {
  const repo: any = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(
      'findOne' in over ? over.findOne : 'found' in over ? over.found : { id: 'i1', tenantId: 't1' },
    ),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: 'i1', ...x })),
    remove: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(() => (over.qb ? over.qb : makeQb([], 0).qb)),
  };
  const audit: any = { log: jest.fn() };
  const meldungen: any = { pruefeChemieVerdacht: jest.fn() };
  const svc = new GeraetemarktService(repo, audit, meldungen);
  return { svc, repo, audit, meldungen };
}

const OWNER: any = { id: 'u1', tenantId: 't1', role: 'owner' };

const BASE_CREATE = {
  titel: 'Rupes LHR21',
  beschreibung: 'Poliermaschine, wenig genutzt',
  kategorie: 'poliermaschine',
  zustand: 'gebraucht',
  preisModus: 'fest',
  preis: 250,
  gewerblichBestaetigt: true,
};

describe('GeraetemarktService · create', () => {
  it('setzt tenantId/userId aus dem JWT und ein Ablaufdatum ~90 Tage', async () => {
    const { svc, repo } = makeService();
    await svc.create(OWNER, { ...BASE_CREATE } as any);
    const created = repo.create.mock.calls[0][0];
    expect(created).toMatchObject({ tenantId: 't1', userId: 'u1', status: 'aktiv', moderationStatus: 'ok' });
    // gewerblichBestaetigt ist KEIN Persistenz-Feld (nur Gate).
    expect(created).not.toHaveProperty('gewerblichBestaetigt');
    const tage = Math.round((created.ablaufAm.getTime() - Date.now()) / 86_400_000);
    expect(tage).toBe(90);
  });

  it('preisModus=anfrage -> preis wird auf null normalisiert', async () => {
    const { svc, repo } = makeService();
    await svc.create(OWNER, { ...BASE_CREATE, preisModus: 'anfrage', preis: 999 } as any);
    expect(repo.create.mock.calls[0][0].preis).toBeNull();
  });

  it('preisModus=fest ohne preis -> BadRequest (Konsistenz)', async () => {
    const { svc } = makeService();
    await expect(
      svc.create(OWNER, { ...BASE_CREATE, preisModus: 'fest', preis: undefined } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stoesst nach dem Speichern die (weiche) Chemie-Vorpruefung an', async () => {
    const { svc, meldungen } = makeService();
    const saved = await svc.create(OWNER, { ...BASE_CREATE } as any);
    expect(meldungen.pruefeChemieVerdacht).toHaveBeenCalledWith(saved);
  });
});

describe('GeraetemarktService · Mutationen sind {id,tenantId}-gescoped', () => {
  it('update auf fremdes/unbekanntes Inserat -> 404', async () => {
    const { svc } = makeService({ found: null });
    await expect(svc.update(OWNER, 'fremd', { titel: 'x' } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateStatus auf fremdes/unbekanntes Inserat -> 404', async () => {
    const { svc } = makeService({ found: null });
    await expect(svc.updateStatus(OWNER, 'fremd', { status: 'verkauft' } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('remove auf fremdes/unbekanntes Inserat -> 404', async () => {
    const { svc } = makeService({ found: null });
    await expect(svc.remove(OWNER, 'fremd')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOneScoped filtert immer auf id UND tenantId', async () => {
    const { svc, repo } = makeService({ found: { id: 'i1', tenantId: 't1', status: 'aktiv', preisModus: 'fest', preis: 5 } });
    await svc.update(OWNER, 'i1', { titel: 'neu' } as any);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'i1', tenantId: 't1' } });
  });
});

describe('GeraetemarktService · browse (cross-tenant, sichtbar, projiziert)', () => {
  it('erzwingt Sichtbarkeit: moderationStatus=ok, Status aktiv/reserviert, nicht abgelaufen', async () => {
    const { qb, calls } = makeQb([], 0);
    const { svc } = makeService({ qb });
    await svc.browse({});
    const conds = [...calls.where, ...calls.andWhere].map((c: any[]) => c[0]).join(' | ');
    expect(conds).toContain('i.moderationStatus = :ok');
    expect(conds).toContain('i.status IN (:...sichtbar)');
    expect(conds).toContain('i.ablaufAm IS NULL OR i.ablaufAm > :now');
    // Projektion: nur oeffentliche Spalten, KEIN tenantId/userId/moderationStatus.
    expect(calls.select).toEqual(expect.arrayContaining(['i.id', 'i.titel', 'i.preis']));
    expect(calls.select).not.toContain('i.tenantId');
    expect(calls.select).not.toContain('i.userId');
    expect(calls.select).not.toContain('i.moderationStatus');
  });

  it('mappt Ergebnisse ohne PII (kein tenantId/userId im View)', async () => {
    const row = {
      id: 'i1', tenantId: 't5', userId: 'uX', titel: 'T', beschreibung: 'B',
      kategorie: 'plotter', zustand: 'gebraucht', preis: 100, preisModus: 'fest',
      plzRegion: '20', ort: 'HH', status: 'aktiv', moderationStatus: 'ok',
      createdAt: new Date(), ablaufAm: null,
    };
    const { qb } = makeQb([row], 1);
    const { svc } = makeService({ qb });
    const res = await svc.browse({});
    expect(res.total).toBe(1);
    expect(res.data[0]).not.toHaveProperty('tenantId');
    expect(res.data[0]).not.toHaveProperty('userId');
    expect(res.data[0]).not.toHaveProperty('moderationStatus');
    expect(res.data[0].titel).toBe('T');
  });

  it('reicht Filter (kategorie/zustand/plzRegion/preis-range) an die Query weiter', async () => {
    const { qb, calls } = makeQb([], 0);
    const { svc } = makeService({ qb });
    await svc.browse({ kategorie: 'plotter', zustand: 'neu', plzRegion: '20', preisMin: 50, preisMax: 500 } as any);
    const conds = calls.andWhere.map((c: any[]) => c[0]).join(' | ');
    expect(conds).toContain('i.kategorie = :kategorie');
    expect(conds).toContain('i.zustand = :zustand');
    expect(conds).toContain('i.plzRegion = :plzRegion');
    expect(conds).toContain('i.preis >= :preisMin');
    expect(conds).toContain('i.preis <= :preisMax');
  });

  it('sortiert nach Preis, wenn sort=preis_auf', async () => {
    const { qb, calls } = makeQb([], 0);
    const { svc } = makeService({ qb });
    await svc.browse({ sort: 'preis_auf' } as any);
    expect(calls.orderBy).toContainEqual(['i.preis', 'ASC']);
  });
});

describe('GeraetemarktService · findOnePublic (Detail)', () => {
  const sichtbaresFremd = {
    id: 'i1', tenantId: 't9', userId: 'uX', titel: 'T', beschreibung: 'B',
    kategorie: 'plotter', zustand: 'gebraucht', preis: 100, preisModus: 'fest',
    plzRegion: '20', ort: 'HH', status: 'aktiv', moderationStatus: 'ok',
    createdAt: new Date(), ablaufAm: null,
  };

  it('eigenes Inserat -> volle Entity (Verkaeufer-Sicht)', async () => {
    const own = { ...sichtbaresFremd, tenantId: 't1' };
    const { svc } = makeService({ findOne: own });
    const res: any = await svc.findOnePublic(OWNER, 'i1');
    expect(res.tenantId).toBe('t1');
  });

  it('fremdes sichtbares Inserat -> projiziert OHNE PII', async () => {
    const { svc } = makeService({ findOne: sichtbaresFremd });
    const res: any = await svc.findOnePublic(OWNER, 'i1');
    expect(res).not.toHaveProperty('tenantId');
    expect(res).not.toHaveProperty('userId');
    expect(res).not.toHaveProperty('moderationStatus');
  });

  it('fremdes verborgenes Inserat -> 404 (kein Existenz-Orakel)', async () => {
    const { svc } = makeService({ findOne: { ...sichtbaresFremd, moderationStatus: 'verborgen' } });
    await expect(svc.findOnePublic(OWNER, 'i1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fremdes verkauftes Inserat -> 404 (nicht mehr sichtbar)', async () => {
    const { svc } = makeService({ findOne: { ...sichtbaresFremd, status: 'verkauft' } });
    await expect(svc.findOnePublic(OWNER, 'i1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fremdes abgelaufenes Inserat -> 404', async () => {
    const abgelaufen = { ...sichtbaresFremd, ablaufAm: new Date(Date.now() - 1000) };
    const { svc } = makeService({ findOne: abgelaufen });
    await expect(svc.findOnePublic(OWNER, 'i1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('unbekannte id -> 404', async () => {
    const { svc } = makeService({ findOne: null });
    await expect(svc.findOnePublic(OWNER, 'weg')).rejects.toBeInstanceOf(NotFoundException);
  });
});
