import { NotFoundException } from '@nestjs/common';
import { PlatformCockpitService } from './platform-cockpit.service';

/** Chainable QueryBuilder-Stub. Nur die im Service genutzten Methoden. */
function chainQb(result: {
  manyAndCount?: [any[], number];
  rawMany?: any[];
  many?: any[];
}): any {
  const o: any = {};
  for (const m of [
    'select', 'addSelect', 'where', 'andWhere', 'innerJoin', 'leftJoin',
    'groupBy', 'addGroupBy', 'orderBy', 'skip', 'take',
  ]) {
    o[m] = () => o;
  }
  o.getManyAndCount = jest.fn().mockResolvedValue(result.manyAndCount ?? [[], 0]);
  o.getRawMany = jest.fn().mockResolvedValue(result.rawMany ?? []);
  o.getMany = jest.fn().mockResolvedValue(result.many ?? []);
  return o;
}

function repoStub(over: any = {}) {
  return {
    createQueryBuilder: jest.fn(() => chainQb({})),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    ...over,
  };
}

function makeService(over: any = {}) {
  const audit = over.audit ?? { log: jest.fn().mockResolvedValue(undefined) };
  const tenant = repoStub(over.tenant);
  const user = repoStub(over.user);
  const sub = repoStub(over.sub);
  const plan = repoStub(over.plan);
  const order = repoStub(over.order);
  const invoice = repoStub(over.invoice);
  const auditRepo = repoStub(over.auditRepo);
  const ticket = repoStub(over.ticket);
  const dealer = repoStub(over.dealer);
  const svc = new PlatformCockpitService(
    tenant, user, sub, plan, order, invoice, auditRepo, ticket, dealer, audit as any,
  );
  return { svc, audit, tenant, user, sub, plan, order, invoice, auditRepo, ticket, dealer };
}

const ACTOR: any = { id: 'admin1', email: 'a@detailly.de', role: 'platform_admin', tenantId: 'plat' };

describe('PlatformCockpitService · listTenants', () => {
  it('paginiert + reichert #Nutzer und Abo-Summary an', async () => {
    const tenant = {
      createQueryBuilder: jest.fn(() =>
        chainQb({
          manyAndCount: [
            [{ id: 't1', name: 'Muster', slug: 'muster', email: 'm@x.de', city: 'Berlin', betriebstyp: 'komplett', status: 'active', createdAt: new Date('2026-01-01') }],
            1,
          ],
        }),
      ),
    };
    const user = { createQueryBuilder: jest.fn(() => chainQb({ rawMany: [{ tenantId: 't1', anzahl: '3' }] })) };
    const sub = { createQueryBuilder: jest.fn(() => chainQb({ rawMany: [{ tenantId: 't1', status: 'active', planName: 'Pro', planSlug: 'pro' }] })) };
    const { svc } = makeService({ tenant, user, sub });

    const r = await svc.listTenants({});
    expect(r.total).toBe(1);
    expect(r.limit).toBe(25);
    expect(r.data[0]).toMatchObject({
      id: 't1', ort: 'Berlin', nutzerAnzahl: 3,
      abo: { status: 'active', tarif: 'Pro', tarifSlug: 'pro' },
    });
  });

  it('deckelt limit hart (max 100)', async () => {
    const tenant = { createQueryBuilder: jest.fn(() => chainQb({ manyAndCount: [[], 0] })) };
    const { svc } = makeService({ tenant });
    const r = await svc.listTenants({ limit: '9999', offset: '-5' });
    expect(r.limit).toBe(100);
    expect(r.offset).toBe(0);
  });

  it('leere Trefferseite: keine IN()-Query auf leerer ID-Liste', async () => {
    const tenant = { createQueryBuilder: jest.fn(() => chainQb({ manyAndCount: [[], 0] })) };
    const user = { createQueryBuilder: jest.fn() };
    const sub = { createQueryBuilder: jest.fn() };
    const { svc } = makeService({ tenant, user, sub });
    const r = await svc.listTenants({});
    expect(r.data).toEqual([]);
    expect(user.createQueryBuilder).not.toHaveBeenCalled();
    expect(sub.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe('PlatformCockpitService · getTenantDetail', () => {
  it('WHITELIST: liefert KEINE Secrets (settings/sevdeskApiToken/passwordHash/totpSecret)', async () => {
    const tenant = {
      findOne: jest.fn().mockResolvedValue({
        id: 't1', name: 'Muster', slug: 'muster', street: 'Weg 1', city: 'Berlin', postalCode: '10115',
        country: 'DE', betriebstyp: 'komplett', status: 'active', createdAt: new Date('2026-01-01'),
        // absichtlich mitgegeben, um das Strippen zu beweisen:
        settings: { iban: 'DE00', steuernummer: '123' }, sevdeskApiToken: 'TOK', smtpPassword: 'PW',
      }),
    };
    const user = {
      find: jest.fn().mockResolvedValue([
        { id: 'u1', firstName: 'Max', lastName: 'Muster', email: 'm@x.de', role: 'owner', isActive: true, lastLoginAt: new Date('2026-02-01'), passwordHash: 'HASH', totpSecret: 'SECRET', recoveryCodes: ['r1'] },
      ]),
    };
    const order = { count: jest.fn().mockResolvedValue(5) };
    const invoice = { count: jest.fn().mockResolvedValue(2) };
    const sub = { findOne: jest.fn().mockResolvedValue({ status: 'active', planId: 'p1', trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, canceledAt: null, notiz: 'intern' }) };
    const plan = { findOne: jest.fn().mockResolvedValue({ name: 'Pro', slug: 'pro', preisMonatlich: '49.00' }) };
    const { svc, audit } = makeService({ tenant, user, order, invoice, sub, plan });

    const r = await svc.getTenantDetail(ACTOR, 't1');

    expect(r.profil).toMatchObject({ id: 't1', postalCode: '10115', betriebstyp: 'komplett' });
    expect(r.nutzung).toEqual({ auftraege: 5, belege: 2 });
    expect(r.abo).toMatchObject({ tarif: 'Pro', preisMonatlich: 49, notiz: 'intern' });
    expect(r.nutzer[0]).toEqual({ id: 'u1', name: 'Max Muster', email: 'm@x.de', rolle: 'owner', aktiv: true, letzterLogin: new Date('2026-02-01') });

    // Kein Secret irgendwo in der Antwort.
    const blob = JSON.stringify(r);
    for (const leak of ['passwordHash', 'HASH', 'totpSecret', 'SECRET', 'recoveryCodes', 'settings', 'sevdeskApiToken', 'TOK', 'smtpPassword', 'iban', 'steuernummer']) {
      expect(blob).not.toContain(leak);
    }

    // DSGVO-Rechenschaft: Zugriff protokolliert.
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'platform.viewTenant', tenantId: 't1', userId: 'admin1' }));
  });

  it('unbekannter Betrieb -> 404', async () => {
    const tenant = { findOne: jest.fn().mockResolvedValue(null) };
    const { svc } = makeService({ tenant });
    await expect(svc.getTenantDetail(ACTOR, 'weg')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PlatformCockpitService · lookupUsers', () => {
  it('unter 3 Zeichen: kein Query, kein Audit, leere Liste', async () => {
    const user = { createQueryBuilder: jest.fn() };
    const { svc, audit } = makeService({ user });
    const r = await svc.lookupUsers(ACTOR, 'ab');
    expect(r).toEqual({ data: [] });
    expect(user.createQueryBuilder).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('findet Nutzer -> Betrieb, MINIMALE Projektion (keine Secrets), protokolliert', async () => {
    const user = {
      createQueryBuilder: jest.fn(() =>
        chainQb({ many: [{ id: 'u1', email: 'max@x.de', firstName: 'Max', lastName: 'M', role: 'owner', isActive: true, tenantId: 't1', passwordHash: 'HASH', totpSecret: 'SECRET' }] }),
      ),
    };
    const tenant = { find: jest.fn().mockResolvedValue([{ id: 't1', name: 'Muster', slug: 'muster' }]) };
    const { svc, audit } = makeService({ user, tenant });

    const r = await svc.lookupUsers(ACTOR, 'max@');
    expect(r.data[0]).toEqual({ id: 'u1', email: 'max@x.de', name: 'Max M', rolle: 'owner', aktiv: true, betrieb: { id: 't1', name: 'Muster', slug: 'muster' } });
    const blob = JSON.stringify(r);
    for (const leak of ['passwordHash', 'HASH', 'totpSecret', 'SECRET']) expect(blob).not.toContain(leak);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'platform.viewUserLookup', payload: { query: 'max@', treffer: 1 } }));
  });
});

describe('PlatformCockpitService · locations', () => {
  it('aggregiert je 2-stelliger Leitregion + Typ-Split, ohne volle PLZ', async () => {
    const tenant = {
      createQueryBuilder: jest.fn(() =>
        chainQb({
          rawMany: [
            { region: '10', betriebstyp: 'komplett', anzahl: '2' },
            { region: '10', betriebstyp: 'folierung', anzahl: '1' },
            { region: '80', betriebstyp: 'ppf', anzahl: '1' },
          ],
        }),
      ),
    };
    const { svc } = makeService({ tenant });
    const r = await svc.locations();

    const r10 = r.find((x) => x.region === '10')!;
    expect(r10.anzahl).toBe(3);
    expect(r10.typen.komplett).toBe(2);
    expect(r10.typen.folierung).toBe(1);
    expect(r.find((x) => x.region === '80')!.anzahl).toBe(1);

    // Datensparsam: nur 2-stellige Region, nirgends eine volle 5-stellige PLZ.
    for (const item of r) expect(item.region.length).toBeLessThanOrEqual(2);
    expect(JSON.stringify(r)).not.toMatch(/\d{5}/);
  });
});

describe('PlatformCockpitService · live', () => {
  it('zaehlt Testphasen-Ende (7 Tage), aktive Nutzer (24h), offene Tickets + KYB', async () => {
    const sub = { count: jest.fn().mockResolvedValue(4) };
    const user = { count: jest.fn().mockResolvedValue(12) };
    const ticket = { count: jest.fn().mockResolvedValue(3) };
    const dealer = { count: jest.fn().mockResolvedValue(1) };
    const { svc } = makeService({ sub, user, ticket, dealer });
    const r = await svc.live();
    expect(r).toEqual({ testphasenEndenIn7Tagen: 4, aktiveNutzer24h: 12, offeneSupportTickets: 3, offeneKybBewerbungen: 1 });
  });
});

describe('PlatformCockpitService · readAudit', () => {
  it('deckelt limit hart (max 200) und filtert nach action/tenantId', async () => {
    const auditRepo = { findAndCount: jest.fn().mockResolvedValue([[{ id: 'a1' }], 1]) };
    const { svc } = makeService({ auditRepo });
    const r = await svc.readAudit({ limit: '9999', action: 'platform.viewTenant', tenantId: 't1' });
    expect(r.limit).toBe(200);
    expect(r.total).toBe(1);
    expect(auditRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { action: 'platform.viewTenant', tenantId: 't1' }, take: 200, skip: 0 }),
    );
  });
});
