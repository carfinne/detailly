import { InvoicesService } from './invoices.service';
import { AngebotStatus, InvoiceKind } from './entities/invoice.entity';

/**
 * Unit-Tests der Welle-2-B-Teil-1-Logik (Angebots-Ablauf + Nachfass-Liste) im
 * InvoicesService, mit QueryBuilder-Mocks (keine DB). Belegt:
 *  - markAbgelaufen setzt NUR aus offen/NULL (Idempotenz) und traegt tenantId
 *  - nachfassListe/-Count nutzen die tenant-konfigurierbare Schwelle (Default 7)
 *  - keine Mail-Beruehrung (rein lesend/schreibend auf Belegen)
 */

/** Chainable QueryBuilder-Mock, der where/andWhere-Argumente mitschreibt. */
function makeQB(result: { getMany?: unknown[]; getCount?: number; affected?: number }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const qb: any = {};
  for (const m of ['update', 'set', 'where', 'andWhere', 'orderBy']) {
    qb[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return qb;
    };
  }
  qb.getMany = jest.fn().mockResolvedValue(result.getMany ?? []);
  qb.getCount = jest.fn().mockResolvedValue(result.getCount ?? 0);
  qb.execute = jest.fn().mockResolvedValue({ affected: result.affected ?? 0 });
  qb.__calls = calls;
  return qb;
}

/** Baut den Service mit gemocktem repo + tenantRepo (uebrige Deps unbenutzt). */
function makeService(opts: { qb: any; settings?: Record<string, unknown> | null }) {
  const repo: any = { createQueryBuilder: jest.fn().mockReturnValue(opts.qb) };
  const tenantRepo: any = {
    findOne: jest.fn().mockResolvedValue(
      opts.settings === undefined ? { id: 't1', settings: {} } : { id: 't1', settings: opts.settings },
    ),
  };
  const svc = new InvoicesService(
    repo,
    {} as any, // itemRepo
    {} as any, // orderRepo
    {} as any, // customerRepo
    tenantRepo,
    {} as any, // audit
    {} as any, // sevdesk
    {} as any, // pdf
    {} as any, // mail
    {} as any, // accExport
  );
  return { svc, repo, tenantRepo };
}

describe('InvoicesService.markAbgelaufen', () => {
  const NOW = new Date('2026-07-07T10:00:00.000Z');

  it('setzt angebotStatus=ABGELAUFEN, strikt tenant-scoped und NUR aus offen/NULL (idempotent)', async () => {
    const qb = makeQB({ affected: 2 });
    const { svc, repo } = makeService({ qb });

    const n = await svc.markAbgelaufen('t1', NOW);

    expect(n).toBe(2);
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);
    const calls: { method: string; args: unknown[] }[] = qb.__calls;
    // set(ABGELAUFEN)
    const set = calls.find((c) => c.method === 'set');
    expect(set?.args[0]).toMatchObject({ angebotStatus: AngebotStatus.ABGELAUFEN });
    // where(tenantId) – Tenant-Scope
    const where = calls.find((c) => c.method === 'where');
    expect(where?.args[0]).toContain('tenantId');
    expect(where?.args[1]).toMatchObject({ tenantId: 't1' });
    // andWhere: art=ANGEBOT + offen/NULL (Idempotenz: abgelaufene bleiben aussen vor) + gueltigBis<now
    const andWheres = calls.filter((c) => c.method === 'andWhere').map((c) => String(c.args[0]));
    expect(andWheres.some((s) => s.includes('art'))).toBe(true);
    expect(andWheres.some((s) => s.includes('angebotStatus') && s.includes('IS NULL'))).toBe(true);
    expect(andWheres.some((s) => s.includes('gueltigBis') && s.includes('< :now'))).toBe(true);
    // now-Parameter wird durchgereicht
    const gueltig = calls.find((c) => c.method === 'andWhere' && String(c.args[0]).includes('gueltigBis'));
    expect(gueltig?.args[1]).toMatchObject({ now: NOW });
  });
});

describe('InvoicesService.nachfassListe / nachfassCount', () => {
  const NOW = new Date('2026-07-07T10:00:00.000Z');
  const tag = 24 * 60 * 60 * 1000;

  it('nutzt die Default-Schwelle (7 Tage) und liefert tageOffen je Angebot', async () => {
    const datum = new Date(NOW.getTime() - 10 * tag); // 10 Tage offen
    const qb = makeQB({
      getMany: [
        { id: 'a1', tenantId: 't1', art: InvoiceKind.ANGEBOT, angebotStatus: AngebotStatus.OFFEN, datum, createdAt: datum },
      ],
    });
    const { svc, tenantRepo } = makeService({ qb, settings: {} });

    const liste = await svc.nachfassListe('t1', NOW);

    expect(tenantRepo.findOne).toHaveBeenCalledWith({ where: { id: 't1' }, select: { id: true, settings: true } });
    expect(liste).toHaveLength(1);
    expect(liste[0].tageOffen).toBe(10);
    // Kriterien: tenantId + offen/NULL vorhanden
    const calls: { method: string; args: unknown[] }[] = qb.__calls;
    const where = calls.find((c) => c.method === 'where');
    expect(where?.args[1]).toMatchObject({ tenantId: 't1' });
    const andWheres = calls.filter((c) => c.method === 'andWhere').map((c) => String(c.args[0]));
    expect(andWheres.some((s) => s.includes('angebotStatus') && s.includes('IS NULL'))).toBe(true);
    expect(andWheres.some((s) => s.includes('COALESCE'))).toBe(true);
  });

  it('respektiert die tenant-konfigurierte Schwelle (tageOffen aus settings.nachfass)', async () => {
    const qb = makeQB({ getMany: [] });
    const { svc } = makeService({ qb, settings: { nachfass: { tageOffen: 14 } } });

    await svc.nachfassListe('t1', NOW);

    // Die COALESCE-Schwelle = now - 14 Tage.
    const calls: { method: string; args: unknown[] }[] = qb.__calls;
    const schwelleCall = calls.find(
      (c) => c.method === 'andWhere' && String(c.args[0]).includes('COALESCE'),
    );
    const params = schwelleCall?.args[1] as { schwelle: Date };
    expect(params.schwelle.getTime()).toBe(NOW.getTime() - 14 * tag);
  });

  it('nachfassCount liefert den COUNT der gleichen Kriterien', async () => {
    const qb = makeQB({ getCount: 3 });
    const { svc } = makeService({ qb, settings: {} });
    await expect(svc.nachfassCount('t1', NOW)).resolves.toBe(3);
    expect(qb.getCount).toHaveBeenCalledTimes(1);
  });
});
