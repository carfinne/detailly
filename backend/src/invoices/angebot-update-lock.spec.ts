import { ConflictException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { AngebotStatus, InvoiceKind, InvoiceStatus } from './entities/invoice.entity';

/**
 * GoBD-Nachvollziehbarkeit (Fix 3): ein ANGENOMMENES/umgewandeltes Angebot ist der
 * Beleg, aus dem ein Auftrag entstand -> unveraenderlich. Der Annahme-Zustand liegt
 * im SEPARATEN Feld angebotStatus (der InvoiceStatus eines Angebots bleibt ENTWURF).
 * Offene/Altbestand-Angebote bleiben editierbar. Unit-Test mit gemocktem Repository.
 */
function makeService(angebot: any) {
  const repo: any = {
    findOne: jest.fn().mockResolvedValue(angebot),
    save: jest.fn().mockImplementation((inv: any) => Promise.resolve(inv)),
  };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new InvoicesService(
    repo, {} as any, {} as any, {} as any, {} as any, audit,
    {} as any, {} as any, {} as any, {} as any,
  );
  // steuerConfig (tenant.settings) hier irrelevant -> deterministisch stubben.
  jest.spyOn(svc as any, 'steuerConfig').mockResolvedValue({ kleinunternehmer: false });
  return { svc, repo };
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

describe('InvoicesService · update (Angebots-Aenderungssperre)', () => {
  it('angenommenes Angebot -> ConflictException, kein Speichern', async () => {
    const { svc, repo } = makeService(angebotMit(AngebotStatus.ANGENOMMEN));
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
