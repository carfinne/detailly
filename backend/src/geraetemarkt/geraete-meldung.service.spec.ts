import { ConflictException, NotFoundException } from '@nestjs/common';
import { GeraeteMeldungService } from './geraete-meldung.service';
import { SYSTEM_MELDER_ID } from './geraetemarkt.constants';

const SICHTBAR = {
  id: 'i1',
  tenantId: 'verkaeufer-t',
  titel: 'Rupes LHR21',
  beschreibung: 'Poliermaschine, top Zustand',
  status: 'aktiv',
  moderationStatus: 'ok',
  ablaufAm: null,
};

const VERKAEUFER_TENANT = {
  id: 'verkaeufer-t',
  name: 'Glanz & Gloria GmbH',
  email: 'verkauf@glanz.example',
  phone: '040 12345',
  street: 'Hafenstr. 1',
  postalCode: '20095',
  city: 'Hamburg',
  country: 'DE',
};

const MELDER: any = { id: 'u9', tenantId: 'melder-t', role: 'owner' };

function makeService(over: {
  inserat?: any;
  tenant?: any;
  vorhandeneMeldung?: any;
} = {}) {
  const inseratRepo: any = {
    findOne: jest.fn().mockResolvedValue('inserat' in over ? over.inserat : SICHTBAR),
  };
  const meldungRepo: any = {
    findOne: jest.fn().mockResolvedValue(over.vorhandeneMeldung ?? null),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: 'm1', ...x })),
  };
  const tenantRepo: any = {
    findOne: jest.fn().mockResolvedValue('tenant' in over ? over.tenant : VERKAEUFER_TENANT),
  };
  const audit: any = { log: jest.fn() };
  const svc = new GeraeteMeldungService(inseratRepo, meldungRepo, tenantRepo, audit);
  return { svc, inseratRepo, meldungRepo, tenantRepo, audit };
}

describe('GeraeteMeldungService · kontaktReveal', () => {
  it('sichtbares Inserat -> Kontakt aus Verkaeufer-Stammdaten + Audit', async () => {
    const { svc, audit } = makeService();
    const kontakt = await svc.kontaktReveal(MELDER, 'i1');

    expect(kontakt).toEqual({
      betriebsname: 'Glanz & Gloria GmbH',
      email: 'verkauf@glanz.example',
      telefon: '040 12345',
      anschrift: 'Hafenstr. 1, 20095 Hamburg',
    });
    // Jede Offenlegung wird auditiert: wer (melder-t/u9), welches Inserat (i1).
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'melder-t',
        userId: 'u9',
        action: 'kontakt_reveal',
        entityType: 'GeraeteInserat',
        entityId: 'i1',
        payload: { verkaeuferTenantId: 'verkaeufer-t' },
      }),
    );
  });

  it('unsichtbares Inserat (verborgen) -> 404, KEIN Audit, KEIN Tenant-Load', async () => {
    const { svc, audit, tenantRepo } = makeService({
      inserat: { ...SICHTBAR, moderationStatus: 'verborgen' },
    });
    await expect(svc.kontaktReveal(MELDER, 'i1')).rejects.toBeInstanceOf(NotFoundException);
    expect(audit.log).not.toHaveBeenCalled();
    expect(tenantRepo.findOne).not.toHaveBeenCalled();
  });

  it('unbekanntes Inserat -> 404', async () => {
    const { svc } = makeService({ inserat: null });
    await expect(svc.kontaktReveal(MELDER, 'weg')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('Anschrift ist null, wenn keine Adressdaten vorhanden sind', async () => {
    const { svc } = makeService({
      tenant: { id: 'verkaeufer-t', name: 'Nur Name', email: null, phone: null },
    });
    const kontakt = await svc.kontaktReveal(MELDER, 'i1');
    expect(kontakt.anschrift).toBeNull();
    expect(kontakt.email).toBeNull();
    expect(kontakt.telefon).toBeNull();
  });
});

describe('GeraeteMeldungService · melden', () => {
  it('sichtbares Inserat, erste Meldung -> erzeugt Meldung + Audit', async () => {
    const { svc, meldungRepo, audit } = makeService();
    const meldung = await svc.melden(MELDER, 'i1', { grund: 'chemie_verboten', kommentar: 'Chemie' } as any);

    const created = meldungRepo.create.mock.calls[0][0];
    expect(created).toMatchObject({
      inseratId: 'i1',
      melderTenantId: 'melder-t',
      melderUserId: 'u9',
      grund: 'chemie_verboten',
      status: 'offen',
    });
    expect(meldung.id).toBe('m1');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'melden', entityId: 'i1' }),
    );
  });

  it('Doppel-Melden desselben Betriebs -> 409 (idempotent, keine zweite Meldung)', async () => {
    const { svc, meldungRepo } = makeService({ vorhandeneMeldung: { id: 'm0' } });
    await expect(
      svc.melden(MELDER, 'i1', { grund: 'spam' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(meldungRepo.save).not.toHaveBeenCalled();
  });

  it('unsichtbares Inserat -> 404 (kein Existenz-Orakel)', async () => {
    const { svc } = makeService({ inserat: { ...SICHTBAR, status: 'verkauft' } });
    await expect(
      svc.melden(MELDER, 'i1', { grund: 'betrug' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('GeraeteMeldungService · pruefeChemieVerdacht (weich, KEIN Block)', () => {
  it('verdaechtiges Inserat -> offene System-Meldung (chemie_verboten)', async () => {
    const { svc, meldungRepo } = makeService();
    await svc.pruefeChemieVerdacht({
      id: 'i2',
      titel: 'Keramikversiegelung 500ml',
      beschreibung: 'Neuwertiges Gebinde',
    } as any);

    const created = meldungRepo.create.mock.calls[0][0];
    expect(created).toMatchObject({
      inseratId: 'i2',
      melderTenantId: SYSTEM_MELDER_ID,
      melderUserId: SYSTEM_MELDER_ID,
      grund: 'chemie_verboten',
      status: 'offen',
    });
  });

  it('unverdaechtiges Geraet -> KEINE Meldung', async () => {
    const { svc, meldungRepo } = makeService();
    await svc.pruefeChemieVerdacht({
      id: 'i3',
      titel: 'Dampfreiniger Kärcher',
      beschreibung: 'Profi-Geraet',
    } as any);
    expect(meldungRepo.save).not.toHaveBeenCalled();
  });

  it('bereits markiert -> keine zweite System-Meldung (idempotent)', async () => {
    const { svc, meldungRepo } = makeService({ vorhandeneMeldung: { id: 'sys0' } });
    await svc.pruefeChemieVerdacht({
      id: 'i4',
      titel: 'Wachs 1 Liter',
      beschreibung: '',
    } as any);
    expect(meldungRepo.save).not.toHaveBeenCalled();
  });

  it('DB-Fehler blockiert das Anlegen NICHT (best-effort, kein Throw)', async () => {
    const { svc, meldungRepo } = makeService();
    meldungRepo.save.mockRejectedValueOnce(new Error('db weg'));
    await expect(
      svc.pruefeChemieVerdacht({ id: 'i5', titel: 'Politur', beschreibung: '' } as any),
    ).resolves.toBeUndefined();
  });
});
