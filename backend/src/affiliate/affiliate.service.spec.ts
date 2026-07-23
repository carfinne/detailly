import { BadRequestException } from '@nestjs/common';
import { AffiliateService } from './affiliate.service';

/** Baut den Service mit konfigurierbaren Repo-Mocks. */
function makeService(over: {
  codeFindOne?: any;
  codeSave?: any;
  referralFindOne?: any;
  referralFind?: any[];
  referralFindAndCount?: [any[], number];
  tenants?: { id: string; name: string }[];
} = {}) {
  const codeRepo: any = {
    findOne: jest.fn().mockResolvedValue('codeFindOne' in over ? over.codeFindOne : null),
    create: jest.fn((x: any) => x),
    save: over.codeSave ?? jest.fn(async (x: any) => ({ id: 'c1', ...x })),
  };
  const referralRepo: any = {
    findOne: jest.fn().mockResolvedValue('referralFindOne' in over ? over.referralFindOne : null),
    find: jest.fn().mockResolvedValue(over.referralFind ?? []),
    findAndCount: jest.fn().mockResolvedValue(over.referralFindAndCount ?? [[], 0]),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: 'r1', ...x })),
  };
  const tenantRepo: any = {
    find: jest.fn().mockResolvedValue(over.tenants ?? []),
  };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new AffiliateService(codeRepo, referralRepo, tenantRepo, audit);
  return { svc, codeRepo, referralRepo, tenantRepo, audit };
}

// ---------------------------------------------------------------------------
// ensureCode – Eindeutigkeit + Kollisionsfestigkeit
// ---------------------------------------------------------------------------
describe('AffiliateService · ensureCode', () => {
  it('liefert den bestehenden Code (kein Neu-Anlegen)', async () => {
    const { svc, codeRepo } = makeService({ codeFindOne: { id: 'c1', tenantId: 't1', code: 'ABCD2345' } });
    const res = await svc.ensureCode('t1');
    expect(res.code).toBe('ABCD2345');
    expect(codeRepo.save).not.toHaveBeenCalled();
  });

  it('erzeugt einen neuen Code, wenn keiner existiert', async () => {
    const { svc, codeRepo } = makeService({ codeFindOne: null });
    const res = await svc.ensureCode('t1');
    expect(codeRepo.save).toHaveBeenCalledTimes(1);
    expect(res.tenantId).toBe('t1');
    expect(typeof res.code).toBe('string');
    expect(res.code).toHaveLength(8);
  });

  it('bei Code-Kollision (UNIQUE) wird mit neuem Code erneut versucht', async () => {
    const save = jest
      .fn()
      .mockRejectedValueOnce(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: referral_codes.code'))
      .mockImplementationOnce(async (x: any) => ({ id: 'c1', ...x }));
    // findOne: erst null (kein Bestand), dann null (kein tenantId-Race) -> neuer Code.
    const { svc, codeRepo } = makeService({ codeSave: save });
    codeRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const res = await svc.ensureCode('t1');
    expect(save).toHaveBeenCalledTimes(2);
    expect(res.tenantId).toBe('t1');
  });

  it('bei tenantId-Race (UNIQUE) wird der inzwischen erzeugte Code zurueckgegeben', async () => {
    // Postgres-Unique-Verletzung wird ueber SQLSTATE 23505 erkannt (nicht ueber Text).
    const pgUnique = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    });
    const save = jest.fn().mockRejectedValueOnce(pgUnique);
    const { svc, codeRepo } = makeService({ codeSave: save });
    // 1) kein Bestand -> 2) nach der Kollision existiert der Code des Parallel-Aufrufs.
    codeRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'c9', tenantId: 't1', code: 'RACECODE' });
    const res = await svc.ensureCode('t1');
    expect(res.code).toBe('RACECODE');
    expect(save).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// attachReferral – Zuordnung + Anti-Missbrauch
// ---------------------------------------------------------------------------
describe('AffiliateService · attachReferral', () => {
  it('leerer/kein Code -> still verwerfen (keine Werbung, kein Audit)', async () => {
    const { svc, referralRepo, audit } = makeService();
    await svc.attachReferral('tNeu', '   ');
    await svc.attachReferral('tNeu', undefined);
    expect(referralRepo.save).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('gueltiger Code -> Werbung angelegt (referrer aus dem Code), Status registriert', async () => {
    const { svc, referralRepo, audit } = makeService({
      codeFindOne: { id: 'c1', tenantId: 'werber1', code: 'ABCD2345' },
      referralFindOne: null,
    });
    await svc.attachReferral('tNeu', 'abcd2345'); // wird normalisiert
    const created = referralRepo.create.mock.calls[0][0];
    expect(created).toMatchObject({
      referrerTenantId: 'werber1',
      referredTenantId: 'tNeu',
      code: 'ABCD2345',
      status: 'registriert',
      belohnungAnwartschaft: false,
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'affiliate.referred', tenantId: 'werber1' }),
    );
  });

  it('ungueltiger Code -> keine Werbung, aber Audit-Hinweis (kein Fehler)', async () => {
    const { svc, referralRepo, audit } = makeService({ codeFindOne: null });
    await expect(svc.attachReferral('tNeu', 'XXXXYYYY')).resolves.toBeUndefined();
    expect(referralRepo.save).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'affiliate.ref_invalid', tenantId: 'tNeu' }),
    );
  });

  it('Selbst-Werbung (Code-Inhaber == neuer Betrieb) wird geblockt', async () => {
    const { svc, referralRepo, audit } = makeService({
      codeFindOne: { id: 'c1', tenantId: 'tNeu', code: 'SELFCODE' },
    });
    await svc.attachReferral('tNeu', 'SELFCODE');
    expect(referralRepo.save).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'affiliate.ref_self_blocked', tenantId: 'tNeu' }),
    );
  });

  it('bereits geworbener Betrieb -> no-op (kein zweiter Datensatz)', async () => {
    const { svc, referralRepo } = makeService({
      codeFindOne: { id: 'c1', tenantId: 'werber1', code: 'ABCD2345' },
      referralFindOne: { id: 'r0', referredTenantId: 'tNeu' },
    });
    await svc.attachReferral('tNeu', 'ABCD2345');
    expect(referralRepo.save).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onReferredTenantBecamePaying – Belohnung nur bei Statuswechsel, idempotent
// ---------------------------------------------------------------------------
describe('AffiliateService · onReferredTenantBecamePaying', () => {
  it('geworbener Betrieb wird zahlend -> Anwartschaft verbucht (einmal)', async () => {
    const referral: any = { id: 'r1', referrerTenantId: 'werber1', referredTenantId: 'tNeu', status: 'registriert' };
    const { svc, referralRepo, audit } = makeService({ referralFindOne: referral });
    await svc.onReferredTenantBecamePaying('tNeu');
    const saved = referralRepo.save.mock.calls[0][0];
    expect(saved.status).toBe('zahlend');
    expect(saved.belohnungAnwartschaft).toBe(true);
    expect(saved.belohnungTyp).toBe('monat_basic');
    expect(saved.zahlendSeit).toBeInstanceOf(Date);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'affiliate.reward_earned', tenantId: 'werber1' }),
    );
  });

  it('idempotent: bereits zahlend -> keine zweite Gutschrift', async () => {
    const referral: any = { id: 'r1', referrerTenantId: 'werber1', referredTenantId: 'tNeu', status: 'zahlend' };
    const { svc, referralRepo, audit } = makeService({ referralFindOne: referral });
    await svc.onReferredTenantBecamePaying('tNeu');
    expect(referralRepo.save).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('nicht geworbener Betrieb -> no-op', async () => {
    const { svc, referralRepo } = makeService({ referralFindOne: null });
    await svc.onReferredTenantBecamePaying('tFremd');
    expect(referralRepo.save).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getMyView – strikte Isolation (nur eigene Werbungen)
// ---------------------------------------------------------------------------
describe('AffiliateService · getMyView', () => {
  it('scopet die Werbungen hart auf den eigenen Betrieb (referrerTenantId)', async () => {
    const referrals = [
      { referredTenantId: 'a', status: 'zahlend', belohnungTyp: 'monat_basic', belohnungAnwartschaft: true, createdAt: new Date(), zahlendSeit: new Date() },
      { referredTenantId: 'b', status: 'registriert', belohnungTyp: null, belohnungAnwartschaft: false, createdAt: new Date(), zahlendSeit: null },
    ];
    const { svc, referralRepo } = makeService({
      codeFindOne: { id: 'c1', tenantId: 't1', code: 'ABCD2345' },
      referralFind: referrals,
      tenants: [{ id: 'a', name: 'Betrieb A' }, { id: 'b', name: 'Betrieb B' }],
    });
    const view = await svc.getMyView('t1');
    // Der WHERE-Filter MUSS referrerTenantId = eigener Tenant sein.
    expect(referralRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { referrerTenantId: 't1' } }),
    );
    expect(view.code).toBe('ABCD2345');
    expect(view.sharePath).toBe('/registrieren?ref=ABCD2345');
    expect(view.geworben).toBe(2);
    expect(view.zahlend).toBe(1);
    expect(view.anwartschaften).toBe(1);
    expect(view.empfehlungen[0].betrieb).toBe('Betrieb A');
  });

  it('ohne Betrieb im Kontext -> BadRequest (kein Leak)', async () => {
    const { svc } = makeService();
    await expect(svc.getMyView(null)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.getMyView(undefined)).rejects.toBeInstanceOf(BadRequestException);
  });
});
