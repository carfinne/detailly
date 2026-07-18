import { IncidentDetectionService } from './incident-detection.service';
import { DETECTION } from './incident.constants';

/**
 * Erkennungs-Auswerter (Signal 1-3): Schwellwerte, De-dup-Delegation und
 * Fehler-Resilienz. Reiner Unit-Test mit gemocktem Audit-Repository (QueryBuilder)
 * und gemocktem IncidentsService.
 *
 * getRawMany wird in fester Reihenfolge aufgerufen:
 *   1) Export gesamt, 2) Voll-Export, 3) Login-Fehlschlaege, 4) 403-Haeufung.
 */
describe('IncidentDetectionService.runDetection', () => {
  const NOW = new Date('2026-07-16T12:00:00.000Z');

  function makeAuditRepo(queued: Array<Array<{ tenantId: string; cnt: string | number }>>) {
    let i = 0;
    const qb: Record<string, unknown> = {};
    for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy']) {
      qb[m] = () => qb;
    }
    qb.getRawMany = async () => queued[i++] ?? [];
    return { createQueryBuilder: () => qb } as never;
  }

  function makeSvc(
    queued: Array<Array<{ tenantId: string; cnt: string | number }>>,
    upsert = jest.fn().mockResolvedValue({ created: true, incident: {} }),
  ) {
    const svc = new IncidentDetectionService(makeAuditRepo(queued), { upsertAutoIncident: upsert } as never);
    return { svc, upsert };
  }

  it('legt Export-Spike-Vorfall an, wenn > Schwelle (11 > 10)', async () => {
    const { svc, upsert } = makeSvc([[{ tenantId: 't1', cnt: 11 }], [], [], []]);
    const neu = await svc.runDetection(NOW);
    expect(neu).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', signalTyp: 'export_spike', beobachtet: 11 }),
    );
  });

  it('legt KEINEN Vorfall an, wenn Export genau auf der Schwelle liegt (10 nicht > 10)', async () => {
    const { svc, upsert } = makeSvc([[{ tenantId: 't1', cnt: DETECTION.export.schwelle }], [], [], []]);
    const neu = await svc.runDetection(NOW);
    expect(neu).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('erkennt Voll-Export-Spike separat (> vollSchwelle) und dokumentiert den Voll-Count', async () => {
    // Gesamt 5 (<10), aber 4 Voll-Exporte (>3) -> Vorfall. Dokumentierte Zahl =
    // der Ausloesegrund = vollCnt (4), NICHT der Gesamt-Count (5).
    const { svc, upsert } = makeSvc([[{ tenantId: 't2', cnt: 5 }], [{ tenantId: 't2', cnt: 4 }], [], []]);
    const neu = await svc.runDetection(NOW);
    expect(neu).toBe(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ signalTyp: 'export_spike', beobachtet: 4 }),
    );
  });

  it('erkennt Login-Brute-Force ab Schwelle (einzel-IP-fest, >= DETECTION.login.schwelle)', async () => {
    const { svc, upsert } = makeSvc([[], [], [{ tenantId: 't3', cnt: DETECTION.login.schwelle }], []]);
    const neu = await svc.runDetection(NOW);
    expect(neu).toBe(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't3',
        signalTyp: 'login_bruteforce',
        beobachtet: DETECTION.login.schwelle,
      }),
    );
  });

  it('ignoriert Login-Fehlschlaege unter der Schwelle', async () => {
    const { svc, upsert } = makeSvc([[], [], [{ tenantId: 't3', cnt: DETECTION.login.schwelle - 1 }], []]);
    expect(await svc.runDetection(NOW)).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('erkennt 403-Haeufung ab Schwelle (>= 15)', async () => {
    const { svc, upsert } = makeSvc([[], [], [], [{ tenantId: 't4', cnt: DETECTION.forbidden.schwelle }]]);
    const neu = await svc.runDetection(NOW);
    expect(neu).toBe(1);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ signalTyp: 'forbidden_spike' }));
  });

  it('zaehlt nur NEU angelegte Vorfaelle (De-dup: created=false -> 0)', async () => {
    const upsert = jest.fn().mockResolvedValue({ created: false, incident: {} });
    const { svc } = makeSvc([[{ tenantId: 't1', cnt: 50 }], [], [], []], upsert);
    const neu = await svc.runDetection(NOW);
    expect(upsert).toHaveBeenCalledTimes(1); // Signal wird gemeldet ...
    expect(neu).toBe(0); // ... aber kein NEUER Vorfall (bestehender aktualisiert)
  });

  it('faengt DB-Fehler ab und wirft nicht (Timer-Lauf darf nie brechen)', async () => {
    const repo = {
      createQueryBuilder: () => {
        throw new Error('db weg');
      },
    } as never;
    const svc = new IncidentDetectionService(repo, { upsertAutoIncident: jest.fn() } as never);
    await expect(svc.runDetection(NOW)).resolves.toBe(0);
  });
});
