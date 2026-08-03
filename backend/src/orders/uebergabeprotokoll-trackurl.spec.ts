import { OrdersService } from './orders.service';

/**
 * getUebergabeprotokollTrackUrl: der Verfolgungs-Link fuer den QR-Code auf dem
 * Uebergabeprotokoll. Kern-Garantien:
 *  - exakte /track/-URL aus Basis-URL + Token (gleiches Format wie die Status-Mail),
 *  - IDEMPOTENZ: mehrfaches Erzeugen des Protokolls liefert denselben Token –
 *    ein Neu-Ausdruck entwertet nie einen bereits verteilten QR-/Mail-Link.
 * Reine Unit-Tests mit gemockten Repos (kein DB-Zugriff).
 */
function makeSvc(repo: any, config?: any): OrdersService {
  return new OrdersService(
    repo,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any /* Invoice */,
    {} as any /* audit */,
    { send: jest.fn() } as any /* mail */,
    (config ?? { get: () => undefined }) as any /* config */,
    {} as any /* subscriptions */,
    {} as any /* inspection */,
    {} as any /* damageItem */,
  );
}

describe('OrdersService · getUebergabeprotokollTrackUrl', () => {
  it('baut die exakte /track/-URL aus Basis-URL + Token (Trailing-Slash normalisiert)', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'o1', freigabeToken: 'f00dcafef00dcafe' }),
      update: jest.fn(),
    };
    const svc = makeSvc(repo, { get: (k: string) => (k === 'APP_URL' ? 'https://app.detailly.de/' : undefined) });
    const url = await svc.getUebergabeprotokollTrackUrl('t1', 'o1');
    expect(url).toBe('https://app.detailly.de/track/?t=f00dcafef00dcafe');
  });

  it('vorhandenes Token: mehrfaches Erzeugen liefert denselben Link, NIE ein neues Token', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'o1', freigabeToken: 'abc123deadbeef99' }),
      update: jest.fn(),
    };
    const svc = makeSvc(repo);
    const u1 = await svc.getUebergabeprotokollTrackUrl('t1', 'o1');
    const u2 = await svc.getUebergabeprotokollTrackUrl('t1', 'o1');
    const u3 = await svc.getUebergabeprotokollTrackUrl('t1', 'o1');

    expect(u1).toBe('http://localhost:3000/track/?t=abc123deadbeef99');
    expect(u2).toBe(u1);
    expect(u3).toBe(u1);
    // Kein Neu-Ausdruck darf ein Token neu schreiben.
    expect(repo.update).not.toHaveBeenCalled();
    // Token-Lookup strikt tenant-scoped.
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'o1', tenantId: 't1' },
      select: ['id', 'freigabeToken'],
    });
  });

  it('ohne Token: erzeugt EINMAL eins und behaelt es bei jedem weiteren Erzeugen', async () => {
    let stored: string | null = null;
    const repo = {
      findOne: jest.fn(async () => ({ id: 'o1', freigabeToken: stored })),
      update: jest.fn(async (_where: any, patch: any) => {
        stored = patch.freigabeToken;
        return { affected: 1 };
      }),
    };
    const svc = makeSvc(repo);

    const u1 = await svc.getUebergabeprotokollTrackUrl('t1', 'o1');
    expect(u1).toMatch(/^http:\/\/localhost:3000\/track\/\?t=[a-f0-9]{48}$/);
    expect(repo.update).toHaveBeenCalledTimes(1);

    const u2 = await svc.getUebergabeprotokollTrackUrl('t1', 'o1');
    const u3 = await svc.getUebergabeprotokollTrackUrl('t1', 'o1');
    expect(u2).toBe(u1);
    expect(u3).toBe(u1);
    // Nach der ersten Erzeugung NIE wieder ein Schreibvorgang -> Link bleibt stabil.
    expect(repo.update).toHaveBeenCalledTimes(1);
  });
});
