import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoiceKind, InvoiceStatus } from './entities/invoice.entity';

/**
 * Rechnungskorrektur (Stornorechnung / Vollstorno). Unit-Tests mit gemockten
 * Repositories. Schwerpunkte laut Ticket:
 *  - Test 1: Die Ursprungsrechnung bleibt UNANGETASTET (GoBD), Betraege werden
 *    exakt GESPIEGELT (nicht neu gerechnet).
 *  - Test 3: Zwei gleichzeitige Stornos erzeugen KEINE zwei Belege/Nummern
 *    (Doppelstorno-Guard + withUniqueRetry, Muster wie Kassenbuch).
 */

const USER: any = { id: 'u1', tenantId: 't1' };

function makeOriginal(over: Record<string, unknown> = {}): any {
  return {
    id: 'orig1',
    tenantId: 't1',
    nummer: 'RE-2026-0007',
    art: InvoiceKind.RECHNUNG,
    status: InvoiceStatus.OFFEN,
    customerId: 'c1',
    orderId: 'o1',
    datum: new Date('2026-03-01T10:00:00.000Z'),
    leistungsdatum: new Date('2026-03-01T10:00:00.000Z'),
    createdAt: new Date('2026-03-01T10:00:00.000Z'),
    netto: '100.00',
    mwst: '19.00',
    brutto: '119.00',
    mwstSatz: '19',
    stornoVonInvoiceId: null,
    storniertDurchInvoiceId: null,
    empfaengerName: null,
    empfaengerAnschrift: null,
    empfaengerVatNumber: null,
    items: [{ beschreibung: 'Politur', menge: '1', einzelpreis: '100.00', gesamtpreis: '100.00' }],
    ...over,
  };
}

function makeService(
  opts: {
    original?: any;
    existingStorno?: any; // Rueckgabe des bereits-Guards (parallele Storno-Anfrage)
    failSaveTimes?: number; // wirft n-mal UNIQUE, dann Erfolg
    countSequence?: number[]; // aufeinanderfolgende count()-Rueckgaben (Nummernkreis)
  } = {},
) {
  const original = opts.original ?? makeOriginal();
  const saved: any[] = [];
  const updateCalls: Array<{ where: any; patch: any }> = [];
  let saveCount = 0;
  let failsLeft = opts.failSaveTimes ?? 0;
  let countIdx = 0;
  const countSeq = opts.countSequence ?? [7];

  const repo: any = {
    findOne: jest.fn().mockImplementation((q: any) => {
      const w = q?.where ?? {};
      // bereits-Guard: { tenantId, stornoVonInvoiceId }
      if ('stornoVonInvoiceId' in w) return Promise.resolve(opts.existingStorno ?? null);
      // findOne(tenantId, id) fuer das Original
      if (w.id === original.id) return Promise.resolve(original);
      // finaler findOne(storno.id)
      return Promise.resolve(saved.find((s) => s.id === w.id) ?? null);
    }),
    count: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(countSeq[Math.min(countIdx++, countSeq.length - 1)]),
      ),
    create: jest.fn().mockImplementation((o: any) => ({ ...o })),
    save: jest.fn().mockImplementation((beleg: any) => {
      if (failsLeft > 0) {
        failsLeft--;
        return Promise.reject(
          new Error('UNIQUE constraint failed: invoices.tenantId, invoices.nummer'),
        );
      }
      const s = { ...beleg, id: beleg.id ?? `storno${++saveCount}` };
      saved.push(s);
      return Promise.resolve(s);
    }),
    update: jest.fn().mockImplementation((where: any, patch: any) => {
      updateCalls.push({ where, patch });
      if (where.id === original.id) Object.assign(original, patch);
      return Promise.resolve({ affected: 1 });
    }),
  };
  const itemRepo: any = { create: jest.fn().mockImplementation((o: any) => ({ ...o })) };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new InvoicesService(
    repo,
    itemRepo,
    {} as any,
    {} as any,
    {} as any,
    audit,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { svc, repo, itemRepo, audit, original, saved, updateCalls };
}

describe('InvoicesService · Rechnungskorrektur (Stornorechnung)', () => {
  // --- Test 1 (Kernanforderung GoBD) ---------------------------------------
  it('Original bleibt unveraendert; Storno-Beleg spiegelt die Betraege exakt', async () => {
    const { svc, saved, updateCalls, original, repo } = makeService();
    const before = {
      netto: original.netto,
      mwst: original.mwst,
      brutto: original.brutto,
      nummer: original.nummer,
      status: original.status,
      items: JSON.parse(JSON.stringify(original.items)),
    };

    await svc.erstelleStornorechnung(USER, 'orig1');

    const storno = saved[0];
    // Eigener Beleg, eigene RE-Nummer (gleicher Kreis), tenant-scoped, BEZAHLT.
    expect(storno.tenantId).toBe('t1');
    expect(storno.art).toBe(InvoiceKind.RECHNUNG);
    expect(storno.status).toBe(InvoiceStatus.BEZAHLT);
    expect(storno.zahldatum).toBeInstanceOf(Date);
    expect(storno.nummer).toMatch(/^RE-\d{4}-0008$/);
    expect(storno.stornoVonInvoiceId).toBe('orig1');
    expect(storno.hinweis).toContain('Storno zu Rechnung RE-2026-0007');
    // Betraege GESPIEGELT (exakte Negative).
    expect(Number(storno.netto)).toBe(-100);
    expect(Number(storno.mwst)).toBe(-19);
    expect(Number(storno.brutto)).toBe(-119);
    expect(storno.items[0].menge).toBe(1);
    expect(storno.items[0].einzelpreis).toBe(-100);
    expect(storno.items[0].gesamtpreis).toBe(-100);

    // Original: nichts ausser dem Rueckverweis veraendert – KEIN Status-Flip.
    expect(original.netto).toBe(before.netto);
    expect(original.mwst).toBe(before.mwst);
    expect(original.brutto).toBe(before.brutto);
    expect(original.nummer).toBe(before.nummer);
    expect(original.status).toBe(before.status);
    expect(original.status).not.toBe(InvoiceStatus.STORNIERT);
    expect(original.items).toEqual(before.items);
    expect(original.storniertDurchInvoiceId).toBe(storno.id);

    // Rueckverweis-Update ist tenant-scoped + konditional (Race-Schutz).
    const ptr = updateCalls.find((c) => 'storniertDurchInvoiceId' in c.patch);
    expect(ptr?.where.id).toBe('orig1');
    expect(ptr?.where.tenantId).toBe('t1');
    expect(ptr?.where.storniertDurchInvoiceId).toBeDefined(); // IsNull()-Operator

    // bereits-Guard-Suche ist tenant-scoped.
    const guardCall = repo.findOne.mock.calls.find(
      (c: any[]) => c[0]?.where && 'stornoVonInvoiceId' in c[0].where,
    );
    expect(guardCall?.[0].where).toEqual({ tenantId: 't1', stornoVonInvoiceId: 'orig1' });
  });

  // --- Test 3 (Nebenlaeufigkeit / Doppelstorno) ----------------------------
  it('Nummern-Kollision: withUniqueRetry zieht die naechste freie RE-Nummer', async () => {
    const { svc, saved, repo } = makeService({ failSaveTimes: 1, countSequence: [7, 8] });
    await svc.erstelleStornorechnung(USER, 'orig1');
    expect(repo.save).toHaveBeenCalledTimes(2); // 1x Kollision + 1x Erfolg
    expect(saved).toHaveLength(1);
    expect(saved[0].nummer).toMatch(/^RE-\d{4}-0009$/);
  });

  it('Doppel-Storno: bereits korrigiertes Original -> 409 (Vorab-Guard)', async () => {
    const { svc, repo } = makeService({
      original: makeOriginal({ storniertDurchInvoiceId: 'stornoX' }),
    });
    await expect(svc.erstelleStornorechnung(USER, 'orig1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('Doppel-Storno: parallele Anfrage hat bereits storniert (bereits-Guard) -> 409', async () => {
    const { svc, repo } = makeService({ existingStorno: { id: 'stornoX' } });
    await expect(svc.erstelleStornorechnung(USER, 'orig1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('Doppel-Storno: Unique-Verletzung ueberlebt alle Retries -> 409 (partieller Index)', async () => {
    const { svc } = makeService({ failSaveTimes: 99 });
    await expect(svc.erstelleStornorechnung(USER, 'orig1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  // --- Guards ---------------------------------------------------------------
  it('Guard: Angebot kann nicht storniert werden -> 400', async () => {
    const { svc } = makeService({ original: makeOriginal({ art: InvoiceKind.ANGEBOT }) });
    await expect(svc.erstelleStornorechnung(USER, 'orig1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('Guard: Rechnungs-Entwurf ohne Nummer -> 400 (verwerfen statt stornieren)', async () => {
    const { svc } = makeService({
      original: makeOriginal({ status: InvoiceStatus.ENTWURF, nummer: null }),
    });
    await expect(svc.erstelleStornorechnung(USER, 'orig1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('Guard: ein Storno-Beleg kann nicht selbst storniert werden -> 400', async () => {
    const { svc } = makeService({ original: makeOriginal({ stornoVonInvoiceId: 'orig0' }) });
    await expect(svc.erstelleStornorechnung(USER, 'orig1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  // --- §19 (Kleinunternehmer, 0 % MwSt) ------------------------------------
  it('§19-Beleg (0 % MwSt): Storno spiegelt mwst 0 (kein -0), brutto = -netto', async () => {
    const { svc, saved } = makeService({
      original: makeOriginal({
        mwst: '0.00',
        brutto: '100.00',
        mwstSatz: '0',
        items: [{ beschreibung: 'X', menge: '1', einzelpreis: '100.00', gesamtpreis: '100.00' }],
      }),
    });
    await svc.erstelleStornorechnung(USER, 'orig1');
    const storno = saved[0];
    expect(Number(storno.netto)).toBe(-100);
    expect(Number(storno.mwst)).toBe(0);
    expect(Object.is(storno.mwst, -0)).toBe(false); // -0 normalisiert auf +0
    expect(Number(storno.brutto)).toBe(-100);
    expect(Number(storno.mwstSatz)).toBe(0);
  });

  // --- Mandantentrennung ----------------------------------------------------
  it('Mandantentrennung: fremder Tenant -> NotFound (findOne tenant-scoped)', async () => {
    const { svc, repo } = makeService();
    repo.findOne.mockImplementation((q: any) => {
      const w = q?.where ?? {};
      if ('stornoVonInvoiceId' in w) return Promise.resolve(null);
      return Promise.resolve(null); // Beleg gehoert nicht zum Tenant -> nichts gefunden
    });
    await expect(
      svc.erstelleStornorechnung({ id: 'u1', tenantId: 'anderer' } as any, 'orig1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('InvoicesService · Folge-Guards fuer korrigierte Rechnungen', () => {
  function svcWith(stored: any) {
    const repo: any = { findOne: jest.fn().mockResolvedValue(stored), save: jest.fn() };
    const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = new InvoicesService(
      repo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      audit,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return { svc, repo };
  }

  it('markPaid: korrigierte Rechnung -> 409, kein save', async () => {
    const { svc, repo } = svcWith(makeOriginal({ storniertDurchInvoiceId: 'stornoX' }));
    await expect(svc.markPaid(USER, 'orig1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('changeStatus: Beleg einer Rechnungskorrektur (Storno-Beleg) -> 409', async () => {
    const { svc } = svcWith(makeOriginal({ stornoVonInvoiceId: 'orig0' }));
    await expect(svc.changeStatus(USER, 'x', InvoiceStatus.STORNIERT)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('mahnliste: schliesst korrigierte Rechnungen aus (storniertDurchInvoiceId IS NULL)', async () => {
    const repo: any = { find: jest.fn().mockResolvedValue([]) };
    const svc = new InvoicesService(
      repo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await svc.mahnliste('t1');
    const arg = repo.find.mock.calls[0][0];
    expect(arg.where.tenantId).toBe('t1');
    expect(arg.where.status).toBe(InvoiceStatus.OFFEN);
    expect(arg.where.storniertDurchInvoiceId).toBeDefined(); // IsNull()-Operator
  });
});
