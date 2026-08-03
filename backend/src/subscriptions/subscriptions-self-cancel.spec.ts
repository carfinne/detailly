import { Logger, ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionStatus } from './entities/subscription.entity';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Selbstkuendigung mit Halte-Ablauf. Fokus:
 *  - Kuendigung setzt die Felder korrekt und sperrt NICHT sofort.
 *  - Ruecknahme (reactivate) funktioniert.
 *  - Gratismonat wird genau EINMAL gewaehrt – auch bei zwei gleichzeitigen Klicks.
 *  - Ein zweiter Kuendigungsversuch bekommt kein Angebot mehr angezeigt.
 *  - Nur OWNER darf kuendigen (RolesGuard liest die echte @Roles-Metadata).
 *  - Fehlende tenantId wird hart abgewiesen (kein betriebsuebergreifender Scan).
 *
 * Reine Repo-Mocks (kein Nest-Bootstrap): der Service memoisiert ohne Request-Scope
 * transparent ueber die DB (Fallback), daher genuegen jest-Mocks.
 */
const OWNER: AuthUser = { id: 'u1', email: 'chef@betrieb.de', role: 'owner', tenantId: 't1' };

function makeSvc(opts: { sub?: any; support?: any } = {}) {
  const planRepo = { findOne: jest.fn().mockResolvedValue(null), find: jest.fn() };
  const subRepo = opts.sub ?? { findOne: jest.fn(), save: jest.fn((s) => Promise.resolve(s)) };
  if (!subRepo.save) subRepo.save = jest.fn((s: any) => Promise.resolve(s));
  const tenantRepo = { find: jest.fn(), findOne: jest.fn() };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new SubscriptionsService(
    planRepo as any,
    subRepo as any,
    tenantRepo as any,
    audit as any,
    undefined, // affiliate (optional) -> notifyAffiliatePaying = no-op
    opts.support as any, // support (optional)
  );
  return { svc, planRepo, subRepo, audit };
}

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterAll(() => jest.restoreAllMocks());

describe('SubscriptionsService – Selbstkuendigung', () => {
  it('kuendigt zum Laufzeitende und sperrt NICHT sofort (Status bleibt ACTIVE, Zugang full)', async () => {
    const inEinemMonat = new Date(Date.now() + 30 * 864e5);
    const sub: any = {
      id: 's1',
      tenantId: 't1',
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: inEinemMonat,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      halteangebotGenutztAt: null,
    };
    const subRepo = { findOne: jest.fn().mockResolvedValue(sub), save: jest.fn((s: any) => Promise.resolve(s)) };
    const { svc } = makeSvc({ sub: subRepo });

    const view = await svc.cancelSelf(OWNER, {});

    // Felder korrekt gesetzt ...
    expect(sub.cancelAtPeriodEnd).toBe(true);
    expect(sub.canceledAt).toBeInstanceOf(Date);
    // ... aber NICHT sofort gesperrt: Status unberuehrt, Zugang bleibt voll.
    expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
    expect(view?.access.access).toBe('full');
    expect(view?.cancelAtPeriodEnd).toBe(true);
  });

  it('speichert den freiwilligen Grund am Abo (Kategorie + Freitext)', async () => {
    const sub: any = { id: 's1', tenantId: 't1', status: SubscriptionStatus.ACTIVE, cancelAtPeriodEnd: false, canceledAt: null, halteangebotGenutztAt: null };
    const subRepo = { findOne: jest.fn().mockResolvedValue(sub), save: jest.fn((s: any) => Promise.resolve(s)) };
    const { svc } = makeSvc({ sub: subRepo });

    await svc.cancelSelf(OWNER, { grundKategorie: 'zu_teuer', grundText: '  zu teuer fuer uns  ' });

    expect(sub.kuendigungGrundKategorie).toBe('zu_teuer');
    expect(sub.kuendigungGrundText).toBe('zu teuer fuer uns'); // getrimmt
  });

  it('leerer Body kuendigt OHNE Grund (Grund ist freiwillig)', async () => {
    const sub: any = { id: 's1', tenantId: 't1', status: SubscriptionStatus.ACTIVE, cancelAtPeriodEnd: false, canceledAt: null };
    const subRepo = { findOne: jest.fn().mockResolvedValue(sub), save: jest.fn((s: any) => Promise.resolve(s)) };
    const { svc } = makeSvc({ sub: subRepo });

    await svc.cancelSelf(OWNER, {});

    expect(sub.cancelAtPeriodEnd).toBe(true);
    expect(sub.kuendigungGrundKategorie).toBeUndefined();
    expect(sub.kuendigungGrundText).toBeUndefined();
  });

  it('als loesbar markiert -> Support-Ticket im bestehenden Kanal (best-effort)', async () => {
    const sub: any = { id: 's1', tenantId: 't1', status: SubscriptionStatus.ACTIVE, cancelAtPeriodEnd: false, canceledAt: null };
    const subRepo = { findOne: jest.fn().mockResolvedValue(sub), save: jest.fn((s: any) => Promise.resolve(s)) };
    const support = { createTicket: jest.fn().mockResolvedValue({ id: 'tk1' }) };
    const { svc } = makeSvc({ sub: subRepo, support });

    await svc.cancelSelf(OWNER, { grundText: 'Import klappt nicht', alsSupportAnfrage: true });

    expect(support.createTicket).toHaveBeenCalledTimes(1);
    const [user, dto] = support.createTicket.mock.calls[0];
    expect(user).toBe(OWNER);
    expect(dto.kategorie).toBe('problem');
    expect(dto.text).toBe('Import klappt nicht');
  });

  it('ohne Support-Flag entsteht KEIN Ticket', async () => {
    const sub: any = { id: 's1', tenantId: 't1', status: SubscriptionStatus.ACTIVE, cancelAtPeriodEnd: false, canceledAt: null };
    const subRepo = { findOne: jest.fn().mockResolvedValue(sub), save: jest.fn((s: any) => Promise.resolve(s)) };
    const support = { createTicket: jest.fn() };
    const { svc } = makeSvc({ sub: subRepo, support });

    await svc.cancelSelf(OWNER, { grundText: 'nur ein Hinweis' });

    expect(support.createTicket).not.toHaveBeenCalled();
  });

  it('fehlende tenantId wird hart abgewiesen (403, kein Voll-Scan)', async () => {
    const { svc, subRepo } = makeSvc();
    await expect(svc.cancelSelf({ ...OWNER, tenantId: '' } as any, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(subRepo.findOne).not.toHaveBeenCalled();
  });

  it('ohne Abo-Datensatz -> 404', async () => {
    const subRepo = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn() };
    const { svc } = makeSvc({ sub: subRepo });
    await expect(svc.cancelSelf(OWNER, {})).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SubscriptionsService – Ruecknahme der Kuendigung', () => {
  it('setzt cancelAtPeriodEnd=false und canceledAt=null zurueck', async () => {
    const sub: any = {
      id: 's1',
      tenantId: 't1',
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: true,
      canceledAt: new Date(),
    };
    const subRepo = { findOne: jest.fn().mockResolvedValue(sub), save: jest.fn((s: any) => Promise.resolve(s)) };
    const { svc } = makeSvc({ sub: subRepo });

    const view = await svc.reactivateSelf(OWNER);

    expect(sub.cancelAtPeriodEnd).toBe(false);
    expect(sub.canceledAt).toBeNull();
    expect(view?.cancelAtPeriodEnd).toBe(false);
  });
});

describe('SubscriptionsService – Halte-Angebot (Gratismonat, genau EINMAL)', () => {
  function subMitClaim() {
    const sub: any = {
      id: 's1',
      tenantId: 't1',
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: new Date(Date.now() + 5 * 864e5),
      currentPeriodStart: new Date(),
      cancelAtPeriodEnd: true,
      canceledAt: new Date(),
      halteangebotGenutztAt: null,
    };
    // Atomarer konditionaler Claim: der ERSTE Aufruf trifft die Zeile (affected=1),
    // jeder weitere sieht den Marker gesetzt (affected=0) – exakt die DB-Semantik.
    let claimed = false;
    const execute = jest.fn().mockImplementation(async () => {
      if (claimed) return { affected: 0 };
      claimed = true;
      return { affected: 1 };
    });
    const updateQb: any = { update: () => updateQb, set: () => updateQb, where: () => updateQb, andWhere: () => updateQb, execute };
    const subRepo = {
      findOne: jest.fn().mockResolvedValue(sub),
      save: jest.fn((s: any) => Promise.resolve(s)),
      createQueryBuilder: jest.fn().mockReturnValue(updateQb),
    };
    return { sub, subRepo, execute };
  }

  it('gewaehrt einen Monat, nimmt die Kuendigung zurueck und markiert den Rabatt als verbraucht', async () => {
    const { sub, subRepo } = subMitClaim();
    const altesEnde = new Date(sub.currentPeriodEnd).getTime();
    const { svc } = makeSvc({ sub: subRepo });

    await svc.redeemRetentionOffer(OWNER);

    expect(sub.halteangebotGenutztAt).toBeInstanceOf(Date);
    expect(sub.cancelAtPeriodEnd).toBe(false);
    expect(sub.canceledAt).toBeNull();
    expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
    // Laufzeit um ~1 Monat verlaengert (ab dem alten Ende).
    expect(new Date(sub.currentPeriodEnd).getTime()).toBeGreaterThan(altesEnde);
  });

  it('zwei gleichzeitige Klicks gewaehren NUR einen Monat (der zweite wird abgewiesen)', async () => {
    const { subRepo } = subMitClaim();
    const { svc } = makeSvc({ sub: subRepo });

    const [a, b] = await Promise.allSettled([
      svc.redeemRetentionOffer(OWNER),
      svc.redeemRetentionOffer(OWNER),
    ]);

    const erfuellt = [a, b].filter((r) => r.status === 'fulfilled');
    const abgelehnt = [a, b].filter((r) => r.status === 'rejected');
    expect(erfuellt).toHaveLength(1);
    expect(abgelehnt).toHaveLength(1);
    expect((abgelehnt[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    // Nur der Gewinner verlaengert -> genau EIN save().
    expect(subRepo.save).toHaveBeenCalledTimes(1);
  });

  it('bereits verbrauchtes Angebot (halteangebotGenutztAt gesetzt) -> 409', async () => {
    const { subRepo, execute } = subMitClaim();
    execute.mockResolvedValue({ affected: 0 }); // Marker war schon gesetzt
    const { svc } = makeSvc({ sub: subRepo });
    await expect(svc.redeemRetentionOffer(OWNER)).rejects.toBeInstanceOf(ConflictException);
    expect(subRepo.save).not.toHaveBeenCalled();
  });
});

describe('SubscriptionsService – Angebots-Sichtbarkeit (halteangebotVerfuegbar)', () => {
  it('nie genutzt -> Angebot verfuegbar; verbraucht -> kein zweites Angebot', async () => {
    const frisch: any = { id: 's1', tenantId: 't1', status: SubscriptionStatus.ACTIVE, halteangebotGenutztAt: null };
    let { svc } = makeSvc({ sub: { findOne: jest.fn().mockResolvedValue(frisch), save: jest.fn() } });
    expect((await svc.getMyView('t1'))?.halteangebotVerfuegbar).toBe(true);

    const verbraucht: any = { id: 's1', tenantId: 't1', status: SubscriptionStatus.ACTIVE, halteangebotGenutztAt: new Date() };
    ({ svc } = makeSvc({ sub: { findOne: jest.fn().mockResolvedValue(verbraucht), save: jest.fn() } }));
    expect((await svc.getMyView('t1'))?.halteangebotVerfuegbar).toBe(false);
  });
});

describe('Selbstkuendigung – nur OWNER (RolesGuard liest die echte @Roles-Metadata)', () => {
  const guard = new RolesGuard(new Reflector());
  function ctx(handler: any, role: UserRole) {
    return {
      getHandler: () => handler,
      getClass: () => SubscriptionsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role, tenantId: 't1', id: 'u1' }, url: '/x', method: 'POST' }) }),
    } as any;
  }

  it('MANAGER darf NICHT kuendigen, OWNER schon; platform_admin passiert generell', () => {
    const handler = SubscriptionsController.prototype.cancelSelf;
    expect(guard.canActivate(ctx(handler, UserRole.MANAGER))).toBe(false);
    expect(guard.canActivate(ctx(handler, UserRole.TECHNICIAN))).toBe(false);
    expect(guard.canActivate(ctx(handler, UserRole.OWNER))).toBe(true);
    expect(guard.canActivate(ctx(handler, UserRole.PLATFORM_ADMIN))).toBe(true);
  });

  it('gilt auch fuer Ruecknahme und Halte-Angebot', () => {
    expect(guard.canActivate(ctx(SubscriptionsController.prototype.reactivateSelf, UserRole.MANAGER))).toBe(false);
    expect(guard.canActivate(ctx(SubscriptionsController.prototype.reactivateSelf, UserRole.OWNER))).toBe(true);
    expect(guard.canActivate(ctx(SubscriptionsController.prototype.redeemRetentionOffer, UserRole.RECEPTIONIST))).toBe(false);
    expect(guard.canActivate(ctx(SubscriptionsController.prototype.redeemRetentionOffer, UserRole.OWNER))).toBe(true);
  });
});
