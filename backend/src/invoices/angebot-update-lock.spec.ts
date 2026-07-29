import { ConflictException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { AngebotStatus, InvoiceKind, InvoiceStatus } from './entities/invoice.entity';

/**
 * GoBD-Nachvollziehbarkeit (Fix 3): ein ANGENOMMENES/umgewandeltes Angebot ist der
 * Beleg, aus dem ein Auftrag entstand -> unveraenderlich. Der Annahme-Zustand liegt
 * im SEPARATEN Feld angebotStatus (der InvoiceStatus eines Angebots bleibt ENTWURF).
 * Offene/Altbestand-Angebote bleiben editierbar. Unit-Test mit gemocktem Repository.
 */
function makeService(beleg: any) {
  const repo: any = {
    findOne: jest.fn().mockResolvedValue(beleg),
    save: jest.fn().mockImplementation((inv: any) => Promise.resolve(inv)),
    // Positionsaenderung laeuft ueber eine Transaktion (delete + save der Zeilen).
    manager: {
      transaction: jest.fn(async (cb: any) =>
        cb({
          delete: jest.fn().mockResolvedValue(undefined),
          save: jest.fn((inv: any) => Promise.resolve(inv)),
        }),
      ),
    },
  };
  // buildItems() ruft itemRepo.create(); Echo genuegt fuers Summen-/Audit-Verhalten.
  const itemRepo: any = { create: jest.fn((data: any) => ({ ...data })) };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new InvoicesService(
    repo, itemRepo, {} as any, {} as any, {} as any, audit,
    {} as any, {} as any, {} as any, {} as any,
  );
  // steuerConfig (tenant.settings) hier irrelevant -> deterministisch stubben.
  jest.spyOn(svc as any, 'steuerConfig').mockResolvedValue({ kleinunternehmer: false });
  return { svc, repo, audit };
}

const USER: any = { id: 'u1', tenantId: 't1' };

function angebotMit(angebotStatus: AngebotStatus | null) {
  return {
    id: 'ang1',
    tenantId: 't1',
    art: InvoiceKind.ANGEBOT,
    status: InvoiceStatus.ENTWURF, // Angebote bleiben rechnungsseitig ENTWURF
    angebotStatus,
    mwstSatz: 19,
    items: [],
  };
}

function rechnungMit(status: InvoiceStatus) {
  return {
    id: 're1',
    tenantId: 't1',
    art: InvoiceKind.RECHNUNG,
    status,
    angebotStatus: null,
    mwstSatz: 19,
    items: [],
  };
}

describe('InvoicesService · update (Angebots-Aenderungssperre)', () => {
  it('angenommenes Angebot -> ConflictException, kein Speichern', async () => {
    const { svc, repo } = makeService(angebotMit(AngebotStatus.ANGENOMMEN));
    await expect(svc.update(USER, 'ang1', { hinweis: 'x' } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('abgelehntes Angebot -> ConflictException, kein Speichern', async () => {
    const { svc, repo } = makeService(angebotMit(AngebotStatus.ABGELEHNT));
    await expect(svc.update(USER, 'ang1', { hinweis: 'x' } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('offenes Angebot bleibt editierbar -> repo.save aufgerufen', async () => {
    const { svc, repo } = makeService(angebotMit(AngebotStatus.OFFEN));
    await svc.update(USER, 'ang1', { hinweis: 'geaendert' } as any);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('Altbestand-Angebot (angebotStatus=NULL) bleibt editierbar', async () => {
    const { svc, repo } = makeService(angebotMit(null));
    await svc.update(USER, 'ang1', { hinweis: 'geaendert' } as any);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});

describe('InvoicesService · update (Rechnungs-Aenderungssperre, GoBD)', () => {
  it('Rechnung im Entwurf bleibt editierbar -> repo.save aufgerufen', async () => {
    const { svc, repo } = makeService(rechnungMit(InvoiceStatus.ENTWURF));
    await svc.update(USER, 're1', { hinweis: 'geaendert' } as any);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('festgesetzte (offene) Rechnung -> ConflictException, kein Speichern', async () => {
    const { svc, repo } = makeService(rechnungMit(InvoiceStatus.OFFEN));
    await expect(svc.update(USER, 're1', { hinweis: 'x' } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('bezahlte Rechnung -> ConflictException (unveraenderlich)', async () => {
    const { svc, repo } = makeService(rechnungMit(InvoiceStatus.BEZAHLT));
    await expect(svc.update(USER, 're1', { hinweis: 'x' } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('InvoicesService · update (Tenant-Isolation + Audit)', () => {
  it('laedt den Beleg strikt tenant-scoped (findOne mit tenantId)', async () => {
    const { svc, repo } = makeService(rechnungMit(InvoiceStatus.ENTWURF));
    await svc.update(USER, 're1', { hinweis: 'x' } as any);
    expect(repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 're1', tenantId: 't1' }) }),
    );
  });

  it('protokolliert die Aenderung mit itemsGeaendert-Flag (Positionsaenderung)', async () => {
    const { svc, audit } = makeService(rechnungMit(InvoiceStatus.ENTWURF));
    await svc.update(USER, 're1', {
      items: [{ beschreibung: 'Neu', menge: 1, einzelpreis: 10 }],
    } as any);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'Invoice',
        entityId: 're1',
        payload: expect.objectContaining({ itemsGeaendert: true }),
      }),
    );
  });
});
