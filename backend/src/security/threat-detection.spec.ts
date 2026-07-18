import { ThreatDetectionService } from './threat-detection.service';

/**
 * Baut einen Query-Builder-Mock, dessen getRawMany der Reihe nach die
 * uebergebenen Ergebnis-Saetze liefert (1. Aufruf = Login-Flut, 2. = Scan-Flut).
 */
function makeEventRepo(loginRows: any[], scanRows: any[]) {
  const getRawMany = jest
    .fn()
    .mockResolvedValueOnce(loginRows)
    .mockResolvedValueOnce(scanRows);
  const qb: any = {};
  for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy']) qb[m] = () => qb;
  qb.getRawMany = getRawMany;
  return { createQueryBuilder: jest.fn(() => qb) } as any;
}

function makeSut(opts: { loginRows?: any[]; scanRows?: any[]; alreadyBlocked?: boolean } = {}) {
  const eventRepo = makeEventRepo(opts.loginRows ?? [], opts.scanRows ?? []);
  const blocks = {
    hasActiveBlock: jest.fn(async () => opts.alreadyBlocked ?? false),
    block: jest.fn(async (i: any) => ({ id: 'b1', ...i })),
  };
  const events = { record: jest.fn() };
  const alerts = { notifyAutoBlock: jest.fn(async () => undefined) };
  const svc = new ThreatDetectionService(
    eventRepo,
    blocks as any,
    events as any,
    alerts as any,
  );
  return { svc, blocks, events, alerts };
}

describe('ThreatDetectionService – Auto-IP-Sperre (Schwellwerte, De-Dup)', () => {
  const OLD = process.env;
  beforeEach(() => {
    // Deterministische, kleine Schwellen fuer die Tests (5).
    process.env = {
      ...OLD,
      SENTINEL_LOGINFAIL_THRESHOLD: '5',
      SENTINEL_SCAN4XX_THRESHOLD: '5',
    };
  });
  afterEach(() => {
    process.env = OLD;
  });

  it('Fehl-Login-Serie GENAU an der Schwelle -> critical-Sperre + Betreiber-Alarm', async () => {
    const { svc, blocks, events, alerts } = makeSut({
      loginRows: [{ ip: '203.0.113.5', cnt: '5' }],
    });
    const neu = await svc.runDetection();
    expect(neu).toBe(1);
    expect(blocks.block).toHaveBeenCalledTimes(1);
    const arg = blocks.block.mock.calls[0][0];
    expect(arg.createdBy).toBe('system');
    expect(arg.severity).toBe('critical');
    expect(arg.expiresAt).toBeInstanceOf(Date); // IMMER befristet (TTL)
    // Sperr-Audit im Security-Event-Log + transaktionaler Alarm (kein Review-Gate).
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ip_block', severity: 'critical', ip: '203.0.113.5' }),
    );
    expect(alerts.notifyAutoBlock).toHaveBeenCalledTimes(1);
  });

  it('Fehl-Login-Serie UNTER der Schwelle -> KEINE Sperre', async () => {
    const { svc, blocks } = makeSut({ loginRows: [{ ip: '203.0.113.6', cnt: '4' }] });
    const neu = await svc.runDetection();
    expect(neu).toBe(0);
    expect(blocks.block).not.toHaveBeenCalled();
  });

  it('De-Dup: bereits aktiv gesperrte IP wird NICHT erneut gesperrt', async () => {
    const { svc, blocks, events } = makeSut({
      loginRows: [{ ip: '203.0.113.7', cnt: '99' }],
      alreadyBlocked: true,
    });
    const neu = await svc.runDetection();
    expect(neu).toBe(0);
    expect(blocks.block).not.toHaveBeenCalled();
    expect(events.record).not.toHaveBeenCalled();
  });

  it('4xx-Scan-Serie -> warn-Sperre OHNE Alarm-Mail', async () => {
    const { svc, blocks, alerts } = makeSut({ scanRows: [{ ip: '198.51.100.3', cnt: '8' }] });
    const neu = await svc.runDetection();
    expect(neu).toBe(1);
    expect(blocks.block.mock.calls[0][0].severity).toBe('warn');
    expect(alerts.notifyAutoBlock).not.toHaveBeenCalled();
  });

  it('mehrere IPs im selben Lauf: nur die ueber der Schwelle werden gesperrt', async () => {
    const { svc, blocks } = makeSut({
      loginRows: [
        { ip: 'a', cnt: '5' },
        { ip: 'b', cnt: '2' },
        { ip: 'c', cnt: '40' },
      ],
    });
    const neu = await svc.runDetection();
    expect(neu).toBe(2); // a + c, nicht b
    expect(blocks.block).toHaveBeenCalledTimes(2);
  });

  it('runDetection faengt Fehler ab (Timer-Lauf bricht nie)', async () => {
    const eventRepo = { createQueryBuilder: jest.fn(() => { throw new Error('db weg'); }) } as any;
    const svc = new ThreatDetectionService(
      eventRepo,
      { hasActiveBlock: jest.fn(), block: jest.fn() } as any,
      { record: jest.fn() } as any,
      undefined,
    );
    await expect(svc.runDetection()).resolves.toBe(0);
  });
});
