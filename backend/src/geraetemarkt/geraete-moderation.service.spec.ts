import { NotFoundException } from '@nestjs/common';
import { GeraeteModerationService } from './geraete-moderation.service';

const MODERATOR: any = { id: 'mod1', tenantId: 'platform', role: 'platform_admin' };

const INSERAT = {
  id: 'i1',
  tenantId: 'betrieb-t',
  titel: 'Politur 5 Liter',
  status: 'aktiv',
  moderationStatus: 'ok',
};

function makeService(over: { inserat?: any; meldung?: any } = {}) {
  const inseratRepo: any = {
    findOne: jest.fn().mockResolvedValue('inserat' in over ? over.inserat : INSERAT),
    find: jest.fn().mockResolvedValue([INSERAT]),
    findAndCount: jest.fn().mockResolvedValue([[INSERAT], 1]),
    save: jest.fn(async (x: any) => x),
  };
  const meldungRepo: any = {
    findOne: jest.fn().mockResolvedValue(
      'meldung' in over ? over.meldung : { id: 'm1', inseratId: 'i1', status: 'offen' },
    ),
    findAndCount: jest.fn().mockResolvedValue([[{ id: 'm1', inseratId: 'i1', status: 'offen' }], 1]),
    save: jest.fn(async (x: any) => x),
  };
  const audit: any = { log: jest.fn() };
  const svc = new GeraeteModerationService(inseratRepo, meldungRepo, audit);
  return { svc, inseratRepo, meldungRepo, audit };
}

describe('GeraeteModerationService · moderateInserat', () => {
  it('setzt moderationStatus=verborgen und auditiert unter der Inserat-tenantId', async () => {
    const { svc, inseratRepo, audit } = makeService();
    const res = await svc.moderateInserat(MODERATOR, 'i1', { moderationStatus: 'verborgen' } as any);

    // Persistierter Wert -> faellt aus dem Browse (dort gilt moderationStatus=ok).
    expect(inseratRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ moderationStatus: 'verborgen' }),
    );
    expect(res.moderationStatus).toBe('verborgen');
    // Audit: betroffener Betrieb (betrieb-t) sieht die Massnahme; userId = Moderator.
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'betrieb-t',
        userId: 'mod1',
        action: 'moderation',
        entityType: 'GeraeteInserat',
        entityId: 'i1',
        payload: expect.objectContaining({ moderationStatus: 'verborgen' }),
      }),
    );
  });

  it('unbekanntes Inserat -> 404', async () => {
    const { svc } = makeService({ inserat: null });
    await expect(
      svc.moderateInserat(MODERATOR, 'weg', { moderationStatus: 'verborgen' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('GeraeteModerationService · updateMeldung', () => {
  it('setzt Status + Bearbeiter und auditiert unter der Inserat-tenantId', async () => {
    const { svc, meldungRepo, audit } = makeService();
    await svc.updateMeldung(MODERATOR, 'm1', { status: 'erledigt' } as any);

    expect(meldungRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'erledigt', bearbeitetVonUserId: 'mod1' }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'betrieb-t',
        userId: 'mod1',
        action: 'meldung_bearbeitet',
        entityId: 'm1',
      }),
    );
  });

  it('unbekannte Meldung -> 404', async () => {
    const { svc } = makeService({ meldung: null });
    await expect(
      svc.updateMeldung(MODERATOR, 'weg', { status: 'verworfen' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('GeraeteModerationService · Listen (paginiert)', () => {
  it('listMeldungen filtert per Default auf offen und haengt den Inseratbezug an', async () => {
    const { svc, meldungRepo } = makeService();
    const res = await svc.listMeldungen({});
    expect(meldungRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'offen' } }),
    );
    expect(res.total).toBe(1);
    expect(res.data[0].inserat).toMatchObject({ id: 'i1', tenantId: 'betrieb-t' });
  });

  it('listInserate liefert ALLE Inserate (inkl. verborgene) paginiert', async () => {
    const { svc, inseratRepo } = makeService();
    const res = await svc.listInserate({ moderationStatus: 'verborgen' } as any);
    expect(inseratRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { moderationStatus: 'verborgen' } }),
    );
    expect(res.total).toBe(1);
  });
});
