import { NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { AngebotStatus } from './entities/invoice.entity';

/**
 * Welle 1 (F2): oeffentliche Angebots-Freigabe per Token. Unit-Test mit gemockten
 * Repositories. Schwerpunkt: kein Fremd-Tenant-Leak (Gruppe strikt tenant+Gruppe scoped).
 */
function makeService(over: { findOneImpl?: any; find?: any[]; tenant?: any } = {}) {
  const repo: any = {
    findOne: over.findOneImpl ? jest.fn().mockImplementation(over.findOneImpl) : jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue(over.find ?? []),
  };
  const tenantRepo: any = { findOne: jest.fn().mockResolvedValue(over.tenant ?? null) };
  const svc = new InvoicesService(
    repo, {} as any, {} as any, {} as any, tenantRepo, { log: jest.fn() } as any,
    {} as any, {} as any, {} as any, {} as any,
  );
  return { svc, repo };
}

const VALID = 'a'.repeat(48);

describe('InvoicesService · oeffentliche Angebots-Gruppe per Token', () => {
  it.each(['', 'abc', 'ZZZ', '../x'])('unplausibles Token "%s" -> 404 ohne DB', async (bad) => {
    const { svc, repo } = makeService();
    await expect(svc.angebotGruppeByToken(bad)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('unbekanntes Token -> 404', async () => {
    const { svc } = makeService({ findOneImpl: () => Promise.resolve(null) });
    await expect(svc.angebotGruppeByToken(VALID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('Gruppe wird STRIKT ueber tenantId + varianteGruppeId geladen (kein Fremd-Tenant-Leak)', async () => {
    const { svc, repo } = makeService({
      findOneImpl: () => Promise.resolve({ id: 'i1', tenantId: 't1', varianteGruppeId: 'g1' }),
      find: [
        {
          id: 'i1', nummer: 'AN-2026-0001', varianteLabel: 'Voll', angebotStatus: AngebotStatus.OFFEN,
          istGewaehlt: false, gueltigBis: new Date(Date.now() + 86400000),
          netto: '2000', mwst: '380', brutto: '2380', items: [{ beschreibung: 'x', menge: 1, einzelpreis: 2000, gesamtpreis: 2000 }],
        },
      ],
      tenant: { id: 't1', name: 'Muster GmbH' },
    });
    const res = await svc.angebotGruppeByToken(VALID);

    expect(res.betrieb).toBe('Muster GmbH');
    expect(res.varianten).toHaveLength(1);
    expect(res.varianten[0].nummer).toBe('AN-2026-0001');
    // Der Gruppen-Load ist auf den Tenant DES TREFFERS + dessen Gruppe beschraenkt.
    const where = repo.find.mock.calls[0][0].where;
    expect(where.tenantId).toBe('t1');
    expect(where.varianteGruppeId).toBe('g1');
    // Keine sensiblen Felder in der oeffentlichen Ansicht.
    for (const verboten of ['customerId', 'tenantId', 'angebotToken', 'hinweis']) {
      expect(res.varianten[0]).not.toHaveProperty(verboten);
    }
  });
});

describe('InvoicesService · oeffentliche Annahme per Token', () => {
  it('invoiceId aus fremdem Tenant/ausserhalb der Gruppe -> 404, kein Accept', async () => {
    // Treffer liefert Tenant t1; die Ziel-Suche (tenantId=t1 + Token) findet die
    // fremde invoiceId NICHT -> 404, acceptAngebotCore wird nie erreicht.
    const findOneImpl = (opts: any) =>
      opts?.where?.id ? Promise.resolve(null) : Promise.resolve({ id: 'i1', tenantId: 't1', varianteGruppeId: 'g1' });
    const { svc } = makeService({ findOneImpl });
    const core = jest.spyOn(svc as any, 'acceptAngebotCore').mockResolvedValue({ id: 'ord' } as any);

    await expect(svc.acceptAngebotByToken(VALID, 'fremde-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(core).not.toHaveBeenCalled();
  });

  it('gueltige Variante der Token-Gruppe -> acceptAngebotCore(tenantId aus Token, zielId)', async () => {
    const findOneImpl = (opts: any) =>
      opts?.where?.id
        ? Promise.resolve({ id: 'i2', tenantId: 't1' })
        : Promise.resolve({ id: 'i1', tenantId: 't1', varianteGruppeId: 'g1' });
    const { svc } = makeService({ findOneImpl });
    const core = jest.spyOn(svc as any, 'acceptAngebotCore').mockResolvedValue({ id: 'ord-neu' } as any);

    const res = await svc.acceptAngebotByToken(VALID, 'i2');
    expect(res).toEqual({ id: 'ord-neu' });
    expect(core).toHaveBeenCalledWith('t1', 'i2');
  });
});

describe('InvoicesService · Angebot-Token konditional erzeugen (F4/Finding 4)', () => {
  const USER: any = { id: 'u1', tenantId: 't1' };

  function makeTokenService(inv: any, nach: any) {
    const repo: any = {
      findOne: jest.fn().mockResolvedValueOnce(inv).mockResolvedValueOnce(nach),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const svc = new InvoicesService(
      repo, {} as any, {} as any, {} as any, {} as any, { log: jest.fn() } as any,
      {} as any, {} as any, {} as any, {} as any,
    );
    return { svc, repo };
  }

  it('setzt Token nur WHERE angebotToken IS NULL (ganze Gruppe) und liefert den re-gelesenen Wert', async () => {
    const { svc, repo } = makeTokenService(
      { id: 'i1', art: 'angebot', varianteGruppeId: 'g1', angebotToken: null },
      { id: 'i1', angebotToken: 'RE_READ_TOKEN' },
    );
    const res = await svc.getOrCreateAngebotToken(USER, 'i1');

    // Re-Read gewinnt (konsistenter Gruppen-Token, egal wer geschrieben hat).
    expect(res.token).toBe('RE_READ_TOKEN');
    // Konditionales Update: Gruppen-scoped + angebotToken IS NULL.
    const where = repo.update.mock.calls[0][0];
    expect(where.tenantId).toBe('t1');
    expect(where.varianteGruppeId).toBe('g1');
    expect(where).toHaveProperty('angebotToken'); // IsNull()-Operator
    // Neuer Token ist >= 32 Hex-Zeichen (Entropie-Vorgabe).
    expect(repo.update.mock.calls[0][1].angebotToken).toMatch(/^[a-f0-9]{48}$/);
  });

  it('vorhandenes Gruppen-Token wird ohne Neuschreiben zurueckgegeben', async () => {
    const { svc, repo } = makeTokenService(
      { id: 'i1', art: 'angebot', varianteGruppeId: 'g1', angebotToken: 'b'.repeat(48) },
      null,
    );
    const res = await svc.getOrCreateAngebotToken(USER, 'i1');
    expect(res.token).toBe('b'.repeat(48));
    expect(repo.update).not.toHaveBeenCalled();
  });
});
